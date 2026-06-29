# داري — خارطة المتابعة (اقرأني أوّلاً) 🧭

> **الغرض:** هذا الملف هو **نقطة البداية في كل محادثة جديدة**. اقرأه لتعرف: أين وصلنا، ما القرارات
> المثبّتة، وما الخطوة التالية. يُحدَّث **في نهاية كل جلسة** (الأقسام 3 و 4 و 9).
>
> للهيكلية العامة للمشروع → [`STRUCTURE.md`](STRUCTURE.md).

**آخر تحديث:** 2026-06-30 · **الجلسة:** #6

---

## 1) أين نحن الآن (نبذة)

نُحوّل **واجهة الجوّال** من Expo/React Native إلى **Flutter** ونجعلها الواجهة الرسمية، مع **حذف Expo
نهائياً** لاحقاً. **الخادم (NestJS+Prisma) يبقى كما هو** (لا إعادة كتابة بـ FastAPI)، و**لوحات الويب تبقى
Next.js**. الإشعارات على الخادم تحوّلت من Expo Push إلى **Firebase FCM**. لا شيء منشور على المتاجر بعد
(بداية نظيفة).

تطبيقا الزبون والسائق بـ Flutter **قرب التكافؤ**؛ تطبيق الإدارة بـ Flutter **يعمل بـ 11 شاشة** (`apps/admin`:
مؤشّرات حيّة + تقارير أساسية ومتقدّمة + فريق بإجراءاته + عروض + مخزون + تهيئة + **خريطة أسطول حيّة**)، والمتبقّي **بصمة** ولمسات تكافؤ.

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

---

## 3) ✅ ما أُنجِز

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

> **لم يُنشأ commit بعد** — كل ما سبق في شجرة العمل (working tree).

---

## 4) ⏭️ ابدأ من هنا (الخطوة التالية مباشرةً)

اختر مساراً (مرتّب حسب الأولوية):

1. **(لا يحتاج حسابك)** **إكمال لمسات تكافؤ تطبيق الإدارة** (11 شاشة + قفل بصمة تعمل أصلاً). المتبقّي:
   - الخريطة الحرارية للسائقين كعرض (`driverHeatmap`)، أداء السائقين (`driverPerformance`)، سجلّ التدقيق (`auditLog`)، فلاتر التاريخ، متابعة بثّ الواتساب (`blastStatus`). **طبقة البيانات لهذه جاهزة في `daari_core` — يتبقّى عرضها كشاشات.**
   - **المرجع الوظيفي:** تطبيق Expo `mobile-admin/`.
   - ⏳ **اختبار البصمة ميدانياً** على جهاز فعلي (الكود مكتمل ويُحلَّل نظيفاً، لكن لا يمكن التحقّق من المُطالبة دون جهاز).
2. **(يحتاج حسابك — انظر القسم 5)** تجهيز Firebase + توقيع Android، لتمكين أول بناء موقّع للزبون/السائق/الإدارة.
3. تجهيز سكربت بناء/توقيع محلّي ($0، بديل EAS).

---

## 5) 🔑 بانتظارك (عناصر بشرية تحجب التقدّم)

- [ ] **مشروع Firebase**: سجّل 3 تطبيقات Android بأسماء الحِزَم أعلاه (+ iOS إن لزم)، ونزّل:
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

- **المرحلة 0 — الأساس:** أسماء الحِزَم ✅ · Firebase ⏳ · توقيع ⏳ · سكربت بناء محلّي ⏳ · قناة FCM بالخادم ✅
- **المرحلة 1 — الزبون:** إغلاق فجوات التكافؤ + QA شامل → إصدار → تقاعد `mobile-customer`.
- **المرحلة 2 — السائق:** إغلاق الفجوات + ⚠️ **QA طابور المال غير المتصل** + اختبار ميداني → تقاعد `mobile-worker`.
- **المرحلة 3 — الإدارة (الأكبر):** طبقة بيانات `/plant/*` في core ✅ · `apps/admin` بـ 11 شاشة (مؤشّرات + تقارير أساسية/متقدّمة + فريق بإجراءاته + عروض + مخزون + onboarding + خريطة أسطول حيّة) ✅ · بصمة (`local_auth`) ✅ (يتبقّى اختبار ميداني) · لمسات تكافؤ متبقّية ⏳ → تقاعد `mobile-admin`.
- **المرحلة 4 — التقاعد النهائي:** حذف `mobile-customer/worker/admin` + سكربت EAS، إلغاء اعتماد EAS (التكلفة → $0)، تحديث `STRUCTURE.md`.

---

