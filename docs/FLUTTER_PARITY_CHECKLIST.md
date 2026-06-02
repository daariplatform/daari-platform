# ✅ قائمة مهام التكافؤ الكامل: Flutter ⟵ Expo — **v2 (مُحقّقة)**

> الهدف: رفع نسخة Flutter (`mobile-flutter/`) إلى **طبق الأصل** من نسختَي Expo
> (`mobile-customer/` + `mobile-worker/`).
>
> **v2:** أُعيدت كتابتها بعد تدقيق خصامي متعدد الوكلاء (٨ وكلاء قرؤوا الشيفرة الفعلية في
> النسختين). صُحّحت ٩ بنود، حُذفت ٣ "فجوات" تبيّن أنها موجودة فعلاً، وأُضيفت ٧ فجوات حقيقية
> أغفلتها v1. آخر تحديث: 2026-06-02.

**نتيجة التدقيق المنقّحة:**

| المعيار | النتيجة |
|---|---|
| جرد الشاشات | الزبون ١٦ مشتركة + splash، ناقص onboarding · السائق ١٢/١٢ |
| سطح الـ API | **ليس ١٠٠٪** — Flutter ينقصه نقطتان حيّتان (`/customers/:id/move` + `/customers/me/onboard`) |
| منطق العمل الأساسي | ~٩٥٪ (كل إجراءات الوردية موجودة) |
| التكافؤ البصري/UX | ~٦٠٪ |
| التكافؤ الوظيفي الكامل | ~٨٥٪ |

> رمز الحالة: 🔴 تراجع وظيفي · 🟠 بنية مفقودة · 🟡 تلميع/تجربة استخدام

---

## ⚠️ تصحيحات v2 (أخطاء كانت في v1)

| البند | تصحيح v2 |
|---|---|
| OfflineBanner | كان في Expo داخل `_layout.tsx` فقط (لا home)، **ولا يعرض عدّاد الطابور**. العدّاد في `WorkerHeader.tsx`. |
| "الطابور يصرّف عند عودة الاتصال" | غير صحيح — يُصرَّف على **مؤقّت ٦٠ث + عند الإقلاع**، بلا مستمع NetInfo. وهو احتياطي-عند-الفشل لا offline-first. |
| StarRating | **موجود فعلاً** في Flutter (`_RatingForm`/`_RatedCard`) — حُذف من الفجوات (يبقى فرق الأنميشن فقط). |
| EmptyState | **موجود فعلاً** (`common.dart:126`) — حُذف من الفجوات. |
| i18n | `i18n.ts` في Expo فرض RTL فقط بلا قاموس ترجمة؛ الطرفان يثبّتان العربية → **ليست فجوة**، حُذفت. |
| خطوات onboarding | الصحيح: (١) إذن موقع (٢) المعمل المغطّي (٣) شرح وصول السائق (٤) **قبول الشروط** — وليس "عنوان→خزان". |
| سطح الـ API | Flutter يضيف فقط `/auth/logout`؛ بقية "الإضافات" موجودة في Expo أصلاً (تكافؤ). |

---

## المستوى ١ — تراجعات وظيفية (إجباري قبل أي إطلاق)

### 🔴 1. خريطة التتبّع الحيّ للسائق (شاشة طلب الزبون)
- [ ] **المصدر:** `mobile-customer/app/order/[id].tsx:727-788` — `MapView` + علامة الزبون (دائماً) + علامة السائق (عند توفّر إحداثيات منتهية وقريبة)، تتحدّث كل ١٥ث.
- [ ] **الهدف:** `mobile-flutter/apps/customer/lib/screens/order_detail_screen.dart` — أضِف `GoogleMap` فوق `_EtaCard`.
- [ ] أضِف `driverLocation` polling (~١٠–١٥ث أثناء `EN_ROUTE`) في `orders_repository.dart`.
- [ ] علامة السائق + الوجهة + `LatLngBounds` يشملهما.
- **يُنجَز عندما:** يرى الزبون السائق يتحرّك على خريطة فعلية أثناء `EN_ROUTE`.

### 🔴 2. طابور العمل دون اتصال (تطبيق السائق)
- [ ] **المصدر:** `mobile-worker/lib/offline-queue.ts` — SQLite `pending_mutations`، يُستدعى من **٤ كتل catch** (إكمال طلب، إكمال استرجاع، بيع walk-in، تسجيل زبون) عند فشل الشبكة. يُصرَّف على مؤقّت ٦٠ث + عند الإقلاع (`_layout.tsx:60-66`)، يحذف عند 2xx، يُسقِط 4xx (عدا 401/408/429).
- [ ] **الهدف:** أنشئ `mobile-flutter/packages/daari_core/lib/src/services/offline_queue.dart` بـ `sqflite`.
- [ ] لفّ الطفرات الحرجة (complete refill, complete reclaim, walkin refill, registerByDriver) لتُحفَظ محلياً عند فشل الاتصال ثم تُصرَّف.
- [ ] صرف على مؤقّت + (تحسين) مستمع `connectivity_plus`.
- **يُنجَز عندما:** يُكمل السائق طلباً بدون شبكة فلا يُفقَد، ويُرسَل لاحقاً.

