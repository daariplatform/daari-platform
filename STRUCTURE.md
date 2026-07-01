# هيكلية منصّة داري (Daari Platform)

منصّة **SaaS متعددة المستأجِرين (multi-tenant)** للسوق العراقي، أساسها خدمات توصيل المياه
وخدمات المنزل. تتكوّن من **خادم API مركزي واحد** تستهلكه عدّة واجهات (تطبيقات جوّال + لوحات ويب).
كل بيانات المستأجِر معزولة عبر `tenantId` وحُرّاس مصادقة/عزل/صلاحيات على مستوى الخادم.

> هذا الملف هو **المرجع الوحيد** لهيكلية المشروع العامة.

> **تحديث التوجّه (2026-06):** اعتُمِدت تطبيقات **Flutter** (`mobile-flutter/`) كواجهة الجوّال **الرسمية**.
> تطبيقات **Expo/React Native** (`mobile-customer` · `mobile-worker` · `mobile-admin`) أصبحت **قديمة (legacy)
> قيد الإيقاف التدريجي**. الخادم يبقى **NestJS** بلا إعادة كتابة، ولوحات الويب تبقى **Next.js**. الإشعارات على
> الخادم تحوّلت إلى **FCM (firebase-admin)**. تفاصيل ما أُنجِز والمتبقّي في **[`PROGRESS.md`](PROGRESS.md)**.

---

## المعمارية العامة

```
                         ┌──────────────────────────────┐
                         │   backend  (NestJS + Prisma)  │
                         │   REST API  ·  /api/v1 :3000  │
                         │   PostgreSQL + PostGIS · Redis│
                         └───────────────┬──────────────┘
                                         │  HTTP (Dio / axios)
        ┌──────────────┬─────────────────┼─────────────────┬──────────────┐
        │              │                 │                 │              │
   لوحات ويب        تطبيقات الجوّال (Expo)            إعادة بناء Flutter
   (Next.js)                                                                  
  dashboard :3001   mobile-customer   mobile-worker   mobile-admin   mobile-flutter
  platform-console  (الزبون)          (السائق/العامل) (الإدارة)       (الزبون + السائق)
        :3011
```

كل الواجهات تتحدّث مع **نفس** الخادم على `/api/v1`، دون منطق أعمال مكرّر في العميل.

---

## خريطة المجلّدات (المستوى الأعلى)

| المجلّد | النوع | الوصف |
|---|---|---|
| `backend/` | NestJS 10 + Prisma 5 | خادم الـ API المركزي (القلب) |
| `dashboard/` | Next.js 14 | لوحة ويب تشغيلية (المنفذ 3001) |
| `platform-console/` | Next.js 14 | لوحة ويب على مستوى المنصّة (المنفذ 3011) |
| `mobile-customer/` | Expo / React Native | تطبيق الزبون (الأصل) — `maa-customer` |
| `mobile-worker/` | Expo / React Native | تطبيق السائق/العامل — `maa-worker` |
| `mobile-admin/` | Expo / React Native | تطبيق الإدارة — `daari-admin` |
| `mobile-flutter/` | Flutter (Dart) | إعادة بناء تطبيقات الزبون + السائق + الإدارة بـ Flutter |
| `deploy/` | سكربتات + إعدادات | النشر على VPS (nginx, systemd, logrotate) |
| `scripts/` | سكربتات مساعدة | نسخ احتياطي DB، بناء EAS، توليد أيقونات… |
| `legal/` | مستندات | سياسات الخصوصية والشروط وقوائم متجر Play |
| `store-assets/` | مستندات | حزمة تقديم Google Play Console |
| `.claude/` | إعدادات | إعداد أدوات Claude Code |
| `LICENSE` | — | رخصة المشروع |

---

## 1) الخادم — `backend/`

خادم **NestJS 10 + Prisma 5**، متعدّد المستأجِرين، يخدم كل الواجهات.

- **التقنيات:** PostgreSQL + PostGIS (مواقع جغرافية)، Redis + BullMQ (طوابير)، Sentry (رصد الأخطاء)،
  تسجيل JSON عبر pino، توثيق Swagger (في التطوير فقط).
- **الأمان:** كل صفّ يحمل `tenantId`؛ أربعة حُرّاس عامّون (Throttler, JwtAuth, Tenant, Capabilities)
  يفرضون المصادقة والعزل وبوّابة المزايا. يستمع على `127.0.0.1` خلف nginx.
