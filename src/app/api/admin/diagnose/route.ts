import { NextRequest, NextResponse } from "next/server";
import { getFirebaseStatus, firebaseReady, adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";

export async function GET(request: NextRequest) {
  // Verify admin session first (primary auth)
  const sessionAdminId = await requireAdmin();
  if (!sessionAdminId) {
    return NextResponse.json({ error: "Unauthorized - admin session required" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // 1. Firebase Admin SDK initialization status
  const fbStatus = getFirebaseStatus();
  results.firebaseStatus = fbStatus;
  results.firebaseReady = firebaseReady;

  // 2. Firestore READ test from siteSettings
  try {
    const settings = await adminDb.collection("siteSettings").limit(1).get();
    results.firestoreRead = {
      success: true,
      docCount: settings.size,
      sample: settings.docs[0]?.data() ?? null,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    results.firestoreRead = {
      success: false,
      error: msg,
    };
  }

  // 3. Firestore WRITE test (write + delete)
  const testDocId = `__diag_test_${Date.now()}`;
  try {
    await adminDb.collection("siteSettings").doc(testDocId).set({
      key: "__diagnostic_test",
      value: "test",
      createdAt: new Date().toISOString(),
    });
    // Verify write
    const doc = await adminDb.collection("siteSettings").doc(testDocId).get();
    results.firestoreWrite = {
      success: doc.exists,
      writtenData: doc.data(),
    };
    // Cleanup
    await adminDb.collection("siteSettings").doc(testDocId).delete();
    results.firestoreWriteCleanup = { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    results.firestoreWrite = {
      success: false,
      error: msg,
    };
    // Try to cleanup anyway
    try {
      await adminDb.collection("siteSettings").doc(testDocId).delete();
      results.firestoreWriteCleanup = { success: true };
    } catch {
      results.firestoreWriteCleanup = { success: false };
    }
  }

  // 4. Check if admin code exists in DB (value redacted for security)
  try {
    const settings = await adminDb.collection("siteSettings")
      .where("key", "==", "admin_access_code")
      .limit(1)
      .get();
    results.adminCodeInDb = !settings.empty;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    results.adminCodeInDb = { error: msg };
  }

  results.adminCodeEnvSet = !!process.env.ADMIN_ACCESS_CODE;

  // 5. Environment variables check (redacted)
  results.envChecks = {
    FIREBASE_SERVICE_ACCOUNT_KEY: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    FIREBASE_SERVICE_ACCOUNT_JSON: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    ADMIN_ACCESS_CODE: !!process.env.ADMIN_ACCESS_CODE,
    DATABASE_URL: !!process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV || "not set",
  };

  return NextResponse.json({
    status: "diagnostic_complete",
    timestamp: new Date().toISOString(),
    ...results,
  });
}