### 🔴 3. عدّاد الطابور المعلّق + شريط عدم الاتصال
- [ ] **المصدر (مصحّح):** عدّاد "N في الانتظار" في `WorkerHeader.tsx:73-78` (يُغذّى من `home.tsx` عبر `pendingCount()`). شريط "أنت غير متصل" الثابت في `OfflineBanner.tsx` (مُركَّب في `_layout.tsx` فقط).
- [ ] **الهدف:** شارة عدد معلّق في `gradient_header.dart` للسائق + شريط offline في `home_shell.dart`.
- **يُنجَز عندما:** تظهر شارة بعدد العمليات غير المُزامَنة + شريط عند انقطاع الشبكة.

### 🔴 4. ميزة "انتقلت لبيت جديد" (تحديث موقع الزبون) — **جديد v2**
- [ ] **المصدر:** `mobile-customer/app/(tabs)/profile.tsx:213-279` — زرّ يطلب GPS ثم `POST /customers/:id/move` بـ `newLng/newLat`.
- [ ] **الهدف:** أضِف `move()` في `customer_repository.dart` (التعليق يذكره لكن لا تنفيذ) + زرّ في `profile_screen.dart`.
- **يُنجَز عندما:** يحدّث الزبون موقعه من البروفايل.

### 🔴 5. حاجز GPS ٥٠م عند الإكمال (مانع احتيال) — **جديد v2**
- [ ] **المصدر:** `mobile-worker/app/task/[id].tsx:106-126` — `verifyArrivalGPS` يرفض الإكمال إن كان السائق >٥٠م من الزبون.
- [ ] **الهدف:** في `task_detail_screen.dart._complete` (السطور ٤٢-٦٦) أضِف فحص مسافة بين إحداثيات السائق والزبون قبل الإرسال (الباك إند يفرضه عبر `REFILL_GPS_MAX_DISTANCE_M`، لكن أضِف الفحص العميلي للرسالة الفورية).
- **يُنجَز عندما:** يُرفض الإكمال برسالة "اقترب أكثر من موقع الزبون" عند البُعد.

---

## المستوى ٢ — بنية مفقودة (cross-cutting)

### 🟠 6. Sentry (رصد الأعطال) — **جديد v2**
- [ ] **المصدر:** `mobile-customer/lib/sentry.ts` + `mobile-worker/lib/sentry.ts` (10% trace, beforeBreadcrumb يجرّد التوكنات، `sendDefaultPii=false`).
- [ ] **الهدف:** أضِف `sentry_flutter`؛ هيّئ في `customer/main.dart` + `driver/main.dart` بـ `Env.sentryDsn` (الثابت موجود لكنه ميت لا يُستهلك).
- **يُنجَز عندما:** تظهر أعطال Flutter في Sentry.

### 🟠 7. التحليلات (PostHog)
- [ ] **المصدر:** `posthog.ts` (autocapture، session replay، identify/reset، track، super-property `app`). `Env.posthogKey` ثابت ميت في Flutter.
- [ ] **الهدف:** `posthog_flutter` في `daari_core`، تهيئة في `main.dart`، identify/reset في `auth_controller.dart`، تتبّع المسارات عبر `GoRouter` observer، حدث `shift_ended`.
- **يُنجَز عندما:** تظهر أحداث `daari-customer`/`daari-worker`.

### 🟠 8. حفظ كاش الاستعلامات (cold-start) — **جديد v2**
- [ ] **المصدر:** `mobile-worker/lib/persist.ts` — يحفظ كاش React Query (`driver/me`, `driver/today`, `worker/history`) في AsyncStorage بـ TTL ٢٤س.
- [ ] **الهدف:** طبقة حفظ لـ Riverpod (مثل `riverpod` + `shared_preferences`/`hive`) للبيانات الباردة.
- **يُنجَز عندما:** تظهر آخر بيانات معروفة فوراً عند إعادة فتح التطبيق دون شبكة.

### 🟠 9. وضع العرض / البيانات التجريبية (DEMO_MODE)
- [ ] **المصدر:** `EXPO_PUBLIC_DEMO_MODE` في login/auth-store/queries/wallet/sentry — دخول وتصفّح ببيانات وهمية.
- [ ] **الهدف:** علَم `Env.demoMode` + fixtures في `daari_core`.
- **يُنجَز عندما:** يعمل الدخول التجريبي دون خادم.

