/**
 * Firebase Storage initialization using the existing Admin SDK app.
 * Reuses the admin app already initialized in firebase-admin.ts.
 *
 * The storageBucket is configured during app initialization in firebase-admin.ts,
 * so we can use the default bucket without specifying a name.
 */
import { getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const ADMIN_APP_NAME = "healing-space-admin";

let _bucket: ReturnType<ReturnType<typeof getStorage>["bucket"]> | null = null;

/**
 * Get the Firebase Storage bucket from the already-initialized ADMIN app.
 * Uses the admin app (named "healing-space-admin") instead of the client SDK app.
 */
export function getStorageBucket() {
  if (_bucket) return _bucket;

  // Find the ADMIN app specifically (not the client SDK app)
  const adminApp = getApps().find((a) => a.name === ADMIN_APP_NAME);
  if (!adminApp) {
    throw new Error(
      "[Firebase Storage] Firebase admin app not initialized. " +
      "Ensure firebase-admin.ts is imported before this module."
    );
  }

  // Use the default bucket configured during admin app initialization.
  // The bucket name was set via the storageBucket option in initializeApp().
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (bucketName) {
    _bucket = getStorage(adminApp).bucket(bucketName);
  } else {
    // Fall back to the default bucket from the app config
    _bucket = getStorage(adminApp).bucket();
  }

  return _bucket;
}
