# تقرير الفحص الأمني — منصة فضاء الشفاء (المرحلة 2)

**التاريخ:** سبتمبر 2026 — **النتيجة العامة:** مقبول مع ملاحظات

تم فحص الكود المصدر (النسخة المرآة من GitHub، فرع `main`) عبر 14 فئة أمنية. الحالة العامة: **التوثيق، التحكم في الوصول، الحماية من XSS/CSRF/SSRF بخير**؛ توجد **ثغرة متعلقة بسلامة البيانات** و**مشكلتان إجرائيتان** تُعالجان في المرحلة 3.

---

## ملخص الحالات

| # | الفئة | الحالة | التفاصيل |
|---|---|---|---|
| 1 | كشف بيانات حساسة في الردود | ✅ سليم | الردود تقتصر على حقول محددة؛ بوابات التقطيع على الخادم |
| 2 | حقن (SQL/NoSQL) | ✅ سليم | لا SQL؛ Firestore عبر `validateCollection` + whitelists |
| 3 | XSS | ✅ جيد | `zod` + `sanitizeHtml` + `sanitize.ts` على كل الحقول النصية؛ CSP تحظر `unsafe-inline` |
| 4 | CSRF | ✅ جيد | نمط Double-Submit (cookie + رأس `X-CSRF-Token`) مع قائمة exemptions منطقية |
| 5 | تجاوز المصادقة/التفويض | ⚠️ ملاحظة | المصادقة الفعلية تُنفَّذ داخل كل راوتر (سليمة)؛ لكن middleware يحجب القراءة العامة — وليست ثغرة تسلل بل خلل وظيفي |
| 6 | SSRF | ✅ سليم | `validateReceipt` يمنع localhost/شبكات خاصة ويسمح بمزودي تخزين موثوقين فقط |
| 7 | Rate Limiting | ⚠️ معروف | في الذاكرة لكل instance (موثّق في الدليل القسم 26) |
| 8 | أسرار ومفاتيح | 🟠 ملاحظة | `SESSION_SECRET` معزّز؛ كود أدمن افتراضي `052307` مضمّن في الكود (يُضبط عبر env/DB) |
| 9 | رفع الملفات | 🔴 حرجة (نشر) | كود الرفع موجود في `temp-upload-api` (المسار الخطأ) → `/api/upload` غائب فعلياً |
| 10 | الوصول الأفقي (IDOR) | ✅ سليم | مستخدم `userId` من الجلسة؛ `updateMany` للسطرة على الإشعارات مقيد بـ `userId` |
| 11 | تسريب المعلومات | ✅ سليم | رسائل خطأ عامة؛ `check-email` يمنع تعداد الحسابات |
| 12 | إعدادات غير آمنة | 🟡 ملاحظة | CORS عاكس مع credentials؛ يقيَّد في المرحلة 3 |
| 13 | الثقة ببيانات العميل | ✅ سليم | كل قرارات الوصول تُحسب على الخادم (session) لا من query |
| 14 | الخصوصية/حماية المستخدم | ✅ بخير | لا كتابة `userId` من العميل؛ رموز غير قابلة للتخمين؛ CSP على الاتصالات |

---

## 1. كشف البيانات الحساسة
- واجهات عامة تتعامل مع content: `gateContentList`/`gateContentItem`/`gateCourseLessons` تقطع `content*`, `videoUrl`, `audioUrl`, `pdfUrl`, `streamUrl`, ودرس `videoUrl/content*` لمن لا صلاحية.
- الإداري فقط يرى الكل. `admin/all-content`, `admin/members` خلف `verifyAdminAccess`.

## 2. حقن SQL/NoSQL
- `db-security.ts` يتحقق من أسماء المجموعات والحقول والحقول المحددة (whitelist). لا وجود لـ SQL. 🟢 (ملاحظة بسيطة: `getDocuments` في `firestore.ts` لا يتحقق من أسماء حقول الفلاتر — غير مستخدم في مسارات حرجة.)

## 3. XSS
- كل الحقول النصية الطويلة تمر عبر `sanitizeHtml` قبل الحفظ (articles، courses، يورك، دروس، ملاحظات إدارية).
- CSP في `next.config.ts`: `script-src 'self'` + الغوغل؛ `frame-src youtube/vimeo` فحسب.
- يُنصح بمراقبة حقل `adminNote` في الردود (مُعقّم — سليم).

## 4. CSRF
- `csrf.ts`: توليد token عشوائي 32 بايت، مقارنة timing-safe بين cookie ورأس مخصص؛ استثناءات منطقية (login/register/verify-admin/logout/session/upload/cloudinary-signature).