### 🟡 10. الـ Haptics
- [ ] **المصدر:** `mobile-customer/lib/haptics.ts` (`hap.*` في ١٠ ملفات للزبون) + السائق يستخدم `expo-haptics` مباشرة (~٥ ملفات، **لا يوجد `haptics.ts` للسائق**).
- [ ] **الهدف:** غلاف `HapticFeedback` في `daari_core` على أزرار الطلب/الإكمال/القبول/النجاح/الخطأ.

---

## المستوى ٣ — مكوّنات بصرية (تلميع التجربة)

> `WaterDropHero`/`PartnerAds`/`TankStatusCard`/`Icon3D` غير مستخدمة في Expo — تجاهلها (مؤكَّد).
> StarRating و EmptyState **موجودان** في Flutter (يبقى الأنميشن فقط).

### الزبون
- [ ] 🟡 **RainBackground** → `login` + `home`.
- [ ] 🟡 **RefillStatusStrip** → `home` (عدّاد دورة ٣٠ يوماً + شريط تقدّم).
- [ ] 🟡 **RecentActivityList** → `home` (آخر ٣ طلبات + متوسط فترة/إجمالي إنفاق).
- [ ] 🟡 **Burst (احتفال)** → عند **إرسال التقييم** لطلب مكتمل (وليس عند الإكمال — تصحيح).
- [ ] 🟡 **AnimatedCounter** → `wallet` (عدّ تصاعدي للرصيد/النقاط).

### السائق
- [ ] 🟡 **AnimatedNumber** → `cash`/`earnings`/`shift-summary`/`van-inventory`.
- [ ] 🟡 شارة حالة الشبكة في الهيدر (Flutter يعرض الاسم + مفتاح الوردية، لكن لا شارة اتصال).

### مشترك
- [ ] 🟡 **Skeleton/Shimmer** بدل السبينر (٧ شاشات لكل تطبيق) — اختياري.

---

## المستوى ٤ — فجوات شاشات محدّدة

- [ ] 🟠 **شاشة onboarding (٤ خطوات)** → غائبة في Flutter (مؤكَّد، بما فيها `POST /customers/me/onboard`). الخطوات: موقع → معمل مغطٍّ → شرح وصول → **قبول الشروط**.
- [ ] 🟠 **زرّ "أنهِ الوردية" في شاشة shift-summary** — **جديد v2**: موجود في Expo (`shift-summary.tsx:137`، يستدعي `stopShiftTracking` + تتبّع `shift_ended` + توجيه home). مفقود من `shift_summary_screen.dart` (الإنهاء متاح في home/profile فقط).
- [ ] 🟡 **تقسيم السجلّ بالتاريخ** (history السائق) — **جديد v2**: Expo يجمّع برؤوس "اليوم/أمس/..." (`history.tsx:112`)، Flutter قائمة مسطّحة.
- [ ] 🟡 **إثراء شاشة الإعدادات (الزبون)** — **جديد v2**: روابط FAQ/الشروط/الخصوصية، تبديل إذن الإشعارات، تأكيد كلمة السر بـ٣ حقول (Flutter حقلان).
- [ ] 🟡 **task_detail السائق** (٤٧٧ مقابل ٩١٣) — كل الإجراءات موجودة؛ الفارق = خريطة Expo الحيّة (علامة السائق + GPS ١٠ث + ETA) + حاجز ٥٠م (البند ٥) + الطابور (البند ٢). راجِع بعد تنفيذها.

---

## المستوى ٥ — نظافة وجودة (اختياري)

- [ ] 🟡 اختبارات الموبايل (الطرفان صفر — فرصة في Flutter لـ widget/golden tests).
- [ ] 🟡 تكافؤ الأذونات (`AndroidManifest`/`Info.plist`): موقع، إشعارات.

---

## جدول الأولوية المنقّح

| الأولوية | البنود | الأثر |
|---|---|---|
| **يجب الآن** | 1، 2، 3، **4**، **5** | تتبّع حيّ + عمل ميداني + تحديث موقع + مانع احتيال |
| **قبل الإطلاق الواسع** | 6 (Sentry)، 7 (PostHog)، 8 (حفظ الكاش)، 9 (demo) | رصد أعطال + مقاييس + تجربة بادرة + مراجعة المتجر |
| **تلميع** | 10 (haptics)، المستوى ٣ | الإحساس والحركة |
| **شاشات** | onboarding، End-Shift CTA، history sections، settings | فجوات شاشات مؤكَّدة |

---

## مرجع: جرد الشاشات

### الزبون
welcome · login · signup · forgot · map-picker · home · orders · order-detail · profile · addresses · notifications · schedules · settings · support · wallet · intro · **splash (يبدّل index.tsx)** — **(ناقص: onboarding)**

### السائق (١٢/١٢)
login · forgot · home · history · profile · cash · earnings · shift-summary · task-detail · van-inventory · walkin · splash
