# داري — Daari Platform

> **خدمات منزلك بضغطة زر** — منصّة SaaS عراقية متعدّدة المستأجرين (multi-tenant).
> الإطلاق الأول: **توصيل مياه الشرب** من المعامل إلى البيوت.

**شركة Phi-Bit** · أحمد العاني · [phi-bit.com](https://phi-bit.com)

هذا الملف هو **المرجع الكامل للفريق**. اقرأه أولاً قبل أي عمل على المشروع.

---

## 1) نظرة عامة سريعة

النظام يخدم **٤ أنواع مستخدمين**، عبر **٥ أسطح برمجية** كلها تتكلّم مع **API واحد**:

| المستخدم | السطح | التقنية | الرابط الحيّ |
|---|---|---|---|
| الزبون | تطبيق موبايل | Expo / React Native | (Expo Go أثناء التطوير) |
| السائق | تطبيق موبايل | Expo / React Native | (Expo Go أثناء التطوير) |
| صاحب المعمل | لوحة ويب | Next.js 14 | https://daari-admin.phi-bit.com |
| **مالك المنصّة (Ahmed)** | لوحة ويب منفصلة | Next.js 14 | https://platform.phi-bit.com |
| (الكل) | الـ API | NestJS 10 | https://api.phi-bit.com/api/v1 |

> **اللغة موحّدة: TypeScript** في كل الأسطح الخمسة (موبايل + ويب + باك إند). نفس الأنواع (types) والمنطق يُشارَك — هذه ميزة أساسية في الصيانة.

---

## 2) الخريطة المعمارية

```
                         ┌─────────────────────────────────────┐
                         │   Backend API — NestJS 10 (TS)        │
                         │   PostgreSQL + Prisma 5 · Redis ·     │
                         │   BullMQ · JWT + Capabilities · Cron  │
                         │   api.phi-bit.com/api/v1              │
                         └───────────────────┬───────────────────┘
                                             │  REST (JWT Bearer)
       ┌──────────────┬──────────────┬───────┴───────┬───────────────────┐
       ▼              ▼              ▼               ▼                   ▼
  تطبيق الزبون    تطبيق السائق   لوحة المعمل      لوحة المنصّة         Webhooks
  Expo/RN         Expo/RN        Next.js          Next.js            (WhatsApp/SMS)
  (mobile-        (mobile-       (dashboard)      (platform-console)
   customer)       worker)       daari-admin      platform.phi-bit

  خدمات خارجية:  Apple/Google Maps · WhatsApp · SMS (otpiq) · FCM Push · Zoho SMTP · Sentry · PostHog
```

**ملاحظة مهمّة:** المنصّة **TypeScript بالكامل** — التطبيقات بُنيت بـ **Expo (React Native)**، **ليست Flutter**. (نسخة قديمة من هذا الملف ذكرت Flutter بالخطأ.)

---

## 3) هيكل المستودع

```
maa-platform/
├── backend/            NestJS API (Prisma + PostgreSQL + Redis + BullMQ)        → /var/www/daari-water-api
├── mobile-customer/    تطبيق الزبون (Expo SDK 54 + expo-router + nativewind)     → Metro :8087
├── mobile-worker/      تطبيق السائق (Expo SDK 54)                                 → Metro :8086
├── dashboard/          لوحة المعمل (Next.js 14 + Tailwind + recharts)            → daari-admin.phi-bit.com :3005
├── platform-console/   لوحة مالك المنصّة (Next.js 14) — جديدة                     → platform.phi-bit.com :3011
├── mobile-admin/        (قديم — حُوِّل لـ PWA؛ متروك، لا تطوّره)
├── docs/               توثيق (api-reference, MONITORING, UPTIMEROBOT)
├── legal/ · store-assets/ · deploy/ · scripts/
└── README.md           ← هذا الملف
```

كل تطبيق موبايل + كل لوحة فيها مجلّد `design/` فيه **mockups HTML** للتصاميم المعتمدة (افتحها في المتصفح).

---

## 4) التشغيل المحلي (التطوير)

### المتطلبات
- Node.js 20+ · Docker (لـ Postgres + Redis محلياً) · Expo Go على هاتفك أو iOS Simulator.

### مهم جداً — جدول المنافذ الثابتة (لا تغيّرها)
| المكوّن | المنفذ | الأمر |
|---|---|---|
| Backend API | `3000` (محلي) / `3004` (إنتاج) | `npm run start:dev` |
| لوحة المعمل | `3005` | `npm run dev` |
| لوحة المنصّة | `3011` | `npm run dev` |
| Metro — الزبون | `8087` | `npx expo start --port 8087` |
| Metro — السائق | `8086` | `npx expo start --port 8086` |

### Backend
```bash
cd backend
cp .env.example .env          # عدّل الأسرار (DB, JWT_SECRET, ...)
docker compose up -d          # Postgres + Redis
npm install
npx prisma generate
npx prisma db push            # ⚠️ المشروع يستخدم db push وليس migrations
npm run prisma:seed           # بيانات تجريبية
npm run start:dev             # http://localhost:3000/api/v1  (Swagger: /api/docs)
```

### التطبيقات (الزبون / السائق)
```bash
cd mobile-customer            # أو mobile-worker
npm install
npx expo start --port 8087    # 8086 للسائق — امسح QR بـ Expo Go
```

### اللوحات (المعمل / المنصّة)
```bash
cd dashboard                  # أو platform-console
npm install
npm run dev                   # 3005 للمعمل / 3011 للمنصّة
```

---

## 5) الأدوار والصلاحيات (Capabilities)

كل مستخدم له `role` أساسي، وقدراته تُحسَب تلقائياً ويفرضها الـ Backend عبر `RolesGuard`/`@RequireCapability`:

| Capability | يحصل عليها |
|---|---|
| `customer` | الزبون |
| `driver` | سائق فتح له المعمل ملفاً |
| `plant_admin` | OWNER / MANAGER / ACCOUNTANT لمعمل |
| `platform_admin` | مالك المنصّة (Ahmed) — عبر كل المعامل، `tenantId = null` |

### حسابات تجريبية (على البروداكشن — معمل `demo-tenant`)
| الدور | الهاتف | كلمة السر |
|---|---|---|
| الزبون | `07710000001` | `password123` |
| السائق | `07700000002` | `password123` |
| صاحب المعمل | `07700000001` | `password123` |
| **مالك المنصّة** | `07752222558` | `DaariOwner@2026` (مؤقتة) |

> 🔒 كلها كلمات seed افتراضية — **غيّرها قبل أي استخدام حقيقي**.

---

## 6) التدفّقات الرئيسية

### دورة حياة طلب التعبئة
```
الزبون يطلب → PENDING (بركة عروض، بلا سائق)
   → سائق يضغط «قبول» (claim, أول من يضغط يفوز) → ASSIGNED
   → السائق يبدأ → EN_ROUTE (الزبون يرى موقعه على الخريطة)
   → يصل ويعبّئ ويُحصّل نقداً → COMPLETED  (أو FAILED / CANCELLED)
```

**نموذج «العرض والمنافسة» (claim):** الطلبات الجديدة **لا تُسنَد تلقائياً** — تدخل بركة `GET /orders/me/available`، وأول سائق ينادي `POST /orders/:id/claim` يأخذها (atomic، آمن ضد التسابق). المدير يستطيع الإسناد يدوياً كاحتياطي.

- **الدفع: نقدي عند التسليم فقط.** لا صورة إثبات (توفيراً للذاكرة).
- التتبّع الحيّ + ETA حقيقي عبر إحداثيات السائق.

---

## 7) مكوّنات الـ Backend

| الموديول | الغرض | أمثلة Endpoints |
|---|---|---|
| `auth/` | JWT + refresh (rotating, نافذة سماح 30s) + OTP | `/auth/login`, `/auth/refresh`, `/auth/me` |
| `orders/` | دورة الطلب + **claim** + الإلغاء + التقييم | `/orders`, `/orders/me/available`, `/orders/:id/claim` |
| `customers/` | CRM + العناوين المتعدّدة + الجدولة التلقائية | `/customers`, `/customers/me/addresses`, `/customers/me/schedules` |
| `drivers/` | السائق + GPS + الأرباح + ملخص الوردية + جرد الفان | `/drivers/me/earnings`, `/drivers/me/van-inventory` |
| `cash-handover/` | تسوية نقد السائق | `/drivers/me/cash-handover`, `/plant/cash-handovers` |
| `ratings/` | تقييم الزبون بعد التوصيل | `/orders/:id/rate`, `/drivers/:id/ratings` |
| `tanks/` `accounting/` `notifications/` `plant/` | الخزانات · المحاسبة · WhatsApp/SMS · إحصاءات المعمل | — |
| `platform-admin/` | **لوحة المنصّة** — كل المعامل + الإيرادات + الإجراءات | `/platform/overview`, `/platform/plants`, `/platform/wallets` |

كل مسارات `/platform/*` محميّة بـ `@Roles(PLATFORM_ADMIN)`.

---

## 8) النشر (Deployment)

كل شيء على **VPS واحد** (Contabo `45.84.138.119`, Ubuntu 24.04) — **لا تنشئ سيرفراً جديداً**.

| الخدمة (systemd) | المنفذ | المسار | النطاق |
|---|---|---|---|
| `daari-water-api` | 3004 | `/var/www/daari-water-api` | api.phi-bit.com |
| `daari-water-dashboard` | 3005 | `/var/www/daari-water-dashboard` | daari-admin.phi-bit.com |
| `platform-console` | 3011 | `/var/www/platform-console` | platform.phi-bit.com |
| `daari-customer-metro` | 8087 | `/var/www/daari-customer-mobile` | (تطوير) |
| `daari-worker-metro` | 8086 | `/var/www/daari-worker-mobile` | (تطوير) |

**دورة النشر** (باك إند مثالاً): `npm run build` محلياً → `rsync dist/src` للسيرفر → `systemctl restart daari-water-api`.
**للموبايل في الإنتاج:** الطريق الصحيح هو **`eas build`** (تطبيق مستقل، لا يعتمد على Metro).

> راجع `/root/PROJECTS.md` على السيرفر — هو **المرجع الوحيد** للمنافذ والخدمات والـ vhosts. حدّثه قبل أي نشر جديد.

---

## 9) قواعد ومزالق مهمّة للفريق (تجنّب هذه الأخطاء)

- **db push وليس migrations** — لا تشغّل `prisma migrate` على الإنتاج. (الـ Prisma يقرأ `schema.prisma` الجذري على السيرفر.)
- **ValidationPipe صارم** (`forbidNonWhitelisted: true`) — أي حقل زائد في جسم الطلب = خطأ 400. أرسل الحقول المسموحة فقط.
- **reanimated 4 (الموبايل):** لا تكتب/تقرأ `sharedValue.value` أثناء الـ render (فقط داخل `useEffect` أو معالج حدث)، ولا تنادِ دالة JS عادية داخل worklet. مخالفة ذلك = انهيار التطبيق بالكامل.
- **react-native-maps:** لا تمرّر إحداثيات غير صالحة / منطقة خريطة عملاقة لـ `MapView` — MapKit تنهار. قيّد الـ region وتحقق من finite.
- **توكن التجديد one-time-use** — لا تُطلق عمليتَي refresh متزامنتين (الـ client single-flight يضمن ذلك).
- **المنافذ ثابتة** (الجدول أعلاه) — لا تشغّل Metro/dev server على منفذ مشروع آخر.

---

## 10) نموذج العمل

خطط اشتراك المعامل (شهرياً، IQD): **STARTER · PRO · BUSINESS · ENTERPRISE**.
محفظة العروض: المعمل يدفع نقداً لـ Ahmed، وAhmed يشحن المحفظة من لوحة المنصّة (`/platform/wallets`).

---

## 11) المراقبة والتوثيق
- `docs/api-reference.md` — مرجع الـ API.
- `docs/MONITORING.md` · `docs/UPTIMEROBOT.md` — Sentry + UptimeRobot + التنبيهات.
- mockups التصاميم: `mobile-worker/design/`, `dashboard/design/`.