## 5. المصادقة والتفويض
- طبقات: `requireAuth` (جلسة)، `requireAdmin` (isAdmin + userId)، `verifyAdminAccess` (جلسة أو `X-Admin-Code` مع timing-safe).
- ملاحظة: `middleware.ts` يفحص وجود cookie فقط — لا يعتمد عليه في الأمان؛ كل راوتر يتحقق بنفسه.
- **الخلل المرصود:** حجب القراءة العامة للمحتوى (يُعالج في المرحلة 3).

## 6. SSRF
- `validateReceipt` (payments & purchases) يسمح فقط: firebasestorage.googleapis.com / storage.googleapis.com / res.cloudinary.com / cloudinary.com، ويمنع localhost/127.0.0.1/192.168/10.x/172.16–31. ✅

## 7. Rate Limiting
- `rate-limit.ts` خريطة داخل الذاكرة لكل instance (دقيق في function واحد، توزيعي أدناه). الحدود ملائمة: login 10/min، register 3/min، verify-admin 10/5min، payments/purchases 5/5min، upload 10/min.

## 8. الأسرار والمفاتيح
- ✅ إصلاح سابق: `SESSION_SECRET` يتطلب ≥32 حرفاً، مع منع الاستخدام في البناء.
- 🟡 `ADMIN_ACCESS_CODE` يُفضَّل ضبطه في Vercel (وإلا يُفعَّل الافتراضي `052307` ما دامت DB بلا سجل) — **إجراء مطلوب من المستخدم** (لا حذف الافتراضي حتى لا يُقفل الأدمن خارجاً).

## 9. رفع الملفات
- 📋 المنطق سليم (حد أقصى 20MB للوسيط، منع امتدادات خطرة، مجلدات معيّنة، rate limit، قبول الإيصالات لأي مستخدم موثوق).
- 🔴 **ليست منصَّبة:** المسار `src/app/api/upload/route.ts` مفقود؛ الكود في `temp-upload-api/route.ts` بجذر المشروع. رفع الإيصالات <3MB ورفع ملفات المحتوى الصغيرة يفشل بـ 404.
- ✅ الفحص الآلي متوقع: `getCloudinaryResourceType` + مجلد `healing-space/*` + إزالة الملفات الخطرة.

## 10. الوصول الأفقي (IDOR)
- Profile/subscriptions/payments/purchases/notifications: `userId` من الجلسة دائماً. علامة "كمقروء" للإشعارات مقيدة بـ `userId`. مسار `subscriptions?userId=` للإداري فقط. ✅

## 11. تسريب المعلومات
- `check-email` يعيد `{success:true}` دائماً. رسائل خطأ عامة دون تفاصيل داخلية. ✔

## 12. إعدادات CORS والهيدرز
- 🟡 `Access-Control-Allow-Origin` = أي Origin مع credentials — يُقيَّد بالقبضة `SITE_URL` في المرحلة 3 (حماية استجابات الاشتراكات/المدفوعات/الإشعارات من القراءة عبر مواقع أخرى).
- الهيدرز الوقائية (HSTS, X-Frame-Options SAMEORIGIN) موجودة.

## 13. الثقة ببيانات العميل
- كل صلاحيات الحل تعتمد الجلسة/الخادم لا query params أو localStorage. ✅

## 14. الخصوصية
- `localStorage` يُستخدم فقط للرموز/التفضيلات (ملاحظة معروفة موثقة في `api-helpers.ts`). لا أكواد إدارية تُبث للعميل (شُطب سابقاً).

---

## التوصيات العاجلة (تُنفَّذ في المرحلة 3)
1. نقل/إنشاء `src/app/api/upload/route.ts` بنفس محتوى `temp-upload-api/route.ts` وحذف الملف المؤقت.
2. إخراج مسارات قراءة المحتوى من قائمة الحماية في `middleware.ts` مع تقييد CORS بالقبضة `NEXT_PUBLIC_SITE_URL`.
3. إصلاح استعلام تنظيف المرفوضة في `payments/route.ts` و`purchases/route.ts` (تصفية `updatedAt` داخل JS بدل الاعتماد على `where` الذي تتجاهله طبقة `db`).
4. إضافة ترجمة `recommended` إلى `fr.ts` و`en.ts`.
5. (إجرائي) ضبط `ADMIN_ACCESS_CODE` في إعدادات Vercel؛ تثبيت `bun.lock` عبر `bun install` عند أول بناء محلي.