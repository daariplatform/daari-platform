# ✅ قائمة مهام التكافؤ الكامل: Flutter ⟵ Expo

> الهدف: رفع نسخة Flutter (`mobile-flutter/`) من "بديل وظيفي" (~٩٠٪) إلى **طبق الأصل** من
> نسختَي Expo القديمتين (`mobile-customer/` + `mobile-worker/`).
>
> أُعِدّت بعد تدقيق عميق قارن: جرد الشاشات، سطح الـ API، الأدوات المساعدة، والمكوّنات البصرية.
> آخر تحديث: 2026-06-02.

**نتيجة التدقيق المختصرة:**

| المعيار | النتيجة |
|---|---|
| جرد الشاشات | ٩٥٪ (ناقص onboarding) |
| سطح الـ API | ١٠٠٪+ (Flutter أوسع — يضيف OTP signup/verify, forgot-password, logout, discover, notifications inbox) |
| منطق العمل الأساسي | ~٩٥٪ |
| التكافؤ البصري/UX | ~٦٠٪ (لا حركات، لا haptics، لا مكوّنات تسويقية) |
| التكافؤ الوظيفي الكامل | ~٨٥–٩٠٪ (ينقصه: الخريطة الحيّة + الطابور دون اتصال) |

> رمز الحالة: 🔴 تراجع وظيفي (يكسر سلوكاً موعوداً) · 🟠 بنية مفقودة · 🟡 تلميع/تجربة استخدام

**الحد الأدنى لمنع تراجع المنتج = البنود ١ و ٢ و ٣ فقط.** الباقي يرفع التكافؤ من "وظيفي" إلى "طبق الأصل".

---

## المستوى ١ — تراجعات وظيفية (إجباري قبل أي إطلاق)

### 🔴 1. خريطة التتبّع الحيّ للسائق (شاشة طلب الزبون)
- [ ] **المصدر:** `mobile-customer/app/order/[id].tsx:768` — `MapView` + `Marker` للسائق + علامة التوصيل.
- [ ] **الهدف:** `mobile-flutter/apps/customer/lib/screens/order_detail_screen.dart` — أضِف `GoogleMap` فوق بطاقة الـ ETA الحالية.
- [ ] أضِف نقطة جلب موقع السائق دورياً (polling كل ~١٠ث أثناء `EN_ROUTE`) إلى `orders_repository.dart`.
- [ ] حرّك علامة السائق + اضبط `LatLngBounds` ليشمل السائق والوجهة.
- **يُنجَز عندما:** يرى الزبون أيقونة السائق تتحرّك على خريطة فعلية أثناء `EN_ROUTE`، تتحدّث تلقائياً.

### 🔴 2. طابور العمل دون اتصال (تطبيق السائق)
- [ ] **المصدر:** `mobile-worker/lib/offline-queue.ts` — SQLite + `enqueue/flush/pendingCount`، يصرّف الطابور عند عودة الشبكة، يحذف عند 2xx، ويُسقِط أخطاء 4xx (عدا 401/408/429).
- [ ] **الهدف:** أنشئ `mobile-flutter/packages/daari_core/lib/src/services/offline_queue.dart` باستخدام `sqflite` أو `drift`.
- [ ] لفّ الطفرات الحرجة (إكمال الطلب، الاستحواذ على خزان، بيع walk-in) لتكتب محلياً أولاً ثم تُصرَّف.
- [ ] أضِف مستمعاً لتغيّر الاتصال (`connectivity_plus`) لاستدعاء `flush()` عند العودة و على foreground.
- **يُنجَز عندما:** يُكمل السائق طلباً بدون شبكة، ويُرسَل تلقائياً عند عودتها دون فقدان.

