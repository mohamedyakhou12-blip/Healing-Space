import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { validateCollection, validateDocId, sanitizeFirestoreData } from './db-security';

/**
 * Firestore utility functions with security validation.
 * All functions now validate collection names and sanitize data
 * through the db-security whitelist before interacting with Firestore.
 */

export async function getDocument(collection: string, id: string) {
  if (!adminDb) return null;
  validateCollection(collection);
  validateDocId(id);
  const doc = await adminDb.collection(collection).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function getDocuments(collection: string, filters?: Record<string, any>) {
  if (!adminDb) return [];
  validateCollection(collection);
  let query = adminDb.collection(collection) as any;
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      query = query.where(key, '==', value);
    });
  }
  const snapshot = await query.get();
  return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
}

export async function createDocument(collection: string, data: Record<string, any>) {
  if (!adminDb) return null;
  validateCollection(collection);
  const safeData = sanitizeFirestoreData(collection, data);
  const docRef = await adminDb.collection(collection).add({
    ...safeData,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { id: docRef.id, ...safeData };
}

export async function updateDocument(collection: string, id: string, data: Record<string, any>) {
  if (!adminDb) return null;
  validateCollection(collection);
  validateDocId(id);
  const safeData = sanitizeFirestoreData(collection, data);
  await adminDb.collection(collection).doc(id).update({
    ...safeData,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { id, ...safeData };
}

export async function deleteDocument(collection: string, id: string) {
  if (!adminDb) return;
  validateCollection(collection);
  validateDocId(id);
  await adminDb.collection(collection).doc(id).delete();
}

// Get or create user in Firestore
export async function getOrCreateUser(uid: string, email: string, name?: string, photoURL?: string) {
  if (!adminDb) return null;
  validateDocId(uid);
  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (userDoc.exists) {
    return { id: userDoc.id, ...userDoc.data() };
  }
  // Create new user with validated fields
  const newUser = {
    email,
    name: name || email.split('@')[0],
    avatar: photoURL || null,
    role: 'user',
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const safeData = sanitizeFirestoreData('users', newUser);
  await adminDb.collection('users').doc(uid).set(safeData);
  return { id: uid, ...safeData };
}
