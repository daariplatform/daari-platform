# تقرير الفحص الشامل — منصّة داري (Daari Platform)

**تاريخ الفحص:** 2026-07-02 · **الفرع:** `audit/cleanup` · **القاعدة:** `9766f18`

> فحص متعدّد الوكلاء (17 فاحصًا متوازيًا حسب البُعد/الوحدة + ناقد اكتمال أضاف 3 فاحصي فجوات)، يتبعه **تحقّق عدائي**
> لكل نتيجة ولكل عنصر مُرشَّح للحذف (مدقّق سلامة حذف مستقلّ يُعيد البحث بنفسه). إجمالي 167 وكيلًا، صفر أخطاء.
> الأدلة أدناه من قراءة الكود الفعلي؛ ما لم يصمد أمام التحقّق نُقل إلى قسم «النتائج المرفوضة» للشفافية.

---

## 1) الملخّص التنفيذي

المشروع **صحّي بنيويًا وقابل للشحن**: الوحدات الأربع للجوّال (`customer/driver/admin/daari_core`) تُحلَّل بلا ملاحظات،
والخادم يبني نظيفًا (`nest build` exit 0)، ولوحتا الويب تبنيان بنجاح (`next build`). انضباط الحدود المعمارية جيّد
(لا استيراد لـ`daari_core/src/**` الداخلي في التطبيقات، لا منطق أعمال مكرّر في العميل لتسعير الطلبات)، وعزل المستأجِرين
مطبَّق باتّساق عبر الحُرّاس العامّة، والأعمدة المالية كلّها `Int` بالدينار (لا `Float` يمسّ المال).

لكن الفحص كشف **مشاكل حقيقية تستحقّ الإصلاح**، أبرزها أربع حرجة (تسريب PII بعد تسجيل الخروج عبر service worker،
خطأ منطقة زمنية يُخطئ رواتب السائقين، إسقاط صامت لبيعة نقدية ثانية دون اتصال، ونسخ احتياطي ليلي لا ينجح أبدًا)،
إضافةً إلى ~55 مشكلة متوسّطة (أمن، سباقات مالية، idempotency، معالجة أخطاء) و~60 مشكلة منخفضة (جودة، تكرار، اعتماديات).

**حالة الاختبارات (خط الأساس، قبل أي تعديل):** جهّزتُ Postgres/PostGIS + Redis عبر Docker وقاعدة `maa_platform_test`.
النتيجة: **15 نجاح / 3 فشل** (مجموعتان). الأسباب الثلاثة كلّها أخطاء حقيقية دخلت التقرير (اختبارات دورة الطلب متقادمة
بعد الانتقال لنموذج المطالبة، ورسالة حجم الرفع العربية لا تصل للعميل).

| الفئة | حرجة | متوسطة | منخفضة | الإجمالي |
|---|---|---|---|---|
| أمن (Security) | 1 | 8 | 8 | 17 |
| أخطاء منطقية (Bugs) | 2 | 17 | 18 | 37 |
| بنية ومعمارية (Architecture) | 0 | 3 | 7 | 10 |
| جودة الكود (Quality) | 0 | 12 | 20 | 32 |
| اعتماديات (Dependencies) | 0 | 2 | 4 | 6 |
| اختبارات وبنية تحتية | 1 | 3 | 2 | 6 |
| **الإجمالي (بعد إزالة التكرار)** | **4** | **~45** | **~59** | **~108** |

**العناصر غير المستخدمة:** 118 عنصرًا مؤكَّد أنه قابل للحذف بأمان + عنصر واحد «بانتظار قرارك» (logrotate — يُوصَل لا يُحذف)
+ **عنصران رفضهما مدقّق السلامة** (`PlantGroup` و`VendorWalletEntry` — مستخدمان فعلًا رغم غياب استدعاء عميل Prisma المباشر، **لا تُحذفا**).

---

## 2) المشاكل الحرجة (Critical)