### 🔴 3. شريط حالة عدم الاتصال + عدّاد الطابور (OfflineBanner)
- [ ] **المصدر:** `mobile-worker/components/OfflineBanner.tsx` — مستخدم في `home` + `_layout` العام، يعرض `pendingCount()`.
- [ ] **الهدف:** widget في `daari_core` يظهر في `home_shell.dart` (الزبون والسائق) + شارة العدد المعلّق على السائق.
- **يُنجَز عندما:** يظهر شريط "غير متصل — N عملية بانتظار المزامنة" عند انقطاع الشبكة.

---

## المستوى ٢ — بنية مفقودة (cross-cutting)

### 🟠 4. التحليلات (PostHog)
- [ ] **المصدر:** `mobile-customer/lib/posthog.ts` — حساب PhiBit المؤسسي. يشمل: autocapture لتغيّر المسارات، session replay، feature flags، `identifyUser()` بعد الدخول، `resetUser()` بعد الخروج، خاصية `app: 'daari-customer'/'daari-worker'`، و `track()` للأحداث الصريحة.
- [ ] **الهدف:** أضِف حزمة `posthog_flutter` في `daari_core`؛ هيّئها في `main.dart` للتطبيقين بمفتاح `EXPO_PUBLIC_POSTHOG_KEY` (نفسه)، super-property مطابق للتمييز بين التطبيقات.
- [ ] اربط `identify/reset` في `auth_controller.dart`، وتتبّع المسارات عبر `GoRouter` observer.
- **يُنجَز عندما:** تظهر أحداث `daari-customer`/`daari-worker` في PostHog من نسخة Flutter.

### 🟠 5. وضع العرض / البيانات التجريبية (DEMO_MODE)
- [ ] **المصدر:** مستخدم في `login`, `auth-store`, `queries`, `wallet`, `sentry` — يسمح بالدخول والتصفّح ببيانات وهمية دون باك إند (لمراجعة المتجر والعروض).
- [ ] **الهدف:** علَم `Env.demoMode` + بيانات وهمية في `daari_core`، يُحقَن في الـ repositories/providers.
- **يُنجَز عندما:** يعمل الدخول التجريبي والتصفّح بالكامل دون اتصال بالخادم.

### 🟡 6. الـ Haptics (الاهتزاز عند اللمس)
- [ ] **المصدر:** `mobile-customer/lib/haptics.ts` — `hap.*` مستخدم في **١٠ ملفات** (الزبون) + **٥** (السائق).
- [ ] **الهدف:** غلاف رفيع حول `HapticFeedback` في `daari_core` (نجاح/خطأ/خفيف)، واستدعِه على أزرار الطلب والإكمال والتأكيد.
- **يُنجَز عندما:** اهتزاز عند: إرسال الطلب، الإكمال، القبول، النجاح/الخطأ.

### 🟡 7. وحدة i18n
- [ ] **المصدر:** `mobile-customer/lib/i18n.ts`.
- [ ] **الهدف:** اختياري — Flutter يثبّت العربية مباشرة (مقبول لتطبيق عربي فقط). نفّذ فقط إن كان تعدّد اللغات مطلوباً.

---

## المستوى ٣ — مكوّنات بصرية (تلميع التجربة)

> ملاحظة: `WaterDropHero`, `PartnerAds`, `TankStatusCard`, `Icon3D` مُعرّفة في Expo لكن **غير مستخدمة** في أي شاشة فعلية — تجاهلها.

### الزبون
- [ ] 🟡 **RainBackground** (خلفية قطرات متحركة) → مستخدم في `login` + `home`. الهدف: `widgets/rain_background.dart` بـ `AnimationController`.
- [ ] 🟡 **RefillStatusStrip** (شريط دورة التعبئة) → `home`. الهدف: widget يأخذ `lastRefillAt` ويعرض شريط التقدّم.
- [ ] 🟡 **RecentActivityList** (آخر الطلبات) → `home`. الهدف: قسم في `home_screen.dart` يعرض آخر ٣–٥ طلبات (البيانات متوفّرة من `myOrdersProvider`).
- [ ] 🟡 **Burst** (احتفال نجاح) → `order/[id]` عند الإكمال. الهدف: confetti عبر `confetti` package.
- [ ] 🟡 **AnimatedCounter** (عدّ تصاعدي للرصيد) → `wallet`. الهدف: `TweenAnimationBuilder` على المبلغ.
- [ ] 🟡 **StarRating** → `order/[id]`. **تحقّق** أن واجهة النجوم موجودة في Flutter (النقطة `/orders/$id/rate` موصولة).

