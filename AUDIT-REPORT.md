# تقرير الفحص الشامل — منصة فضاء الشفاء (المرحلة 1)

**المشروع:** Healing-Space التعليمية (تطوير الذات والصحة النفسية)
**المستودع:** https://github.com/mohamedyakhou12-blip/Healing-Space
**الفرع:** `main`
**تاريخ الفحص:** سبتمبر 2026
**الأداة:** فحص يدوي شامل للكود المصدر (نسخة مرآة محلية مأخوذة من GitHub)

---

## 1. نطاق الفحص

- كل `src/app/api/**` (نحو 67 راوتر API).
- طبقة البيانات والحماية: `src/lib/**` (db, firestore, session, csrf, rate-limit, content-access, api-content-gate, admin-code, sanitize, cloudinary, cache…).
- طبقة العرض (SPA): `src/components/pages/**`, `src/components/layout/**`, `src/app/**`.
- إعدادات النظام: `next.config.ts`, `vercel.json`, `package.json`.
- الترجمات الثلاثية ar/fr/en.

## 2. الخلاصة التنفيذية

المنصة **متينة أمنياً في جوهرها**: طبقة حماية موزعة (جلسات مشفّرة iron-session، CSRF مزدوج، توثيق أدمن بطبقتين، rate limiting، sanitize، بوابات محتوى على الخادم، CSP قوية). لكن الفحص كشف **مشكلتين حرجتين وظيفيتين** تعطّلان تجربة المستخدمين الفعلية، و**مشكلة أمنية** واحدة متعلقة بالبيانات، إضافة إلى ملاحظات جودة:

### 🔴 حرجة
1. **غياب نقابة `/api/upload`** — كود الرفع موجود في `temp-upload-api/route.ts` **في جذر المشروع** بدل `src/app/api/upload/route.ts`. النتيجة: رفع الإيصالات الصغيرة (<3MB) ورفع ملفات المحتوى الصغيرة في لوحة الأدمن يُرجع **404** (الصفحة والدفع مكسوران جزئياً).
2. **`src/middleware.ts` يحجب تصفح الضيوف** — قائمة `PROTECTED_API_ROUTES` تشمل مسارات قراءة المحتوى العام (`/api/courses`, `/api/articles`, `/api/podcasts`, `/api/videos`, `/api/pdfs`, `/api/live`, `/api/coaching`). الضيوف (بدون cookie) يتلقون 401 فيسقطون لبيانات وهمية احتياطية (`mock*`). أي: **الموقع العام يعرض محتوى تجريبياً بدل المحتوى الحقيقي المنشور**.

### 🟠 خطيرة
3. **حذف جماعي خاطئ في GET للمدفوعات والمشتريات** — الاستعلام `where: { status:"rejected", updatedAt:{ lt: … } }` يتجاهل طبقة `db` شرط `updatedAt` بصمت، فيجلب **كل** السجلات المرفوضة ويحذفها عند كل فتح للوحة الأدمن.

### 🟡 متوسطة
4. **CORS عاكس** — `Access-Control-Allow-Origin` يعكس أي `Origin` مع `Allow-Credentials: true`، ما يتيح لأي موقع قراءة استجابات واجهات المستخدم الخاصة (الاشتراكات، المدفوعات، الإشعارات) إذا نجح في حمل cookie الضحية.
5. **ترجمة ناقصة** — مفتاح `admin.recommended` موجود في `ar.ts` فقط (يظهر كنص "مميز" ثابت في fr/en).
6. **كود أدمن افتراضي مضمّن** `052307` في `admin-code.ts` يُفعَّل فقط عند غياب إعداد env وDB (يُنصح بضبط `ADMIN_ACCESS_CODE`).

---

## 3. البنية العامة

| الطبقة | التقنية | ملاحظات |
|---|---|---|
| Framework | Next.js App Router + React 19 + TypeScript | SPA عبر rewrites إلى `/` |
| UI | Tailwind v4 + shadcn/ui + framer-motion | RTL تلقائي للعربية |
| قاعدة البيانات | Firestore (Admin SDK) | طبقة `db.ts` بنمط Prisma-like مع whitelists |
| الجلسات | iron-session (cookie مشفّر httpOnly) | صارم: `SESSION_SECRET` ≥ 32 حرف |
| التخزين | Cloudinary (محتوى) + Firebase Storage (احتياط) | رفع مباشر للكبير، خادم-وسيط للصغير |
| النشر | Vercel + vercel.json rewrites | دون واحدة |

## 4. الميزات المطبَّقة مقابل الدليل (القسم 30)

الميزات الرئيسية موثّقة في الكود:
- مصادقة email/كلمة مرور + birthday + تغيير/استعادة كلمة المرور + منع التخمين (قفل).
- بوابة أدمن برمز وصول ثنائي (جلسة أو رأس) مع `verify-admin` journal.
- 7 فئات محتوى (دورات، مقالات، بودكاست، فيديوهات، كتب، مباشر، كوتشنغ) مع 3 لغات لكل حقل + تقييمات (reviews + avgRating).
- خطط اشتراك (8 أنواع من "full" حتى "coaching") + شراء فردي بإيصال CCP + مراجعة يدوية من الأدمن + إشعارات.
- تحكم وصول على الخادم (بوابة تقطيع الحقول الحساسة) + تخصيص الصفحة الرئيسية (Hero/فيديو/سلايدر/معرض) + إعدادات موقع عامة عبر allow-list.
- لوحة أدمن: إحصائيات، أعضاء، مدفوعات، مشتريات، محتوى (CRUD كامل بالفصول والدروس + subcategories للكوتشنغ)، الأسعار، إعدادات، تغيير الكود، تشخيص Firebase.
- SEO (SEOPageWrapper, sitemap, robots, verify token) + CSP + HSTS.