## 7) ⚠️ مخاطر يجب تذكّرها

- **طابور المال للسائق (الأهم):** منع double-claim / double-complete عند إعادة الاتصال — مسارات المال محميّة في الخادم بـ `updateMany` شرطي؛ يجب ألا يكسرها العميل بإعادة الإرسال.
- **عقد الـ API مُجمَّد:** Flutter يستهلك نفس `/api/v1` — لا تغيّر العقد أثناء التحويل. استخدم اختبارات تكافؤ.
- **اللمسة الوحيدة المسموحة بالخادم:** قناة الإشعارات (FCM) — أُنجِزت. لا تغييرات معمارية أخرى.

---

## 8) 🧭 ملفات مرجعية سريعة

- الهيكلية العامة → [`STRUCTURE.md`](STRUCTURE.md)
- قناة الإشعارات (FCM) → `backend/src/notifications/push.service.ts`
- القلب المشترك لـ Flutter → `mobile-flutter/packages/daari_core/` (طبقة الإدارة `/plant/*` مكتملة: api/`{plant,promo,reports,team,onboarding}_repository.dart` + نماذجها)
- تطبيقات Flutter → `mobile-flutter/apps/{customer,driver,admin}` (admin بـ 11 شاشة في `lib/screens/` فوق providers تغلّف طبقة `plant/` + `GET /drivers/live`)

---

## 9) 🗒️ سجلّ الجلسات

| # | التاريخ | الخلاصة |
|---|---|---|
| 1 | 2026-06-28 | تحليل (FastAPI/Flutter) → قرار: إبقاء الخادم، اعتماد Flutter، حذف Expo، إشعارات FCM. تنفيذ: توحيد أسماء الحِزَم (customer/driver)، تحويل إشعارات الخادم إلى FCM (يبني نظيفاً)، تحديث STRUCTURE + إنشاء هذا الملف. |
| 2 | 2026-06-29 | بناء طبقة بيانات الإدارة في `daari_core`: 5 repositories + 12 ملف نماذج (+enums بقيم Prisma) تغطّي 28 نقطة `/plant/*`، رُبِطت بـ providers وصُدِّرت من barrel. `dart analyze` نظيف + تحقّق خصومي بـ workflow (كلها faithful). لا تغيير على الخادم. |
| 3 | 2026-06-29 | هيكلة تطبيق الإدارة `apps/admin` (`com.phibit.daariadmin`): بنية المنصّات + ضبط معرّف الحزمة + تسجيل في workspace + `main/router(حارس مصادقة)/providers` + 6 شاشات (splash/login/home-KPIs/reports/team/more) + قشرة تبويبات. `dart analyze`: No issues found. لا تغيير على الخادم. |
| 4 | 2026-06-29 | استكمال شاشات admin (صارت 10): المخزون (عرض+تحديث) · العروض (حملات+بثّ) · إجراءات الفريق (دعوة/تعديل/حذف) · تقارير متقدّمة (ذروة/خزّانات/أفواج/تصدير) · تهيئة المعمل + ربط المسارات وبلاطات «المزيد». `dart analyze`: No issues found. لا تغيير على الخادم. |
| 5 | 2026-06-29 | خريطة الأسطول الحيّة (admin صار 11 شاشة): نموذج `LiveDriver` + `liveDrivers()` في core على `GET /drivers/live` + `google_maps_flutter` + إعداد Android (MAPS_API_KEY) + شاشة `fleet_map` بعلامات حسب الحالة واستقصاء 15ث. `dart analyze`: admin نظيف. لا تغيير على الخادم. |
| 6 | 2026-06-30 | قفل الدخول بالبصمة (`local_auth`) لتطبيق الإدارة: خدمة `BiometricService` + علَم `LocalFlags.biometricEnabled` في core (+`local_auth ^2.3.0`، صُدّرت من barrel) + إعداد منصّات admin (`FlutterFragmentActivity`/`USE_BIOMETRIC`/`NSFaceIDUsageDescription`) + شاشة قفل `/lock` + بوّابة splash + عرض تفعيل بعد الدخول (فوق Navigator الجذر) + مفتاح في «المزيد» + مسح العلَم عند الخروج. `dart analyze`: admin نظيف. لا تغيير على الخادم. يتبقّى اختبار ميداني. |

---

> **كيف تُحدِّث هذا الملف في نهاية الجلسة:** أضِف ما أُنجِز في القسم 3، حدّث «ابدأ من هنا» (القسم 4)
> و«بانتظارك» (القسم 5)، وأضِف سطراً في سجلّ الجلسات (القسم 9) مع التاريخ.