### السائق
- [ ] 🟡 **AnimatedNumber** (عدّ تصاعدي) → `cash`, `earnings`, `shift-summary`, `van-inventory`. الهدف: نفس widget الـ counter في `daari_core`.
- [ ] 🟡 **WorkerHeader** → `home`. **تحقّق** أن `gradient_header.dart` يغطّيه (الحالة online/offline + الاسم).

### مشترك
- [ ] 🟡 **Skeleton/Shimmer** (تحميل) → مستخدم في **٧ شاشات** لكل تطبيق. الهدف: استبدِل سبينر `AsyncView` بـ shimmer (`shimmer` package) — **اختياري** (الوظيفة مغطّاة بالسبينر، الفرق تجميلي).
- [ ] 🟡 **EmptyState** → `orders`/`history`/`walkin`. **تحقّق** أن فرع "لا توجد بيانات" في `AsyncView` يعرض حالة فارغة لائقة.

---

## المستوى ٤ — فجوات شاشات محدّدة

- [ ] 🟠 **شاشة onboarding (٤ خطوات أول تشغيل)** → موجودة في Expo (`mobile-customer/app/onboarding.tsx`)، **غائبة كشاشة في Flutter**. تحقّق هل دُمجت في `signup_screen`/`intro`؛ إن لا، أنشئ `onboarding_screen.dart` (الموقع → المعمل المغطّي → العنوان → الخزان).
- [ ] 🔴 **task_detail السائق** (Expo ٩١٣ سطر مقابل Flutter ٤٧٧) → راجع بالتفصيل أن خريطة التوجيه + كل إجراءات الوردية (بدء/إكمال/فشل/استرجاع خزان/تحصيل) موجودة. الفارق الكبير يستدعي تدقيقاً.
- [ ] 🟡 **home الزبون** (٧٥٧ مقابل ٣١٢) و**home السائق** (٨٠٩ مقابل ٣٥١) → الفارق يُغطّى معظمه ببنود المكوّنات أعلاه (Rain/RefillStrip/RecentActivity/AnimatedNumber/Skeleton). راجِع بعد تنفيذها.

---

## المستوى ٥ — نظافة وجودة (اختياري)

- [ ] 🟡 **اختبارات الموبايل** → كلا النسختين **صفر اختبارات**. ليس تراجعاً، لكن Flutter يُسهّل widget/golden tests — فرصة لرفع الجودة.
- [ ] 🟡 تأكّد من تكافؤ الأذونات (`AndroidManifest`/`Info.plist`): الموقع، الإشعارات، الكاميرا (إن لزم).

---

## جدول الأولوية السريع

| الأولوية | البنود | الأثر |
|---|---|---|
| **يجب الآن** | 1، 2، 3 | يكسر سلوكاً موعوداً (تتبّع حيّ + عمل ميداني) |
| **قبل الإطلاق الواسع** | 4، 5 | عمى عن المقاييس + مراجعة المتجر |
| **تلميع** | 6، 7، المستوى ٣ | تجربة الاستخدام والإحساس |
| **تدقيق/تحقّق** | onboarding، task_detail | فجوات محتملة تحتاج تأكيداً |

---

## مرجع: جرد الشاشات (للتتبّع)

### الزبون (١٧/١٨ مُرحّلة)
welcome · login · signup · forgot · map-picker · home · orders · order-detail · profile · addresses · notifications · schedules · settings · support · wallet · splash · intro — **(ناقص: onboarding)**

### السائق (١٢/١٢ — تطابق كامل في الجرد)
login · forgot · home · history · profile · cash · earnings · shift-summary · task-detail · van-inventory · walkin · splash
