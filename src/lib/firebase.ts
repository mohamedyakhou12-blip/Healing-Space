import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
} from "firebase/firestore";

// ═══════════════════════════════════════════════════════════════════════
//  FIREBASE CONFIGURATION — ENV VAR FIRST, HARDCODED FALLBACK
//
//  These values are NOT secrets — Firebase API keys are public-facing
//  and are restricted via Firebase Console rules, not by obscurity.
//
//  Priority:
//  1. NEXT_PUBLIC_FIREBASE_* env vars (set in Vercel)
//  2. Hardcoded fallback (healing-space-5a76f project)
//
//  CRITICAL: Client and server MUST use the same Firebase project.
//  Using env vars ensures consistency across the entire stack.
// ═══════════════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC0dHZ4Z1AkVeMlo21Y2e5MHF6hJkG6E48",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "healing-space-5a76f.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://healing-space-5a76f-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "healing-space-5a76f",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "healing-space-5a76f.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "873540723647",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:873540723647:web:e78a1edbe4fc249e61370a",
};

// Debug: Log which config is being used (helps diagnose auth issues)
if (typeof window !== "undefined") {
  const source = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "env vars" : "hardcoded fallback";
  console.log(`[Firebase Client] Config source: ${source}, project: ${firebaseConfig.projectId}`);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);

export default app;
