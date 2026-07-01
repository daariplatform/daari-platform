# تقرير جاهزية النشر — منصّة داري (Daari Platform)

> **التاريخ:** 2026-07-01 · **المنهجية:** مراجعة متعدّدة الوكلاء (17 قارئاً عميقاً غطّى كل ملف
> في backend/web/flutter/deploy/secrets/publishing) + **تحقّق خصومي مستقل** لكل حاجز مُدّعى (وكيل
> ثانٍ يقرأ الكود الفعلي) + تشغيل مستقل لـ`tsc`/`nest build` و`flutter analyze`.
> 49 وكيلاً · ~2.7M توكن · مصدر الحقيقة هو الكود لا مستندات `*.md`.
>
> للحالة العامّة → [`PROGRESS.md`](PROGRESS.md) · للهيكلية → [`STRUCTURE.md`](STRUCTURE.md).

---

## 🧭 الخلاصة التنفيذية

**المشروع قريب جداً من الجاهزية لكنه ليس قابلاً للنشر كما هو.** الشيفرة **تُبنى نظيفة تماماً** (لا مشكلة
كود أو تجميع)، والمتبقّي هو **٤ حواجز حقيقية في «وصلات النشر» (deploy-wiring)** + مجموعة تحسينات
(should-fix) + المهام التشغيلية/البشرية المعروفة (خادم جديد، توقيع، Firebase، خرائط، اختبار ميداني).

أهمّ نتيجة مطمئنة: أخطر ما رُصد (تسميم معاملة `WaterStock`) **ثبت أنه ليس مشكلة** عند القراءة الدقيقة
(Prisma يقرأ قبل الكتابة)، وكثير من «الحواجز» تبخّرت بعد التحقّق الخصومي.

**الحكم:** `readyToDeploy = false` — أصلِح الحواجز الأربعة، أكمِل المهام التشغيلية، ثم انشر.

### ✅ حالة البناء (تحقّق مستقل)

| الفحص | النتيجة |
|---|---|
| Backend `prisma generate` + `tsc --noEmit` + `nest build` | **0 أخطاء** (Node 24.15، Prisma 5.22) |
| Flutter `analyze` — core + customer + driver + admin | **No issues found** على الأربعة (Flutter 3.44.1 / Dart 3.12.1) |
| Backend `npm run lint` | ⚠️ يفشل (ESLint v9 بلا `eslint.config.js`) — **ثغرة أدوات فقط، لا تكسر البناء** |
| Flutter deps | 66 حزمة مؤجَّلة الترقية (صيانة، لا خطأ) |

---

## 🔴 الحواجز الحقيقية قبل النشر (٤ — كلها كود/إعداد بسيط)