- **نقطة الدخول:** `src/main.ts` (بادئة `/api/v1`، المنفذ 3000).
- **النطاقات (modules):** `auth`, `tenants`, `tanks`, `customers`, `drivers`, `orders`, `ratings`,
  `customer-address`, `scheduled-orders`, `cash-handover`, `accounting`, `platform-admin`, `ai`,
  `vendors`, `uploads`, `health`, `notifications` (SMS/WhatsApp + Push عبر **FCM/firebase-admin**)، و `plant/` (العروض + المحفظة +
  الإعداد + التقارير + الفريق).
- **قاعدة البيانات:** `prisma/schema.prisma` (≈37 نموذجاً) — تُطبَّق عبر `prisma db push`؛ بذور التطوير `prisma/seed.ts` (ديمو، معزول خلف `NODE_ENV !== 'production'`)، وبذرة الإنتاج `prisma/seed-prod.cjs` (مالك المنصّة فقط، idempotent، JS صِرف يعمل مع `--omit=dev`).
- **الاختبارات:** `test/` — Jest e2e (مصادقة، طلبات، عزل المستأجِرين، رفع…).

```
backend/
├── src/
│   ├── main.ts              ← نقطة الدخول
│   ├── app.module.ts        ← الوحدة الجذر + الحُرّاس العامّون
│   ├── auth/ common/ prisma/ cache/ queue/ email/ notifications/
│   ├── <نطاقات الأعمال>/     ← orders, customers, drivers, accounting, …
│   └── plant/               ← العروض + المحفظة + التقارير
├── prisma/  (schema.prisma + seed.ts)
└── test/    (Jest e2e)
```

---

## 2) لوحات الويب — `dashboard/` و `platform-console/`

لوحتان بـ **Next.js 14 (App Router)** بنفس الحزمة التقنية:
React Query، خرائط Leaflet، مخططات Recharts، حالة Zustand، Tailwind، PWA.

- **`dashboard/`** — لوحة تشغيلية (المنفذ **3001**).
- **`platform-console/`** — لوحة على مستوى المنصّة (المنفذ **3011**).

البنية الداخلية لكلٍّ منهما:
```
src/
├── app/          ← مسارات App Router (dashboard/ · login/ · legal/ · layout · providers)
├── components/   ← مكوّنات الواجهة
└── lib/          ← عميل الـ API والأدوات المساعدة
```

---

## 3) تطبيقات الجوّال — Expo / React Native (قديمة · قيد الإيقاف)

> ⚠️ هذه التطبيقات **يجري استبدالها بـ Flutter** (القسم 4) وستُحذف بعد اكتمال التحويل. تبقى حتى ذلك الحين
> **مرجعاً وظيفياً** — خصوصاً `mobile-admin` كمخطّط للوحة الإدارة بـ Flutter (غير المبنية بعد). الإشعارات
> على الخادم لم تعد تمرّ عبر Expo Push بل عبر **FCM** مباشرةً.

ثلاثة تطبيقات بـ **Expo SDK 54 / React Native 0.81 / expo-router**، تبني وتُنشر عبر EAS:

| المجلّد | الاسم | الدور | ميزات بارزة |
|---|---|---|---|
| `mobile-customer/` | `maa-customer` | الزبون | الطلب والتتبّع، خرائط، إشعارات |
| `mobile-worker/` | `maa-worker` | السائق/العامل | الكاميرا، SQLite (طور غير متصل)، مهام خلفية |
| `mobile-admin/` | `daari-admin` | الإدارة | مصادقة حيوية، حافظة، إدارة المنصّة |

الحزمة المشتركة بينها: axios + React Query (مع تخزين دائم)، Sentry، nativewind (Tailwind)،
zod، zustand، expo-secure-store، expo-notifications، react-native-maps.

---

## 4) إعادة البناء بـ Flutter — `mobile-flutter/`

إعادة بناء تطبيقات **الزبون + السائق + الإدارة** بـ **Flutter**، تستهلك نفس الـ API دون أي تغيير في الخادم.
بنية **Dart pub workspace**:

