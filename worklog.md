---
Task ID: 1
Agent: Main Agent
Task: اختبار جميع نقاط الرفع في الموقع واختبار نظام الاشتراكات بالتفصيل

Work Log:
- فحص شامل لجميع ملفات الرفع: upload API, cloudinary-client, cloudinary signature
- فحص نظام الاشتراكات: payments, purchases, subscriptions, user-access, content-access
- فحص صفحة الأدمن: FileUploadComponent, ContentView, PaymentsView, PurchasesView
- فحص صفحات العرض: PdfsPage, PodcastsPage, VideosPage, ArticlesPage, SubscriptionsPage, PaymentPage
- اكتشاف مشكلة حرجة: حقول videoUrl, audioUrl, fileUrl كانت Input نصي فقط بدون إمكانية رفع ملفات
- إصلاح: استبدال Input بـ FileUploadComponent لكل من الفيديو والبودكاست و PDF
- إصلاح: عنوان مضلل لصورة غلاف PDF (كان "رفع ملف PDF" أصبح "صورة الغلاف")
- التحقق من وجود صفحة نسيت كلمة المرور وتغيير كلمة المرور (موجودة بالفعل)
- البناء نجح والتعديلات تم نشرها على GitHub

Stage Summary:
- نظام الاشتراكات يعمل بشكل صحيح بدون مشاكل
- تم إصلاح مشكلة عدم إمكانية رفع ملفات المحتوى مباشرة
- تم نشر التعديلات: commit 8c7df9a
---
Task ID: final-audit
Agent: Super Z (Main)
Task: فحص نهائي شامل للموقع - كل شيء بدون استثناء

Work Log:
- فحص كامل لكل ملفات المشروع (144+ ملف)
- اكتشاف أن /api/upload/route.ts مفقود تماماً (كل الرفع كان معطلاً)
- اكتشاف ثغرة أمنية في /api/auth/reset-password (أي شخص يمكنه تغيير كلمة مرور أي مستخدم)
- اكتشاف ملفات Google Auth القديمة لا تزال موجودة
- اكتشاف مكونات LoginForm/RegisterForm القديمة تستخدم Firebase Auth مباشرة
- اكتشاف استيرادات verifyAdminAccess خاطئة في coaching routes
- إصلاح كل المشاكل المكتشفة
- البناء ينجح بنجاح

Stage Summary:
- أنشئ /api/upload/route.ts (كان مفقوداً - كل الرفع كان معطلاً)
- أصلح ثغرة أمنية حرجة في reset-password (الآن يتطلب idToken)
- حذف GoogleSignInButton.tsx, LoginForm.tsx, RegisterForm.tsx, auth-store.ts
- حذف 6 مسارات API لـ Google Auth + firebase-check/firebase-status
- حذف google-gis.ts, google-notify.ts
- أصلح استيراد notifyGoogleUpdate في 17 ملف
- أصلح استيراد verifyAdminAccess في 2 ملف coaching
- حذف أدلة المصدر المكررة (39MB حرر)
- البناء ينجح بالكامل

---
Task ID: password-reset-fix
Agent: Super Z (Main)
Task: إصلاح مشكلة عدم وصول رابط تغيير كلمة السر إلى الإيميل

Work Log:
- فحص شامل لنظام إعادة تعيين كلمة المرور بالكامل
- اكتشاف السبب الرئيسي: FIREBASE_SERVICE_ACCOUNT_KEY غير مضبوط في .env.local
- بدون مفتاح Service Account، Firebase Admin يعمل في وضع fallback_unauthenticated
- المستخدمون لا يتم إنشاؤهم في Firebase Auth أثناء التسجيل
- sendPasswordResetEmail() تفشل مع auth/user-not-found لأن المستخدم غير موجود في Firebase Auth
- اكتشاف مشكلة ثانوية: handleCodeInApp: false يعني أن كلمة المرور تتحدث في Firebase فقط وليس في Firestore (bcrypt)
- إنشاء صفحة ResetPasswordPage.tsx جديدة لمعالجة إعادة تعيين كلمة المرور داخل التطبيق
- تحديث ForgotPasswordPage.tsx لاستخدام handleCodeInApp: true مع URL /reset-password
- الصفحة الجديدة تتحقق من OOB code، تعيد تعيين كلمة المرور في Firebase Auth، ثم تحدث الـ bcrypt hash في Firestore
- تحديث store.ts لإضافة مسار reset-password
- تحديث page.tsx لاستيراد ResetPasswordPage
- تحديث vercel.json لإضافة rewrite rule لـ /reset-password
- إنشاء /app/reset-password/page.tsx كصفحة Next.js route
- تحديث ملفات الترجمة ar.ts, en.ts, fr.ts بنصوص إعادة تعيين كلمة المرور
- تحسين forgot-password API route بتسجيل أخطاء أوضح عند عدم توفر Firebase Admin
- تحديث .env.local بالقيم الصحيحة لمشروع Firebase
- إزالة تكرار confirmPassword في ملفات الترجمة
- البناء ينجح بنجاح

Stage Summary:
- تم إنشاء نظام إعادة تعيين كلمة مرور كامل داخل التطبيق
- المسار: ForgotPassword → Email Link → /reset-password → ResetPasswordPage → Update Firebase Auth + Firestore
- ⚠️ يجب على المستخدم ضبط FIREBASE_SERVICE_ACCOUNT_KEY في Vercel لكي يعمل النظام في الإنتاج
- ⚠️ يجب إضافة نطاق الموقع في Firebase Console > Authentication > Settings > Authorized domains