### C-1 — تخزين مؤقّت للاستجابات المصادَقة في service worker يسرّب PII بعد تسجيل الخروج
- **الملف:** [dashboard/next.config.mjs:20](dashboard/next.config.mjs#L20) + الملفّان المُودَعان `dashboard/public/sw.js` و`platform-console/public/sw.js`
- **الوصف:** `next-pwa` يُستخدم بإعداد `runtimeCaching` الافتراضي، فالـ`sw.js` المُودَع يسجّل قاعدة شاملة `NetworkFirst` لكل أصل مختلف
  (`cacheName: 'cross-origin'`, `maxAgeSeconds: 3600`). الـ API على أصل مختلف (`api.phi-bit.com`) عن اللوحات (`daari-admin.phi-bit.com`)،
  فكل `GET` مصادَق (زبائن بأرقام هواتف وعناوين، محاسبة، محافظ، تقارير) يُكتَب في Cache Storage، **يبقى بعد تسجيل الخروج**، ويُقدَّم قديمًا
  عند أي انقطاع/مهلة >10s — بما في ذلك **لمستخدم/مستأجِر آخر** يسجّل دخوله لاحقًا على نفس المتصفّح (المفتاح هو الـURL لا المستخدم).
  تعليق `buildExcludes` يزعم أن استجابات الـAPI لا تُخدَم من الكاش، لكنه يؤثّر على precaching فقط لا على قاعدة التشغيل هذه.
- **الحل المقترح:** مرّر `runtimeCaching` صريحًا يعالج أصل `api.phi-bit.com` بـ`NetworkOnly` في اللوحتين، ونادِ `caches.delete('cross-origin')`
  عند `logout()`، وأعد البناء ليسقط `public/sw.js` قاعدة الكاش عبر الأصول.

### C-2 — تواريخ فترة الراتب مُزاحة بتوقيت UTC → دفع رواتب سائقين خاطئ
- **الملف:** [dashboard/src/app/dashboard/accounting/page.tsx:427](dashboard/src/app/dashboard/accounting/page.tsx#L427) (والافتراضي في السطر 391 من نفس الصنف)
- **الوصف:** `SalariesTab` يحوّل مدخلات التاريخ بـ`new Date(periodStart/periodEnd).toISOString()`، فينتج منتصف ليل UTC = الساعة 03:00 بتوقيت العراق؛
  والخادم يرشّح `completedAt` بين هذين اللحظتين بالضبط ([accounting.service.ts:391,408](backend/src/accounting/accounting.service.ts#L391))،
  فتُستبعَد كل الطلبات المكتملة بعد 03:00 محليًا في اليوم الأخير من عمولة/مكافأة السائق. كذلك `periodStart` الافتراضي يُصيَّر باليوم الأخير
  من الشهر السابق في UTC+3، فنافذة «الشهر الحالي» تتضمّن يومًا من الشهر السابق. النتيجة: **خطأ منهجي في احتساب رواتب السائقين** المدفوعة من هذه الصفحة.
- **الحل المقترح:** ابنِ سلاسل التاريخ من مكوّنات محلية (`getFullYear/getMonth/getDate` كما في `drivers/live/page.tsx` → `todayStr()`)،
  وأرسِل `periodEnd` كنهاية يوم محلية (`23:59:59.999`) بدل `toISOString()`.

### C-3 — dedupe البيع دون اتصال يُسقط بيعة نقدية ثانية مشروعة بصمت
- **الملف:** [mobile-flutter/apps/driver/lib/screens/walkin_screen.dart:340](mobile-flutter/apps/driver/lib/screens/walkin_screen.dart#L340)
- **الوصف:** عند فشل بيعة walk-in بخطأ شبكة تُدرَج في الطابور بمفتاح `walkin:<customerId>:<amount>`. تُرجع `OfflineQueue.enqueue` القيمة `false`
  (ولا تُدرِج شيئًا) إن وُجد صفّ معلّق بنفس المفتاح، **لكن القيمة المُعادة تُتجاهَل** والواجهة تعرض «حُفِظت البيعة وستُرسَل». سائق يبيع تعبئتين لنفس
  الزبون بنفس السعر أثناء انقطاع الاتصال يجمع النقد مرّتين لكن تُزامَن بيعة واحدة فقط → **فقدان صامت لسجلّ الإيراد ومطابقة النقد**. idempotency الخادم
  مبنيّ على `clientRequestId` لكل تأكيد، ولا يمكنه استرجاع صفّ لم يُدرَج أصلًا.
- **الحل المقترح:** افحص القيمة المنطقية من `enqueue()` ونبّه السائق عند قمع تكرار؛ والأفضل: اجعل مفتاح صفّ الطابور هو `clientRequestId`
  المُولَّد لكل بيعة مؤكَّدة (فريد)، فلا تُسقَط بيعتان متمايزتان بينما يبقى النقر المزدوج مقموعًا.

### C-4 — النسخ الاحتياطي الليلي لا ينجح أبدًا: `pg_dump` يرفض سلسلة اتصال Prisma
- **الملف:** [scripts/backup-db.sh:49](scripts/backup-db.sh#L49)
- **الوصف:** السكربت يقرأ `.env` الخادم (نفس ملفّ NestJS) ويمرّر `$DATABASE_URL` إلى `pg_dump`. القالب يفرض `...?schema=public`
  ([.env.production.example:27](backend/.env.production.example#L27))، و`libpq` يرفض معاملات URI غير المعروفة، فيخرج بـ`invalid URI query parameter: "schema"`
  في **كل تشغيل** → صفر نسخ صالحة، يفشل بصمت في سجلّ cron لا يُقرأ (تعرّض لفقدان بيانات يوم الحاجة للاستعادة). يضاعفه أن `ENV_FILE` الافتراضي
  `/var/www/daari-api/.env` بينما المسار الفعلي `/var/www/daari-water-api/` (انظر L-low أدناه).
- **الحل المقترح:** جرّد معامل schema قبل الاستخدام: `CONN="${DATABASE_URL/\?schema=public/}"` (أو فُكّ الـURL وأعد بناءه)،
  وأضف فحص سلامة بعد الـdump (حجم غير تافه للناتج المفكوك).

---

## 3) المشاكل المتوسطة (Medium)

### أمن الخادم والنشر

| المعرّف | الملف:السطر | الوصف | الحل المقترح |
|---|---|---|---|
| M-S1 | [docker-compose.yml:13](backend/docker-compose.yml#L13) | يكشف Postgres (باعتماد `maa/maa_password`) وRedis (بلا كلمة سرّ) على `0.0.0.0`؛ خطر على أي مضيف غير محلّي. | اربط المنافذ بـ`127.0.0.1:5432:5432`، اضبط كلمة سرّ قويّة، وفعّل `requirepass` لـRedis. |
| M-S2 | [orders.controller.ts:53](backend/src/orders/orders.controller.ts#L53) | `completionLng/Lat` في `CompleteOrderDto` بلا `@IsNumber`؛ قيمة غير رقمية → `haversineMetres` = `NaN`، و`NaN > limit` = false → يتخطّى السياج الجغرافي ويختم `gpsVerified=true`. تجاوز مضادّ للاحتيال. | أضف `@IsNumber()/@IsLatitude()/@IsLongitude()` على حقول الإحداثيات (و`WalkinRefillDto`)، وارفض `NaN` قبل فحص المسافة. |
| M-S3 | [uploads.controller.ts:101](backend/src/uploads/uploads.controller.ts#L101) | `fileFilter` يثق بـMIME من العميل (قابل للانتحال) والامتداد المخزَّن يؤخَذ من `originalname`؛ رفع `evil.svg`/`.html` بترويسة `image/png` يُخزَّن ويُخدَم من nginx → **XSS مخزَّن** على أصل الـAPI. | اشتقّ الامتداد من MIME المُتحقَّق منه، وارفض أي `originalname` بامتداد خارج قائمة صور صارمة. |
| M-S4 | [deploy/nginx/daari-water-api.conf:58](deploy/nginx/daari-water-api.conf#L58) | `location /uploads/` يخدم كل شيء بلا مصادقة؛ تقارير الإكسل (`/uploads/reports/<tenantId>/<uuid>.xlsx`) تحوي أسماء/هواتف/مناطق زبائن مستأجِر كامل، محميّة بـUUID فقط. لا يوجد مهمّة تنظيف فالانتهاء 24س حقل JSON فقط. | اخدم ملفّات التقارير عبر مسار NestJS مصادَق يُعيد فحص `tenantId`، أو انقل `/uploads/reports/` خلف المصادقة وقصِّر الاحتفاظ + أضف تنظيفًا. |
| M-S5 | [seed-prod.cjs:87](backend/prisma/seed-prod.cjs#L87) | `upsert` يرفع أي مستخدم يملك `PLATFORM_ADMIN_PHONE` إلى `PLATFORM_ADMIN` (يبقي كلمة سرّه وtenantId)؛ يُشغَّل في كل نشر. تغيير المشغّل للرقم إلى رقم يملكه مستخدم مستأجِر يمنحه تحكّمًا كاملًا بالمنصّة. | في فرع التحديث: أجهِض ما لم يكن الصفّ أصلًا `PLATFORM_ADMIN` بـ`tenantId=null`؛ لا ترقِّ مستخدمًا مستأجِرًا أبدًا. |

### أمن لوحات الويب

| المعرّف | الملف:السطر | الوصف | الحل المقترح |
|---|---|---|---|
| M-S6 | [dashboard/next.config.mjs:34](dashboard/next.config.mjs#L34) | لا `middleware.ts` ولا ترويسات أمان؛ حماية المسارات فحص عميل فقط (`useEffect` لوجود التوكن)، واللوحات قابلة للتأطير (لا `X-Frame-Options`/`frame-ancestors`) → clickjacking لأفعال إدارية. | أضف `headers()` في `next.config.mjs` (أو nginx) بـ`X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`؛ لاحقًا انقل التوكنات لكوكيز لتفعيل حارس server-side. |
| M-S7 | [dashboard/src/lib/api.ts:29](dashboard/src/lib/api.ts#L29) | التوكن **والـrefresh** يُخزَّنان في `localStorage` (`maa_access`/`maa_refresh`)؛ أي XSS يسرّبهما → استيلاء دائم على حساب. الـrefresh **لا يُقرأ أبدًا** (لا مسار `/auth/refresh` في اللوحتين) → مسؤولية بلا فائدة. (اللوحتان ملفّان متطابقان.) | انقل التوكنات لكوكيز `httpOnly SameSite`؛ كحدّ أدنى أوقف تخزين الـrefresh وأضف CSP. |
| M-S8 | [dashboard/src/lib/api.ts:53](dashboard/src/lib/api.ts#L53) | معترض 401 يعيد التوجيه لـ`/login` على **كل** 401 بما فيه 401 تسجيل الدخول الخاطئ → إعادة تحميل كاملة تمحو رسالة «فشل تسجيل الدخول»؛ ولا يحاول تجديد التوكن فيفقد حالة النماذج. | تخطَّ التوجيه حين `url === /auth/login` (أو أثناء `/login`)، ووجّه فقط لـ401 الجلسات المصادَقة؛ يُفضَّل محاولة `/auth/refresh` أولًا. |

### أخطاء منطقية — الخادم (المال)

| المعرّف | الملف:السطر | الوصف | الحل المقترح |
|---|---|---|---|
| M-B1 | [accounting.service.ts:386](backend/src/accounting/accounting.service.ts#L386) | تجميع العمولة يحسب **كل** أنواع الطلبات المكتملة بلا مرشّح `kind` (بينما المكافأة تُعالَج بالفعل عبر لقطة `bonusIqd`)، فتنفخ walk-in/tank السائقُ راتبه؛ ولا حارس ضد فترات متداخلة → دفع الطلبات ذاتها مرّتين. | أضف `kind: REFILL` للتجميع، وارفض/نبّه عند تداخل فترة `SalaryPayment` مع قائمة. |
| M-B2 | [accounting.service.ts:667](backend/src/accounting/accounting.service.ts#L667) | `transactions()` يسحب `max(pageSize*5, 200)` صفًّا لكل مصدر ويُرجع `total = merged.length` (≤~750)؛ الصفحات بعد نافذة السحب تعود فارغة والإجمالي خاطئ فتُخفى صفوف مالية. | احسب `total` من `count()` حقيقي لكل مصدر، واستخدم ترقيم keyset (cursor على `occurredAt`). |
| M-B3 | [cash-handover.service.ts:89](backend/src/cash-handover/cash-handover.service.ts#L89) | `summaryForDriver` يجمع `paidAmountIqd` على كل الطلبات المكتملة بلا مرشّح طريقة الدفع، لكن `PaymentMethod` يشمل ZAINCASH/ASIA_HAWALA/CREDIT → السائق يظهر «محصّلًا» نقدًا لم يقبضه فيبدو ناقصًا عند التسليم. | رشّح التجميع بـ`paymentMethod: 'CASH'` (أو أبلِغ تفصيلًا لكل طريقة). |
| M-B4 | [orders.service.ts:999](backend/src/orders/orders.service.ts#L999) | `cancel()` يقرأ ثم يُحدّث بلا حارس حالة؛ إن اكتمل `complete()` (بحارس ذرّي) بين القراءة والكتابة يُقلَب الطلب `COMPLETED → CANCELLED` مع بقاء آثار المال (رصيد/ولاء/مخزون/محفظة) → المال يختفي من كل التقارير التي ترشّح `status=COMPLETED`. | استخدم `updateMany` بـ`where {id, status in cancellable}` وعامِل `count===0` كتعارض. |
| M-B5 | [orders.service.ts:141](backend/src/orders/orders.service.ts#L141) | حارس «طلب نشط واحد» هو check-then-create بلا قيد DB؛ نقرتان متزامنتان (أو معالِج الجدولة يسابق طلبًا يدويًا) يُنتجان طلبين PENDING → شحن وفوترة نفس الخزّان مرّتين. | أضف فهرس فريد جزئي على `(tenantId, customerId)` حيث `kind='REFILL'` وحالة نشطة، أو تسلسل الإنشاء داخل transaction. |
| M-B6 | [plant.controller.ts:433](backend/src/plant/plant.controller.ts#L433) | سعر بثّ WhatsApp يُحسَب على جمهور (`userId != null`) لكن مهمّة الطابور تُبنى من استعلام بلا هذا المرشّح → زبائن بلا حساب يُراسَلون دون تسعير، فتُفوتَر المنصّة ناقصًا و`sentCount > audienceCount`. | احسب الجمهور مرّة واحدة واشتقّ منه التسعير والقائمة المُرسَلة معًا. |

### أخطاء منطقية — الخادم (بقيّة)

| المعرّف | الملف:السطر | الوصف | الحل المقترح |
|---|---|---|---|
| M-B7 | [auth.service.ts:284](backend/src/auth/auth.service.ts#L284) | نافذة سماح إعادة استخدام الـrefresh (30s) لا تميّز إلغاء التدوير عن الإلغاء الصريح؛ مهاجم يجدّد خلال 30s من إعادة تعيين الضحية كلمة السرّ يحصل على refresh جديد غير مُبطَل ويظلّ يدوّره → إعادة التعيين لا تقتل جلسته. | ميّز سبب الإلغاء (`revokedReason`) وارفض إعادة استخدام نافذة السماح للتوكنات المُلغاة بإعادة تعيين/خروج/حذف. |
| M-B8 | [otp.service.ts:33](backend/src/auth/otp.service.ts#L33) | `generateCode()` يستخدم `Math.random` (غير تشفيري) لرموز OTP للتسجيل وإعادة التعيين؛ رمز إعادة تعيين صحيح يمنح توكنات دخول كاملة. | ولّد الرمز بـ`crypto.randomInt(0, 1000000)` وبطّنه لـ6 خانات. |
| M-B9 | [reminder.scheduler.ts:58](backend/src/notifications/reminder.scheduler.ts#L58) | مهمّة التذكير اليومية تُعيد مراسلة **كل** زبون `AT_RISK` بلا حارس «أُرسِل سابقًا» (بخلاف جدولة الاشتراك) → إزعاج يومي وحرق أرصدة WhatsApp/SMS مدفوعة. | افحص `NotificationLog` قبل الإرسال (كما في `subscription-reminder.scheduler`) أو راسِل من تغيّرت حالته فقط. |
| M-B10 | [subscription-reminder.scheduler.ts:65](backend/src/notifications/subscription-reminder.scheduler.ts#L65) | التذكير والتعليق التلقائي يعتمدان مساواة `daysLeft` بالضبط (14/7/3/-1)؛ تشغيل فائت أو انزياح حدود يتخطّى النافذة نهائيًا — والأخطر: تخطّي `-1` يعني **عدم تعليق** المستأجِر المنتهي أبدًا. | استخدم عتبات مدى + dedup، وعلّق أي مستأجِر `endsAt` في الماضي بدل اشتراط `daysLeft===-1`. |
| M-B11 | [whatsapp-blast.processor.ts:68](backend/src/queue/whatsapp-blast.processor.ts#L68) | `process()` يعيد جلب القائمة كاملة ويبدأ من 0 بلا سجلّ مُرسَل، مع `attempts:3`؛ فشل بعد إرسال جزئي يعيد إرسال البثّ للجميع → بثّ مدفوع مكرّر لآلاف. | ثبّت حالة الإرسال لكل مستلِم (مجموعة/cursor) وتخطَّ المُرسَل عند الإعادة، أو اجعل الإرسال idempotent. |
| M-B12 | [customers.controller.ts:196](backend/src/customers/customers.controller.ts#L196) | `throw new Error('لم يتم رفع ملف')` في `importPreview/importCommit` و`throw new Error('Tenant not found')` في [tenants.service.ts:181](backend/src/tenants/tenants.service.ts#L181) → Nest يحوّلها لـ500 عامّ، تُفقَد الرسالة العربية وتلوّث Sentry. | استبدِل بـ`BadRequestException`/`NotFoundException`. |

### أخطاء منطقية — نموذج البيانات

| المعرّف | الملف:السطر | الوصف | الحل المقترح |
|---|---|---|---|
| M-B13 | [schema.prisma:646](backend/prisma/schema.prisma#L646) | مسارات `onDelete: Cascade` تدمّر السجلّات المالية: حذف سائق يمحو دفتر تسليم النقد؛ حذف مستأجِر يمحو Subscription/WalletTopup/RefillOrder/Expense/SalaryPayment/Invoice. كامن (لا نقطة حذف اليوم) لكن أوّل ميزة حذف تُلحق ضررًا صامتًا. | حوّل الدفاتر المالية إلى `onDelete: Restrict` واعتمِد soft-delete/أرشفة للمستأجِر/السائق. |
| M-B14 | [schema.prisma:169](backend/prisma/schema.prisma#L169) | `User.phone` فريد **عالميًا** ومربوط بـtenant واحد (بينما `Customer` فريد لكل مستأجِر)؛ أوّل معمل يسجّل رقمًا يتحكّم بحسابه/يمنعه في كل معمل آخر. الدخول بالرقم المجرّد فيصير القيد حِمليًا. | اسمح بربط `User` بعدّة `Customer` عبر عضويات، أو اجعل الاعتماد لكل مستأجِر؛ كحدّ أدنى اجعل تحكيم الملكية لمدير المنصّة. |

### أخطاء منطقية — لوحات الويب

| المعرّف | الملف:السطر | الوصف | الحل المقترح |
|---|---|---|---|
| M-B15 | [customers/page.tsx:150](dashboard/src/app/dashboard/customers/page.tsx#L150) | زرّ «عرض» في شريط الموافقات يضبط `search='بانتظار'` كنصّ حرّ، والخادم يطابق الاسم/الهاتف/العنوان/QR فقط لا الحالة → قائمة فارغة. و`pendingCount` من صفحة الـ50 الحالية فقط. | مرّر `status=PENDING_APPROVAL` كمرشّح حقيقي، واحسب العدد من استعلام مُرشَّح بالحالة. |
| M-B16 | [customers/page.tsx:233](dashboard/src/app/dashboard/customers/page.tsx#L233) | `STATUS[c.status].klass` (وفي `notifications/page.tsx:72`) بلا احتياط؛ نفس صنف العطل الموثَّق كخطأ إنتاج سابق في `drivers/page.tsx` (الذي عولِج بـ`?? STATUS.OFFLINE`). أي حالة enum جديدة تُسقِط الصفحة كاملة عبر error boundary. | طبّق نفس الاحتياط `(STATUS[x] ?? DEFAULT).klass` في الصفحتين. |
| M-B17 | [drivers/page.tsx:93](dashboard/src/app/dashboard/drivers/page.tsx#L93) | `resetMutation` (سائق) و`reclaimMutation` ([tanks/page.tsx:89](dashboard/src/app/dashboard/tanks/page.tsx#L89)) و`updateMutation` ([stock/page.tsx:33](dashboard/src/app/dashboard/stock/page.tsx#L33)) بلا `onError` → فشل 403/شبكة صامت، والمشرف يظنّ العملية نجحت. | أضف نمط `onError` مع تنبيه (كما في mutations المجاورة). |
| M-B18 | [orders/page.tsx:133](dashboard/src/app/dashboard/orders/page.tsx#L133) | لوحة kanban (العرض الافتراضي) ترشّح شريحة الـ50 المرقّمة، وأزرار الترقيم في فرع القائمة فقط → طلبات PENDING أقدم من الشريحة غير مرئية ولا تُسنَد؛ وعمود «مكتمل اليوم» يعرض أي COMPLETED في الشريحة بلا مرشّح تاريخ. | اجلب بيانات kanban باستعلام مخصّص (مرشّحات حالة) مستقلّ عن ترقيم القائمة، ورشّح العمود المكتمل بـ`completedAt >= today`. |
| M-B19 | [accounting/page.tsx:391](dashboard/src/app/dashboard/accounting/page.tsx#L391) | افتراضيات فترة الراتب عبر `toISOString().slice(0,10)` على تاريخ منتصف ليل محلّي → في UTC+3 يُصيَّر اليوم الأخير من الشهر السابق (نفس صنف C-2). | ابنِ افتراضات `YYYY-MM-DD` من مكوّنات التاريخ المحلية (نمط `todayStr`). |
| M-B20 | [subscription/page.tsx:71](dashboard/src/app/dashboard/subscription/page.tsx#L71) | استعلامات البيانات الأساسية بلا حالة خطأ (`subscription/settings/stock/reports` → هيكل عظمي دائم؛ `drivers/customers` → جدول فارغ صامت). المعترض يعالج 401 فقط. (اللوحة الأخرى تطبّق `isError` — العُرف موجود لكنه غير مطبَّق هنا.) | أضف فرع `isError` مع إعادة محاولة (كما في `platform-console/.../plants/page.tsx:156`). |

### أخطاء منطقية — Flutter

| المعرّف | الملف:السطر | الوصف | الحل المقترح |
|---|---|---|---|
| M-B21 | [auth_interceptor.dart:73](mobile-flutter/packages/daari_core/lib/src/api/auth_interceptor.dart#L73) | `catch` حول إعادة الطلب يعامِل **كل** استثناء كفشل مصادقة فينادي `onAuthFailure` (يمسح التوكنات، خروج)؛ نجاح التجديد ثم مهلة/500 على إعادة الطلب (شائع على شبكات العراق) → خروج المستخدم وطلب اعتماد جديد. | اقصُر try/catch على فشل التجديد نفسه؛ عند فشل إعادة الطلب مرّر الخطأ عبر `handler.next` دون مسّ الجلسة. |
| M-B22 | [auth_controller.dart:85](mobile-flutter/packages/daari_core/lib/src/auth/auth_controller.dart#L85) | `onSessionExpired` لا يوقف `LocationService`؛ مؤقّت 30s يظلّ يرسل `POST /drivers/me/location` بلا توكن → 401 → تجديد → `onAuthFailure` حلقة لانهائية تستنزف GPS/البطارية. وخروج الملفّ لا يعيد `onShiftProvider`. | استمِع لانتقال «غير مصادَق» لاستدعاء `stopShift()` وإعادة ضبط `onShiftProvider=false`. |
| M-B23 | [offline_queue.dart:95](mobile-flutter/packages/daari_core/lib/src/services/offline_queue.dart#L95) | `flush()` تُستدعى من 3 أماكن بلا حارس تزامن؛ تدفّقان متداخلان يرسلان نفس التحوّل مرّتين. صفوف `register-by-driver` بلا `dedupeKey`/`clientRequestId`، والخادم `create` عاري → عند تكرار: `@@unique([tenantId,phone])` يرمي P2002 غير مُعالَج (500) فيتعطّل الطابور كاملًا خلف الصفّ. | أضف حارس in-flight (Future field) وألصِق `clientRequestId` بإدراجات `register-by-driver`. |
| M-B24 | [push_service.dart:66](mobile-flutter/packages/daari_core/lib/src/services/push_service.dart#L66) | `register()` يشترك في `onTokenRefresh/onMessage/onMessageOpenedApp` بلا إلغاء سابق، ويُستدعى من `HomeScreen.initState` (يتكرّر مع كل زيارة تبويب/إعادة دخول) → تراكم مستمعين؛ إغلاق مُتقادِم يُلمِس `context` لحالة مُتلَفة (خطأ null في release). | اجعل `register()` idempotent: خزّن الاشتراكات وألغِها-وابدِلها، أو احرسها بعلَم مرّة واحدة. |
| M-B25 | [customer/lib/router.dart:26](mobile-flutter/apps/customer/lib/router.dart#L26) | `/map-picker` ليس في `_authRoutes` فيوجّه حارس المستخدمين غير المسجّلين إلى `/welcome`؛ لكن `SignupScreen` (تدفّق غير مسجّل) يدفعه، فزبون يرفض GPS لا يستطيع إكمال التسجيل. | أضف `/map-picker` إلى `_authRoutes` (لا يحمل بيانات مستخدم) أو استثنِه من توجيه غير المسجّلين. |

### أخطاء منطقية — إعداد Flutter الأصلي (Android/iOS)

| المعرّف | الملف:السطر | الوصف | الحل المقترح |
|---|---|---|---|
| M-B26 | [admin/android/app/build.gradle.kts:24](mobile-flutter/apps/admin/android/app/build.gradle.kts#L24) | تطبيق الإدارة يعتمد `flutter_local_notifications ^18` عبر `daari_core` لكن `compileOptions` تُغفل `isCoreLibraryDesugaringEnabled` + `desugar_jdk_libs` (أضافهما customer/driver) → **فشل بناء Android** للإدارة. يفتقر أيضًا لدفعة `compileSdk=36`. | انسخ علَم desugaring + `coreLibraryDesugaring(...)` وكتلة `subprojects compileSdk` من customer/driver. |
| M-B27 | [admin/AndroidManifest.xml:51](mobile-flutter/apps/admin/android/app/src/main/AndroidManifest.xml#L51) | manifest الإدارة يفتقر لـ`<queries>` الخاصّة بـ`url_launcher` (VIEW+https)؛ `canLaunchUrl` يعود false على Android 11+ فيصمت زرّ تصدير التقرير بينما يعرض snackbar نجاح. | أضف نيّة `<queries>` VIEW/https (وtel/mailto إن لزم) كما في customer/driver. |
| M-B28 | [admin/.../project.pbxproj:385](mobile-flutter/apps/admin/ios/Runner.xcodeproj/project.pbxproj#L385) | `PRODUCT_BUNDLE_IDENTIFIER = com.phibit.daariAdmin` (حرف A كبير) بينما Android يستخدم `daariadmin` وFIREBASE_SETUP.md يوجّه للأحرف الصغيرة؛ Firebase يطابق حسّاسًا لحالة الأحرف. | غيّر إلى `com.phibit.daariadmin` في الإعدادات الثلاثة + RunnerTests قبل أي إصدار iOS. |
| M-B29 | [customer/AndroidManifest.xml:10](mobile-flutter/apps/customer/android/app/src/main/AndroidManifest.xml#L10) | لا تطبيق من الثلاثة يضبط `android:allowBackup="false"`؛ النسخ التلقائي يشمل `EncryptedSharedPreferences` (التوكنات) وقاعدة الطابور. بعد الاستعادة على جهاز جديد لا يوجد مفتاح Keystore فترمي `TokenStorage` في splash → التطبيق معطّل حتى مسح البيانات يدويًا. | أضف `android:allowBackup="false"` (أو `dataExtractionRules` تستثني تفضيلات آمنة + قاعدة الطابور) في التطبيقات الثلاثة. |

### البنية والمعمارية

| المعرّف | الملف:السطر | الوصف | الحل المقترح |
|---|---|---|---|
| M-A1 | [plant.controller.ts:80](backend/src/plant/plant.controller.ts#L80) | أربع تحكّمات في `plant` تحقن `PrismaService` مباشرةً وتضمّ ~2000 سطر منطق (فوترة، كتابة PDF/XLSX للقرص، تجزئة كلمات سرّ)، بينما بقيّة الوحدات تمرّ عبر خدمات. دالّة `audit()` مكرّرة 3 مرّات. عزل المستأجِر يُكرَّر يدويًا في كل `where` بلا نقطة تحكّم. | استخرِج `PlantService/ReportsService/TeamService` ودالّة `audit()` مشتركة (كنمط `PromoService` داخل نفس الوحدة). |
| M-A2 | [platform/wallets/page.tsx:1](dashboard/src/app/dashboard/platform/wallets/page.tsx#L1) | 14+ ملفًّا متطابقًا بايتًا بين `dashboard/` و`platform-console/` (بينها `lib/api.ts` وصفحة شحن المحفظة 433 سطرًا) بلا حزمة مشتركة؛ إصلاح في نسخة يفوت الأخرى. وصفحة محفظة على مستوى المنصّة تعيش داخل لوحة المستأجِر. | أنشئ npm workspace بحزمة ويب مشتركة (api/format/providers/config)، وأبقِ صفحات المنصّة في `platform-console` فقط. |
| M-A3 | [deploy/deploy.sh:89](deploy/deploy.sh#L89) | خطّ أنابيب بلا هجرات: `prisma db push` غير تفاعلي في كل نشر، والكود يُزامَن (`rsync --delete`) قبل المخطّط؛ أي فرق هدّام يُجهِض الدفع فيبقى كود جديد على مخطّط قديم → انهيار عند إعادة التشغيل. لا نسخ احتياطي تلقائي. سكربتات `prisma:migrate` ما زالت في package.json رغم أنها معطّلة. | أنشئ خطّ أساس هجرات وبدّل إلى `migrate deploy`؛ حتى ذلك أضف `pg_dump` + بوّابة `migrate diff` تُجهِض قبل rsync عند DROP/ALTER، واحذف سكربتات migrate المضلّلة. |

### جودة الكود

| المعرّف | الملف:السطر | الوصف | الحل المقترح |
|---|---|---|---|
| M-Q1 | [auth.service.ts:23](backend/src/auth/auth.service.ts#L23) | `auth.service` يعيد تعريف `ARGON2_OPTS` وينادي `argon2.hash/verify` مباشرةً (204/229/325/328) رغم أن `common/crypto.ts` يوثّق أن كل التجزئة تمرّ عبر `hashPassword()` → ترقية معاملات مستقبلية تترك مسارات forgot/change بقوّة قديمة. | استبدِل النداءات المباشرة بـ`hashPassword/verifyPassword` واحذف `ARGON2_OPTS` المحلّي. |
| M-Q2 | [orders.service.ts:896](backend/src/orders/orders.service.ts#L896) | مسار إيميل الإيصال كود ميت مخفيّ بـ`as unknown as { email }` — لا حقل `email` في أي نموذج، فـ`recipientEmail` دائمًا undefined والكتلة (891-922) + `sendReceipt` + `receipt.hbs` لا تُنفَّذ. الـcast يُخرِس خطأ الترجمة. | أضف عمود `Customer.email` أو احذف كتلة الإيصال والـcast حتى يوجد العمود. |
| M-Q3 | [orders.service.ts:595](backend/src/orders/orders.service.ts#L595) | `complete()` دالّة ~330 سطرًا تخلط سياج GPS (بأرقام سحرية) + backfill موقع + دفاع QR + transaction مالية حرجة + كتلتَي إشعار عربيّتين مكرّرتين + إبطال cache + مسار إيميل ميت. | استخرِج `verifyCompletionGps` / `runCompletionTransaction` / `notifyCompletion`، وارفع ثلاثي `arabicKind` المكرّر لبحث واحد. |
| M-Q4 | [orders.service.ts:809](backend/src/orders/orders.service.ts#L809) | خريطة `TankCapacity→liters` مكرّرة 4 مرّات باحتياطات متناقضة: `orders` تُرجِع 350 للمجهول، `plant`/`ai` تُرجِعان 0. enum جديد → خصم مخزون خاطئ بلا خطأ ترجمة. | عرّف `LITERS_BY_CAPACITY: Record<TankCapacity, number>` مشتركًا واستخدمه في المواضع الأربعة. |
| M-Q5 | [plant.controller.ts:35](backend/src/plant/plant.controller.ts#L35) | ثلاث كتالوجات أسعار خطط متضاربة: `PLAN_TIERS` (75k/200k/400k) ≠ `PLAN_PRICES` في tenants (25k/80k/180k، وهو ما يُكتَب فعلًا) ≠ `PLAN_PRICE_IQD` في platform-admin (150k/400k/1M لـMRR) + حدود `TIER_OPS` مكرّرة. | انقل كتالوجًا واحدًا (حدّ + سعر لكل خطّة) إلى `common/plans.ts` واستورده في المواضع الأربعة. |
| M-Q6 | [reports.controller.ts:716](backend/src/plant/reports.controller.ts#L716) | `gatherReportData` يعيد تنفيذ `revenue7d/topCustomers/topDrivers` تقريبًا حرفيًا بافتراضات مختلفة (take 100 مقابل 50، 30 يومًا مقابل 7)؛ إصلاح شاشة لا يصل للتصدير. | استخرِج جمع بيانات كل تقرير في دوالّ خدمة مشتركة مُعاملة بالنافذة/الحدّ، تناديها نقاط GET والتصدير. |
| M-Q7 | [tenants.service.ts:187](backend/src/tenants/tenants.service.ts#L187) | مهارب `as any`/`as unknown as any` حول حقول Prisma وenums (tenants 187-192، auth 375/385/393، orders 798، platform-admin 38) تُبطِل فحص الأنواع؛ إعادة تسمية عمود/enum تُترجَم نظيفة وتفشل وقت التشغيل. | أزِل الـcasts واستخدم الحقول/الـenums المُعرَّفة بأنواعها. |
| M-Q8 | [cache.module.ts:45](backend/src/cache/cache.module.ts#L45) | `REDIS_PASSWORD` معروض في القوالب لكن Redis يُوصَل بلا مصادقة (cache + queue)؛ تصليب Redis بـ`requirepass` يكسر الكاش والبثّ بصمت. و`JWT_REFRESH_SECRET`/`JWT_REFRESH_EXPIRES_IN`/`SLACK_WEBHOOK_URL` لا تُقرأ إطلاقًا. | إمّا اربط `REDIS_PASSWORD` في KeyvRedis + BullMQ، أو احذف المتغيّرات الميتة من القالبين. |
| M-Q9 | [deploy/logrotate/daari-water:1](deploy/logrotate/daari-water#L1) | إعداد logrotate موجود لكن لا سكربت نشر يثبّته في `/etc/logrotate.d/`؛ وحدات systemd تسجّل عبر `append:` فتنمو `/var/log/daari-water/*.log` بلا حدّ حتى تملأ القرص. | أضف خطوة bootstrap: `install -m 644 deploy/logrotate/daari-water /etc/logrotate.d/daari-water`. |
| M-Q10 | [customer/profile_screen.dart:282](mobile-flutter/apps/customer/lib/screens/profile_screen.dart#L282) | `_ChangePasswordDialog` مُنفَّذ 3 مرّات بقواعد تحقّق متناقضة (بلا/مع حقل تأكيد، تلميح «8 أحرف» بينما `Validators.isPassword` يفرض 6). | استخرِج `ChangePasswordDialog` واحدًا في `daari_core` ووحّد التلميح مع `isPassword`. |
| M-Q11 | [customer/widgets/common.dart:7](mobile-flutter/apps/customer/lib/widgets/common.dart#L7) | مجموعة واجهة مشتركة (LoadingButton/LabeledField/SectionCard/EmptyState/AsyncView/showSnack) منسوخة في التطبيقات الثلاثة وقد **تباعدت** فعلًا (driver أضاف `loadingLabel`، customer أضاف `obscureToggle`). | انقلها إلى `daari_core/lib/src/widgets/` كاتّحاد المتغيّرات واحذف النسخ. |
| M-Q12 | [driver/forgot_screen.dart:54](mobile-flutter/apps/driver/lib/screens/forgot_screen.dart#L54) | `forgot_screen.dart` نسخة متباعدة ~160 سطرًا بين customer/driver (snackbar OTP خاطئ، رسائل نجاح، عناوين، مرشّح أرقام)؛ تعليق «يطابق إصلاح الزبون» يثبت نقل إصلاح يدويًا. | انقل التدفّق إلى `ForgotPasswordScreen` مشترك في `daari_core` مُعامَل بمسار ما بعد التعيين. |

### الاختبارات والبنية التحتية

| المعرّف | الملف:السطر | الوصف | الحل المقترح |
|---|---|---|---|
| M-T1 | [test/setup.ts:74](backend/test/setup.ts#L74) | `truncateAll()` يشغّل `TRUNCATE ... CASCADE` على أي DB يحلّها Prisma بلا حارس اسم DB؛ أي جلسة يكون فيها `DATABASE_URL` مُصدَّرًا (CI/direnv/shell الخادم) تُفرّغ الجداول عبر `npm test`. | ارفض التشغيل ما لم يُضبَط `DATABASE_URL_TEST` صراحةً، وتحقّق أن اسم DB يطابق `/_test$/` قبل `TRUNCATE`. |
| M-T2 | [test/uploads.e2e-spec.ts:35](backend/test/uploads.e2e-spec.ts#L35) | `UPLOADS_DIR` يُثبَّت وقت استيراد الوحدة، فتجاوزه في `beforeAll` غير فعّال → اختبار المسار الناجح يكتب لـ`/var/uploads`، و`afterAll` يحذف مجلّدًا مؤقّتًا فارغًا، وعلى Linux CI غير الجذر يفشل بـ500. | اضبط `UPLOADS_DIR` في `test/setup-env.ts` (يعمل قبل استيراد أي وحدة)، واحذف التجاوز غير الفعّال. |
| M-T3 | [backend/tsconfig.json:26](backend/tsconfig.json#L26) | لا `tsconfig.build.json` فيرجِع `nest build` إلى `tsconfig.json` (يستثني `node_modules/dist` فقط) وينتج `dist/test/` و`dist/jest.config.js` و`dist/src/main.js` بلا `dist/main.js` → `start:prod` (`node dist/main`) يفشل؛ الإنتاج يعمل فقط لأن systemd يستخدم `dist/src/main.js`. | أضف `tsconfig.build.json` يستثني `test`/`jest.config.ts`/`prisma/seed.ts`، ووحّد `start:prod` وpackage.json main وExecStart على `dist/main.js`. |
| M-T4 | [backend/test/orders.e2e-spec.ts:59](backend/test/orders.e2e-spec.ts#L59) | **(محقّق بتشغيل خط الأساس)** اختبارا دورة الطلب متقادمان: يفترضان الإسناد التلقائي، بينما انتقل الخادم لنموذج المطالبة (الطلب يُنشأ PENDING بلا سائق — [orders.service.ts:189](backend/src/orders/orders.service.ts#L189)) فـ`start` يعود 404. اختباران يفشلان دائمًا. | حدّث الاختبار ليطالب السائقُ الطلبَ (`POST /orders/:id/claim`) قبل `start`، بما يطابق التدفّق الحالي. |

### أخطاء أخرى محقّقة بتشغيل الاختبارات

| المعرّف | الملف:السطر | الوصف | الحل المقترح |
|---|---|---|---|
| M-B30 | [uploads.controller.ts:63](backend/src/uploads/uploads.controller.ts#L63) | **(محقّق بخط الأساس)** فرع `MulterError`/`LIMIT_FILE_SIZE` عمليًا ميت: NestJS يحوّل خطأ الحجم إلى `HttpException(413, "File too large")` قبل الفلتر، فيمرّ عبر فرع HttpException العامّ ولا تصل رسالة «حجم الملف يتجاوز 5 ميجابايت» للعميل (الاختبار يتوقّعها ويفشل). | التقط الحجم قبل تحويل Nest (حدّ body/محدّد صريح) أو أعِد صياغة الفلتر ليطابق رسالة/كود Nest الفعليَّين. |

---

## 4) المشاكل المنخفضة (Low)

### الخادم — أخطاء منطقية

| الملف:السطر | الوصف | الحل |
|---|---|---|
| [accounting.service.ts:170](backend/src/accounting/accounting.service.ts#L170) | `materialiseRecurring` بلا حارس تزامن → مصروف مكرّر عند تشغيل متزامن (كامن؛ النشر الحالي single-instance). | `updateMany` مشروط بـ`nextDueAt` داخل transaction، وأنشئ المصروف فقط عند `count===1`. |
| [accounting.service.ts:202](backend/src/accounting/accounting.service.ts#L202) | ترقيم الفواتير يعطب بعد التسلسل 9999/سنة (ترتيب نصّي: `9999` > `10000`) → فشل إنشاء الفواتير بقيّة السنة. | رتّب برقم صحيح مخزَّن، أو بطّن لعرض يحفظ الترتيب المعجمي. |
| [accounting.service.ts:264](backend/src/accounting/accounting.service.ts#L264) | `markInvoicePaid` بلا حارس حالة ويقبل مبلغًا < الإجمالي → دفع 0 دينار يقلبها PAID. | ارفض الحالات غير القابلة للدفع، واضبط PAID فقط عند `paid >= total`. |
| [accounting.service.ts:449](backend/src/accounting/accounting.service.ts#L449) | `paySalary` قابل للتكرار ويعيد كتابة `paidAt` → ينقل المصروف لفترة محاسبية أخرى بأثر رجعي. | اجعله idempotent (أعد الصفّ دون تغيير) أو ارفض بـ409. |
| [auth.service.ts:138](backend/src/auth/auth.service.ts#L138) | `requestPasswordReset` يرمي 400 مميّزًا لمستخدم موجود بلا `lastLoginAt` بينما يُرجِع نجاحًا عامًّا لغيره → تعداد الحسابات المسجّلة. | أعِد نفس الشكل العامّ `{ok:true, sent:false}` لحالة عدم وجود `lastLoginAt`. |
| [orders.controller.ts:52](backend/src/orders/orders.controller.ts#L52) | (مرتبط بـM-S2) `completionLng/Lat` بلا `@IsNumber` → NaN يتخطّى السياج ثم 500 عند كتابة عمود Float. | أضف `@IsNumber()` واحرس `Number.isFinite` قبل الثقة بالنتيجة. |
| [orders.service.ts:1102](backend/src/orders/orders.service.ts#L1102) | `myTasksToday` يخفي طلبات ASSIGNED/EN_ROUTE مطلوبة قبل اليوم → طلب مسائي يختفي منتصف الليل. | أسقِط مرشّح التاريخ للحالات النشطة أو وسّع النافذة. |
| [plant.controller.ts:113](backend/src/plant/plant.controller.ts#L113) | تحديث المخزون read-modify-write (يضيع تحديث خصم متزامن)، وبيع walk-in لا يخصم المخزون أبدًا → انحراف المخزون للأعلى. | استخدم `{ increment }` للإضافة، واخصِم `walkinLiters` عند بيع walk-in. |
| [promo.service.ts:82](backend/src/plant/promo.service.ts#L82) | `createCampaign` check-then-create بلا قيد → حملتان ACTIVE، تلطّخ عدّادات ROI. | فهرس فريد جزئي على `(tenantId)` حيث `status='ACTIVE'` + التقاط P2002. |
| [wallet.service.ts:60](backend/src/plant/wallet.service.ts#L60) | `balanceAfterIqd` من قراءة قبل الـtransaction (بينما التحديث `increment`) + لا مفتاح idempotency → لقطة تدقيق خاطئة وشحن مزدوج. | حدّث أولًا داخل transaction تفاعلية واستخدم القيمة المُعادة، وأضف مفتاح idempotency. |
| [vendors.service.ts:71](backend/src/vendors/vendors.service.ts#L71) · [vendors.controller.ts:73](backend/src/vendors/vendors.controller.ts#L73) | إنشاء طلب توصيل يثق بـ`customerId` من الجسم بلا فحص ملكية (IDOR)؛ محدود لأن `FEATURE_VENDORS=false`. | اشتقّ `customerId` من المستخدم المصادَق قبل تفعيل الميزة. |

### الخادم — أمن وجودة

| الملف:السطر | الوصف | الحل |
|---|---|---|
| [health.controller.ts:39](backend/src/health/health.controller.ts#L39) | `/ready` العامّ يُرجِع رسالة خطأ DB خام → كشف تفاصيل بنية تحتية لأي مجهول. | أعِد حالة عامّة «db: unreachable» وسجّل التفاصيل خادميًا فقط. |
| [main.ts:25](backend/src/main.ts#L25) | CORS يرجع إلى عكس كل أصل حين `CORS_ORIGINS` فارغ. | في الإنتاج أفشِل مغلقًا لقائمة معروفة أو ارفض الإقلاع بلا الإعداد. |
| [ai.service.ts:521](backend/src/ai/ai.service.ts#L521) | حلقات N+1 (scorecard: استعلام لكل سائق؛ platform-admin: تجميعات شهرية متسلسلة + استعلامان لكل مستأجِر). | استبدِل الحلقات بـ`groupBy` واحد و`Promise.all`. |
| [orders.service.ts:1255](backend/src/orders/orders.service.ts#L1255) | `haversine` منسوخ 5 مرّات (orders/ai/drivers/tenants/vendors). | أنشئ `common/geo.ts` واستورده في الجميع. |
| [orders.service.ts:238](backend/src/orders/orders.service.ts#L238) | `console.warn` بدل pino Logger المُهيّأ (orders 238/249/567/863، plant 662، team 284، main 78). | استبدِل بـ`this.log.warn`. |
| [customers.service.ts:48](backend/src/customers/customers.service.ts#L48) | `PASSWORD_ALPHABET + generatePassword` منسوخ 3 مرّات (customers/drivers/team). | صدّر `generatePassword()` من `common/crypto.ts`. |
| [plant.controller.ts:385](backend/src/plant/plant.controller.ts#L385) | أرقام سحرية للمال مضمّنة (بثّ 5000/10000+10، سعر تعبئة افتراضي 1000 في 4 مواضع). | ثوابت مسمّاة في وحدة مشتركة، يفضّل قابلة للتجاوز عبر env. |
| [team.controller.ts:262](backend/src/plant/team.controller.ts#L262) | دالّة `audit()` خاصّة مكرّرة عبر تحكّمات plant. | استخرِج `AuditService` محقونًا. |
| [tenants.service.ts:166](backend/src/tenants/tenants.service.ts#L166) | `getDashboardStats` يلفّق صفوف سائقين وهمية (id متسلسل، اسم فارغ) من عدّ فقط. | أرجِع العدد كرقم، أو استعلِم السائقين الفعليين. |

### الخادم — نموذج البيانات

| الملف:السطر | الوصف | الحل |
|---|---|---|
| [schema.prisma:568](backend/prisma/schema.prisma#L568) | فهارس مركّبة مفقودة على أحرّ الاستعلامات (RefillOrder `[tenantId, requestedAt]`/`[tenantId, completedAt]`، NotificationLog `[tenantId, createdAt]`). | أضف الفهارس الثلاثة. |
| [schema.prisma:1104](backend/prisma/schema.prisma#L1104) | 8 نماذج مملوكة للمستأجِر تخزّن `tenantId` كـString عارٍ بلا FK → قيم عشوائية مقبولة وأيتام بعد حذف المستأجِر. | أضف علاقات مستأجِر بإجراءات `onDelete` مقصودة. |
| [schema.prisma:853](backend/prisma/schema.prisma#L853) | `Invoice.status` و`RecurringExpense.cadence` نصوص حرّة؛ حالات مُعلَنة (OVERDUE...) غير قابلة للوصول، و`cadence` مجهول → مصروف مكرّر يوميًا. | حوّلهما إلى enums + `else-throw` في `advanceCadence`. |

### لوحات الويب

| الملف:السطر | الوصف | الحل |
|---|---|---|
| [customers/page.tsx:63](dashboard/src/app/dashboard/customers/page.tsx#L63) | مدخلات بحث بلا debounce → طلب لكل ضغطة ضدّ throttler 10/s → 429 يظهر جدولًا فارغًا. | debounce 300ms أو `useDeferredValue`. |
| [orders/[id]/page.tsx:364](dashboard/src/app/dashboard/orders/[id]/page.tsx#L364) | `AssignDriverModal`/نوع Driver/تدفّق الإلغاء منسوخ ومتباعد؛ نوع Driver يعلن `'BREAK'` غير الموجود في enum (`ON_BREAK`). | استخرِج مكوّنًا/نوعًا مشتركًا وصحّح `'BREAK'→'ON_BREAK'`. |
| [dashboard/page.tsx:63](dashboard/src/app/dashboard/page.tsx#L63) | نفس نقطة الإعدادات مُخزَّنة بمفتاحَي React Query (`tenant-settings` vs `plant-settings`) → الحفظ لا يُبطِل بطاقة الرئيسية. | ثابت مفتاح واحد مُصدَّر يُستخدم في الصفحات الثلاث. |
| [promos/page.tsx:346](dashboard/src/app/dashboard/promos/page.tsx#L346) | عدّاد الحملة مجمَّد: `useMemo` deps تُغفل الـtick. | أضف `tick` إلى deps أو احسب في كل render. |
| [promos/page.tsx:82](dashboard/src/app/dashboard/promos/page.tsx#L82) | تنسيق أرقام/تواريخ غير متّسق (`n()` محلّي بـen-US مقابل `lib/format` بـar-IQ؛ locale arSA في promos). | وحّد على مساعدات `lib/format` وlocale ar-IQ. |
| [stock/page.tsx:33](dashboard/src/app/dashboard/stock/page.tsx#L33) | معالجة أخطاء mutations غير متّسقة (بعضها صامت، وإلا نفس cast+alert منسوخ ~15 مرّة). | مساعد `getApiErrorMessage` + `onError` افتراضي في `mutationCache`. |
| [subscription/page.tsx:137](dashboard/src/app/dashboard/subscription/page.tsx#L137) | أسعار/حدود الخطط مضمّنة في الواجهة رغم أن `/plant/usage` يُرجِعها → أسعار قديمة على بطاقات الترقية. | اشتقّ من استجابة usage أو نقطة `/plant/plans`. |
| [login/page.tsx:23](dashboard/src/app/login/page.tsx#L23) | رقم هاتف المشرف وtenantId يُرسَلان لـPostHog عند الدخول (خامل حاليًا: المفتاح فارغ). | عرّف بـuserId فقط أو جزّئ الهاتف قبل الإرسال. |
| [platform-console/.../page.tsx:162](platform-console/src/app/dashboard/page.tsx#L162) | «أبرز المعامل» تعرض أقدم 5 (backend يرتّب `createdAt asc` والواجهة `slice(0,5)` بلا فرز). | رتّب بالإيراد/الطلبات تنازليًا قبل الاقتطاع. |
| [platform-console/public/manifest.json:2](platform-console/public/manifest.json#L2) | manifest نسخة حرفية من dashboard (اسم/وصف خاطئ + اختصارات لمسارات غير موجودة → 404). | أعد كتابته بهويّة الكونسول واختصاراته الفعلية. |

### Flutter

| الملف:السطر | الوصف | الحل |
|---|---|---|
| [customer/main.dart:10](mobile-flutter/apps/customer/lib/main.dart#L10) | تمهيد التطبيق + غلاف MaterialApp RTL + شريط عدم الاتصال مكرّرة في main.dart الثلاثة (والإدارة بلا شريط)؛ مساعد `_poll` منسوخ في providers الثلاثة. | `daariBootstrap()` + `DaariMaterialApp`/`OfflineBanner` + `pollSelf()` في `daari_core`. |
| [customer/order_detail_screen.dart:385](mobile-flutter/apps/customer/lib/screens/order_detail_screen.dart#L385) | خريطة التتبّع تعيد تحريك الكاميرا كل 15s (`didUpdateWidget` ينادي `_fitCamera` بلا شرط) فتقاوم تحريك المستخدم. | نادِ `_fitCamera` فقط عند تغيّر إحداثيات السائق/التوصيل فعلًا. |
| [customer/settings_screen.dart:69](mobile-flutter/apps/customer/lib/screens/settings_screen.dart#L69) | روابط الشروط/الخصوصية مضمّنة في 5 مواضع عبر تطبيقين. | ثوابت `termsUrl/privacyUrl` في `daari_core`. |
| [driver/profile_screen.dart:153](mobile-flutter/apps/driver/lib/screens/profile_screen.dart#L153) | ألوان hex مضمّنة تتجاوز `AppColors` (`0xFFDC2626`==`danger600`، وقيم amber/red-100 مفقودة). | استبدِل بـ`AppColors.danger600` وأضف `warn100/danger100`. |
| [driver/profile_screen.dart:35](mobile-flutter/apps/driver/lib/screens/profile_screen.dart#L35) | دالّتا `build()` تتجاوزان 220 سطرًا من تخطيط متداخل. | قسّم إلى ودجات قسم خاصّة (`_PerformanceCard`...). |
| [driver/widgets/otp_field.dart:1](mobile-flutter/apps/driver/lib/widgets/otp_field.dart#L1) | ودجات/شاشات شبه مكرّرة بين customer/driver (otp_field، home_shell، gradient_header، splash، forgot) بدأت تتباعد. | رقِّ القطع خفيفة المعاملات إلى `daari_core/lib/src/widgets`. |
| [daari_core/.../orders_repository.dart:26](mobile-flutter/packages/daari_core/lib/src/api/orders_repository.dart#L26) | 81 نسخة من `try/DioException/ApiException.fromDio` عبر 11 ملفّ repository. | مساعد `guard<T>()` أو معترض Dio يحوّل مركزيًا. |
| [daari_core/.../response_cache.dart:42](mobile-flutter/packages/daari_core/lib/src/api/response_cache.dart#L42) | PII الزبون (اسم/هاتف/عنوان) مُخزَّن نصًّا في SharedPreferences + مشمول بالنسخ التلقائي (بخلاف التوكنات في secure storage). | اضبط `allowBackup=false`/`dataExtractionRules` وقلّل حمولة الكاش لغير-PII. |
| [daari_core/.../location_service.dart:52](mobile-flutter/packages/daari_core/lib/src/services/location_service.dart#L52) | `startShift` يُبلِغ نجاحًا حتى لو GPS معطّل (لا يُرسَل ping أبدًا) → السائق «متاح» بلا موقع. | افحص `isLocationServiceEnabled()` وأرجِع false مع رسالة «فعّل خدمة الموقع». |
| [customer/android/app/build.gradle.kts:56](mobile-flutter/apps/customer/android/app/build.gradle.kts#L56) | بناء الإصدار يرجع لمفتاح توقيع debug عند غياب `key.properties` → APK موقَّع بمفتاح عامّ. | أفشِل بناء الإصدار (GradleException) عند غياب `key.properties`. |
| [customer/android/app/build.gradle.kts:39](mobile-flutter/apps/customer/android/app/build.gradle.kts#L39) | `MAPS_API_KEY` يُخلَّف فارغًا حتى في الإصدار → خرائط رمادية صامتة في الإنتاج. | أفشِل/نبّه في buildType الإصدار عند فراغ المفتاح. |
| [customer/AndroidManifest.xml:11](mobile-flutter/apps/customer/android/app/src/main/AndroidManifest.xml#L11) | أسماء ظاهرة للمستخدم وبيانات ويب لا تزال قيم قالب (`daari_customer`، «A new Flutter project.»، ألوان Flutter الزرقاء). | حدّد الاسم النهائي (داري) في manifests وInfo.plist وweb/index.html + manifest.json. |

### أمن الجوّال (Legacy + أدوات)

| الملف:السطر | الوصف | الحل |
|---|---|---|
| [mobile-customer/google-services.json:18](mobile-customer/google-services.json#L18) | مفتاح Google/Firebase حيّ مُودَع في 3 ملفّات legacy (customer/worker/admin). مفاتيح Android عادةً عامّة في الـAPK لكن الكشف يبقى في التاريخ. | احذف الملفّات الثلاثة وطبّق قيود API (تقييد تطبيق Android + قائمة API) أو دوّر المفتاح. |
| [mobile-flutter/dev-cors-proxy.cjs:26](mobile-flutter/dev-cors-proxy.cjs#L26) | وكيل التطوير يعكس أي Origin بـcredentials ويجرّد Origin/Referer → مُرحِّل مفتوح من متصفّح المطوّر للإنتاج (الخطر محدود: loopback + توكنات bearer لا كوكيز). | اسمح فقط لأصول dev المحدّدة (`localhost:8090/8091`)، وأعِد 403 وامسح ترويسة الكوكيز. |

### النشر والأدوات والتوثيق

| الملف:السطر | الوصف | الحل |
|---|---|---|
| [scripts/backup-db.sh:36](scripts/backup-db.sh#L36) | `set -a; source "$ENV_FILE"` يُنفِّذ `.env` كشِل → قيم بمسافات/أقواس/`$` (JSON Firebase، كلمات سرّ) تُجهِض أو تُنفَّذ؛ ويُصدِّر كل الأسرار لعملية `aws`. | استخرِج المفاتيح المطلوبة فقط بلا تقييم (`grep`/`cut`). |
| [scripts/backup-db.sh:50](scripts/backup-db.sh#L50) | فشل الـdump يترك `.sql.gz` مبتورًا يبدو نسخة صالحة (لا trap/فحص حجم) فتحذف الدورة النسخ الجيّدة لاحقًا. | اكتب لـ`.tmp` مع `trap ... ERR` + فحص حجم ثم `mv`. |
| [scripts/backup-db.sh:23](scripts/backup-db.sh#L23) | مسارات legacy قديمة (`/var/www/daari-api`، دور/DB `daari`) تكسر التشغيل اليدوي؛ يعمل cron فقط لأن bootstrap يرقّعه بـsed. | صحّح الافتراضات إلى مسارات/دور `daari-water`. |
| [scripts/github-setup.sh:54](scripts/github-setup.sh#L54) | `open` (macOS فقط) يجعل السكربت يخرج ≠0 على Windows/Linux؛ ومسارات usage قديمة. | مُشغِّل محروس أو echo للـURL؛ حدّث المسارات. |
| [deploy/deploy.sh:58](deploy/deploy.sh#L58) | يوجّه لملفّ `deploy/PROJECTS-MD-ENTRY.md` المحذوف (commit 65f2e08) فيُجهِض الإعداد الأوّل بتعليمات لملفّ مفقود. | ضمّن نصّ الإدخال في رسالتي الإجهاض، أو استعِد الملفّ. |
| [.claude/settings.local.json.bak:1](.claude/settings.local.json.bak#L1) | ملفّ `.bak` مُتتبَّع لإعدادات محلّية + `launch.json` ميت يشير لـ`maa-mockup` غير الموجود. | `git rm` كليهما وأضف `*.bak`/`.claude/settings.local.json*` لـ`.gitignore`. |
| [.gitignore:13](.gitignore#L13) | القواعد لا تغطّي `.env.test` (يُحمَّل فعلًا في `setup-env.ts`) ولا `backend/.env.production` → خطر التزام أسرار. | أضف `.env.test` و`backend/.env.production` لـ`.gitignore`. |
| [backend/nest-cli.json:5](backend/nest-cli.json#L5) | لا قاعدة `assets` فلا يُحزَّم `receipt.hbs` في dist (كامن: مسار الإيميل غير قابل للوصول لغياب `Customer.email`). | أضف `assets` لـ`email/templates/**/*.hbs`. |
| [STRUCTURE.md:30](STRUCTURE.md#L30) | التوثيق (المرجع الوحيد المُعلَن) تباعد: المخطّط يذكر customer+driver فقط بينما هناك 3 تطبيقات؛ أعداد الشاشات قديمة (17→18 customer، 14→15 admin). | صحّح المخطّط والأعداد، أو استبدِلها بمؤشّرات مجلّدات. |

### اعتماديات

| الملف:السطر | الوصف | الحل |
|---|---|---|
| [dashboard/package.json:19](dashboard/package.json#L19) | `next-pwa ^5.6.0` مهجور (منذ 2022، Workbox 6، حقبة Pages Router) بينما اللوحتان App Router؛ يفعّل SW في الإنتاج. | هاجِر إلى `@serwist/next` أو `@ducanh2912/next-pwa`. |
| [dashboard/package.json:18](dashboard/package.json#L18) | `next` مثبّت على `14.2.13` بلا مدى → لا رقع أمان (14.2.15/.21/.25/.30+، أبرزها رقع image-optimizer). | ارفع إلى أحدث رقعة `^14.2.33`. |
| [backend/package.json:86](backend/package.json#L86) | ESLint 9 بلا أي إعداد في أي حزمة (يتطلّب flat config)؛ اللوحات تقرن ESLint 9 مع `eslint-config-next` غير المتوافق → `lint` ميت في الحزم الثلاث. | للوحات: ESLint 8 + `.eslintrc` يمدّد `next/core-web-vitals`؛ للخادم: `eslint.config.mjs` مع presets `@typescript-eslint 8`. |
| [backend/package.json:40](backend/package.json#L40) | `@types/multer` و`@types/pdfkit` في `dependencies` (وقت التشغيل) بينما بقيّة `@types/*` في devDependencies. | انقلهما إلى `devDependencies`. |
| [backend/package.json:37](backend/package.json#L37) | NestJS 10 وPrisma 5 خلف الخطوط المدعومة (Nest 11، Prisma 6/7). | خطّط ترقية منسّقة (Nest 11 + Prisma 6، ورفع كل رفقاء `@nestjs/*`). |

---

## 5) العناصر غير المستخدمة (الدليل + حالة التحقّق)

> كل عنصر أدناه أعاد **مدقّق سلامة حذف مستقلّ** البحثَ عنه بنفسه (بحث بالاسم الكامل والأساسي عبر كل الملفّات المتتبَّعة،
> واستيرادات ديناميكية، ومسارات نصّية، وأعراف الأطر). حالة كل عنصر: **safe-to-delete** أدناه ما لم يُذكَر خلاف ذلك.

### 5.1 اعتماديات npm — الخادم (احذفها من package.json ثم أعِد التثبيت)

| الحزمة | الدليل |
|---|---|
| `bcrypt` + `@types/bcrypt` | صفر استيراد؛ التجزئة بـargon2 (auth.service/crypto/seeds). الهيت الوحيد package.json/lock. |
| `passport-local` + `@types/passport-local` | لا `LocalStrategy`/`AuthGuard('local')`؛ الاستراتيجية الوحيدة `JwtStrategy`. |
| `qrcode` + `@types/qrcode` | لا استيراد؛ الهيت الوحيد سلسلة عمود CSV `'qrcode'` في bulk-import. |
| `uuid` + `@types/uuid` | لا استيراد؛ المعرّفات من `node:crypto randomUUID`. |
| `socket.io` · `@nestjs/websockets` · `@nestjs/platform-socket.io` | لا gateway/IoAdapter في أي مكان (main.ts مفحوص). |
| `cache-manager-ioredis-yet` | استُبدِل بـ`@keyv/redis` (موثّق في cache.module.ts:16-20). |
| `ioredis` (تصريح مباشر) | لا استيراد مباشر؛ يبقى ترانزِتيفيًا عبر bullmq (يُصرِّح نسخته). |
| `date-fns` (الخادم) | صفر هيت في backend/src·prisma·test (اللوحات لها نسخها). |
| `jest-mock-extended` (dev) | لا استخدام؛ الاختبارات supertest فقط. |
| `ts-loader` (dev) | لا webpack builder ولا إعداد webpack. |

### 5.2 كود الخادم الميت

| العنصر | الملف | الدليل |
|---|---|---|
| `verifyPassword` (export) | [common/crypto.ts:27](backend/src/common/crypto.ts#L27) | صفر مستدعٍ؛ auth.service ينادي `argon2.verify` مباشرةً. |
| `import * as argon2` (غير مستخدم) | customers.service.ts:15 · drivers.service.ts:4 · team.controller.ts:25 · tenants.service.ts:3 | التجزئة تمرّ عبر `hashPassword`؛ احذف سطر الاستيراد فقط (لا حزمة argon2). |
| `listPendingApprovals` | [customers.service.ts:577](backend/src/customers/customers.service.ts#L577) | هيت وحيد = التعريف؛ لا مسار/cron. |
| `createInboxMessage` | [notifications.service.ts:273](backend/src/notifications/notifications.service.ts#L273) | هيت وحيد رغم زعم docstring بمستدعين خارجيين. |
| `pickDriverForNewOrder` | [orders.service.ts:420](backend/src/orders/orders.service.ts#L420) | خاصّة بلا مستدعٍ بعد الانتقال لنموذج المطالبة (حدّث التعليق 193). |
| `recordWalkinSale` | [orders.service.ts:1013](backend/src/orders/orders.service.ts#L1013) | walk-in يمرّ عبر `createWalkinRefill`/`createAdminWalkinSale` (حدّث docstring 1151). |
| `PaginationDto` (مُحدِّد الاستيراد فقط) | [plant.controller.ts:24](backend/src/plant/plant.controller.ts#L24) | غير مستخدم؛ **احذف المُحدِّد فقط** (`paginated` مستخدم في 183، وصنف `PaginationDto` مستخدم في 6 تحكّمات). |
| `isTestDbReady` | [test/setup.ts:83](backend/test/setup.ts#L83) | مُصدَّر ولا يُستدعى؛ `describeIfDb` يعيد التحقّق ضمنيًا. |
| سكربتات `prisma:migrate`/`prisma:deploy` | [package.json:16](backend/package.json#L16) | لا مجلّد migrations؛ deploy.sh يمنع migrate deploy صراحةً. |

### 5.3 نماذج Prisma غير مرجعية (⚠️ `db push` يُسقِط الجداول — انظر «مرشّحات القرار»)

`DataReport` + `DataReportPurchase` (+ enum `DataReportCategory`) · `AdCampaign` + `AdImpression` (+ enums `AdCampaignStatus`/`AdCategory`) · `BulkDeal` + `BulkDealParticipation` (+ enum `BulkDealStatus`) — صفر استدعاء عميل Prisma أو مرجع اسم في src/test/seeds؛ نماذج مكتفية ذاتيًا (لا back-relations).

**لا تُحذَف (رفضهما المدقّق):**
- `PlantGroup` — يُستعلَم عبر `Tenant.group` في [tenants.service.ts:383/509](backend/src/tenants/tenants.service.ts#L383) رغم غياب `prisma.plantGroup`.
- `VendorWalletEntry` — يُكتَب في [vendors.service.ts:153/162](backend/src/vendors/vendors.service.ts#L153) (قيد مزدوج EARNING+COMMISSION).

### 5.4 اعتماديات npm — لوحات الويب

- **dashboard:** `clsx` · `tailwind-merge` · `zustand` (صفر هيت في src/config).
- **platform-console:** `clsx` · `tailwind-merge` · `zustand` · `date-fns` · `leaflet` · `react-leaflet` · `@types/leaflet` (لا مكوّن خريطة في هذه اللوحة).

### 5.5 كود/أصول الويب

| العنصر | الملف | ملاحظة |
|---|---|---|
| استيرادات recharts غير مستخدمة | audit-log/page.tsx:5 (`Filter`) · page.tsx:12 (`BarChart,Bar`) · reports/page.tsx:8 (`LineChart,Line,Legend`) · platform-console page.tsx:26 (`Cell`) | احذف المُحدِّدات فقط. |
| `platform-console/src/lib/format.ts` | [platform-console/src/lib/format.ts:1](platform-console/src/lib/format.ts#L1) | لا مستورِد؛ الصفحات تعرّف `iqd()` محلّيًا. |
| `maa_refresh` + معامل `refresh` في `setTokens` | dashboard/platform-console `src/lib/api.ts` | يُكتَب ولا يُقرَأ أبدًا (لا مسار refresh). |
| `public/sw.js` + `workbox-*.js` (اللوحتان) | build artifacts | مُولَّدة كل بناء؛ أضفها لـ`.gitignore` و`git rm`. |

### 5.6 Flutter

| العنصر | الملف | ملاحظة |
|---|---|---|
| `waterStockProvider` | apps/admin/lib/providers.dart:63 | مكرِّر لـ`stockProvider` المستخدَم؛ حدّث تعليق 97. |
| `HeaderBackButton` | customer/lib/widgets/gradient_header.dart:69 | **احذف الصنف لا الملفّ** (5 شاشات تستورد `GradientHeader`). |
| `orderKindIcon` (نسخة customer) | customer/lib/widgets/order_widgets.dart:61 | 7 مستدعين يستوردون نسخة driver. |
| `AuthRepository.loginWithOtp` · `TokenStorage.setAccessToken` · `Fmt.daysBetween` · `Hap.warning` · `Analytics.isEnabled` · `PlantRepository.auditLogRecent` | daari_core | صفر مستدعٍ في التطبيقات الثلاثة (`auditLogRecent` استبدله `auditLogPaged`). |
| `cupertino_icons` | pubspecs الثلاثة | صفر `CupertinoIcons`/import. |
| `flutter_localizations` · `firebase_core` | daari_core/pubspec.yaml | التطبيقات تُصرِّحهما بنفسها؛ core لا يستوردهما (firebase_messaging يجلب core ترانزِتيفيًا). |
| `geolocator` (driver) | driver/pubspec.yaml:31 | يُستخدَم عبر daari_core الذي يُصرِّحه. |
| `<queries>` intents غير مستخدمة | geo (customer/driver) · mailto (driver) | لا URI مطابق يُطلَق. |

### 5.7 عنصر بانتظار قرارك (uncertain)

- `deploy/logrotate/daari-water` — بلا مستهلك في المستودع، **لكن لا يُحذَف**: هو إعداد التدوير الوحيد للسجلّات التي تُلحِقها systemd؛ الإصلاح الصحيح **وصله في bootstrap** (M-Q9).

---

## 6) مرشّحات للحذف — القرار المُتَّخذ

بناءً على قرارك «احذف كل ما لا يؤثّر على المشروع»، طُبِّق التالي في **المرحلة 5**:

1. ✅ **نماذج Prisma غير المرجعية (§5.3) — حُذِفت:** `DataReport` · `DataReportPurchase` · `AdCampaign` · `AdImpression` · `BulkDeal` · `BulkDealParticipation` + التعدادات الأربعة. صفر مرجع في الكود، فحذفها لا يؤثّر على البناء/الاختبارات/التشغيل. `prisma db push` على DB الاختبار أسقط الجداول (الفارغة) نظيفًا. **أُبقِيَ `PlantGroup` و`VendorWalletEntry`** (مستخدمان فعلًا).
2. ✅ **`scripts/github-setup.sh` — حُذِف:** سكربت one-shot مُنجَز (المستودع موجود بالفعل) ولا يشير إليه أي تدفّق.
3. ⏸️ **أُبقِيَت عمدًا (حذفها قرار منتج لا «تنظيف محايد»):**
   - **وحدة `vendors`** — معلَنة صراحةً كميزة **Phase-3 مخطّطة** (`.env.production.example`)؛ حذفها إزالة عمل مستقبلي مقصود، لا تنظيف. (بديل أخفّ: تسييج استعلام المصادقة خلف `FEATURE_VENDORS` — انظر L-arch.)
   - **تطبيقات Expo + أدواتها (`eas-setup-and-build.sh`، `generate-icons.py`)** — محفوظة **عمدًا كمرجع وظيفي حتى بوّابة QA** ([DEVICE_QA_CHECKLIST.md](mobile-flutter/DEVICE_QA_CHECKLIST.md))؛ حذفها قبل تأكيد تكافؤ Flutter ميدانيًا يزيل شبكة الأمان في خطّة الترحيل.
   - **مفتاح Firebase المكشوف** — لا يُعالَج بالحذف (يبقى في تاريخ git)؛ يحتاج **تدوير/تقييد** في Google Cloud Console.

> لو رغبت بحذف `vendors` و/أو تطبيقات Expo أيضًا، أخبرني صراحةً وأنفّذها بأمان (فحص + اختبارات).

---

## 7) النتائج المرفوضة (للشفافية — لم تصمد أمام التحقّق)

1. **LiveMap يحمّل أصول Leaflet من unpkg CDN** — الأصول لا تُجلَب أبدًا لأن كل Marker يمرّر `L.divIcon` مخصّصًا؛ `mergeOptions` إعداد خامل.
2. **FKs الافتراضية Restrict تُعطِّل حذف Customer/Tenant بـP2003** — لا مسار يحذف فعليًا؛ نقاط الحذف الموجودة كلّها soft-delete/إخفاء هوية عمدًا (الاستراتيجية الصحيحة مُطبَّقة أصلًا).
3. **استنساخ Flutter السطحي لـ`stable` لا يثبّت شيئًا** — الاختبار العملي يُظهِر أن `git clone --depth 1 -b stable` يجلب الوسم؛ كشف الإصدار يعمل، ويطابق طريقة تثبيت Flutter الموثّقة.
4. **سكربتات EAS/الأيقونات تخدم Expo المهجورة فقط** — مرفوضة بقاعدة الإهمال (جودة/معمارية بحتة على أدوات legacy، بلا زاوية أمنية) — لكنها مُدرَجة كمرشّح قرار في §6.

---

*انتهى تقرير المرحلة 1. المراحل التالية: الإصلاح (من الأخطر للأبسط) → حذف المؤكَّد → تحديث التوثيق.*
