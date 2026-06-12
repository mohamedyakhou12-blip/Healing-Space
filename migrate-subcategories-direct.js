/**
 * Direct Firestore migration script for coaching subcategories.
 * Uses Firebase Admin SDK directly — no web server, no CSRF needed.
 * 
 * Usage: node migrate-subcategories-direct.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const serviceAccount = {
  projectId: "healing-space-5a76f",
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@healing-space-5a76f.iam.gserviceaccount.com",
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || "",
};

// If no private key, try using default credentials
let app;
try {
  if (serviceAccount.privateKey) {
    app = initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    app = initializeApp();
  }
} catch (e) {
  // App might already be initialized
  app = initializeApp();
}

const db = getFirestore(app);

const SUBCATEGORY_MAP = {
  "جلسة شهرية مع مدربة": { subcategory: "sessions", isFree: false, price: 3000, category: "كوتشنغ" },
  "ورشة عمل": { subcategory: "sessions", isFree: false, price: 5000, category: "كوتشنغ" },
  "حلول وفصول": { subcategory: "sessions", isFree: false, price: 2000, category: "كوتشنغ" },
  "تأمل": { subcategory: "meditation", isFree: true, price: 0, category: "تأمل" },
  "تأكيدات إيجابية": { subcategory: "meditation", isFree: true, price: 0, category: "تأمل" },
  "طبيب العقل": { subcategory: "meditation", isFree: false, price: 4000, category: "تأمل" },
  "علاج فني وترفيه": { subcategory: "therapy", isFree: false, price: 3500, category: "علاج نفسي" },
  "شفاء وعلاج طبي": { subcategory: "therapy", isFree: false, price: 6000, category: "علاج نفسي" },
  "ذاكرة الجسد": { subcategory: "therapy", isFree: false, price: 4500, category: "علاج نفسي" },
  "الطب الشمولي والتكاملي": { subcategory: "holistic", isFree: false, price: 7000, category: "طب شمولي" },
  "رحلة إعادة توازن": { subcategory: "holistic", isFree: false, price: 15000, category: "طب شمولي" },
  "تمارين": { subcategory: "exercises", isFree: true, price: 0, category: "تمارين" },
  "جلسة كوتشنغ شهرية": { subcategory: "sessions", isFree: false, price: 3000, category: "كوتشنغ" },
};

function autoDetectSubcategory(titleAr) {
  if (!titleAr) return "sessions";
  if (titleAr.includes("تأمل") || titleAr.includes("تأكيد") || titleAr.includes("عقل")) return "meditation";
  if (titleAr.includes("علاج") || titleAr.includes("شفاء") || titleAr.includes("ذاكرة")) return "therapy";
  if (titleAr.includes("شمولي") || titleAr.includes("توازن")) return "holistic";
  if (titleAr.includes("تمارين") || titleAr.includes("رياض")) return "exercises";
  return "sessions";
}

async function migrate() {
  console.log("🔍 Fetching coaching items from Firestore...");
  
  const snapshot = await db.collection("coachings").get();
  console.log(`📋 Found ${snapshot.size} coaching items`);
  
  let updated = 0;
  let skipped = 0;
  const details = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const titleAr = data.titleAr || "";
    const existingSub = data.subcategory;
    
    // Skip if already has subcategory
    if (existingSub) {
      console.log(`  ⏭️  ${titleAr}: already has subcategory "${existingSub}" — skipping`);
      skipped++;
      continue;
    }
    
    const mapping = SUBCATEGORY_MAP[titleAr];
    let updateData;
    
    if (mapping) {
      updateData = {
        subcategory: mapping.subcategory,
        isFree: mapping.isFree,
        price: mapping.price,
        category: mapping.category,
      };
      details.push(`${titleAr} -> ${mapping.subcategory}`);
    } else {
      const sub = autoDetectSubcategory(titleAr);
      updateData = { subcategory: sub };
      details.push(`${titleAr} -> ${sub} (auto)`);
    }
    
    await db.collection("coachings").doc(doc.id).update(updateData);
    console.log(`  ✅ ${titleAr} -> ${updateData.subcategory}`);
    updated++;
  }
  
  console.log("\n" + "=".repeat(50));
  console.log(`✅ Migration complete! Updated: ${updated}, Skipped: ${skipped}`);
  console.log("Details:");
  details.forEach(d => console.log(`  - ${d}`));
  
  process.exit(0);
}

migrate().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
