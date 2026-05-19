/**
 * Shared normalizeDoc utility - extracted from db.ts to avoid circular imports.
 */

// Recursively convert all Firestore Timestamps to ISO strings in a document
export function normalizeDoc(doc: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(doc)) {
    if (val && typeof val === "object" && val.toDate) {
      // Firestore Timestamp
      result[key] = val.toDate().toISOString();
    } else if (Array.isArray(val)) {
      result[key] = val.map((item) =>
        item && typeof item === "object" && !Array.isArray(item) && item.toDate
          ? item.toDate().toISOString()
          : typeof item === "object" && item !== null && !Array.isArray(item)
            ? normalizeDoc(item)
            : item
      );
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      result[key] = normalizeDoc(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}
