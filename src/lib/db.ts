import { adminDb, Timestamp, FieldValue } from "./firebase-admin";
import { normalizeDoc } from "./db-normalize";
import {
  validateCollection,
  validateDocId,
  validateWhereClauses,
  sanitizeFirestoreData,
  validateLimit,
} from "./db-security";

// Re-export for other modules that import from db.ts
export { normalizeDoc };

// ============================================================
// Utility helpers
// ============================================================

function toFirestoreDate(d?: string | Date | null): any {
  if (!d) return FieldValue.delete();
  const date = typeof d === "string" ? new Date(d) : d;
  return Timestamp.fromDate(date);
}

function fromFirestoreTimestamp(t: any): string {
  if (!t) return "";
  if (t.toDate) return t.toDate().toISOString();
  if (typeof t === "string") return t;
  if (typeof t === "number") return new Date(t).toISOString();
  return "";
}

function addTimestamps(data: Record<string, any>): Record<string, any> {
  return {
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

// ============================================================
// Generic CRUD helpers
// ============================================================

async function findAll(
  collection: string,
  orderBy?: string,
  orderDir: "asc" | "desc" = "desc"
): Promise<any[]> {
  validateCollection(collection);
  let ref: any = adminDb.collection(collection);
  if (orderBy) {
    ref = ref.orderBy(orderBy, orderDir);
  }
  const snap = await ref.get();
  return snap.docs.map((d) => normalizeDoc({ id: d.id, ...d.data() }));
}

async function findMany(
  collection: string,
  where: Array<[string, any, any]>,
  orderBy?: string,
  orderDir: "asc" | "desc" = "desc"
): Promise<any[]> {
  validateCollection(collection);
  const safeWhere = validateWhereClauses(collection, where);
  let ref: any = adminDb.collection(collection);
  const whereFields = new Set<string>();
  for (const [field, op, value] of safeWhere) {
    if (op === "==" && value === undefined) continue;
    ref = ref.where(field, op, value);
    whereFields.add(field);
  }

  // Firestore requires a composite index when filtering by one field
  // and ordering by a different field. To avoid this, we sort client-side
  // when orderBy field differs from any where field.
  const sortClientSide = orderBy && where.length > 0 && !whereFields.has(orderBy);
  if (orderBy && !sortClientSide) {
    ref = ref.orderBy(orderBy, orderDir);
  }

  const snap = await ref.get();
  const results = snap.docs.map((d) => normalizeDoc({ id: d.id, ...d.data() }));

  // Client-side sort when needed (avoids composite index requirement)
  if (sortClientSide && orderBy) {
    const dir = orderDir === "asc" ? 1 : -1;
    results.sort((a, b) => {
      const va = a[orderBy];
      const vb = b[orderBy];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  return results;
}

async function findUnique(
  collection: string,
  field: string,
  value: string
): Promise<any | null> {
  validateCollection(collection);
  const snap = await adminDb
    .collection(collection)
    .where(field, "==", value)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return normalizeDoc({ id: snap.docs[0].id, ...snap.docs[0].data() });
}

async function findById(
  collection: string,
  id: string
): Promise<any | null> {
  validateCollection(collection);
  validateDocId(id);
  const doc = await adminDb.collection(collection).doc(id).get();
  if (!doc.exists) return null;
  return normalizeDoc({ id: doc.id, ...doc.data() });
}

async function create(
  collection: string,
  data: Record<string, any>
): Promise<any> {
  validateCollection(collection);
  // Sanitize data against field whitelist and injection patterns
  const safeData = sanitizeFirestoreData(collection, data);
  const docRef = await adminDb
    .collection(collection)
    .add(addTimestamps(safeData));
  const doc = await docRef.get();
  return normalizeDoc({ id: doc.id, ...doc.data() });
}

async function createWithId(
  collection: string,
  id: string,
  data: Record<string, any>
): Promise<any> {
  validateCollection(collection);
  validateDocId(id);
  const safeData = sanitizeFirestoreData(collection, data);
  await adminDb
    .collection(collection)
    .doc(id)
    .set(addTimestamps(safeData));
  const doc = await adminDb.collection(collection).doc(id).get();
  return normalizeDoc({ id: doc.id, ...doc.data() });
}

async function updateById(
  collection: string,
  id: string,
  data: Record<string, any>
): Promise<any> {
  validateCollection(collection);
  validateDocId(id);
  const safeData = sanitizeFirestoreData(collection, data);
  await adminDb
    .collection(collection)
    .doc(id)
    .set({ ...safeData, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const doc = await adminDb.collection(collection).doc(id).get();
  return normalizeDoc({ id: doc.id, ...doc.data() });
}

async function deleteById(collection: string, id: string): Promise<void> {
  validateCollection(collection);
  validateDocId(id);
  await adminDb.collection(collection).doc(id).delete();
}

async function countAll(collection: string): Promise<number> {
  validateCollection(collection);
  const snap = await adminDb.collection(collection).count().get();
  return snap.data().count;
}

async function countWhere(
  collection: string,
  where: Array<[string, any, any]>
): Promise<number> {
  validateCollection(collection);
  const safeWhere = validateWhereClauses(collection, where);
  let ref: any = adminDb.collection(collection);
  for (const [field, op, value] of safeWhere) {
    ref = ref.where(field, op, value);
  }
  const snap = await ref.count().get();
  return snap.data().count;
}

// ============================================================
// Exported database interface (mirrors Prisma patterns)
// ============================================================

export const db = {
  // --- User ---
  user: {
    async findUnique({ where }: { where: { id?: string; email?: string; googleUid?: string } }) {
      if (where.id) return findById("users", where.id);
      if (where.email) return findUnique("users", "email", where.email);
      if (where.googleUid) return findUnique("users", "googleUid", where.googleUid);
      return null;
    },
    async findMany(opts?: { orderBy?: { createdAt?: string }; select?: any }) {
      const results = await findAll("users", "createdAt", "desc");
      if (opts?.select) {
        const enriched = await Promise.all(
          results.map(async (u) => {
            const selected: any = {};
            for (const key of Object.keys(opts.select)) {
              if (opts.select[key]) selected[key] = u[key];
              if (key === "_count") {
                selected._count = {};
                if (opts.select._count.subscriptions) {
                  const subs = await db.subscription.findMany({
                    where: { userId: u.id },
                  });
                  selected._count.subscriptions = subs.length;
                }
                if (opts.select._count.payments) {
                  const pays = await db.payment.findMany({
                    where: [["userId", "==", u.id]],
                  });
                  selected._count.payments = pays.length;
                }
              }
            }
            return selected;
          })
        );
        return enriched;
      }
      return results;
    },
    async create({ data }: { data: Record<string, any> }) {
      return create("users", data);
    },
    async update({
      where,
      data,
      select,
    }: {
      where: { id: string };
      data: Record<string, any>;
      select?: any;
    }) {
      const updated = await updateById("users", where.id, data);
      if (select) {
        const result: any = {};
        for (const key of Object.keys(select)) {
          if (select[key]) result[key] = updated[key];
        }
        return result;
      }
      return updated;
    },
    async count(opts?: { where?: any }) {
      if (opts?.where?.isActive !== undefined) {
        return countWhere("users", [["isActive", "==", opts.where.isActive]]);
      }
      return countAll("users");
    },
  },

  // --- Subscription ---
  subscription: {
    async findMany(opts?: {
      where?: Record<string, any>;
      orderBy?: { createdAt?: string };
    }) {
      const where: Array<[string, any, any]> = [];
      if (opts?.where?.userId) where.push(["userId", "==", opts.where.userId]);
      if (opts?.where?.status) where.push(["status", "==", opts.where.status]);
      if (opts?.where?.endDate) {
        where.push(["endDate", ">", new Date(opts.where.endDate.gt)]);
      }
      return findMany("subscriptions", where, "createdAt", "desc");
    },
    async create({ data }: { data: Record<string, any> }) {
      const firestoreData: any = { ...data };
      if (firestoreData.startDate)
        firestoreData.startDate = toFirestoreDate(firestoreData.startDate);
      if (firestoreData.endDate)
        firestoreData.endDate = toFirestoreDate(firestoreData.endDate);
      return create("subscriptions", firestoreData);
    },
    async update({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, any>;
    }) {
      return updateById("subscriptions", where.id, data);
    },
    async delete({ where }: { where: { id: string } }) {
      await deleteById("subscriptions", where.id);
    },
    async count(opts?: { where?: any }) {
      if (opts?.where?.status) {
        return countWhere("subscriptions", [["status", "==", opts.where.status]]);
      }
      return countAll("subscriptions");
    },
  },

  // --- Payment ---
  payment: {
    async findMany(opts?: {
      where?: Record<string, any>;
      orderBy?: { createdAt?: string };
      include?: any;
      take?: number;
    }) {
      const whereClauses: Array<[string, any, any]> = [];
      if (opts?.where?.userId) whereClauses.push(["userId", "==", opts.where.userId]);
      if (opts?.where?.status) whereClauses.push(["status", "==", opts.where.status]);

      // Build Firestore query without orderBy to avoid composite index requirement
      let ref: any = adminDb.collection("payments");
      const whereFields = new Set<string>();
      for (const [field, op, value] of whereClauses) {
        ref = ref.where(field, op, value);
        whereFields.add(field);
      }
      if (opts?.take) ref = ref.limit(opts.take);

      const snap = await ref.get();
      const payments = snap.docs.map((d) => normalizeDoc({ id: d.id, ...d.data() }));

      // Client-side sort: orderBy createdAt desc (different from where fields)
      if (!whereFields.has("createdAt")) {
        payments.sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta; // desc
        });
      }

      if (opts?.include?.user) {
        for (const payment of payments) {
          const user = await findById("users", payment.userId);
          if (user) {
            const selected: any = {};
            if (opts.include.user.select) {
              for (const key of Object.keys(opts.include.user.select)) {
                if (opts.include.user.select[key]) selected[key] = user[key];
              }
            } else {
              selected.id = user.id;
              selected.name = user.name;
              selected.email = user.email;
              selected.phone = user.phone;
            }
            payment.user = selected;
          }
        }
      }

      return payments;
    },
    async findUnique({ where }: { where: { id: string } }) {
      return findById("payments", where.id);
    },
    async create({ data }: { data: Record<string, any> }) {
      return create("payments", data);
    },
    async update({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, any>;
    }) {
      return updateById("payments", where.id, data);
    },
    async delete({ where }: { where: { id: string } }) {
      await deleteById("payments", where.id);
    },
    async count(opts?: { where?: any }) {
      if (opts?.where?.status) {
        return countWhere("payments", [["status", "==", opts.where.status]]);
      }
      return countAll("payments");
    },
  },

  // --- Course ---
  course: {
    async findMany(opts?: {
      orderBy?: { createdAt?: string };
      include?: any;
      limit?: number;
      status?: string;
    }) {
      let results = await findAll("courses", "createdAt", "desc");

      // Filter by status if specified (reduces data early)
      if (opts?.status) {
        results = results.filter((c: any) => c.status === opts.status);
      }

      // Apply limit early before expensive nested queries
      if (opts?.limit) {
        results = results.slice(0, opts.limit);
      }

      if (opts?.include?.chapters) {
        // Fetch chapters for ALL courses in parallel
        const chaptersResults = await Promise.all(
          results.map((course: any) =>
            findMany("courseChapters", [["courseId", "==", course.id]], "order", "asc")
          )
        );

        for (let i = 0; i < results.length; i++) {
          results[i].chapters = chaptersResults[i];
        }

        if (opts.include.chapters.include?.lessons) {
          // Fetch lessons for ALL chapters across ALL courses in parallel
          const allLessonsPromises = results.flatMap((course: any) =>
            course.chapters.map((chapter: any) =>
              findMany("courseLessons", [["chapterId", "==", chapter.id]], "order", "asc")
                .then((lessons: any) => ({ chapterId: chapter.id, lessons }))
            )
          );
          const allLessons = await Promise.all(allLessonsPromises);

          // Build a lookup map for quick chapter->lessons assignment
          const lessonsByChapter = new Map<string, any[]>();
          for (const { chapterId, lessons } of allLessons) {
            lessonsByChapter.set(chapterId, lessons);
          }
          for (const course of results) {
            for (const chapter of course.chapters) {
              chapter.lessons = lessonsByChapter.get(chapter.id) || [];
            }
          }
        }
      }

      if (opts?.include?._count) {
        const countSelect = opts.include._count === true ? { reviews: true, enrollments: true } : (opts.include._count?.select || {});
        // Run all count queries in parallel
        const countPromises = results.map((course: any) => {
          const counts: Record<string, Promise<number>> = {};
          if (countSelect.reviews) {
            counts.reviews = countWhere("reviews", [["courseId", "==", course.id]]);
          }
          if (countSelect.enrollments) {
            counts.enrollments = countWhere("courseProgress", [["courseId", "==", course.id]]);
          }
          return Promise.all(
            Object.entries(counts).map(([key, prom]) => prom.then(v => [key, v] as [string, number]))
          ).then(entries => {
            course._count = Object.fromEntries(entries);
          });
        });
        await Promise.all(countPromises);
      }

      return results;
    },
    async findUnique(opts: {
      where: { id: string };
      include?: any;
    }) {
      const course = await findById("courses", opts.where.id);
      if (!course) return null;

      if (opts?.include?.chapters) {
        course.chapters = await findMany(
          "courseChapters",
          [["courseId", "==", course.id]],
          "order",
          "asc"
        );
        if (opts.include.chapters.include?.lessons) {
          // Fetch lessons for all chapters in parallel
          const lessonsPromises = course.chapters.map((chapter: any) =>
            findMany("courseLessons", [["chapterId", "==", chapter.id]], "order", "asc")
          );
          const lessonsResults = await Promise.all(lessonsPromises);
          for (let i = 0; i < course.chapters.length; i++) {
            course.chapters[i].lessons = lessonsResults[i];
          }
        }
      }

      if (opts?.include?.reviews) {
        course.reviews = await db.review.findMany({
          where: [["courseId", "==", course.id]],
          includeUser: true,
        });
      }

      if (opts?.include?._count) {
        const countSelect = opts.include._count === true ? { enrollments: true } : (opts.include._count?.select || {});
        const countPromises: Promise<[string, number]>[] = [];
        if (countSelect.enrollments) {
          countPromises.push(
            countWhere("courseProgress", [["courseId", "==", course.id]])
              .then(v => ["enrollments", v] as [string, number])
          );
        }
        const entries = await Promise.all(countPromises);
        course._count = Object.fromEntries(entries);
      }

      return course;
    },
    async create({ data }: { data: Record<string, any> }) {
      return create("courses", data);
    },
    async update({
      where,
      data,
      include,
    }: {
      where: { id: string };
      data: Record<string, any>;
      include?: any;
    }) {
      await updateById("courses", where.id, data);
      return db.course.findUnique({ where, include });
    },
    async delete({ where }: { where: { id: string } }) {
      // Delete lessons first, then chapters, then course
      const chapters = await findMany("courseChapters", [
        ["courseId", "==", where.id],
      ]);
      for (const ch of chapters) {
        const lessons = await findMany("courseLessons", [
          ["chapterId", "==", ch.id],
        ]);
        for (const l of lessons) await deleteById("courseLessons", l.id);
        await deleteById("courseChapters", ch.id);
      }
      await deleteById("courses", where.id);
    },
    async count() {
      return countAll("courses");
    },
  },

  // --- CourseChapter ---
  courseChapter: {
    async create({ data }: { data: Record<string, any> }) {
      return create("courseChapters", data);
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, any> }) {
      return updateById("courseChapters", where.id, data);
    },
    async delete({ where }: { where: { id: string } }) {
      // Delete all lessons in this chapter first
      const lessons = await findMany("courseLessons", [["chapterId", "==", where.id]]);
      for (const l of lessons) await deleteById("courseLessons", l.id);
      await deleteById("courseChapters", where.id);
    },
  },

  // --- CourseLesson ---
  courseLesson: {
    async createMany({
      data,
    }: {
      data: Record<string, any>[];
    }) {
      const batch = adminDb.batch();
      for (const item of data) {
        const ref = adminDb.collection("courseLessons").doc();
        batch.set(ref, addTimestamps(item));
      }
      await batch.commit();
    },
    async create({ data }: { data: Record<string, any> }) {
      return create("courseLessons", data);
    },
    async update({ where, data }: { where: { id: string }; data: Record<string, any> }) {
      return updateById("courseLessons", where.id, data);
    },
    async delete({ where }: { where: { id: string } }) {
      await deleteById("courseLessons", where.id);
    },
  },

  // --- CourseProgress ---
  courseProgress: {
    async findMany(opts?: { where?: Record<string, any> }) {
      const where: Array<[string, any, any]> = [];
      if (opts?.where?.userId) where.push(["userId", "==", opts.where.userId]);
      if (opts?.where?.courseId)
        where.push(["courseId", "==", opts.where.courseId]);
      return findMany("courseProgress", where);
    },
    async create({ data }: { data: Record<string, any> }) {
      return create("courseProgress", data);
    },
  },

  // --- Article ---
  article: {
    async findUnique(opts: { where: { id: string }; include?: any }) {
      const article = await findById("articles", opts.where.id);
      if (!article) return null;
      return article;
    },
    async findMany(opts?: { orderBy?: { createdAt?: string }; include?: any }) {
      const results = await findAll("articles", "createdAt", "desc");
      if (opts?.include?._count) {
        const countSelect = opts.include._count === true ? { reviews: true } : (opts.include._count?.select || {});
        for (const article of results) {
          article._count = {};
          if (countSelect.reviews) {
            article._count.reviews = await countWhere("reviews", [
              ["articleId", "==", article.id],
            ]);
          }
        }
      }
      return results;
    },
    async create({ data }: { data: Record<string, any> }) {
      return create("articles", data);
    },
    async update({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, any>;
    }) {
      return updateById("articles", where.id, data);
    },
    async delete({ where }: { where: { id: string } }) {
      await deleteById("articles", where.id);
    },
    async count() {
      return countAll("articles");
    },
  },

  // --- Podcast ---
  podcast: {
    async findUnique(opts: { where: { id: string }; include?: any }) {
      const podcast = await findById("podcasts", opts.where.id);
      if (!podcast) return null;
      return podcast;
    },
    async findMany(opts?: {
      orderBy?: Array<{ episode?: string; createdAt?: string }>;
      include?: any;
    }) {
      const results = await findAll("podcasts", "createdAt", "desc");
      // Sort by episode then createdAt client-side
      results.sort((a, b) => {
        if (a.episode && b.episode) return a.episode - b.episode;
        return 0;
      });
      if (opts?.include?._count) {
        const countSelect = opts.include._count === true ? { reviews: true } : (opts.include._count?.select || {});
        for (const podcast of results) {
          podcast._count = {};
          if (countSelect.reviews) {
            podcast._count.reviews = await countWhere("reviews", [
              ["podcastId", "==", podcast.id],
            ]);
          }
        }
      }
      return results;
    },
    async create({ data }: { data: Record<string, any> }) {
      return create("podcasts", data);
    },
    async update({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, any>;
    }) {
      return updateById("podcasts", where.id, data);
    },
    async delete({ where }: { where: { id: string } }) {
      await deleteById("podcasts", where.id);
    },
    async count() {
      return countAll("podcasts");
    },
  },

  // --- Video ---
  video: {
    async findUnique(opts: { where: { id: string }; include?: any }) {
      const video = await findById("videos", opts.where.id);
      if (!video) return null;
      return video;
    },
    async findMany(opts?: { orderBy?: { createdAt?: string }; include?: any }) {
      const results = await findAll("videos", "createdAt", "desc");
      if (opts?.include?._count) {
        const countSelect = opts.include._count === true ? { reviews: true } : (opts.include._count?.select || {});
        for (const video of results) {
          video._count = {};
          if (countSelect.reviews) {
            video._count.reviews = await countWhere("reviews", [
              ["videoId", "==", video.id],
            ]);
          }
        }
      }
      return results;
    },
    async create({ data }: { data: Record<string, any> }) {
      return create("videos", data);
    },
    async update({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, any>;
    }) {
      return updateById("videos", where.id, data);
    },
    async delete({ where }: { where: { id: string } }) {
      await deleteById("videos", where.id);
    },
    async count() {
      return countAll("videos");
    },
  },

  // --- PdfResource ---
  pdfResource: {
    async findUnique(opts: { where: { id: string }; include?: any }) {
      const pdf = await findById("pdfResources", opts.where.id);
      if (!pdf) return null;
      return pdf;
    },
    async findMany(opts?: { orderBy?: { createdAt?: string } }) {
      return findAll("pdfResources", "createdAt", "desc");
    },
    async create({ data }: { data: Record<string, any> }) {
      return create("pdfResources", data);
    },
    async update({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, any>;
    }) {
      return updateById("pdfResources", where.id, data);
    },
    async delete({ where }: { where: { id: string } }) {
      await deleteById("pdfResources", where.id);
    },
    async count() {
      return countAll("pdfResources");
    },
  },

  // --- LiveSession ---
  liveSession: {
    async findUnique(opts: { where: { id: string }; include?: any }) {
      const session = await findById("liveSessions", opts.where.id);
      if (!session) return null;
      return session;
    },
    async findMany(opts?: {
      orderBy?: Array<{ status?: string; scheduledAt?: string }>;
    }) {
      const results = await findAll("liveSessions", "scheduledAt", "desc");
      results.sort((a, b) => {
        const order: Record<string, number> = { live: 0, upcoming: 1, ended: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      });
      return results;
    },
    async create({ data }: { data: Record<string, any> }) {
      const firestoreData: any = { ...data };
      if (firestoreData.scheduledAt)
        firestoreData.scheduledAt = toFirestoreDate(
          firestoreData.scheduledAt
        );
      return create("liveSessions", firestoreData);
    },
    async update({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, any>;
    }) {
      return updateById("liveSessions", where.id, data);
    },
    async delete({ where }: { where: { id: string } }) {
      await deleteById("liveSessions", where.id);
    },
    async count() {
      return countAll("liveSessions");
    },
  },

  // --- Review ---
  review: {
    async findMany(opts?: {
      where?: Array<[string, any, any]>;
      orderBy?: { createdAt?: string };
      include?: any;
      includeUser?: boolean;
    }) {
      const where = opts?.where || [];
      const results = await findMany(
        "reviews",
        where,
        "createdAt",
        "desc"
      );

      if (opts?.include?.user || opts?.includeUser) {
        const select = opts?.include?.user?.select;
        for (const review of results) {
          const user = await findById("users", review.userId);
          if (user) {
            if (select) {
              const selected: any = {};
              for (const key of Object.keys(select)) {
                if (select[key]) selected[key] = user[key];
              }
              review.user = selected;
            } else {
              review.user = {
                id: user.id,
                name: user.name,
                avatar: user.avatar,
              };
            }
          }
        }
      }

      return results;
    },
    async findFirst(opts?: { where?: Record<string, any> }) {
      const where: Array<[string, any, any]> = [];
      if (opts?.where) {
        for (const [key, value] of Object.entries(opts.where)) {
          if (value !== undefined) where.push([key, "==", value]);
        }
      }
      const results = await findMany("reviews", where);
      return results[0] || null;
    },
    async create({ data, include }: { data: Record<string, any>; include?: any }) {
      const review = await create("reviews", data);
      if (include?.user) {
        const user = await findById("users", data.userId);
        if (user) {
          review.user = {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
          };
        }
      }
      return review;
    },
    async update({
      where,
      data,
      include,
    }: {
      where: { id: string };
      data: Record<string, any>;
      include?: any;
    }) {
      const review = await updateById("reviews", where.id, data);
      if (include?.user) {
        const user = await findById("users", data.userId || review.userId);
        if (user) {
          review.user = {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
          };
        }
      }
      return review;
    },
  },

  // --- Notification ---
  notification: {
    async findMany(opts?: {
      where?: Record<string, any>;
      orderBy?: { createdAt?: string };
    }) {
      const where: Array<[string, any, any]> = [];
      if (opts?.where?.userId) where.push(["userId", "==", opts.where.userId]);
      if (opts?.where?.isRead !== undefined)
        where.push(["isRead", "==", opts.where.isRead]);
      return findMany("notifications", where, "createdAt", "desc");
    },
    async create({ data }: { data: Record<string, any> }) {
      return create("notifications", data);
    },
    async updateMany({
      where,
      data,
    }: {
      where: { id: { in: string[] }; userId?: string };
      data: Record<string, any>;
    }) {
      // If userId is provided, verify each notification belongs to the user before updating
      if (where.userId) {
        const batch = adminDb.batch();
        for (const id of where.id.in) {
          const ref = adminDb.collection("notifications").doc(id);
          const doc = await ref.get();
          if (doc.exists && doc.data()?.userId === where.userId) {
            batch.update(ref, data);
          }
        }
        await batch.commit();
        return { count: where.id.in.length };
      }

      // No userId filter — update all matching IDs (admin use)
      const batch = adminDb.batch();
      for (const id of where.id.in) {
        const ref = adminDb.collection("notifications").doc(id);
        batch.update(ref, data);
      }
      await batch.commit();
      return { count: where.id.in.length };
    },
    async count(opts?: { where?: Record<string, any> }) {
      const where: Array<[string, any, any]> = [];
      if (opts?.where?.userId) where.push(["userId", "==", opts.where.userId]);
      if (opts?.where?.isRead !== undefined)
        where.push(["isRead", "==", opts.where.isRead]);
      return countWhere("notifications", where);
    },
  },

  // --- Purchase (individual content purchase) ---
  purchase: {
    async findMany(opts?: { where?: Record<string, any> }) {
      const whereClauses: Array<[string, any, any]> = [];
      if (opts?.where?.userId) whereClauses.push(["userId", "==", opts.where.userId]);
      if (opts?.where?.contentId) whereClauses.push(["contentId", "==", opts.where.contentId]);
      if (opts?.where?.contentType) whereClauses.push(["contentType", "==", opts.where.contentType]);
      if (opts?.where?.status) whereClauses.push(["status", "==", opts.where.status]);
      return findMany("purchases", whereClauses, "createdAt", "desc");
    },
    async create({ data }: { data: Record<string, any> }) {
      return create("purchases", data);
    },
    async findUnique({ where }: { where: { id: string } }) {
      return findById("purchases", where.id);
    },
    async update({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, any>;
    }) {
      return updateById("purchases", where.id, data);
    },
    async delete({ where }: { where: { id: string } }) {
      await deleteById("purchases", where.id);
    },
  },

  // --- SiteSetting ---
  siteSetting: {
    async findMany(opts?: { orderBy?: { key?: string } }) {
      return findAll("siteSettings", "key", "asc");
    },
    async upsert({
      where,
      update,
      create: createData,
    }: {
      where: { key: string };
      update: { value: string };
      create: { key: string; value: string };
    }) {
      const existing = await findUnique("siteSettings", "key", where.key);
      if (existing) {
        return updateById("siteSettings", existing.id, update);
      }
      return create("siteSettings", createData);
    },
  },

  // --- Slider ---
  slider: {
    async findMany(opts?: { orderBy?: { order?: string; createdAt?: string } }) {
      return findAll("sliders", "order", "asc");
    },
    async create({ data }: { data: Record<string, any> }) {
      return create("sliders", data);
    },
    async update({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, any>;
    }) {
      return updateById("sliders", where.id, data);
    },
    async delete({ where }: { where: { id: string } }) {
      await deleteById("sliders", where.id);
    },
  },
};
