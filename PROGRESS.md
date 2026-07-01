# داري — خارطة المتابعة (اقرأني أوّلاً) 🧭

> **الغرض:** هذا الملف هو **نقطة البداية في كل محادثة جديدة**. اقرأه لتعرف: أين وصلنا، ما القرارات
> المثبّتة، وما الخطوة التالية. يُحدَّث **في نهاية كل جلسة** (الأقسام 3 و 4 و 9).
>
> للهيكلية العامة للمشروع → [`STRUCTURE.md`](STRUCTURE.md).

**آخر تحديث:** 2026-07-01 · **الجلسة:** #18

---

## 1) أين نحن الآن (نبذة)

نُحوّل **واجهة الجوّال** من Expo/React Native إلى **Flutter** ونجعلها الواجهة الرسمية، مع **حذف Expo
نهائياً** لاحقاً. **الخادم (NestJS+Prisma) يبقى كما هو** (لا إعادة كتابة بـ FastAPI)، و**لوحات الويب تبقى
Next.js**. الإشعارات على الخادم تحوّلت من Expo Push إلى **Firebase FCM**. لا شيء منشور على المتاجر بعد
(بداية نظيفة).

تطبيق الزبون بـ Flutter: **مكتمل التكافؤ** — جُرِدت **75 فجوة داخلية** وأُغلِقت **74** عبر الدفعات #9–#15 (الوحيدة المتبقّية
قرار منتج: login «لا حساب»)؛ سجلّ التتبّع: [`mobile-flutter/CUSTOMER_PARITY_BACKLOG.md`](mobile-flutter/CUSTOMER_PARITY_BACKLOG.md).
التالي للزبون: **QA شامل** ثمّ التقاعد. تطبيق السائق **جُرِد الآن** (12 زوج شاشة): التطابق على مستوى الشاشات كامل،
**56 فجوة داخلية مؤكّدة** (1 عالية · 22 متوسّطة · 33 منخفضة) + **5 نتائج سلامة مالية** — **55 بنداً مُغلقاً (52 من الـ56 + MS‑1/2/3)** عبر 6أ/ج/د/هـ + history‑1 + 6و + **6ب (idempotency خادم، إغلاق الثغرة المالية)**، `tsc` exit 0 · `flutter analyze` نظيف؛ المتبقّي 3 مؤجَّلة منخفضة (+ خطوة نشر `prisma db push`)؛ السجلّ:
[`mobile-flutter/DRIVER_PARITY_BACKLOG.md`](mobile-flutter/DRIVER_PARITY_BACKLOG.md). ✅ **أبرز نتيجة عولِجت:** ثغرة **مزدوجة الشحن** في walk-in/تسليم النقد
(نقاط `create()` كانت بلا حارس) **أُغلقت في 6ب** عبر `clientRequestId` + قيد UNIQUE — يبقى تشغيل `prisma db push` عند النشر. تطبيق الإدارة بـ Flutter **مكتمل التكافؤ الوظيفي** — **14 شاشة** (`apps/admin`:
مؤشّرات حيّة + تقارير أساسية ومتقدّمة **مع فلاتر تاريخ** + فريق بإجراءاته + عروض (مع **متابعة بثّ حيّة**) + مخزون + تهيئة +
**خريطة أسطول حيّة** + **أداء السائقين** + **خريطة حرارية** + **سجلّ تدقيق مرقّم**) + قفل بصمة. لم يبقَ على الإدارة سوى **اختبار
البصمة ميدانياً** (يحتاج جهازاً). **التركيز التالي:** أُغلقت **الحواجز الأربعة للنشر كوداً (#18)** → **صفر حواجز كود**. الخطوة: **تجهيز خادم جديد** ثم **أوّل `./deploy/deploy.sh api`** (يطبّق `db push` + يزرع مالك المنصّة + ينشئ uploads تلقائياً) ثم **اختبار ميداني** (GPS/خريطة/بصمة/idempotency طابور المال) + عناصرك البشرية (القسم 5).

---

## 2) القرارات المثبّتة (لا تُعاد مناقشتها)

| القرار | التفصيل |
|---|---|
| **الخادم** | يبقى **NestJS + Prisma** — لا إعادة كتابة بـ FastAPI. |
| **لوحات الويب** | تبقى **Next.js** (لا Flutter Web). |
| **الجوّال** | **Flutter** هو الرسمي؛ تطبيقات **Expo تُحذف** بعد اكتمال التحويل. |
| **المتاجر** | لا توجد قوائم منشورة — لا قلق ترحيل. |
| **أسماء الحِزَم** | `com.phibit.daaricustomer` · `com.phibit.daaridriver` · `com.phibit.daariadmin` |
| **الإشعارات** | **Firebase FCM** (عبر `firebase-admin` في الخادم). |
| **عقد API** | مُجمَّد عموماً. **استثناءان مُقرّان:** قناة FCM (#1)، و**idempotency السلامة المالية** (#16/6ب: حقل `clientRequestId` اختياري + قيد UNIQUE على `RefillOrder`/`CashHandover`) — **إضافة متوافقة رجعياً** لا تكسر Expo. أي تغيير عقد آخر يحتاج قراراً صريحاً. |

---

## 3) ✅ ما أُنجِز

**جلسة #18 — 2026-07-01**
- ✅ **إغلاق الحواجز الأربعة الحقيقية من [`DEPLOYMENT_READINESS_REPORT.md`](DEPLOYMENT_READINESS_REPORT.md)** — كلها كود/إعداد **لا تحتاج حسابك**. تحقّق مستقل من الكود الفعلي قبل كل تعديل، ثم `npx tsc --noEmit` = **0 أخطاء** و`node --check` نظيف.
  - **الحاجز #3 — لوحة التحكّم تنهار على أي سائق `ON_BREAK`:** enum الحقيقي `ON_BREAK` ([schema.prisma:410](backend/prisma/schema.prisma#L410)) بينما اللوحة تستخدم مفتاح `BREAK` → `STATUS[d.status].klass` = `undefined.klass` يرمي ويُسقط الجدول كاملاً في error boundary (حدث يومي عادي). أُعيدت التسمية `BREAK→ON_BREAK` في اتحاد النوع وخريطة `STATUS` + **حارس احتياطي** `(STATUS[d.status] ?? STATUS.OFFLINE)` يقاوم أي حالة مستقبلية ([drivers/page.tsx](dashboard/src/app/dashboard/drivers/page.tsx)).
  - **الحاجز #1 — لا أحد يخدم `/uploads/` (صور الإثبات + ملفات التقارير 404):** NestJS لا يخدم static و`location /` يمرّرها للخادم → 404. أُضيف `location /uploads/ { alias /var/www/daari-water-api/uploads/; try_files $uri =404; ... }` في [nginx conf](deploy/nginx/daari-water-api.conf) — يخدم proof + reports من نفس `UPLOADS_DIR`. ملاحظة PII للتقارير موثّقة (روابط UUID تنتهي خلال 24س؛ بديل مصادَق لاحقاً إن لزم).
  - **الحاجز #4 — النشر لا يزرع `PLATFORM_ADMIN` أبداً (لوحة المنصّة معطّلة + لا إنشاء مستأجِرين):** (أ) عُزلت بيانات الديمو (`password123`) خلف `NODE_ENV !== 'production'` بإرجاع مبكر بعد زرع مالك المنصّة في [seed.ts](backend/prisma/seed.ts). (ب) سكربت إنتاجي مستقلّ [`prisma/seed-prod.cjs`](backend/prisma/seed-prod.cjs) بـ JS صِرف **يعمل مع `--omit=dev`** (لأن `@prisma/client`+`argon2` إنتاجيان، بخلاف `prisma`/`ts-node` التطويريين) — يزرع مالك المنصّة فقط بشكل idempotent + يحمّل `.env` بنفسه (عميل Prisma وقت التشغيل لا يحمّله). (ج) رُبط `node prisma/seed-prod.cjs` في [deploy.sh](deploy/deploy.sh) بعد `prisma generate`. (د) أُضيف `PLATFORM_ADMIN_PHONE/PASSWORD` إلى [`.env.production.example`](backend/.env.production.example) — **فشل صريح إن غاب الباسورد** (لا اعتماد افتراضي)، وإعادة النشر لا تُعيد تعيين باسورد قائم.
  - **الحاجز #2 — «رفع السائق يُرجع 500» كان مبالغاً فيه:** القالب [`.env.production.example:72`](backend/.env.production.example) **يضبط `UPLOADS_DIR=/var/www/daari-water-api/uploads` أصلاً** (داخل `ReadWritePaths` بـ systemd)، والتطبيق ينشئ المجلّد ذاتياً عند الإقلاع → لا 500 عند استخدام القالب. أُضيف تحصين فقط: `mkdir -p .../uploads/{proof,reports}` + chown في [deploy.sh](deploy/deploy.sh).
  - **مكافأة (should-fix):** صُحّح اسم متغيّر FCM في القالب `FCM_SERVICE_ACCOUNT_PATH` → `FIREBASE_SERVICE_ACCOUNT_PATH` (الكود يقرأ `FIREBASE_SERVICE_ACCOUNT_JSON`/`_PATH` — [push.service.ts:40-42](backend/src/notifications/push.service.ts#L40)) — كان الدفع يتعطّل بصمت.
  - **الأثر:** `readyToDeploy` انتقل من **4 حواجز كود → 0**؛ المتبقّي مهام تشغيلية/بشرية فقط (خادم جديد، توقيع، Firebase طرف الخادم، مفتاح خرائط، QA ميداني — القسم 5).

**جلسة #17 — 2026-07-01**
- ✅ **تجهيز نشر `prisma db push` (السلامة المالية 6ب) — runbook + تحقّق من الواقع.** لا كود جديد؛ تحقّق وتوثيق.
  - **تحقّق من أرض الواقع:** المخطّط مُودَع فعلاً ([schema.prisma:504/567](backend/prisma/schema.prisma#L504) لـ`RefillOrder`، [652/657](backend/prisma/schema.prisma#L652) لـ`CashHandover`)، ومنطق الخادم المستهلك للمفتاح مُودَع (`createWalkinRefill` [orders.service.ts:1189](backend/src/orders/orders.service.ts#L1189) · `createForDriver` مع التقاط `P2002` [cash-handover.service.ts:34-59](backend/src/cash-handover/cash-handover.service.ts#L34) + حقول DTO). **`git status` نظيف** → كل ذلك في commits (آخرها `eb8ff2e`).
  - 🔎 **اكتشاف مهمّ:** `prisma db push` **ليس خطوة يدوية منفصلة** — [`deploy/deploy.sh:79`](deploy/deploy.sh#L79) يشغّله تلقائياً في كل نشر API (`npx prisma db push --skip-generate` + `generate` + إعادة تشغيل الخدمة). فأوّل `./deploy/deploy.sh api` يطبّق العمود/القيد. المستودع **بلا مجلّد migrations** ويستخدم `db push` حصراً (`migrate deploy` يُعطّل الـ API — تحذير صريح في السكربت).
  - 📄 **الناتج:** [`deploy/RUNBOOK-clientRequestId-db-push.md`](deploy/RUNBOOK-clientRequestId-db-push.md) — نسخة احتياطية (`pg_dump`) → معاينة SQL الدقيق (`prisma migrate diff --script`، توقّف عند أي انحراف هدّام) → تطبيق (نشر متكامل أو `db push` جراحي) → تحقّق بعدي (أعمدة/فهارس + اختبار idempotency وظيفي) → خطة تراجع. يشمل معطيات البيئة (VPS/دليل/خدمة) وتنبيه مسار `.env` القديم في `backup-db.sh`.
  - ✅ **تصحيح توثيقي:** سطر «لم يُنشأ commit بعد» كان قديماً — صُحِّح ليعكس أنّ العمل مُودَع وأنّ المعلّق هو تطبيق `db push` على DB الخادم فقط.
- ✅ **بوّابة جاهزية للنشر — تحقّق بناء/تحليل عبر المكدّس كلّه** (Flutter 3.44.1 · Dart 3.12.1 · Node 24.15، على جهاز المطوّر):
  - **Flutter:** `flutter pub get` نجح؛ `flutter analyze` = **No issues found** على `apps/customer` و`apps/driver` و`apps/admin`. القلب `packages/daari_core` أظهر 11 ملاحظة `info` موروثة (فواصل ذيلية × 10 + قوس `if` × 1) → طُبِّق `dart fix --apply` (فحص جافّ أولاً، 11 إصلاحاً تجميلياً بحتاً في 7 ملفات، لا تغيير سلوكي) → **daari_core صار No issues found أيضاً**. الآن **الوحدات الأربع نظيفة 100%**.
  - **الخادم:** `npm ci` (exit 0) + `npx prisma generate` + **`npx tsc --noEmit` = 0 أخطاء**. مؤكَّد أنّ كود idempotency (6ب) يبني نظيفاً مع عميل Prisma المتضمّن `clientRequestId`.
  - **الخلاصة:** الشيفرة في حالة **قابلة للشحن**؛ لا حواجز بناء متبقّية قبل النشر/التوقيع. الحواجز المتبقّية تشغيلية/بشرية فقط (نشر DB · جهاز فعلي · Firebase/توقيع).
- ✅ **تجهيز Firebase (FCM) — ربط برمجي مسبق + دليل.** فحص من الواقع: حزم `firebase_core`/`firebase_messaging` وتهيئة best-effort و`push_service.dart` والصلاحيات كلّها موجودة؛ والخادم `firebase-admin` جاهز (no-op بلا اعتماد). **الناقص كان ربط Gradle** — أُضيف مكوّن `com.google.gms.google-services` **مشروطاً** في التطبيقات الثلاثة (`settings.gradle.kts` بـ`apply false` + `app/build.gradle.kts` بـ`if (file("google-services.json").exists())`) → **يُفعَّل تلقائياً عند إسقاط الملفّ، ولا يكسر البناء بدونه.** الناتج: [`mobile-flutter/FIREBASE_SETUP.md`](mobile-flutter/FIREBASE_SETUP.md) (خطوات الكونسول + معرّفات الحِزَم الثلاثة ومسارات الملفّات + iOS/APNs + متغيّرات اعتماد الخادم `FIREBASE_SERVICE_ACCOUNT_JSON`/`_PATH` + تحقّق). **يتبقّى عملك:** إنشاء مشروع Firebase وتنزيل الملفّات + ضبط اعتماد الخادم. (الأسرار مُتجاهَلة في `.gitignore` أصلاً.)
  - **تقدّم لاحق في #17:** ✅ أنشأ المستخدم مشروع `daariplatform` وسجّل التطبيقات الثلاثة وأسقط `google-services.json` في أماكنها (مؤكَّد: `package_name` مطابق لكل تطبيق؛ تعدّد الإدخالات طبيعي والمكوّن يختار المطابق). ✅ نزّل مفتاح حساب الخدمة (محفوظ لديه، بلا خادم بعد). صُلّبت `.gitignore` بأنماط `*firebase-adminsdk*.json`/`*service-account*.json` (الاسم الافتراضي لا يطابق النمط القديم). صُحِّح مسار الخادم في الدليل إلى `/etc/daari-water/` (خارج مجلّد النشر — `rsync --delete` يحذف ما بداخله).
  - **⚠️ الخادم `45.84.138.119` أُلغي نهائياً (#17):** أُزيل الـ IP المثبّت من [`deploy.sh`](deploy/deploy.sh) (صار يتطلّب `SSH_TARGET` ويجهض بلا دونه — أماناً من إعادة تعيين العنوان لغير) وعُمِّم في الـ runbook. **يلزم خادم جديد** (القسم 5).
- ✅ **خطّة اختبار QA للجهاز الفعلي — جاهزة.** الناتج: [`mobile-flutter/DEVICE_QA_CHECKLIST.md`](mobile-flutter/DEVICE_QA_CHECKLIST.md) — قائمة فحص منظّمة تغطّي ما لا يُثبته `analyze`: **(أ)** idempotency طابور المال (5 حالات، الإثبات الأهمّ — يتطلّب القيد مُطبَّقاً) · **(ب)** GPS/خرائط السائق (حاجز 50م · فرز الأقرب · خريطة حيّة) · **(ج)** تدفّقات السائق · **(د)** الزبون (map-picker/ترميز عكسي · دورة الطلب) · **(هـ)** الإدارة + قفل البصمة · **(و)** إشعارات FCM (محجوبة حتى Firebase) · **(ز)** اختبار شامل E2E عبر التطبيقات + جدول اعتماد. مبنيّة على المسارات/الميزات الفعلية للتطبيقات الثلاثة وسجلّات التكافؤ. تُعلّم الحواجز البشرية (مفتاح خرائط/Firebase) صراحةً.

**جلسة #16 — 2026-06-30**
- ✅ **بدء المرحلة 2 (السائق) — جرد التكافؤ الكامل** (`apps/driver` ↔ `mobile-worker`) عبر **workflow متعدّد الوكلاء** (تدقيق ← تحقّق خصومي، 12 زوج شاشة) + **وكيل مخصّص لطابور المال**. لا تغيير على الكود بعد (جرد فقط).
  - **النتيجة:** التطابق على مستوى الشاشات **كامل** (12 شاشة)؛ **56 فجوة داخلية مؤكّدة** (1 عالية · 22 متوسّطة · 33 منخفضة، **0 مرفوضة** — كلها صمدت أمام التحقّق الخصومي). السجلّ الدائم: [`mobile-flutter/DRIVER_PARITY_BACKLOG.md`](mobile-flutter/DRIVER_PARITY_BACKLOG.md) + الخام في `mobile-flutter/.parity/driver-audit-2026-06-30.json`.
  - ⚠️ **أخطر نتيجة (طابور المال — القسم 7):** إكمال التعبئة و«reclaim» **آمنان تماماً** ضدّ الإرسال المزدوج بفضل **حارس الخادم الشرطي** (`updateMany` مُقيَّد بالحالة داخل transaction، [`orders.service.ts:733-757`])، ومنفذ Flutter للطابور **أمين لـ Expo بل أأمن** (تفريغ تلقائي عند عودة الاتصال). **لكن** نقطتَي **walk-in** (`createWalkinRefill`) و**تسليم النقد** (`createForDriver`) مجرّد `create()` بلا حارس ولا مفتاح idempotency → **ثغرة مزدوجة الشحن حقيقية** عند إعادة إرسال الطابور (تُسجَّل المبيعة/التسليم مرّتين). الجذر في الخادم → يحتاج قرارك (MS‑1/MS‑2).
  - **أبرز الفجوات العالية/الحرجة:** `forgot-1` (بعد إعادة التعيين يوجّه لـ`/login` بدل دخول تلقائي — نفس إصلاح الزبون #10) · `task-detail-3` (تحقّق وصول GPS 50م غير مطبَّق على reclaim — حارس مضادّ للاحتيال) · `task-detail-1/2` (توجيه reclaim + سبب غير إجباري) · `shift-summary-1` (إنهاء وردية بلا منع نقر مزدوج) · `van-inventory-1` (حفظ بلا حارس متّسخ) · عنقود `home` (فرز GPS «الأقرب أولاً» + شارات مسافة + بطاقة نشطة — ميزة كاملة مفقودة).
  - **خطّة دفعات مقترحة** في ذيل السجلّ (6أ سلامة مالية على العميل → 6ب قرار الخادم → 6ج تدفّقات حرجة → 6د GPS/خريطة → 6هـ/و لمسات وتجميل).
- ✅ **الدفعة 6أ — السلامة المالية على العميل (Flutter بحت، لا لمس للخادم).** **`flutter analyze`: نظيف** (driver: No issues found؛ core: ملفّاي المعدّلان نظيفان، الباقي info-lints موروثة في ملفات لم تُلمَس).
  - **MS‑3 — dedupe طابور العميل:** عمود `dedupe_key` (هجرة SQLite v2) + معامل `dedupeKey` في `OfflineQueue.enqueue` (يتخطّى الإدراج عند تطابق مفتاح معلّق). الإكمال يُفتَّح بـ`/orders/{id}/complete`، والبيع الفوري بـ`walkin:{customerId}:{amount}` → **أُغلق ناقل تنفيذ مزدوج الشحن على العميل** (تبقّى الجذر الخادمي MS‑1/MS‑2 لقرارك).
  - **splash-routing‑3 + ‑1:** أُضيف `_AppChrome` فوق الـ router في `main.dart` — يصرّف الطابور دورياً (60ث) + فور عودة الاتصال **على مستوى التطبيق** (كان مقيّداً بتبويب الرئيسية)، ويعرض **شريط «غير متصل» على كل الشاشات** (مكافأة). نُقِل منطق التفريغ من `home_screen` (أُزيل تكراره).
  - **shift-summary‑1:** الشاشة صارت `ConsumerStatefulWidget` بعلَم `_ending` يعطّل زرّ «أنهِ الوردية» طوال إيقاف التتبّع والتنقّل (منع نقر مزدوج).
  - **van-inventory‑1 + ‑2:** حارس «متّسخ» (`_dirty` يقارن القيم بقيم الخادم) يعطّل الحفظ ويمنع POST لا-عمل + نصّ «لا توجد تغييرات لحفظها» (مكافأة).
  - **النتيجة:** أُغلِقت **6 بنود** (MS‑3 · splash-routing‑1/3 · shift-summary‑1 · van-inventory‑1/2).
- ✅ **الدفعة 6ج — التدفّقات الحرجة (Flutter بحت، لا لمس للخادم).** **`flutter analyze`: No issues found.**
  - **forgot‑1 (🔴):** شاشة استعادة كلمة السر للسائق صارت تستدعي `authControllerProvider.notifier.resetPasswordAndLogin()` (توثّق حالة المصادقة في الذاكرة) وتوجّه إلى `/home` بدل `/login` — **نفس إصلاح الزبون #10** (الخادم يُصدر توكنات بعد إعادة التعيين).
  - **task-detail‑1:** فرع الاسترجاع (منتقي السبب + «أكّد سحب الخزان») يظهر من `ASSIGNED` مباشرةً (`isReclaim && (isAssigned || isEnRoute)`) **بلا «ابدأ الجولة»** — الخادم يقبل الإكمال من ASSIGNED (يطابق Expo).
  - **task-detail‑2:** `_reclaimReason` صار `null` ابتدائياً (لا افتراضي `customerMoved`)؛ زرّ التأكيد مُعطَّل حتى الاختيار + نصّ إرشادي + حارس داخلي في `_complete` (**منع تسجيل سحب بلا سبب تدقيق**).
  - **task-detail‑3:** أُزيل استثناء `tankReclaim` من حاجز الوصول → فحص الـ50م المضادّ للاحتيال يُطبَّق على الاسترجاع أيضاً (يطابق `verifyArrivalGPS` في Expo).
  - **النتيجة:** أُغلِقت **4 فجوات** (forgot‑1 · task-detail‑1/2/3).
- ✅ **الدفعة 6د — ميزات GPS/الخريطة (Flutter بحت، لا لمس للخادم).** **`flutter analyze`: No issues found.**
  - **core:** `Launchers.navigateToAddress` (بحث خرائط نصّي) + `driverCoordsProvider` (نبضة موقع) + `nearestFirstProvider` + `distanceLabel`/`DistanceChip` في `order_widgets`.
  - **home‑2 (شارات مسافة):** `DistanceChip` على بطاقات المتاح والمهام (تختفي بهدوء بلا GPS).
  - **home‑1 (فرز «الأقرب أولاً»):** شريحة في ترويسة «مهام اليوم» تبدّل `nearestFirstProvider`؛ عند التفعيل تُرتَّب المهام بالمسافة (المهام بلا إحداثيات أخيراً)، وبلا موقع تُعيد جلب GPS وتنبّه.
  - **home‑3 (بطاقة المهمّة النشطة):** `_activeTaskCard` — CTA متدرّج «قيد التنفيذ» + المسافة + «تابِع المهمة» يُفصَل أعلى القائمة (EN_ROUTE).
  - **task-detail‑4 (خريطة حيّة + ETA):** `_MapPreview`/`_TaskMap` — دبّوس السائق الأزرق حين يتوفّر ويكون قريباً + موقع يُحدَّث كل 10ث (`_locTimer`) + طبقة زجاجية بالمسافة والوصول (~22كم/س).
  - **task-detail‑5 (لا‑GPS):** حالة توضيحية بدل إسقاط الخريطة عند غياب إحداثيات الزبون. **task-detail‑6 (ملاحة نصّية):** زرّ الملاحة يستخدم الإحداثيات أو يتراجع لنصّ «العنوان، الحيّ، بغداد».
  - **النتيجة:** أُغلِقت **6 فجوات** (home‑1/2/3 · task-detail‑4/5/6).
- ✅ **الدفعة 6هـ — لمسات الشاشات (Flutter بحت، لا لمس للخادم).** **`flutter analyze`: No issues found.** أُغلِق **14 بنداً** (10 متوسّطة + 4 منخفضة مكافأة):
  - **home‑5:** إثراء بطاقة الطلب المتاح (صورة الحرف + شارات النوع/السعة/QR + شارة «جديد»).
  - **profile‑1/2:** مبدّل فترة الأداء أسبوع/شهر (`profilePerfPeriodProvider` + `_PeriodToggle`) + صفّ «ملخّص الوردية وإنهاؤها» → `/shift-summary`.
  - **login‑1/2:** مساعِد `_loginError` (401 → إرشاد المعمل لإعادة التعيين · 429 → «بعد ١٥ دقيقة»).
  - **walkin‑1/2/4/5:** QR الخزّان في نتيجة البحث وبطاقة الزبون (`customer.tanks`) + تاريخ آخر تعبئة + لترات إلزامية بافتراضي 500.
  - **shift-summary‑2/3:** حوار التأكيد يذكّر بتسليم النقد و«غير متصل» + تعليق مساعد تحت الزرّ.
  - **van-inventory‑3:** حوار «تم الحفظ» + رجوع تلقائي. **earnings‑5:** الحالة الفارغة `total==0` مع إبقاء البطل. **history‑2:** تاريخ فقط.
- ✅ **history‑1 — اسم الزبون في السجلّ (دفعة موديل، Flutter بحت).** **`flutter analyze`: نظيف.** أُضيف `RefillOrder.customerName` (يُقرأ من `customer.fullName`) — **تحقّق خصومي بعقد الخادم:** `listMyHistory` يضمّ `customer: true` و`Customer.fullName` حقل scalar، **فلا تغيير على الخادم**. بطاقة السجلّ صارت تعرض اسم الزبون (بديل «— مجهول —») والنوع+التاريخ ثانوياً.
- ✅ **الدفعة 6و — التجميل (Flutter بحت، لا لمس للخادم).** **`flutter analyze`: No issues found.** أُغلِق **22 بنداً منخفضاً**:
  - **اهتزاز:** cash (نجاح/خطأ) · van-inventory (خطوات+حفظ) · earnings (تبديل الفترة) عبر `Hap`.
  - **حركة/تجميل:** هالة نابضة للنقد المعلَّق (`_PulseGlow`) · قيمة فوق أعمدة الأرباح + نموّها (`TweenAnimationBuilder`) + دخول البطاقات (`_FadeSlideIn`).
  - **تواريخ/نصوص:** cash تاريخ-فقط · earnings عنوان فرعي · shift-summary وسم «سحب خزان» + سحب-للتحديث · walkin تذييل نصيحة QR · profile (رابط شروط/خصوصية + مبلغ كامل بـ`FittedBox` + دور «سائق معمل»).
  - **سلوك/تحليلات:** home حوار تأكيد القبول · login زرّ يعكس الصحّة + `login_success` · task-detail (`durationSec`/`priceIqd`/`order_cancelled_by_driver`) · van-inventory وسم «جارٍ الحفظ…» (`loadingLabel` أُضيف لـ`LoadingButton`) · forgot-2 (رجوع للخطوة 1 ومسح).
  - ⏸️ **مؤجَّل 3 + 1 غير منطبق:** home‑4 (التقدّم اليومي — «منجز» غير متوفّر نظيفاً) · home‑7 (مدخل walk-in موجود، إعادة هيكلة منخفضة القيمة) · splash-routing‑4 (حارس نوع الإشعار — يحتاج تثبيت تصنيف أنواع إشعارات الخادم؛ الحارس الخاطئ يكسر كل الفتح) · login‑4 (دخول تطويري — مكافئه وضع العرض، غير منطبق).
  - **إجمالي بعدها: 53 بنداً مُغلقاً** (MS‑3 + 52 من الـ56).
- ✅ **الدفعة 6ب — إغلاق الثغرة المالية الجذرية على الخادم (idempotency).** بقرار صريح منك، وبتصميم **إضافي متوافق رجعياً** لا يكسر عقد العميل القائم. **`tsc --noEmit` exit 0 · عميل Prisma تولّد · `flutter analyze` نظيف.**
  - **المخطّط (Prisma):** عمود `clientRequestId String?` + قيد `@@unique([tenantId, clientRequestId])` على `RefillOrder` و`CashHandover`. **متوافق رجعياً:** Expo لا يرسل المفتاح؛ Postgres يعامل NULL كمتمايز فلا تتعارض الصفوف القديمة/الخادمية.
  - **الخادم:** `createWalkinRefill` و`createForDriver` صارا: إن وُجد مفتاح، يُرجَع الصفّ القائم له؛ وإلا يُنشأ مع المفتاح؛ مع التقاط `P2002` لإرجاع الأصلي عند تسابق التفريغ. + حقل `clientRequestId` في `WalkinRefillDto`/`CreateHandoverDto`.
  - **Flutter:** `newClientRequestId()` (UUIDv4 عبر `Random.secure`) في `order_inputs`؛ يُولَّد **مرّة** ويُمرَّر في `WalkinRefillInput` (للإرسال المباشر وللطابور معاً) و`handoverCash`. هكذا تُغلَق ثغرة «نجح الإرسال لكن ضاع الردّ → أُعيد من الطابور» نهائياً.
  - **النتيجة:** **MS‑1 مُغلق جذرياً** (مع MS‑3 كطبقة عميل) و**MS‑2 مُغلق على الخادم** (الحوار لا يُدرِج بالطابور اليوم، فهذه حماية + استباق). **MS‑4** (تسجيل سائق مكرّر، ليس مالاً) و**MS‑5** (حيوية الطابور) منخفضان مؤجَّلان.
  - ⚠️ **خطوة نشر مطلوبة:** تشغيل **`prisma db push`** على الخادم لتطبيق العمود/القيد (تغيير غير هدّام). الكود جاهز؛ التطبيق على قاعدة البيانات معلّق على النشر.
  - **إجمالي #16: 55 بنداً مُغلقاً** (MS‑1/2/3 + 52 من الـ56). المتبقّي: 3 مؤجَّلة منخفضة + login‑4 غير منطبق + MS‑4/5 منخفضان.

**جلسة #15 — 2026-06-30**
- ✅ **الدفعة 5ج الأخيرة — اكتمال تكافؤ الزبون (8 فجوات → 74/75 مُغلقة).** **`flutter analyze`: نظيف.** لا خادم.
  - **home:** عدّاد عرض تنازلي (`_PromoCountdown`، Timer 30ث، يحمرّ في آخر 5د) · محدِّد عنوان التوصيل (`_AddressSelector` → `createRefill(addressId:)`) · شارة «🎉 عرض محدود!» · حالة خطأ بزرّ تسجيل خروج (`_ProfileError`) · إخفاء «0 تعبئة».
  - **signup:** زرّ «تعديل المعلومات» للرجوع من OTP · قائمة «ماذا يحدث الآن؟» (٤ خطوات + رقم الهاتف) في شاشة النجاح.
  - **عام:** شريط «غير متصل بالإنترنت» في `main.dart` (`_OfflineWrapper` يراقب `isOnlineProvider` فوق كل الشاشات).
  - **النتيجة:** كل الـ75 فجوة عولِجت (74 مُغلقة + 1 قرار منتج: login «لا حساب» مُبقىً). **تكافؤ تطبيق الزبون مكتمل** — التالي **QA شامل** ثمّ التقاعد.

**جلسة #14 — 2026-06-30**
- ✅ **الدفعة 5ب من تكافؤ الزبون (16 فجوة → 67/75).** **`flutter analyze`: تطبيق الزبون نظيف.** لا خادم.
  - **مساعِدات core:** `Launchers.email` + تحويل `Launchers.*` إلى `Future<bool>` لرصد فشل الفتح · `LabeledField.digitsOnly` (ترشيح أرقام لحظي) · `Fmt.arabicMonthYear`.
  - **support:** ورقة «أبلغ عن مشكلة» (واتساب/بريد) · قناة بريد `info@phi-bit.com` · رسائل فشل الفتح · 3 أسئلة شائعة جديدة.
  - **orders:** تجميع شهري بترويسات · شارة عدّاد في الترويسة · مؤشّر حالة بالأيقونة/اللون (`orderStatusIcon`).
  - **schedules:** منتقي عنوان توصيل (اختياري) · عرض العنوان على البطاقة · تعديل أوّل تعبئة بأزرار ±يوم.
  - **forgot:** «إعادة الإرسال» يرجع للخطوة 1 ويمسح · ترشيح أرقام. **signup:** ترشيح أرقام · السماح باختيار معمل خارج النطاق.
  - **addresses:** عنوان فرعي بعدد العناوين. **order-detail:** زر «افتح في خرائط Google».

**جلسة #13 — 2026-06-30**
- ✅ **الدفعة 5أ من تكافؤ الزبون — لمسات الشاشات النصّية/البسيطة (17 فجوة → 51/75).** **`flutter analyze`: تطبيق الزبون نظيف.** لا موديل/خادم/حزم.
  - **welcome:** شارات منافع · عنوان «كيف تستخدم داري؟» · نصّ توضيحي لكل مسار · رابط الشروط والخصوصية · تذييل الناشر/الإصدار.
  - **intro:** أربع شرائح مطابقة لـ Expo (الأولى «ماؤك يصل إليك» + رابعة «لا تنسَ ماءك») + إخفاء «تخطّي» في الأخيرة.
  - **login:** نصّ فرعي إرشادي · تعطيل الزرّ حتى صحّة المدخلات (`_canSubmit`) · نصّ الموافقة على الشروط.
  - **profile:** عرض العنوان الكامل (`addressLine`) · حالة الرصيد الصفري «مدفوع» بأيقونة توثيق.
  - **wallet:** توحيد وسم بطاقة الرصيد («رصيد الحساب» + ملاحظة دَين ثانوية) · سجلّ الدفعات يشمل أي `paidAmountIqd>0`.
  - **notifications:** عدّاد غير المقروء في الهيدر · إخفاء «تعليم الكل مقروء» عند عدمه.

**جلسة #12 — 2026-06-30**
- ✅ **الدفعة 4 من تكافؤ الزبون — منتقي الخريطة + reverse-geocode (8 فجوات → 34/75).** **`flutter analyze`: No issues found.** لا خادم.
  - **حزمة جديدة:** `geocoding ^3.0.0` (`flutter pub get` نجح) — الاعتماد الوحيد المُضاف في كل المرحلة 1.
  - **map-picker:** أُعيد كتابته — جلب GPS تلقائي عند الفتح + شاشة تحميل، إحداثيات حيّة فوق زرّ التأكيد، وعكس ترميز جغرافي عند التأكيد يُرجِع `MapPickResult{lat,lng,address}` بدل `LatLng` المجرّد.
  - **signup:** زرّ «حدّد موقعك على الخريطة» في خطوة الإدخال (`_pickOnMapForInfo` لا يغادر الخطوة) + تعبئة العنوان تلقائياً من الترميز العكسي + مؤشّر «موقعك مُحدَّد ✓».
  - **addresses:** زرّ تحديد الموقع في نموذج الإضافة/التعديل (يلتقط lat/lng ويمرّرها لـ `AddressInput`) + مؤشّر «موقع محدد على الخريطة» على بطاقة العنوان (`hasPin`).
  - ⏳ **يحتاج جهازاً للاختبار النهائي** (GPS + الترميز العكسي يتطلّبان جهازاً؛ الكود مكتمل ونظيف).

**جلسة #11 — 2026-06-30**
- ✅ **الدفعة 3 من تكافؤ الزبون — شاشة الإعداد (onboarding، 7 فجوات نصّية → 26/75).** **`flutter analyze`: No issues found.** لا موديل ولا خادم.
  - **Step1:** حوار «الموقع مطلوب» التفصيلي («مرّة واحدة فقط… لن نتتبّعك») بدل SnackBar عام.
  - **Step2:** صفّ إحصائيات (تعبئة ١٠٠٠ د.ع · سعة ٥٠٠ لتر · تركيب مجاني) + صندوق كهرماني حول حصرية معمل المنطقة.
  - **Step3:** قائمة «ماذا سيحدث عند وصوله» (٤ بنود ✓) + زرّ رجوع.
  - **Step4:** صندوق شروط قابل للتمرير (٥ بنود: الملكية/التعبئة الشهرية ١٠٠٠/سحب بعد ٤٥ يوماً/الإبلاغ عند الانتقال/الإلغاء) + نصّ قبول يُقرّ باستلام خزان ٥٠٠ لتر في العهدة + زرّ رجوع.

**جلسة #10 — 2026-06-30**
- ✅ **الدفعة 2 من تكافؤ الزبون — تغييرات الموديل + عالية الأثر (11 فجوة، الإجمالي 19/75).** **`flutter analyze`: تطبيق الزبون No issues found.** لا لمس للخادم.
  - **تغييرات `daari_core` (تحقّق خصومي بعقد الخادم أولاً):** `NearestPlant.refillPriceIqd` · `RefillOrder.{customerConfirmedAt, paymentMethod, notes}` · `OrderDriverRef.vehiclePlate` · `AuthRepository.resetPassword` يخزّن التوكنات ويعيد `MeResponse` + `AuthController.resetPasswordAndLogin`. (مؤكّد: `findOneForViewer` يُعيد كل الحقول السلمية + `driver.vehiclePlate`؛ `verifyOtpAndResetPassword` يُصدر توكنات؛ `refillPriceIqd` في tenants.)
  - **forgot:** دخول تلقائي بعد إعادة التعيين → `/home` (بدل العودة لـ`/login`) + رسالة تأكيد الإرسال (صلاحية 10 دقائق) + إرسال تلقائي عند اكتمال الرمز.
  - **order-detail:** التأكيد/الإبلاغ يظهران فقط قبل `customerConfirmedAt` + لافتة شكر بعده · صفّ طريقة الدفع · صفّ الملاحظات · رقم مركبة السائق · تقييد ETA بـ`EN_ROUTE`.
  - **orders:** معاينة إيصال مضمّنة قابلة للطيّ للطلبات المكتملة (رقم/مبلغ/مدفوع/طريقة دفع/سائق/تاريخ).
  - **signup:** عرض سعر التعبئة في بطاقة المعمل.

**جلسة #9 — 2026-06-30**
- ✅ **جرد تكافؤ تطبيق الزبون (Flutter ↔ Expo)** عبر **workflow متعدّد الوكلاء** (تدقيق ← تحقّق خصومي، 18 زوج شاشة، 36 وكيلاً):
  - **التطابق على مستوى الشاشات كامل** (18 شاشة)؛ الفجوات **داخل الشاشات**. **75 فجوة مؤكّدة** (14 عالية)، `settings` بتكافؤ تامّ.
  - السجلّ الدائم: [`mobile-flutter/CUSTOMER_PARITY_BACKLOG.md`](mobile-flutter/CUSTOMER_PARITY_BACKLOG.md) (checklist بالأولوية) + التقرير الخام في `mobile-flutter/.parity/customer-audit-2026-06-30.json`.
- ✅ **الدفعة 1 — السلامة والصحّة (8 فجوات أُغلِقت).** **`flutter analyze`: No issues found.** لا لمس للخادم.
  - **home:** حارس الطلب النشط — زر الطلب يتحوّل لـ«تابِع الطلب» عند وجود طلب تعبئة حيّ (يمنع الطلبات المكرّرة) + تقييد كشف الطلب النشط بنوع `REFILL`.
  - **orders:** حارس الطلب النشط عند «إعادة الطلب» (يوجّه للطلب الحيّ بدل الإنشاء) + تقييد «إعادة الطلب» بـ`REFILL` المكتمل + زر إجراء في الحالة الفارغة.
  - **login:** تحقّق كلمة المرور (6 محارف عبر `Validators.isPassword`) + رسائل خطأ 429/401 خاصّة بالدخول + زرّ إظهار/إخفاء كلمة المرور (`obscureToggle` أُضيف لـ `LabeledField`).

**جلسة #8 — 2026-06-30**
- ✅ **فلاتر التاريخ (from/to) على التقارير** — آخر لمسة تكافؤ وظيفي لتطبيق الإدارة. **`flutter analyze`: No issues found.** لا لمس للخادم.
  - **حالة مدى مشتركة:** `reportWindowProvider` (StateProvider غير autoDispose، يبقى عبر التنقّل)، نوع `ReportWindow` (سجلّ `({from,to})`)،
    وامتداد `ReportWindowIso` يحوّل المدى إلى ISO (**`from`=00:00، `to`=23:59:59**) ليصحّ الشمول مع نقاط الخادم الحصرية (`lt`) والشاملة (`lte`).
  - **ربط المزوّدات:** `revenue7d` · `topCustomers` · `topDrivers` · `peakHours` · `cohort` صارت تقرأ المدى وتعيد الجلب تلقائياً عند تغيّره.
  - **`ReportWindowBar`** (في `widgets/common.dart`): بطاقة تعرض الفترة + `showDateRangePicker` عربي (RTL) + زرّ مسح؛ مضافة أعلى **شاشة التقارير** و**التقارير المتقدّمة**.
  - **التصدير** (`_ExportCard`) صار يمرّر `from/to` المختارين، فالملفّات تحترم نفس الفترة.
  - **تحقّق خصومي بعقد الخادم** (`reports.controller.ts`/`parseRange`): `windowEnd` حصري (`lt`) في معظم النقاط وشامل (`lte`) في المتصدّرين → صيغة 00:00/23:59:59 تجعل العدّ صحيحاً لكليهما (تحقّقت بحساب نوافذ revenue-7d وtop-customers).
  - استغلال الخزّانات يبقى لحظياً (لا مدى) عمداً.

**جلسة #7 — 2026-06-30**
- ✅ **لمسات تكافؤ تطبيق الإدارة** (`apps/admin` صار **14 شاشة**) — 3 شاشات جديدة + متابعة بثّ حيّة، كلها على نمط
  `ConsumerWidget`/`AsyncView` + providers تغلّف repositories جاهزة في core. **`flutter analyze`: No issues found.** لا لمس للخادم.
  - **أداء السائقين** (`driver_performance_screen` · `/drivers/performance`): قائمة مرتّبة + **منتقي نافذة 30/60/90 يوماً**
    (`driverPerfWindowProvider` StateProvider يقود `driverPerformanceProvider`) عبر `plantRepository.driverPerformance(days:)` — مع شريحة حالة ملوّنة.
  - **الخريطة الحرارية** (`driver_heatmap_screen` · `/reports/heatmap`): لكلّ سائق المناطق التي خدمها مع أشرطة كثافة نسبية + الإيراد،
    عبر `reportsRepository.driverHeatmap()` (`driverHeatmapProvider`).
  - **سجلّ التدقيق** (`audit_log_screen` · `/audit`): قائمة **مرقّمة («تحميل المزيد»)** + **فلاتر أفعال** (الكل/المخزون/العروض/الفريق/التهيئة)
    عبر `plantRepository.auditLogPaged(page,action)`. **تحقّق خصومي بعقد الخادم:** الفلتر `contains` ورموز الأفعال الفعلية
    (`stock.update` · `promo.send` · `promo.queue` · `team.{invite,update,delete}` · `onboarding.skip`) — لا قيم مُختلقة؛ الصلاحية OWNER/MANAGER يعالجها `AsyncView` كـ 403.
  - **متابعة بثّ حيّة** (تحسين `promos_screen`): نقر بطاقة البثّ → ورقة سفلية تستقصي `promoRepository.blastStatus(id)`
    عبر `blastStatusProvider.family` (كل 5 ثوانٍ ما دام QUEUED) بشريط تقدّم + عدّادات أُرسِل/فشل + شريحة حالة ملوّنة.
  - رُبِطت المسارات الثلاثة + بلاطات «المزيد» (أداء السائقين · الخريطة الحرارية · سجلّ التدقيق).

**جلسة #6 — 2026-06-30**
- ✅ **قفل الدخول بالبصمة (`local_auth`) لتطبيق الإدارة.** **`dart analyze` في admin: No issues found** (لا ملاحظات جديدة في ملفات core).
  - **core:** خدمة مشتركة `BiometricService` (`services/biometric_service.dart` — غلاف `local_auth`: `isAvailable` يتطلّب بصمة مُسجَّلة فعلاً، `label` عربي حسب النوع، `authenticate` لا يرمي ويسمح ببديل PIN) + علَم `biometricEnabled` get/set في `LocalFlags` (SharedPreferences، الافتراضي «لا» حتى لا نحبس المستخدم) + أُضيف `local_auth: ^2.3.0` لـ pubspec وصُدّرت الخدمة من barrel. (انحلّ `local_auth 2.3.0` + android/darwin/windows.)
  - **admin (المنصّات):** `MainActivity` → `FlutterFragmentActivity` + صلاحية `USE_BIOMETRIC` (Android) + `NSFaceIDUsageDescription` (iOS).
  - **admin (التدفّق):** شاشة قفل `lock_screen` على مسار `/lock` (مُطالبة تلقائية عند الإقلاع البارد؛ نجاح → `/home`، خروج → يمسح العلَم ويعود `/login`) + بوّابة في `splash` (جلسة سارية + العلَم مفعّل + متاح → `/lock`) + عرض تفعيل بعد أوّل دخول في `login_screen` (يُعرض فوق **الـ Navigator الجذر** `adminRootNavigatorKey` لأنّ الحارس ينقل المستخدم إلى `/home` فيُفكَّك سياق شاشة الدخول) + مفتاح «قفل بالبصمة» في «المزيد» (قسم الأمان، يؤكَّد بمسحة عند التفعيل، ويُعطَّل إن لم يتوفّر) + مسح العلَم عند الخروج.
  - **لا لمس للخادم.** المتبقّي: اختبار ميداني على جهاز فعلي (لا يمكن التحقّق من مُطالبة البصمة دون جهاز).

**جلسة #5 — 2026-06-29**
- ✅ **خريطة الأسطول الحيّة** لتطبيق الإدارة (`apps/admin` صار **11 شاشة**). **`dart analyze`: نظيف في admin والملفات الجديدة.**
  - **core:** نموذج `LiveDriver` (`live_driver.dart`) + دالة `liveDrivers()` في `driver_repository` على نقطة الإدارة `GET /drivers/live` (كل سائقي المعمل + آخر موقع + علم `inactive`)، وصُدِّر من barrel. **لا تغيير على الخادم** (نقطة قائمة أصلاً).
  - **admin:** اعتماد `google_maps_flutter` + إعداد Android (placeholder `MAPS_API_KEY` في `build.gradle.kts` + meta-data في الـ manifest، نفس نمط customer) + شاشة `fleet_map_screen` (علامات ملوّنة حسب الحالة/الخمول + شريط عددي + استقصاء كل 15ث عبر `liveDriversProvider`) + مسار `/fleet` + بلاطة في «المزيد».
  - بلا مفتاح خرائط تظهر الخريطة رمادية دون تعطّل (المفتاح للإنتاج — أُضيف للقسم 5).

**جلسة #4 — 2026-06-29**
- ✅ **استكمال شاشات تطبيق الإدارة** (`apps/admin` صار **10 شاشات**) — كلها على نمط ConsumerWidget + `AsyncView` + providers تغلّف repositories الجاهزة. **`dart analyze`: No issues found.**
  - **المخزون** (`stock_screen`): عرض المستوى/النسبة + إضافة كمّية (top-up) + ضبط المستويات يدوياً (`plantRepository.updateStock`).
  - **العروض** (`promos_screen`): تبويبان — حملات التخفيض (رصيد المحفظة + قائمة + إنشاء + إيقاف) والبثّ الترويجي (إرسال PUSH/WHATSAPP + سجلّ) عبر `promoRepository`.
  - **الفريق** (`team_screen`): أُضيفت الإجراءات — دعوة عضو (مع عرض كلمة المرور المؤقّتة) + تغيير الدور + تفعيل/إيقاف + حذف (`teamRepository`)، مع حماية المالك المؤسِّس والذات.
  - **تقارير متقدّمة** (`advanced_reports_screen`): ساعات الذروة (رسم أعمدة) + استغلال الخزّانات + احتفاظ الأفواج + **تصدير** PDF/Excel وفتح الرابط (`reportsRepository` + `Launchers.openUrl`).
  - **تهيئة المعمل** (`onboarding_screen`): قائمة الخطوات + تخطّي (`onboardingRepository`).
  - رُبِطت المسارات الجديدة (`/stock` · `/promos` · `/reports/advanced` · `/onboarding`) + بلاطات تنقّل في «المزيد».
  - **لا لمس للخادم.**

**جلسة #3 — 2026-06-29**
- ✅ **هيكلة تطبيق الإدارة `mobile-flutter/apps/admin`** (`com.phibit.daariadmin`) — يعمل ويُحلَّل نظيفاً (**`dart analyze`: No issues found**):
  - بنية المنصّات عبر `flutter create` (android/ios/web)، ثم **ضبط معرّف الحزمة** يدوياً إلى `com.phibit.daariadmin`
    (namespace + applicationId في `build.gradle.kts`، حزمة ومسار `MainActivity.kt`)، + `build.gradle.kts` بتوقيع `key.properties` (متّسق مع الأشقّاء)، + صلاحيتا INTERNET و POST_NOTIFICATIONS في الـ manifest.
  - سُجِّل التطبيق في `workspace` بجذر `mobile-flutter/pubspec.yaml`؛ `pubspec.yaml` يعتمد `daari_core` + riverpod + go_router + firebase_core + intl.
  - `lib/`: `main.dart` (RTL/عربي + FCM best-effort + crash reporting) · `router.dart` (go_router بحارس مصادقة، مسار `/login` وحيد) · `providers.dart` (مزوّدات تغلّف طبقة `plant/` مع polling) · `widgets/{common,home_shell}` · **6 شاشات**: `splash` · `login` · `home` (لوحة مؤشّرات حيّة: KPIs + لقطة insights + خطّ النشاط) · `reports` (إيراد ٧ أيام + أفضل الزبائن/السائقين) · `team` (قائمة الفريق) · `more` (المستخدم + الاستهلاك + خروج).
  - قشرة تبويبات: الرئيسية · التقارير · الفريق · المزيد.
  - **لا لمس للخادم.**

**جلسة #2 — 2026-06-29**
- ✅ **طبقة بيانات الإدارة في `daari_core`** (أكبر قطعة تمهيدية لتطبيق admin) — على نفس نمط الـ repositories القائم
  (Dio + `try/catch` → `ApiException`, نماذج بـ `P.*` + `fromJson`):
  - **5 repositories** في `lib/src/api/`: `plant_repository` (kpis · stock get/post · usage · audit-log بشكليه المسطّح والمرقّم · driver-performance · activity-feed) ·
    `promo_repository` (البثّ: blast/history/status + الحملات: list/create/pause) · `reports_repository` (revenue-7d · top-customers · top-drivers · insights · peak-hours · cohort · driver-heatmap · tank-utilization · export) ·
    `team_repository` (list · invite · update · delete) · `onboarding_repository` (status · skip).
  - **12 ملف نماذج** جديدة في `lib/src/models/` (KPIs، WaterStock، PlantUsage، AuditLog + `PagedResult<T>` عام، DriverPerformance، ActivityEvent، PromoNotification، PromoCampaign، تقارير، TeamMember، OnboardingStatus) مع enums بقيم Prisma الدقيقة (UserRole، SubscriptionPlan، TenantStatus، PromoChannel، PromoStatus، PromoCampaignStatus، ActivityEventKind).
  - رُبِطت 5 providers في `core_providers.dart` وصُدِّر كل شيء من barrel `daari_core.dart`.
  - **تغطّي 28 نقطة `/plant/*`** عبر 5 controllers (استُبعِد `customers/me/active-promo` لأنه للزبون ومغطّى أصلاً في `customer_repository`).
  - **`dart analyze` نظيف (0 أخطاء/تحذيرات في الملفات الجديدة)** + **تحقّق خصومي**: كل repository طوبق مقابل عقد الـ controller الفعلي → **«faithful» بلا انحرافات**.
  - **لا لمس للخادم** (عقد `/api/v1` مُجمَّد).

**جلسة #1 — 2026-06-28**
- ✅ **توحيد معرّفات الحِزَم** لتطبيقَي Flutter:
  - customer → `com.phibit.daaricustomer` · driver → `com.phibit.daaridriver`
  - شمل: Android `namespace`+`applicationId`، حزمة `MainActivity.kt` ومسار مجلّدها، iOS `PRODUCT_BUNDLE_IDENTIFIER`.
- ✅ **تحويل إشعارات الخادم Expo Push → FCM** في `backend/src/notifications/push.service.ts`:
  - الواجهة العامة بلا تغيير (`registerToken/sendToUser/sendToUsers/sendToTenantAdmins`)، لا تغيير في المستدعين ولا في جدول `PushToken`.
  - يتعطّل بأمان (no-op) إن لم تُضبَط بيانات اعتماد Firebase.
  - أُضيف `firebase-admin@^13` وثُبِّت — **`tsc --noEmit` ينجح (0 أخطاء)**.
- ✅ تحديث `STRUCTURE.md` ليعكس التوجّه الجديد + إنشاء هذا الملف.

> **ملاحظة (مُصحَّحة #17):** العمل مُودَع في commits (`git status` نظيف؛ آخرها `eb8ff2e Form Home`) — كان هذا السطر
> يقول «لم يُنشأ commit بعد» وهو قديم. **لم يُطبَّق `prisma db push` على قاعدة بيانات الخادم بعد** (يُطبَّق تلقائياً
> عند أوّل `./deploy/deploy.sh api` — انظر القسم 4 و[`deploy/RUNBOOK-clientRequestId-db-push.md`](deploy/RUNBOOK-clientRequestId-db-push.md)).

---

## 4) ⏭️ ابدأ من هنا (الخطوة التالية مباشرةً)

اختر مساراً (مرتّب حسب الأولوية):

> ✅ **تكافؤ تطبيق الإدارة اكتمل وظيفياً** (#7 أداء السائقين/الخريطة الحرارية/سجلّ التدقيق/متابعة البثّ · #8 فلاتر التاريخ).
> لم يبقَ عليه سوى **اختبار البصمة ميدانياً** على جهاز فعلي (يحتاج جهازاً — الكود مكتمل ويُحلَّل نظيفاً).

> ✅ **تكافؤ تطبيق الزبون اكتمل** (74/75 — [السجلّ](mobile-flutter/CUSTOMER_PARITY_BACKLOG.md)؛ الوحيد المتبقّي قرار منتج).
> يبقى عليه **QA شامل** (الأفضل على جهاز فعلي) قبل التقاعد.

> ✅ **تكافؤ السائق مكتمل عملياً** — **55 بنداً مُغلقاً (52 من الـ56 + MS‑1/2/3)** عبر 6أ/ج/د/هـ + history‑1 + 6و + 6ب ([السجلّ](mobile-flutter/DRIVER_PARITY_BACKLOG.md)). **كل العالية/المتوسّطة + التجميل + الثغرة المالية مُغلق.** `tsc` exit 0 · `flutter analyze` نظيف.

> ✅ **الحواجز الأربعة للنشر أُغلقت كوداً (#18):** `/uploads` بـnginx · انهيار `ON_BREAK` في اللوحة · زرع `PLATFORM_ADMIN` (`seed-prod.cjs` في `deploy.sh`) · تحصين `UPLOADS_DIR` + تصحيح متغيّر FCM. **صفر حواجز كود متبقّية** — الباقي تشغيلي/بشري (القسم 5). التفاصيل في [`DEPLOYMENT_READINESS_REPORT.md`](DEPLOYMENT_READINESS_REPORT.md).

1. **(⚠️ يحتاج الخادم الجديد) أوّل نشر متكامل:** أوّل `./deploy/deploy.sh api` **يطبّق `prisma db push`** (عمود/قيد `clientRequestId` 6ب) **+ يزرع مالك المنصّة** (`seed-prod.cjs`، الحاجز #4) **+ ينشئ مجلّد uploads** — كلها مؤتمتة الآن. التغيير غير هدّام (عمود nullable + فهرس على صفوف كلها NULL). الـ runbook لقيد idempotency: [`deploy/RUNBOOK-clientRequestId-db-push.md`](deploy/RUNBOOK-clientRequestId-db-push.md) (نسخة احتياطية → معاينة SQL → تطبيق → تحقّق → تراجع).
2. **(لا يحتاج حسابك) اختبار ميداني + QA على جهاز فعلي:** ميزات GPS/الخريطة (6د) + البصمة + **طابور المال idempotency** (إثبات أن إعادة الإرسال لا تُكرّر البيع). **الخطّة جاهزة:** [`mobile-flutter/DEVICE_QA_CHECKLIST.md`](mobile-flutter/DEVICE_QA_CHECKLIST.md) (اتّبعها على جهاز). ثم تقاعد `mobile-worker`. (المتبقّي 3 مؤجَّلة منخفضة: home‑4/7 · splash-routing‑4 · + MS‑4/5.)
3. **(يحتاج حسابك — انظر القسم 5)** تجهيز Firebase + توقيع Android، لتمكين أوّل بناء موقّع.

> ✅ **بوّابة الجاهزية (#17) مجتازة:** الوحدات الأربع (customer/driver/admin/core) `flutter analyze` نظيفة 100%، والخادم `tsc --noEmit` = 0 أخطاء. **لا حواجز بناء متبقّية** — أيّ نشر/توقيع لن يتعثّر بسبب الشيفرة.

---

## 5) 🔑 بانتظارك (عناصر بشرية تحجب التقدّم)

- [ ] **🖥️ خادم/VPS (حاجب رئيسي #17):** الخادم السابق `45.84.138.119` **أُلغي نهائياً**. (حواجز الكود الأربعة أُغلقت #18 — يبقى الخادم نفسه.) يلزم **تجهيز خادم جديد** ليكون هدف النشر (`SSH_TARGET`) — أُزيل الـ IP المثبّت من [`deploy.sh`](deploy/deploy.sh) (صار يتطلّب `SSH_TARGET`) وعُمِّم في الـ runbook. بدون خادم: لا `prisma db push`، لا إرسال FCM، ولا API إنتاجي للتطبيقات. (للتطوير: شغّل `backend` محلياً ووجّه التطبيقات إليه. لتجهيز خادم: [`deploy/vps-bootstrap.sh`](deploy/vps-bootstrap.sh).)
- [x] **مشروع Firebase (طرف التطبيقات) — مُنجَز #17:** سُجِّلت 3 تطبيقات Android وأُسقِط `google-services.json` لكلٍّ في مكانه (مؤكَّد: `package_name` مطابق لكل تطبيق). طرف الخادم (مفتاح حساب الخدمة) بانتظار الخادم.

> 📄 **الربط البرمجي جاهز (#17)** — اتّبع [`mobile-flutter/FIREBASE_SETUP.md`](mobile-flutter/FIREBASE_SETUP.md). المتبقّي: **اعتماد الخادم فقط** (مفتاح حساب الخدمة عند توفّر خادم). المفتاح مُنزَّل ومحفوظ لديك.

- [ ] **مفتاح حساب خدمة Firebase (طرف الخادم):** مُنزَّل — يُضبط في `.env` الخادم عند تجهيزه (خارج مجلّد النشر، `/etc/daari-water/`).
- [ ] ~~مشروع Firebase~~ ✅ (أعلاه) — للمرجع، الملفّات المطلوبة كانت:
  - `google-services.json` → `android/app/` لكل تطبيق
  - `GoogleService-Info.plist` → `ios/Runner/` لكل تطبيق
  - **مفتاح حساب خدمة** → للخادم عبر `FIREBASE_SERVICE_ACCOUNT_JSON` أو `FIREBASE_SERVICE_ACCOUNT_PATH`
- [ ] **توقيع Android**: `keytool -genkey -v -keystore daari.keystore -alias daari -keyalg RSA -keysize 2048 -validity 10000`
  ثم `android/key.properties` (storePassword, keyPassword, keyAlias, storeFile) لكل تطبيق.
- [ ] **اسم العرض** للتطبيق (`android:label` / iOS `CFBundleName`، حالياً `daari_customer`/`daari_driver`/`daari_admin`): «داري»؟ «Daari»؟
- [ ] **مفتاح خرائط جوجل** (Maps SDK for Android/iOS) لتطبيق الإدارة (خريطة الأسطول): مرّره عبر `-PMAPS_API_KEY=...`
  أو `android/gradle.properties`؛ بدونه تظهر الخريطة رمادية. iOS يحتاج تسجيل المفتاح في `AppDelegate`.

---

## 6) 📋 المتبقّي (المراحل)

- **المرحلة 0 — الأساس:** أسماء الحِزَم ✅ · Firebase: ربط برمجي (Gradle مشروط + دليل) ✅ / أصول الكونسول ⏳ · توقيع ⏳ · سكربت بناء محلّي ⏳ · قناة FCM بالخادم ✅
- **المرحلة 1 — الزبون:** جرد التكافؤ ✅ · **إغلاق 74/75 عبر 7 دفعات (#9–#15) ✅ → مكتمل التكافؤ** (الوحيد المتبقّي قرار منتج) · يبقى QA شامل → إصدار → تقاعد `mobile-customer`.
- **المرحلة 2 — السائق:** جرد التكافؤ ✅ (56 فجوة + 5 سلامة مالية، [السجلّ](mobile-flutter/DRIVER_PARITY_BACKLOG.md)) · 6أ/ج/د/هـ + history‑1 + 6و + **6ب (idempotency خادم) ✅** — **55 بنداً مُغلقاً (52 من الـ56 + MS‑1/2/3)** · ✅ **الثغرة المالية مُغلقة جذرياً** (يتطلّب `prisma db push` عند النشر) · المتبقّي 3 مؤجَّلة منخفضة + MS‑4/5 · يبقى **اختبار ميداني + QA** → تقاعد `mobile-worker`.
- **المرحلة 3 — الإدارة (الأكبر):** طبقة بيانات `/plant/*` في core ✅ · `apps/admin` بـ 14 شاشة (مؤشّرات + تقارير أساسية/متقدّمة **بفلاتر تاريخ** + فريق بإجراءاته + عروض + مخزون + onboarding + خريطة أسطول حيّة + أداء السائقين + خريطة حرارية + سجلّ تدقيق + متابعة بثّ حيّة) ✅ · فلاتر تاريخ ✅ · بصمة (`local_auth`) ✅ (يتبقّى اختبار ميداني فقط) → **مكتملة وظيفياً** · تبقّى تقاعد `mobile-admin`.
- **المرحلة 4 — التقاعد النهائي:** حذف `mobile-customer/worker/admin` + سكربت EAS، إلغاء اعتماد EAS (التكلفة → $0)، تحديث `STRUCTURE.md`.

---

## 7) ⚠️ مخاطر يجب تذكّرها

- **طابور المال للسائق:** ✅ **مُعالَج (#16).** الإكمال/reclaim محميّان بـ `updateMany` الشرطي، وwalk-in/تسليم النقد صارا idempotent بـ `clientRequestId` + قيد UNIQUE (الدفعة 6ب) + dedupe العميل (MS‑3). ⚠️ **يتطلّب `prisma db push` عند النشر** ليفعّل القيد — **الإجراء موثّق ومجهّز في** [`deploy/RUNBOOK-clientRequestId-db-push.md`](deploy/RUNBOOK-clientRequestId-db-push.md)، ويُطبَّق تلقائياً عند أوّل `./deploy/deploy.sh api`.
- **عقد الـ API مُجمَّد:** Flutter يستهلك نفس `/api/v1` — لا تغيّر العقد أثناء التحويل. استخدم اختبارات تكافؤ.
- **اللمسة الوحيدة المسموحة بالخادم:** قناة الإشعارات (FCM) — أُنجِزت. لا تغييرات معمارية أخرى.

---

## 8) 🧭 ملفات مرجعية سريعة

- الهيكلية العامة → [`STRUCTURE.md`](STRUCTURE.md)
- قناة الإشعارات (FCM) → `backend/src/notifications/push.service.ts`
- سجلّات التكافؤ → الزبون [`CUSTOMER_PARITY_BACKLOG.md`](mobile-flutter/CUSTOMER_PARITY_BACKLOG.md) · السائق [`DRIVER_PARITY_BACKLOG.md`](mobile-flutter/DRIVER_PARITY_BACKLOG.md) (+ `mobile-flutter/.parity/*.json` خام)
- القلب المشترك لـ Flutter → `mobile-flutter/packages/daari_core/` (طبقة الإدارة `/plant/*` مكتملة: api/`{plant,promo,reports,team,onboarding}_repository.dart` + نماذجها)
- تطبيقات Flutter → `mobile-flutter/apps/{customer,driver,admin}` (admin بـ 14 شاشة في `lib/screens/` فوق providers تغلّف طبقة `plant/` + `GET /drivers/live`)

---

## 9) 🗒️ سجلّ الجلسات

| # | التاريخ | الخلاصة |
|---|---|---|
| 18 | 2026-07-01 | **إغلاق الحواجز الأربعة الحقيقية من تقرير الجاهزية** (كلها كود، لا تحتاج حساب المستخدم؛ تحقّق مستقل + `tsc --noEmit`=0 + `node --check`): **#3** انهيار لوحة السائقين على `ON_BREAK` — أُعيدت التسمية `BREAK→ON_BREAK` + حارس `?? STATUS.OFFLINE` ([drivers/page.tsx](dashboard/src/app/dashboard/drivers/page.tsx)). **#1** `/uploads/` بلا خدمة (صور الإثبات/التقارير 404) — أُضيف `location /uploads/` بـ alias في [nginx](deploy/nginx/daari-water-api.conf). **#4** لا زرع `PLATFORM_ADMIN` — سكربت [`prisma/seed-prod.cjs`](backend/prisma/seed-prod.cjs) JS صِرف (يعمل مع `--omit=dev`) مربوط في [deploy.sh](deploy/deploy.sh) + عزل الديمو خلف `NODE_ENV` في [seed.ts](backend/prisma/seed.ts) + `PLATFORM_ADMIN_*` في القالب. **#2** كان مبالغاً فيه (القالب يضبط `UPLOADS_DIR` أصلاً داخل `ReadWritePaths`) — أُضيف تحصين `mkdir uploads` + chown. مكافأة: صُحّح اسم متغيّر FCM في القالب (`FIREBASE_SERVICE_ACCOUNT_PATH`). **النتيجة: 4 حواجز كود → 0؛ يبقى الخادم الجديد + المهام البشرية.** |
| 17 | 2026-07-01 | **(أ) تجهيز نشر `prisma db push` (السلامة المالية 6ب):** تحقّق من الواقع أنّ المخطّط (عمود `clientRequestId` + قيدا `@@unique` على `RefillOrder`/`CashHandover`) ومنطق الخادم (`createWalkinRefill`/`createForDriver` + التقاط `P2002`) **مُودَعان** و`git status` نظيف. 🔎 اكتشاف: `db push` مؤتمَت في [`deploy.sh:79`](deploy/deploy.sh#L79) (يُطبَّق تلقائياً عند أوّل نشر API؛ المستودع بلا migrations). الناتج: [`deploy/RUNBOOK-clientRequestId-db-push.md`](deploy/RUNBOOK-clientRequestId-db-push.md) (نسخة احتياطية→معاينة SQL→تطبيق→تحقّق idempotency→تراجع). صُحِّح سطر «لم يُنشأ commit بعد» القديم. **(ب) بوّابة جاهزية للنشر:** `flutter analyze` = No issues على customer/driver/admin؛ `daari_core` نُظّف بـ`dart fix` (11 إصلاح تجميلي/7 ملفات) → الوحدات الأربع نظيفة 100%؛ الخادم `npm ci`+`prisma generate`+`tsc --noEmit` = 0 أخطاء. **الشيفرة قابلة للشحن؛ الحواجز المتبقّية تشغيلية/بشرية فقط.** **(ج) خطّة QA للجهاز الفعلي:** [`DEVICE_QA_CHECKLIST.md`](mobile-flutter/DEVICE_QA_CHECKLIST.md) (7 أقسام: idempotency المال · GPS/خرائط · تدفّقات · الزبون · الإدارة/البصمة · FCM محجوب · E2E + جدول اعتماد). **(د) تجهيز Firebase:** ربط `google-services` **مشروط** في التطبيقات الثلاثة (يُفعَّل عند إسقاط الملفّ، لا يكسر البناء) + دليل [`FIREBASE_SETUP.md`](mobile-flutter/FIREBASE_SETUP.md) — يتبقّى أصول الكونسول + اعتماد الخادم (عملك). |
| 1 | 2026-06-28 | تحليل (FastAPI/Flutter) → قرار: إبقاء الخادم، اعتماد Flutter، حذف Expo، إشعارات FCM. تنفيذ: توحيد أسماء الحِزَم (customer/driver)، تحويل إشعارات الخادم إلى FCM (يبني نظيفاً)، تحديث STRUCTURE + إنشاء هذا الملف. |
| 2 | 2026-06-29 | بناء طبقة بيانات الإدارة في `daari_core`: 5 repositories + 12 ملف نماذج (+enums بقيم Prisma) تغطّي 28 نقطة `/plant/*`، رُبِطت بـ providers وصُدِّرت من barrel. `dart analyze` نظيف + تحقّق خصومي بـ workflow (كلها faithful). لا تغيير على الخادم. |
| 3 | 2026-06-29 | هيكلة تطبيق الإدارة `apps/admin` (`com.phibit.daariadmin`): بنية المنصّات + ضبط معرّف الحزمة + تسجيل في workspace + `main/router(حارس مصادقة)/providers` + 6 شاشات (splash/login/home-KPIs/reports/team/more) + قشرة تبويبات. `dart analyze`: No issues found. لا تغيير على الخادم. |
| 4 | 2026-06-29 | استكمال شاشات admin (صارت 10): المخزون (عرض+تحديث) · العروض (حملات+بثّ) · إجراءات الفريق (دعوة/تعديل/حذف) · تقارير متقدّمة (ذروة/خزّانات/أفواج/تصدير) · تهيئة المعمل + ربط المسارات وبلاطات «المزيد». `dart analyze`: No issues found. لا تغيير على الخادم. |
| 5 | 2026-06-29 | خريطة الأسطول الحيّة (admin صار 11 شاشة): نموذج `LiveDriver` + `liveDrivers()` في core على `GET /drivers/live` + `google_maps_flutter` + إعداد Android (MAPS_API_KEY) + شاشة `fleet_map` بعلامات حسب الحالة واستقصاء 15ث. `dart analyze`: admin نظيف. لا تغيير على الخادم. |
| 6 | 2026-06-30 | قفل الدخول بالبصمة (`local_auth`) لتطبيق الإدارة: خدمة `BiometricService` + علَم `LocalFlags.biometricEnabled` في core (+`local_auth ^2.3.0`، صُدّرت من barrel) + إعداد منصّات admin (`FlutterFragmentActivity`/`USE_BIOMETRIC`/`NSFaceIDUsageDescription`) + شاشة قفل `/lock` + بوّابة splash + عرض تفعيل بعد الدخول (فوق Navigator الجذر) + مفتاح في «المزيد» + مسح العلَم عند الخروج. `dart analyze`: admin نظيف. لا تغيير على الخادم. يتبقّى اختبار ميداني. |
| 7 | 2026-06-30 | لمسات تكافؤ admin (صار 14 شاشة): أداء السائقين (نافذة 30/60/90 عبر `driverPerformance`) + الخريطة الحرارية (`driverHeatmap`) + سجلّ التدقيق المرقّم بفلاتر أفعال (`auditLogPaged` — تحقّق خصومي برموز الأفعال الفعلية `stock.update`/`promo.*`/`team.*`/`onboarding.skip` وفلتر `contains`) + متابعة بثّ حيّة (`blastStatus.family` استقصاء 5ث) + ربط 3 مسارات وبلاطات «المزيد». `flutter analyze`: No issues found. لا تغيير على الخادم. المتبقّي: فلاتر تاريخ على التقارير. |
| 8 | 2026-06-30 | فلاتر التاريخ (from/to) على التقارير → **تكافؤ admin مكتمل وظيفياً**: حالة مدى مشتركة `reportWindowProvider` + نوع `ReportWindow` + امتداد `ReportWindowIso` (00:00/23:59:59) رُبِطت بـ revenue7d/topCustomers/topDrivers/peakHours/cohort + التصدير، وعنصر `ReportWindowBar` (`showDateRangePicker` عربي) في شاشتَي التقارير. تحقّق خصومي بـ `parseRange` (حصري `lt` / شامل `lte`). `flutter analyze`: No issues found. لا تغيير على الخادم. |
| 15 | 2026-06-30 | **الدفعة 5ج الأخيرة → اكتمال تكافؤ الزبون (8 فجوات → 74/75 مُغلقة):** home (عدّاد عرض `_PromoCountdown` · منتقي عنوان `_AddressSelector`→`createRefill(addressId:)` · شارة عرض · حالة خطأ بخروج `_ProfileError` · إخفاء 0 تعبئة) + signup (تعديل-من-OTP · قائمة «ماذا يحدث») + شريط offline عام في `main.dart` (`_OfflineWrapper`/`isOnlineProvider`). `flutter analyze`: نظيف. لا خادم. الوحيد المتبقّي قرار منتج (login «لا حساب»). |
| 14 | 2026-06-30 | **الدفعة 5ب من تكافؤ الزبون (16 فجوة → 67/75):** مساعِدات core (`Launchers.email`/`bool` · `LabeledField.digitsOnly` · `Fmt.arabicMonthYear`) + support (أبلغ/بريد/فشل/أسئلة) + orders (تجميع شهري/عدّاد/أيقونة حالة) + schedules (منتقي عنوان/عرض/±يوم) + forgot/signup (ترشيح أرقام + إعادة إرسال + تغطية) + addresses (عنوان فرعي) + order-detail (زر خرائط). `flutter analyze`: نظيف. لا خادم. |
| 13 | 2026-06-30 | **الدفعة 5أ من تكافؤ الزبون (لمسات نصّية/بسيطة، 17 فجوة → 51/75):** welcome (شارات/عنوان/نصوص/رابط شروط/تذييل) · intro (4 شرائح + إخفاء تخطّي) · login (نصّ فرعي + تعطيل حتى الصحّة + نصّ شروط) · profile (العنوان + رصيد صفري «مدفوع») · wallet (توحيد وسم الرصيد + سجلّ أي مدفوع) · notifications (عدّاد غير مقروء + إخفاء «الكل مقروء»). `flutter analyze`: نظيف. لا موديل/خادم. |
| 12 | 2026-06-30 | **الدفعة 4 من تكافؤ الزبون (منتقي الخريطة + reverse-geocode، 8 فجوات → 34/75):** أُضيفت حزمة `geocoding ^3.0.0`؛ أُعيد كتابة map-picker (GPS تلقائي + تحميل + إحداثيات حيّة + `MapPickResult` بعنوان عكسي) + signup (زر خريطة في الإدخال + تعبئة عنوان تلقائية + مؤشّر موقع) + addresses (زر خريطة في النموذج يلتقط lat/lng + مؤشّر دبّوس). `flutter analyze`: No issues found. لا خادم. يتبقّى اختبار ميداني (GPS/ترميز). |
| 11 | 2026-06-30 | **الدفعة 3 من تكافؤ الزبون (onboarding، 7 فجوات نصّية → 26/75):** Step1 حوار إذن الموقع التفصيلي · Step2 صفّ إحصائيات + صندوق حصرية المعمل · Step3 قائمة «ماذا سيحدث» (٤ ✓) + رجوع · Step4 صندوق شروط بـ٥ بنود قابل للتمرير + إقرار عهدة ٥٠٠ لتر + رجوع. `flutter analyze`: No issues found. لا موديل/خادم. |
| 10 | 2026-06-30 | **الدفعة 2 من تكافؤ الزبون (الموديل + عالية الأثر، 11 فجوة → 19/75):** تغييرات `daari_core` (refillPriceIqd · customerConfirmedAt/paymentMethod/notes · vehiclePlate · resetPassword→دخول تلقائي) بعد تحقّق خصومي بعقد الخادم، ثم إغلاق فجوات forgot (دخول تلقائي/تأكيد إرسال/إرسال تلقائي) + order-detail (بوّابة التأكيد+لافتة/طريقة الدفع/ملاحظات/مركبة/ETA) + orders (إيصال مضمّن) + signup (سعر التعبئة). `flutter analyze`: الزبون No issues found. لا تغيير على الخادم. |
| 16 | 2026-06-30 | **بدء المرحلة 2 (السائق) — جرد التكافؤ الكامل** بـ workflow متعدّد الوكلاء (12 زوج شاشة، تدقيق←تحقّق خصومي) + وكيل مخصّص لطابور المال: التطابق على مستوى الشاشات كامل، **56 فجوة مؤكّدة** (1 عالية/22 متوسّطة/33 منخفضة، 0 مرفوضة) + 5 نتائج سلامة مالية، أُرشِفت في [`DRIVER_PARITY_BACKLOG.md`](mobile-flutter/DRIVER_PARITY_BACKLOG.md). ⚠️ **أبرزها:** إكمال/reclaim آمنان (حارس خادم شرطي)، لكن **walk-in/تسليم النقد** نقاط `create()` بلا حارس → **ثغرة مزدوجة الشحن** عبر إعادة إرسال الطابور (MS‑1/MS‑2 — جذرها خادمي، تحتاج قراراً). ثم **الدفعة 6أ — السلامة المالية على العميل** (Flutter بحت): MS‑3 (dedupe طابور بعمود `dedupe_key`/هجرة v2) + `_AppChrome` (تفريغ طابور + شريط offline على مستوى التطبيق، splash-routing‑1/3) + shift-summary‑1 (منع نقر مزدوج) + van-inventory‑1/2 (حارس متّسخ + نصّ) → **6 بنود مُغلقة**. ثم **الدفعة 6ج — التدفّقات الحرجة**: forgot‑1 (دخول تلقائي بعد إعادة التعيين، نفس إصلاح الزبون #10) + task-detail‑1/2/3 (إظهار فرع reclaim من ASSIGNED بلا بدء جولة + سبب إجباري `null` افتراضياً + حاجز GPS 50م على الاسترجاع) → **4 بنود**. ثم **6د — GPS/خريطة**: home‑1/2/3 (فرز «الأقرب أولاً» + شارات مسافة + بطاقة المهمة النشطة) + task-detail‑4/5/6 (خريطة سائق حيّة كل 10ث + طبقة مسافة/ETA + بديل لا‑GPS + ملاحة نصّية) → **6 بنود**. ثم **6هـ — لمسات الشاشات** (14 بنداً: home‑5 · profile‑1/2 · login‑1/2 · walkin‑1/2/4/5 · shift-summary‑2/3 · van-inventory‑3 · earnings‑5 · history‑2؛ مؤجَّل history‑1 لتعديل موديل). إجمالي #16 بعدها: 30. ثم **history‑1** (دفعة موديل): `RefillOrder.customerName` من `customer.fullName` (تحقّق خصومي: `customer:true` + `Customer.fullName` scalar) → عرض اسم الزبون في السجلّ. **إجمالي بعدها: 31.** ثم **6و — التجميل** (22 بنداً منخفضاً: اهتزاز/حركة/تواريخ/نصوص/تحليلات عبر كل الشاشات + forgot‑2). إجمالي بعدها: 53. ثم **6ب — idempotency الخادم** (إغلاق الثغرة المالية بقرارك): عمود `clientRequestId` + `@@unique([tenantId,clientRequestId])` على `RefillOrder`/`CashHandover` + منطق إرجاع-القائم/P2002 + Flutter يُرسل المفتاح (UUID مرّة، للإرسال والطابور) — **إضافة متوافقة رجعياً**. `tsc` exit 0 · عميل Prisma تولّد · `flutter analyze` نظيف. ⚠️ يحتاج `prisma db push` عند النشر. **إجمالي #16: 55 بنداً مُغلقاً (52 من الـ56 + MS‑1/2/3).** المتبقّي 3 مؤجَّلة منخفضة + MS‑4/5. |
| 9 | 2026-06-30 | **بدء المرحلة 1 (الزبون):** جرد تكافؤ بـ workflow متعدّد الوكلاء (تدقيق←تحقّق خصومي، 18 زوج شاشة، 36 وكيلاً) → التطابق على مستوى الشاشات كامل، **75 فجوة داخلية** مؤكّدة (settings تامّ)، أُرشِفت في [`CUSTOMER_PARITY_BACKLOG.md`](mobile-flutter/CUSTOMER_PARITY_BACKLOG.md). ثم دفعة السلامة (8 فجوات): حارس الطلب النشط في home+orders (منع التكرار) + تقييد REFILL + تحقّق كلمة المرور + رسائل خطأ الدخول + إظهار/إخفاء كلمة المرور. `flutter analyze`: No issues found. لا تغيير على الخادم. |

---

> **كيف تُحدِّث هذا الملف في نهاية الجلسة:** أضِف ما أُنجِز في القسم 3، حدّث «ابدأ من هنا» (القسم 4)
> و«بانتظارك» (القسم 5)، وأضِف سطراً في سجلّ الجلسات (القسم 9) مع التاريخ.
