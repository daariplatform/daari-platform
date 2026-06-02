# ✅ قائمة مهام التكافؤ الكامل: Flutter ⟵ Expo — **v3 (مُنفَّذة)**

> الهدف: رفع نسخة Flutter (`mobile-flutter/`) إلى **طبق الأصل** من نسختَي Expo
> (`mobile-customer/` + `mobile-worker/`).
>
> **v3:** نُفِّذت غالبية البنود عبر ثلاث طبقات (commits على `main`)، وكلّها مرّت
> بـ `flutter analyze` → **No issues found**. آخر تحديث: 2026-06-02.

## 🎯 حالة التنفيذ

| الطبقة | المحتوى | الحالة |
|---|---|---|
| المستوى ١ (تراجعات وظيفية) | الخريطة الحيّة · الطابور الأوفلاين · شريط الطابور · «انتقلت» · حاجز ٥٠م | ✅ مُنجَز |
| المستوى ٢ (بنية + بصريات) | Sentry · PostHog · haptics · AnimatedCounter · RecentActivity · RefillStrip · Rain | ✅ مُنجَز |
| المستوى ٣ (الأخير) | وضع العرض · تقسيم السجلّ · روابط الإعدادات القانونية · onboarding | ✅ مُنجَز |
| متبقٍّ (اختياري) | حفظ كاش cold-start · AnimatedNumber لبقية شاشات السائق · Skeleton/shimmer | ⏳ مفتوح |

> رمز الحالة: ✅ مُنجَز · ⏳ مفتوح · 🔵 لا ينطبق

---

## المستوى ١ — تراجعات وظيفية (إجباري) — ✅

- [x] **1. خريطة التتبّع الحيّ** (شاشة طلب الزبون): `GoogleMap` بعلامتَي الوجهة والسائق، تتمركز تلقائياً، تتحدّث على استقصاء الـ١٥ث. — `order_detail_screen.dart`
- [x] **2. طابور العمل دون اتصال** (السائق): `offline_queue.dart` (sqflite) — حفظ عند فشل الشبكة، تصريف على مؤقّت ٦٠ث **+ عند عودة الاتصال**، حذف عند 2xx، إسقاط 4xx الدائمة. موصول بالطفرات الأربع.
- [x] **3. عدّاد الطابور + شريط عدم الاتصال** (رئيسية السائق): مزوّد `pendingMutations` + تيار `isOnline`.
- [x] **4. «انتقلت لبيت جديد»**: `customerRepository.move()` + زرّ في البروفايل → `POST /customers/:id/move`.
- [x] **5. حاجز GPS ٥٠م** عند الإكمال (مانع احتيال) في `task_detail_screen.dart`.

## المستوى ٢ — بنية + بصريات — ✅

- [x] **6. Sentry**: `runWithCrashReporting` في `main()` للتطبيقين عبر `Env.sentryDsn`.
- [x] **7. PostHog**: تهيئة + `identify`/`reset` + `PosthogObserver` لتتبّع الشاشات + أحداث (`order_placed`/`order_claimed`/`order_completed`/`shift_ended`).
- [x] **10. Haptics**: `Hap` فوق `HapticFeedback` — موصول بالطلب/القبول/البدء/الإكمال/إنهاء الوردية.
- [x] **RainBackground**: طبقة قطرات متحركة فوق هيدر رئيسية الزبون + تسجيل الدخول (لون قابل للضبط).
- [x] **RefillStatusStrip**: عدّاد دورة الـ٣٠ يوماً + شريط تقدّم + الموعد، على رئيسية الزبون.
- [x] **RecentActivityList**: آخر ٣ طلبات + ملخّص الإنفاق على رئيسية الزبون.
- [x] **AnimatedCounter**: نقاط المحفظة + أرقام ملخّص الوردية (المهام + النقد).
- [ ] ⏳ **AnimatedCounter** لبقية شاشات السائق (cash/earnings/van-inventory) — نُفِّذت في shift-summary فقط؛ الباقي أرقام ثابتة.
- 🔵 **StarRating · EmptyState**: موجودان أصلاً في Flutter (ليسا فجوة).
- 🔵 **i18n**: الطرفان يثبّتان العربية + RTL عبر `Directionality` (ليست فجوة).

## المستوى ٣ — الأخير — ✅

- [x] **9. وضع العرض (DEMO_MODE)**: `DemoInterceptor` (fixtures) + `Env.demoMode` + زرّ «دخول تجريبي» في تسجيل دخول التطبيقين. تشغيل: `--dart-define=DEMO_MODE=true`.
- [x] **تقسيم السجلّ بالتاريخ** (history السائق): رؤوس «اليوم/أمس/اسم اليوم/التاريخ» + عدّاد لكل قسم.
- [x] **إثراء الإعدادات** (الزبون): روابط شروط الخدمة + سياسة الخصوصية (عبر `Launchers.openUrl`). *(تأكيد كلمة السر بـ٣ حقول كان موجوداً أصلاً في شاشة الإعدادات.)*
- [x] **شاشة onboarding (٤ خطوات)**: موقع → معمل مغطٍّ → شرح وصول السائق → قبول الشروط. مُبوَّبة عبر `LocalFlags` (splash + أوّل دخول)، وتحفظ الموقع عبر `/customers/:id/move`.
  - ⚠️ نقطة `POST /customers/me/onboard` **غير موجودة في الباك إند** (كانت مكسورة في Expo أيضاً) — لذا نحفظ الموقع عبر `/move` ونعلّم الاكتمال محلياً بدل استدعاء نقطة 404.

---

## ⏳ المتبقّي (اختياري — أولوية منخفضة)

- [ ] **حفظ كاش cold-start** (`persist.ts` في Expo): طبقة حفظ لـ Riverpod (hive/shared_preferences) تُظهر آخر بيانات معروفة فوراً عند إعادة الفتح دون شبكة.
- [ ] **AnimatedCounter** في `cash`/`earnings`/`van-inventory` (السائق).
- [ ] **Skeleton/Shimmer** بدل سبينر `AsyncView` (٧ شاشات لكل تطبيق) — تجميلي بحت.
- [ ] **تبديل إذن الإشعارات** من داخل الإعدادات (يتطلّب حزمة أذونات).

---

## مفاتيح وقت البناء المطلوبة للتفعيل الكامل

```bash
flutter run \
  --dart-define=API_URL=https://api.phi-bit.com/api/v1 \
  --dart-define=SENTRY_DSN=<dsn> \
  --dart-define=POSTHOG_KEY=<phc_...> \
  --dart-define=DEMO_MODE=false
```
+ مفتاح خرائط Google في `AndroidManifest.xml` / `AppDelegate` (نفسه المستخدم في `map_picker`).

---

## مرجع: جرد الشاشات

### الزبون
welcome · login · signup · forgot · map-picker · home · orders · order-detail · profile · addresses · notifications · schedules · settings · support · wallet · intro · splash · **onboarding (مُضاف v3)**

### السائق (١٢/١٢)
login · forgot · home · history · profile · cash · earnings · shift-summary · task-detail · van-inventory · walkin · splash
