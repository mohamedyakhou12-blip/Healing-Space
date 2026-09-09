import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * FIREBASE CLIENT CONFIGURATION
 * These values are public-facing and restricted via Firebase Console rules.
 * Do NOT add sensitive server-only data here.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC0dHZ4Z1AkVeMlo21Y2e5MHF6hJkG6E48",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "healing-space-5a76f.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://healing-space-5a76f-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "healing-space-5a76f",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "healing-space-5a76f.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "873540723647",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:873540723647:web:e78a1edbe4fc249e61370a",
};

console.log(`[Firebase Client] Using project: ${firebaseConfig.projectId}`);

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;