## 5. نتائج فحص الواجهات

### 5.1 نمط جلب البيانات
الصفحات العامة تعتمد `cachedFetch` مع بيانات وهمية احتياطية:
- `HomePage` → `/api/courses?status=published&limit=4`, `/api/articles…`, `/api/podcasts…` (تعرض mock إذا فشل الطلب — **وهذا يخفي المحتوى الحقيقي حالياً بسبب middleware**).
- `ArticlesPage`, `PdfsPage`, `LivePage` → نفس النمط.
- `CoursesPage` → فيّديو/chapters من `api/courses/[id]`.
- `LoginPage`, `PaymentPage` → جلسة/أسعار مع التخزين المحلي.

### 5.2 استعادة الجلسة
`AppShell` يستدعي `/api/auth/session` + `/api/auth/profile` بالتوازي مع init لـ CSRF. الجلسة تُستعاد حتى لو تعطلت قاعدة البيانات (fallback من بيانات الجلسة). التنقل يدعم SPA pushState وراوتر الموقع معاً.

### 5.3 الترجمات
- 3 ملفات: `ar.ts` (549 سطر), `fr.ts` (548), `en.ts` (548) — تطابق كامل في المفاتيح (405 مفتاحاً) **باستثناء** `admin.recommended` في ar فقط.
- `t()` يعيد مسار المفتاح إن غاب (يسهّل اكتشاف النواقص).

### 5.4 الأداء المُلاحَظ
- ذاكرة تخزين مؤقت للخادم (`cache.ts`) TTL=30s + invalidateContentCache عند الكتابة.
- `Promise.all` بالتوازي في الإحصائيات وall-content وmembers (بدون N+1).
- `batchReviewStats` يجمع التقييمات دفعةً واحدة (حدود `in` = 30).
- تخزين معلومات الوصول (activePlans) بـ TTL=30s لكل مستخدم.

## 6. جرد واجهات API (موجز أمني)

| المجموعة | GET | POST/PUT/DELETE | الحالة الأمنية |
|---|---|---|---|
| auth/* | session/profile | login/register/verify-admin/change-password/reset/forgot | ✅ قوية |
| admin/* | كاملة | كاملة | ✅ verifyAdminAccess |
| courses, articles, podcasts, videos, pdfs, live | عامة (داخلية: gate) | إدارية (verifyAdminAccess) | ⚠️ middlewawre يحجبها للضيوف |
| coaching(s) | عامة (gate) | إدارية | ⚠️ مثل أعلاه |
| content/* (تجريبي) | عامة | — | ⚠️ بيانات ثابتة تجريبية — لا يُستخدم |
| payments, purchases | خاصة بالمستخدم/الأدمن | إنشاء خصوصية / اعتماد إدارية | ⚠️ باغ الحذف القديم + SSRF محمي |
| subscriptions | خاصة | إدارية | ✅ |
| notifications | خاصة | إدارية | ✅ (IDOR محمي: `userId` من الجلسة) |
| reviews | عامة | تسجيل فقط | ✅ |
| upload | — | خصوصي/إداري | 🔴 النقطة غير مُنصَّبة في المسار الصحيح |
| cloudinary/signature | — | إداري/مستخدم | ✅ (rate limit + folders) |
| setup/seed/data-fix | — | إداري | ✅ (معطّلة في الإنتاج) |

## 7. قائمة المشاكل الكاملة (مرجع للمرحلة 3)

| # | الخطورة | الملف | المشكلة |
|---|---|---|---|
| 1 | 🔴 | `(جذر المشروع)/temp-upload-api/route.ts` | يجب نقله إلى `src/app/api/upload/route.ts` |
| 2 | 🔴 | `src/middleware.ts` | حجب تصفح الضيوف للمحتوى العام |
| 3 | 🟠 | `src/app/api/payments/route.ts` + `purchases/route.ts` | حذف كل المرفوضة عند GET |
| 4 | 🟡 | `src/middleware.ts` | CORS عاكس + credentials |
| 5 | 🟡 | `translations/fr.ts`, `en.ts` | مفتاح `recommended` ناقص |
| 6 | 🟡 | `src/lib/admin-code.ts` | كود افتراضي مضمّن — ضبط env |
| 7 | 🟢 | سريان | `rateLimitMap` داخل الذاكرة (لكل instance) |

## 8. الملفات المفحوصة (الأهم)

`db.ts, db-security.ts, db-normalize.ts, firestore.ts, firebase-admin.ts, firebase.ts, firebase-storage.ts, session.ts, csrf.ts, csrf-client.ts, rate-limit.ts, request-limits.ts, content-access.ts, api-content-gate.ts, verifyAdminAccess.ts, admin-code.ts, cache.ts, client-cache.ts, cloudinary.ts, cloudinary-utils.ts, cloudinary-client.ts, sanitize.ts, html-sanitize.ts, api-helpers.ts, i18n.ts, site-config.ts, store.ts, utils.ts, translations/{index,ar,fr,en}.ts, middleware.ts, next.config.ts, vercel.json, package.json` وكل `src/app/api/**/route.ts` و`src/components/pages/*`, `AppShell.tsx`.