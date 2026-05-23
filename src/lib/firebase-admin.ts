import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import {
  getFirestore,
  Firestore,
  Timestamp,
  FieldValue,
} from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let adminApp: any;
let _firebaseReady = false;
let _initMethod: string = "unknown";
let _initError: string | null = null;
const ADMIN_APP_NAME = "healing-space-admin";

function getServiceAccount(): any {
  let sa: any = null;

  // Try FIREBASE_SERVICE_ACCOUNT_KEY - could be base64 or raw JSON
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    // First: try parsing as raw JSON (most common case)
    try {
      sa = JSON.parse(raw);
    } catch {
      // Not raw JSON - try base64 decoding
      try {
        const decoded = Buffer.from(raw, "base64").toString("utf-8");
        sa = JSON.parse(decoded);
      } catch (e) {
        console.error("[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON or base64");
      }
    }
  }

  // Fallback: try FIREBASE_SERVICE_ACCOUNT_JSON
  if (!sa && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      console.error("[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e);
    }
  }

  if (sa && sa.private_key) {
    // Fix PEM private key newlines
    // Vercel env vars may cause double-escaping: literal \n instead of newlines
    // PEM keys require actual newline characters between lines
    sa.private_key = sa.private_key
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r");
  }

  return sa;
}

function initializeAdmin() {
  if (adminApp) return;

  const existingApp = getApps().find((a) => a.name === ADMIN_APP_NAME);
  if (existingApp) {
    adminApp = existingApp;
    // Check if the existing app was properly initialized
    const sa = getServiceAccount();
    if (sa && sa.private_key && sa.private_key.includes("-----BEGIN")) {
      _firebaseReady = true;
      _initMethod = "service_account";
    }
    return;
  }

  const sa = getServiceAccount();

  if (sa && sa.private_key && sa.private_key.includes("-----BEGIN")) {
    try {
      adminApp = initializeApp(
        {
          credential: cert({
            projectId: sa.project_id,
            privateKey: sa.private_key,
            clientEmail: sa.client_email,
          }),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${sa.project_id}.firebasestorage.app`,
        },
        ADMIN_APP_NAME
      );
      _firebaseReady = true;
      _initMethod = "service_account";
      console.log("[Firebase Admin] Initialized with service account credentials.");
    } catch (e: any) {
      _initError = e?.message || String(e);
      console.error("[Firebase Admin] Failed to initialize with service account:", _initError);
      // Still create a minimal app so the server doesn't crash on import,
      // but API routes MUST check firebaseReady before using Firestore
      adminApp = initializeApp(
        { 
          projectId: sa.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "healing-space-5a76f",
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${sa.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "healing-space-5a76f"}.firebasestorage.app`,
        },
        ADMIN_APP_NAME
      );
      _initMethod = "fallback_unauthenticated";
    }
  } else {
    const reasons: string[] = [];
    if (!sa) reasons.push("no service account data found in env vars");
    else if (!sa.private_key) reasons.push("service account missing private_key");
    else if (!sa.private_key.includes("-----BEGIN")) reasons.push("service account private_key does not contain PEM header");
    _initError = reasons.join(", ");
    console.error("[Firebase Admin] CRITICAL: No valid Firebase service account configured!", _initError);
    console.error("[Firebase Admin] CRITICAL: All Firestore operations will FAIL. Set FIREBASE_SERVICE_ACCOUNT_KEY env var.");
    // Still create a minimal app so the server doesn't crash on import,
    // but API routes MUST check firebaseReady before using Firestore
    adminApp = initializeApp(
      { 
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "healing-space-5a76f",
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "healing-space-5a76f"}.firebasestorage.app`,
      },
      ADMIN_APP_NAME
    );
    _initMethod = "fallback_unauthenticated";
  }
}

// Initialize on import
initializeAdmin();

export const adminDb: Firestore = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);

export { Timestamp, FieldValue };

/** Whether Firebase Admin SDK was initialized WITH proper service account credentials. */
export const firebaseReady: boolean = _firebaseReady;

/** Returns a status object describing the Firebase Admin SDK initialization state. */
export function getFirebaseStatus() {
  return {
    ready: _firebaseReady,
    initMethod: _initMethod,
    initError: _initError,
    hasServiceAccountKey: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    hasServiceAccountJson: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    appName: ADMIN_APP_NAME,
  };
}