### 1) لا أحد يخدم `/uploads/` → كل صور إثبات التسليم وملفات التقارير تُرجع 404
الخادم يُصدر روابط `${APP_URL}/uploads/proof/…` و`/uploads/reports/…`
([uploads.controller.ts:122](backend/src/uploads/uploads.controller.ts#L122)،
[reports.controller.ts:703](backend/src/plant/reports.controller.ts#L703))، لكن
[deploy/nginx/daari-water-api.conf](deploy/nginx/daari-water-api.conf#L25) فيه فقط `location /`
و`/nginx-health` — **لا `location /uploads/`**، وNestJS لا يستدعي `useStaticAssets` ولا
`ServeStaticModule`. النتيجة: كل صورة/تقرير غير قابل للجلب في الإنتاج.
**الحل:** أضف `location /uploads/ { alias /var/www/daari-water-api/uploads/; add_header Cache-Control "private, max-age=86400"; access_log off; }` (نفس مسار `UPLOADS_DIR`).
التقارير تحمل PII فالأفضل تقديمها عبر مسار Nest مصادَق يعيد فحص `tenantId`.

### 2) رفع الصور يكتب في مجلّد يجعله sandbox للقراءة فقط → كل رفع سائق يُرجع 500
[uploads.controller.ts:35](backend/src/uploads/uploads.controller.ts#L35) يكتب في
`${UPLOADS_DIR ?? '/var/uploads'}`، لكن [systemd unit](deploy/systemd/daari-water-api.service#L29)
يعمل بـ`ProtectSystem=strict` مع `ReadWritePaths` = مجلّد النشر واللوغ فقط، و`UPLOADS_DIR`
**غير مضبوط** في أي `.env`/سكربت → يشحن الافتراضي `/var/uploads` غير القابل للكتابة.
`mkdirSync` مغلّف بـtry/catch صامت فيقلع الخادم «أخضر» ثم يفشل عند **أوّل رفع فعلي**.
**الحل:** اضبط `UPLOADS_DIR=/var/www/daari-water-api/uploads` صراحةً في `.env` الإنتاج + أنشئ/امنح
ملكية المجلّد في [vps-bootstrap.sh](deploy/vps-bootstrap.sh). (توأم الحاجز #1 — أصلِحهما معاً بنفس المسار.)

### 3) صفحة السائقين في لوحة التحكّم تنهار عند أي سائق `ON_BREAK`
[dashboard/.../drivers/page.tsx:52](dashboard/src/app/dashboard/drivers/page.tsx#L52) يبني خريطة
`STATUS` بمفتاح `BREAK`، بينما enum الحقيقي في [schema.prisma:406](backend/prisma/schema.prisma#L406)
هو `ON_BREAK` (يُكتب فعلاً في [drivers.service.ts:165](backend/src/drivers/drivers.service.ts#L165)).
العرض `STATUS[d.status].klass` بلا `?.` → `undefined.klass` يرمي ويُسقط الجدول كاملاً في error boundary.
يقع في حدث يومي عادي.
**الحل (سطر واحد):** `const s = STATUS[d.status] ?? STATUS.OFFLINE;` أو أعد تسمية المفتاح `BREAK → ON_BREAK`.

### 4) خط النشر لا يزرع `PLATFORM_ADMIN` أبداً → لوحة المنصّة معطّلة ولا يمكن إنشاء أي مستأجِر
[deploy.sh:89](deploy/deploy.sh#L89) يشغّل `db push` + إعادة تشغيل لكن **لا seed**. الكيان الوحيد الذي
ينشئ `PLATFORM_ADMIN` هو [seed.ts:31](backend/prisma/seed.ts#L31). على قاعدة بيانات جديدة: الجداول
موجودة لكن **صفر platform-admin** → كل `/platform/*` غير قابل للوصول، وإنشاء المستأجِرين ميت =
مسار الإطلاق مسدود. تعقيد إضافي: `ts-node`/`prisma` في `devDependencies` والخادم يثبّت بـ`--omit=dev`.
**الحل:** أضف خطوة `prisma:seed:prod` **idempotent** تزرع الـplatform-admin فقط من
`PLATFORM_ADMIN_PHONE/PASSWORD` (مع عزل بيانات الديمو خلف `NODE_ENV!=='production'`).

---

## 🟠 يُنصَح بإصلاحها قبل الإطلاق (should-fix)

### سلامة مالية
- **رواتب بلا idempotency** — [accounting.service.ts:420](backend/src/accounting/accounting.service.ts#L420): تكرار `computeSalary`/`paySalary` قد يدفع للسائق مرّتين. أضف `@@unique([tenantId,driverId,periodStart,periodEnd])` + حارس `paidAt`.
- **بيع walk-in الإداري/GPS بلا `clientRequestId`** — [orders.service.ts:1156](backend/src/orders/orders.service.ts#L1156): نقر مزدوج يسجّل إيراداً مكرّراً (بينما `createWalkinRefill` محمي). مرّر المفتاح بنفس النمط.
- **`assign()` غير ذرّي** — [orders.service.ts:526](backend/src/orders/orders.service.ts#L526): سباق مع `claim()` → سائقان يملكان نفس الطلب. استبدله بـ`updateMany` مشروط.
- **P2002 هاتف مكرّر** — [customers.service.ts:224](backend/src/customers/customers.service.ts#L224): `registerByDriver` بلا فحص مسبق → 500 خام بدل رسالة «مسجّل مسبقاً».

### أمن/تصلّب Backend
- **CORS يعكس كل الأصول** إن كان `CORS_ORIGINS` فارغاً في الإنتاج ([main.ts:23](backend/src/main.ts#L23)).
- **OTP يعيد `sent=true` بلا مزوّد** ([otp.service.ts:43](backend/src/auth/otp.service.ts#L43)) → استعادة كلمة السر تُكسر بصمت على خادم جديد؛ وأيضاً `Math.random()` غير آمن.
- **`refresh()` لا يفحص `isActive`** ([auth.service.ts:272](backend/src/auth/auth.service.ts#L272)) → حساب مُعطَّل يظلّ يجدّد التوكن.
- **لا helmet** (رؤوس أمان HTTP) ([main.ts:30](backend/src/main.ts#L30)).
- **حارس JWT يقبل النموذج الظاهر** في `.env.example` (`replace-with-a-strong-secret…`) ([auth.module.ts:21](backend/src/auth/auth.module.ts#L21)).

### نشر/إعداد
- **عدم تطابق اسم متغيّر FCM** — القالب يستخدم `FCM_SERVICE_ACCOUNT_PATH` والكود يقرأ `FIREBASE_SERVICE_ACCOUNT_PATH` ([.env.production.example:55](backend/.env.production.example#L55)) → الدفع مُعطَّل بصمت.
- **إضافة `postgis` مُعلَنة وغير مستخدمة** ([schema.prisma:13](backend/prisma/schema.prisma#L13)) → قد تُفشِل `db push` على Postgres عادي. احذفها (المسافة Haversine داخل التطبيق).
- **بذور الديمو تنشئ 4 حسابات بـ`password123`** ([seed.ts:20](backend/prisma/seed.ts#L20)) — اعزلها خلف `NODE_ENV`.
- **`backup-db.sh` مسار `.env` خاطئ** (`daari-api` بدل `daari-water-api`) ([scripts/backup-db.sh:23](scripts/backup-db.sh#L23)) → النسخ الاحتياطي يفشل بصمت.
- **`platform-console` بلا هدف نشر** (لا systemd/nginx/مسار في deploy.sh).

### موبايل/ويب
- **تطبيق الإدارة Flutter لا يسجّل FCM أبداً** ([apps/admin/lib/main.dart:18](mobile-flutter/apps/admin/lib/main.dart#L18)) → الملّاك/المدراء لا يصلهم أي إشعار. أضف `pushService.register()` بعد الدخول.
- **`API_URL` في release يفترض `http://localhost:3000`** بلا تأكيد release ([env.dart:15](mobile-flutter/packages/daari_core/lib/src/config/env.dart#L15)) + release قد يوقّع بمفتاح debug. أضف `assert(kReleaseMode → https)` وحارس توقيع.
- **onboarding يثبّت السعر 1000 د.ع/500 لتر** ([onboarding_screen.dart:257](mobile-flutter/apps/customer/lib/screens/onboarding_screen.dart#L257)) بدل `plant.refillPriceIqd` → سعر خاطئ لكل مستأجِر.
- **تصدير PDF لا يعرض العربية** (خط Helvetica بلا محارف عربية) ([reports.controller.ts:911](backend/src/plant/reports.controller.ts#L911)) — سجّل خط TTF عربي أو اكتفِ بـXLSX.
- **توكنات لوحة التحكّم في localStorage بلا تدوير refresh** ([dashboard/src/lib/api.ts:27](dashboard/src/lib/api.ts#L27)) → خروج قسري كل ~15د.
- **مستندات المتجر تستخدم معرّفات Expo القديمة** ورابط خصوصية غير مخدوم ([PLAY_STORE_LISTING_CUSTOMER.md](legal/PLAY_STORE_LISTING_CUSTOMER.md)).

---

## 🟡 تحسينات (nice-to-have، بعد الإطلاق)

Throttler في الذاكرة بدل Redis · نماذج tenant-scoped بلا FK/cascade · صفّ `WaterStock` كسول ·
جدولا تسعير SaaS متضاربان (×2) · ملفات التقارير لا تُحذف رغم انتهاء 24س (نمو قرص + PII) · مرشّح
الأخطاء مربوط فقط مع Sentry · تتبّع موقع السائق foreground فقط (يتجمّد بالخلفية) ·
**iOS غير مربوط كلياً** (Firebase/Maps/APNs) + خطأ حالة أحرف bundle-id للإدارة · `android:label` =
اسم الحزمة الخام (`daari_customer`) بدل الاسم العربي · قناة إشعار FCM الافتراضية مفقودة ·
`.gitignore` الجذر بلا أنماط keystore · `google-services.json` لتطبيقات Expo القديمة مُودَع في git ·
إضافة `eslint.config.js`.

---

## 🔑 المهام التشغيلية/البشرية (تحجب الإطلاق — ليست كوداً)

1. **تجهيز VPS جديد** (القديم أُلغي): postgres+postgis، redis، nginx، node، certbot + `/root/PROJECTS.md` (⚠️ الملف `deploy/PROJECTS-MD-ENTRY.md` مُشار إليه لكنه **غير موجود** في المستودع — يلزم توفيره) ثم `SSH_TARGET=root@<ip> ./deploy/deploy.sh both`.
2. **DNS + TLS** لـ`api.phi-bit.com` و`daari-admin.phi-bit.com` (certbot؛ الصفحات القانونية يجب أن تُحلّ لمراجعة Play).
3. **زرع platform-admin** أوّل نشر (`PLATFORM_ADMIN_PHONE/PASSWORD`) — بدونه لا لوحة ولا مستأجِرين (الحاجز #4).
4. **توقيع Android**: keystore لكل تطبيق + `key.properties` خارج git + حفظ الأسرار (فقدان المفتاح يمنع كل تحديث لاحق).
5. **مفتاح خدمة Firebase (خادم)** → `/var/www/daari-water-api/` + ضبط `FIREBASE_SERVICE_ACCOUNT_PATH`.
6. **مفاتيح Google Maps** مقيّدة (حزمة + SHA-1) وإلا الخرائط رمادية.
7. **iOS** (إن كان هدف إطلاق): `GoogleService-Info.plist` + مفتاح APNs، وإلا أعلِن Android-first وأجّل iOS.
8. **حقن `API_URL` الإنتاج** في بناء Flutter release + دخان-تست الوصول للخادم الحيّ.
9. **لقطات شاشة + بناء AAB موقّع** ومطابقة أرقام النسخ (المستندات 0.1.0 مقابل pubspec 1.0.0+1).
10. **تقاعد تطبيقات Expo** (customer/worker/admin).
11. **QA ميداني على جهاز فعلي**: رفع/عرض صور الإثبات (يتحقّق من إصلاح #1/#2)، إعادة تشغيل طابور المال (idempotency)، حاجز GPS 50م، إشعارات، تنزيل تقارير.
12. **تأكيد أن مشروع Firebase `daariplatform-5cdd0` هو مشروع الإنتاج** قبل بناء الإصدارات.

---

## 📊 جاهزية كل نطاق

| النطاق | حواجز | الحالة |
|---|:---:|---|
| backend-auth-security | 0 | متين (argon2id، ترتيب الحُرّاس، إزالة backdoor)؛ تصلّب متبقٍّ |
| backend-financial | 0 | معالجة مال إنتاجية؛ should-fix (رواتب/walk-in/assign) |
| backend-domain | 0 | عزل مستأجِرين قوي؛ vendors مغلق بعلَم |
| backend-admin-plant | 0 | جيّد؛ تنزيل تقارير يندمج بحاجز /uploads |
| **backend-infra-integrations** | **2** | حاجزا الرفع (كتابة + خدمة) |
| **backend-schema** | **1** | حاجز زرع platform-admin |
| **web-dashboard** | **1** | انهيار صفحة السائقين (ON_BREAK) |
| web-console | 0 | يُبنى نظيفاً؛ لا هدف نشر |
| flutter-core/customer/driver/admin | 0 | هندسة جيّدة؛ should-fix متفرّقة |
| flutter-build-signing | 0 | توقيع/iOS = مهام بشرية |
| **deploy-infra** | **2** | /uploads بنginx + الخادم الجديد |
| secrets-hygiene | 0 | لا أسرار حقيقية مُودَعة |
| publishing-assets | 0 | أساس قانوني قوي؛ تصحيحات مستندات |

---

**المتبقّي فعلياً كوداً = ٤ حواجز + مجموعة should-fix**، وثلاثة من الحواجز إصلاحات صغيرة جداً (سطر
`ON_BREAK`، `location /uploads/`، `UPLOADS_DIR`+`ReadWritePaths`، خطوة seed للإنتاج). البقية مهام
تشغيلية معروفة.
