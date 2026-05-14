# داري — Daari Platform

> **خدمات منزلك بضغطة زر**

منصّة SaaS عراقية متعدّدة المستأجرين لإدارة الخدمات المنزلية. **الإطلاق الأول**: توصيل مياه الشرب من المعامل للبيوت. **الخدمات القادمة**: توصيل الغاز، تنظيف الخزانات، فلاتر RO، صيانة منزلية، وأكثر.

**شركة Phi-Bit** | أحمد العاني | [phi-bit.com](https://phi-bit.com)

## ما الذي بُني في هذه الجولة

```
daari-platform/
├── backend/          ✅ NestJS API كامل (Prisma + PostGIS + JWT + Capabilities + Cron + WhatsApp/SMS)
├── dashboard/        ✅ Next.js لوحة المعمل (RTL، عربي، صفحات أساسية)
├── mobile-customer/  ✅ Expo (React Native + TypeScript + NativeWind) — تطبيق الزبون
├── mobile-worker/    ✅ Expo — تطبيق العاملين الموحّد: سائق + بائع متجول
├── mockup.html       ✅ نموذج HTML تفاعلي للعرض السريع
├── DEPLOYMENT.md     ✅ دليل النشر الكامل لـ App Store و Google Play
└── docs/             📋 مرجع API
```

> **معمارية تطبيقَين** (وليس ٤): تطبيق خفيف للزبون بأذونات قليلة، وتطبيق ثقيل للعاملين. مستخدم واحد قد يحمل قدرتَي `driver` و `vendor` معاً ويبدّل بينهما داخل تطبيق العاملين.

| المكوّن | الحالة | الوصف |
|---|---|---|
| Backend API | ✅ مكتمل وقابل للتشغيل | auth (JWT + capabilities)، tenants، tanks، customers، drivers، orders، accounting، vendors، notifications |
| نموذج البيانات Prisma | ✅ مكتمل | جميع الجداول مع علاقات multi-tenant |
| نظام القدرات (Capabilities) | ✅ | مستخدم واحد يحمل `driver` + `vendor` في آن واحد، Backend يفرض الصلاحيات تلقائياً |
| لوحة Next.js | ✅ صفحات رئيسية | تسجيل دخول، Dashboard، الخزانات، الزبائن، الطلبات، المحاسبة |
| **تطبيق الزبون (Expo)** | ✅ المعمار + الشاشات الأساسية | auth (OTP)، onboarding 4 خطوات، home، orders، profile |
| **تطبيق العامل (Expo)** | ✅ المعمار + الشاشات الأساسية | role picker، login، today tasks، arrival flow، walk-in lookup/register، reclaim، wallet — مع offline queue و background GPS |

## التشغيل المحلي

### المتطلبات
- Node.js 20+
- Docker (لـ Postgres + Redis)
- Flutter SDK 3.x (لتطبيقات الموبايل لاحقاً)

### Backend

```bash
cd backend
cp .env.example .env       # عدّل الأسرار
docker compose up -d       # Postgres (PostGIS) + Redis
npm install
npm run prisma:migrate     # ينشئ المخطّط
npm run prisma:seed        # بيانات تجريبية: معمل + سائق + ٣ خزانات + زبونان
npm run start:dev          # http://localhost:3000/api/v1
                           # Swagger:    http://localhost:3000/api/docs
```

بيانات تسجيل الدخول للمعمل التجريبي:
- **هاتف**: `07700000001`
- **كلمة المرور**: `password123`

### Dashboard

```bash
cd dashboard
npm install
npm run dev                # http://localhost:3001
```

### تطبيقات Expo (الزبون + العامل)

```bash
# لكل من mobile-customer و mobile-worker:
cd mobile-customer
npm install
npx expo login             # أو eas login إن نشرت
npx expo start             # امسح QR بـ Expo Go على هاتفك
```

للنشر للمتاجر — راجع [DEPLOYMENT.md](DEPLOYMENT.md). الخطوات الرئيسية:

```bash
eas init                                              # ربط بحساب Expo
eas build --profile production --platform android     # بناء AAB
eas submit --platform android                         # رفع لـ Play Store
eas update --auto                                     # تحديث OTA فوري
```

## الخريطة المعمارية

```
                      ┌──────────────────────────────┐
                      │      Backend NestJS API       │
                      │  PostgreSQL + PostGIS + Redis │
                      └──────────────┬───────────────┘
                                     │
        ┌────────────────┬───────────┴────────────┬────────────┐
        ▼                ▼                        ▼            ▼
  لوحة المعمل      تطبيق الزبون            تطبيق العاملين    Webhooks
  (Next.js)        (Flutter)                (Flutter)       (WhatsApp)
                                            ├─ وضع السائق
                                            └─ وضع البائع

   خدمات:  Google Maps · WhatsApp Business · ZainCash · SMS · FCM
```

## نظام الصلاحيات (Capabilities)

كل مستخدم له `role` أساسي، لكن قدراته الفعلية تُحسَب من ملفاته الجانبية:

| Capability | يحصل عليها مَن؟ |
|---|---|
| `customer` | كل من أنشأ حساباً ذاتياً عبر OTP |
| `driver` | من فتح له المعمل ملف Driver وكلّفه بسائق |
| `vendor` | من سجّل بيانات مركبته **وحصل على موافقة** الـ platform_admin |
| `plant_admin` | OWNER / MANAGER / ACCOUNTANT للمعمل |
| `platform_admin` | إدارة المنصة |

**مثال على الجمع**: سائق معمل (يملك `driver`) يستطيع التسجيل كبائع مستقل عبر `POST /vendors/me/register`، فيصبح JWT الخاص به: `capabilities: ["driver", "vendor"]`. تطبيق العاملين يكشف هذا ويُظهر له مفتاح التبديل.

## مكوّنات Backend الرئيسية

| المسار | الغرض | المسارات API |
|---|---|---|
| `auth/` | JWT + refresh tokens + OTP للزبون | POST /auth/login, /auth/login/otp, /auth/refresh |
| `tenants/` | تسجيل المعامل + إحصاءات لوحة | POST /tenants/register, GET /tenants/me/stats |
| `tanks/` | جرد، QR، تخصيص للزبائن، سحب | CRUD + /tanks/qr/:code + /tanks/:id/assign |
| `customers/` | CRM + حالة صحية (active/at_risk) | CRUD |
| `drivers/` | حساب السائق + GPS + أداء شهري | CRUD + /drivers/me/location, /drivers/:id/performance |
| `orders/` | RefillOrder كامل (تعبئة/توصيل/سحب) | CRUD + assign + start + complete + cancel |
| `accounting/` | مصاريف + رواتب + P&L | CRUD expenses, salaries, GET /accounting/pnl |
| `vendors/` | البائع المتجول + المطابقة + المحفظة | CRUD + delivery orders + match + accept |
| `notifications/` | WhatsApp + SMS + سجل + جدولة يومية | جدولة Cron 9 صباحاً + سجل |

## نموذج العمل (Pricing)

ثلاث خطط اشتراك للمعامل:
- **Basic** — ٥٠,٠٠٠ د/شهر · حتى ١٠٠ زبون
- **Pro** — ١٥٠,٠٠٠ د/شهر · حتى ٥٠٠ زبون + المحاسبة الكاملة
- **Business** — ٣٠٠,٠٠٠ د/شهر · غير محدود + API

عمولة المنصة على البائعين المتجولين: **٨٪** من قيمة كل طلب.

## الخطوة التالية (مرتّبة)

1. **اختبارات end-to-end** على Backend (Jest + supertest):
   - `auth → create customer → assign tank → create order → complete → balance updated`
2. **بناء تطبيق السائق Flutter** (الأهم بعد Backend):
   - راجع `mobile-driver/README.md`
   - الميزات الحرجة: GPS ping، QR scan، Offline queue
3. **WhatsApp Business API** — إعداد حساب Meta + قالب رسائل (`refill_reminder_ar`).
4. **خرائط حقيقية في Dashboard** — Google Maps JS SDK لعرض الخزانات والسائقين.
5. **اختبار ميداني** — معمل واحد في بغداد، شهر، مع متابعة يومية.