```
mobile-flutter/
├── pubspec.yaml                 ← جذر الـ workspace (يضمّ admin)
├── packages/daari_core/         ← القلب المشترك (barrel: lib/daari_core.dart)
│   └── lib/src/  (config · theme · format · models · api+interceptors ·
│                  auth · services · widgets · providers)
│      └── api/ + models/ تشمل أيضاً **طبقة الإدارة** `/plant/*`:
│         {plant,promo,reports,team,onboarding}_repository + نماذجها
└── apps/
    ├── customer/   ← تطبيق الزبون (17 شاشة)  · com.phibit.daaricustomer
    ├── driver/     ← تطبيق السائق (12 شاشة)  · com.phibit.daaridriver
    └── admin/      ← تطبيق الإدارة (14 شاشة)  · com.phibit.daariadmin
        # lib/: main · router (حارس مصادقة) · providers · widgets/{common,home_shell}
        #       screens/: splash · login · home(KPIs) · reports · team(دعوة/تعديل/حذف) ·
        #                 more · stock · promos(حملات+بثّ+متابعة بثّ حيّة) · reports/advanced_reports(فلاتر تاريخ) · onboarding ·
        #                 fleet_map(خريطة سائقين حيّة عبر GET /drivers/live + google_maps_flutter) ·
        #                 driver_performance(نافذة 30/60/90) · driver_heatmap(مناطق التوصيل) · audit_log(مرقّم+فلاتر) ·
        #                 lock(قفل بصمة local_auth عند الإقلاع البارد)
        #       تبويبات: الرئيسية · التقارير · الفريق · المزيد (مكتمل وظيفياً؛ يتبقّى اختبار بصمة ميداني)
```

- **الحالة:** Riverpod. **التوجيه:** go_router (مع حارس مصادقة). **الشبكة:** Dio + interceptors
  (تحديث الرمز single-flight + تخزين مؤقّت).
- **التشغيل:** من داخل مجلّد التطبيق `flutter run --dart-define=API_URL=...`.
- **الخرائط/الموقع (تطبيق الزبون):** منتقي الموقع (`map_picker`) يجلب GPS تلقائياً ويعكس الترميز الجغرافي
  (حزمة `geocoding`) لتعبئة نصّ العنوان عند التأكيد؛ يُستعمل في التسجيل والعناوين.
- **تتبّع تكافؤ الزبون:** [`mobile-flutter/CUSTOMER_PARITY_BACKLOG.md`](mobile-flutter/CUSTOMER_PARITY_BACKLOG.md)
  (سجلّ الفجوات الـ75 مقابل Expo + حالة الإغلاق) و`mobile-flutter/.parity/` (التقرير الخام للجرد متعدّد الوكلاء).
- **تتبّع تكافؤ السائق:** [`mobile-flutter/DRIVER_PARITY_BACKLOG.md`](mobile-flutter/DRIVER_PARITY_BACKLOG.md)
  (56 فجوة + 5 نتائج سلامة مالية + خطّة دفعات) و`mobile-flutter/.parity/driver-audit-2026-06-30.json` (الخام).
- **خطّة اختبار الجهاز الفعلي (QA):** [`mobile-flutter/DEVICE_QA_CHECKLIST.md`](mobile-flutter/DEVICE_QA_CHECKLIST.md)
  (7 أقسام: idempotency المال · GPS/خرائط · تدفّقات السائق/الزبون · الإدارة/البصمة · FCM · E2E + جدول اعتماد) — البوّابة قبل تقاعد Expo.
- **تهيئة Firebase (FCM):** [`mobile-flutter/FIREBASE_SETUP.md`](mobile-flutter/FIREBASE_SETUP.md) — الربط البرمجي جاهز (حزم + `push_service` + مكوّن
  `google-services` **مربوط مشروطاً** في التطبيقات الثلاثة: يُفعَّل عند إسقاط `google-services.json`، ولا يكسر البناء بدونه). المتبقّي أصول الكونسول + اعتماد الخادم.

> **التوجّه المعتمَد:** تطبيقات Flutter هي **الواجهة الرسمية** للجوّال؛ وتطبيقات Expo
> (`mobile-customer/worker/admin`) **قديمة قيد الإيقاف** وتُحذف بعد اكتمال التحويل. تطبيق **الزبون** جُرِد بدقّة
> (75 فجوة داخلية، **أُغلِق 74 → مكتمل التكافؤ**؛ الوحيد المتبقّي قرار منتج — [السجلّ](mobile-flutter/CUSTOMER_PARITY_BACKLOG.md))،
> و**السائق** **جُرِد** (12 زوج شاشة): التطابق على مستوى الشاشات كامل، **56 فجوة داخلية + 5 نتائج سلامة مالية** ([السجلّ](mobile-flutter/DRIVER_PARITY_BACKLOG.md))،
> **تكافؤ السائق مكتمل عملياً** — **55 بنداً مُغلقاً (52 من الـ56 + MS‑1/2/3)** عبر 7 دفعات (6أ/ج/د/هـ + history‑1 + 6و + 6ب): سلامة مالية + تدفّقات حرجة + GPS/خريطة + لمسات الشاشات + اسم الزبون + تجميل شامل + **idempotency الخادم لإغلاق الثغرة المالية**. `tsc` exit 0 · `flutter analyze` نظيف. المتبقّي 3 مؤجَّلة منخفضة.
> ✅ **بوّابة جاهزية (#17):** أُعيد التحقّق أنّ الوحدات الأربع (customer · driver · admin · daari_core) تُحلَّل **بلا أي ملاحظة** (نُظّفت 11 ملاحظة `info` موروثة في core بـ`dart fix`)، والخادم `tsc --noEmit` = 0 أخطاء → **الشيفرة قابلة للشحن، لا حواجز بناء.**
> ✅ **الثغرة المالية مُغلقة:** walk-in/تسليم النقد صارا idempotent عبر `clientRequestId` + قيد `@@unique([tenantId, clientRequestId])` (إضافة **متوافقة رجعياً** — Expo بلا مفتاح يبقى كما هو). ⚠️ **خطوة نشر:** `prisma db push` (مؤتمَتة في `deploy.sh`؛ الإجراء الآمن موثّق في [`deploy/RUNBOOK-clientRequestId-db-push.md`](deploy/RUNBOOK-clientRequestId-db-push.md)). ويبقى **اختبار ميداني** (GPS/خريطة/بصمة/طابور المال).
> أمّا **لوحة الإدارة بـ Flutter (`com.phibit.daariadmin`)** فتطبيق `apps/admin` **مكتمل التكافؤ الوظيفي بـ 14 شاشة**
> (مصادقة + **قفل بصمة (`local_auth`)** + لوحة مؤشّرات حيّة + التقارير الأساسية والمتقدّمة **بفلاتر تاريخ** + الفريق بإجراءاته + العروض **مع متابعة بثّ حيّة** + المخزون + تهيئة المعمل + **خريطة أسطول حيّة** + **أداء السائقين** + **خريطة حرارية** + **سجلّ تدقيق مرقّم**)،
> ولم يبقَ عليه سوى **اختبار البصمة ميدانياً** (+ مفتاح خرائط للإنتاج). الحالة التفصيلية في **[`PROGRESS.md`](PROGRESS.md)**.

---

## 5) النشر والأدوات

- **`deploy/`** — `deploy.sh` (نشر API/dashboard؛ يشغّل `prisma db push` **+ يزرع مالك المنصّة** عبر `backend/prisma/seed-prod.cjs` **+ ينشئ مجلّد `uploads`** تلقائياً؛ **يتطلّب `SSH_TARGET`** — الخادم السابق `45.84.138.119` أُلغي، لا هدف افتراضي), `vps-bootstrap.sh` (تجهيز VPS جديد), `RUNBOOK-clientRequestId-db-push.md` (إجراء نشر قيد idempotency), و إعدادات `nginx/` (**تخدم `/uploads/` — صور الإثبات + التقارير — عبر `alias`**), `systemd/`, `logrotate/`.
- **`scripts/`** — `backup-db.sh`, `eas-setup-and-build.sh`, `generate-icons.py`, `github-setup.sh`.
- **`legal/`** — سياسة الخصوصية (EN/AR)، شروط الخدمة (AR)، قوائم متجر Play (الزبون/العامل).
- **`store-assets/`** — حزمة تقديم Google Play Console.

---

## المنافذ (development)

| الخدمة | المنفذ |
|---|---|
| `backend` (API) | 3000 (`/api/v1`) |
| `dashboard` | 3001 |
| `platform-console` | 3011 |
| `mobile-admin` (Expo dev) | 8085 |

---

## مرجع سريع للتشغيل

```bash
# الخادم
cd backend && npm install && npm run start:dev

# لوحة ويب
cd dashboard && npm install && npm run dev          # أو platform-console

# تطبيق Expo
cd mobile-customer && npm install && npx expo start # أو mobile-worker / mobile-admin

# تطبيق Flutter
cd mobile-flutter/apps/customer && flutter run --dart-define=API_URL=https://api.phi-bit.com/api/v1
```
