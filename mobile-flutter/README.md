# داري — تطبيقات Flutter

إعادة بناء تطبيقَي «داري» (الزبون + السائق) بـ **Flutter**، يستهلكان **نفس** الـ NestJS API الحالي
(`/api/v1`) دون أي تغيير في الباك إند. هذا monorepo بـ **Dart pub workspaces**.

> **الحالة:** الحزمة المشتركة `daari_core` وتطبيقا `apps/customer` و `apps/driver` **مكتملة الشيفرة**.
> تبقّى فقط توليد مجلّدات المنصّات (android/ios) وضبط مفاتيح Firebase و Google Maps (خطوات أدناه).

---

## الهيكل

```
mobile-flutter/
├── pubspec.yaml                  ← جذر الـ workspace (daari_core + apps/customer + apps/driver)
├── packages/
│   └── daari_core/               ← القلب المشترك
│       └── lib/src/
│           ├── config/           env عبر --dart-define
│           ├── theme/            ألوان + خط Cairo + الثيم
│           ├── format/           تنسيق IQD + تواريخ ar-IQ + Validators
│           ├── util/             أعلام محلية (shared_preferences)
│           ├── models/           16 نموذجاً (Prisma → Dart) + أجسام الإدخال
│           ├── api/              Dio + interceptor (single-flight refresh) + 5 repositories
│           ├── auth/             التخزين الآمن + repository + Riverpod controller
│           ├── services/         الموقع (geolocator) + الإشعارات (FCM) + الروابط الخارجية
│           └── providers/        مزوّدات Riverpod للبنية التحتية والـ repositories
└── apps/
    ├── customer/                 ← تطبيق الزبون (17 شاشة)
    │   └── lib/{main,router,providers}.dart + screens/ + widgets/
    └── driver/                   ← تطبيق السائق (14 شاشة)
        └── lib/{main,router,providers}.dart + screens/ + widgets/
```

### الشاشات المنفّذة

**الزبون:** Splash · Intro · Welcome · Login · Signup (OTP wizard) · Forgot · MapPicker ·
Home (طلب + حملة + رصيد) · Orders · OrderDetail (تتبّع + ETA + تأكيد/شكوى/تقييم) · Profile ·
Addresses · Schedules · Wallet (نقاط ولاء) · Notifications · Settings · Support.

**السائق:** Splash · Login · Forgot · Home (بركة claim + مهام اليوم + مفتاح الوردية) · History ·
Profile (أداء) · TaskDetail (خريطة + بدء/إكمال + GPS) · Cash · Earnings (مخطط) · ShiftSummary ·
VanInventory · Walkin (بحث/تسجيل زبون + بيع فوري).

---

## المتطلبات

- **Flutter 3.27+** (Dart 3.6+، يدعم pub workspaces و `Color.withValues`).
- Android Studio (Android SDK + محاكي) و/أو Xcode (iOS).
- مفتاح **Google Maps API** (لشاشتَي منتقي الموقع وتتبّع السائق).
- مشروع **Firebase + FCM** (للإشعارات — بديل Expo Push). اختياري للتشغيل الأولي.

تحقّق: `flutter doctor`

---

## الإعداد لأول مرّة (مهمّ)

الكود (`lib/`) جاهز، لكن مجلّدات المنصّات لم تُولَّد بعد. نفّذ لكل تطبيق:

```bash
cd mobile-flutter/apps/customer
flutter create --org com.phibit --project-name daari_customer --platforms=android,ios .

cd ../driver
flutter create --org com.phibit --project-name daari_driver --platforms=android,ios .
```

> `flutter create` على مجلّد موجود **يولّد فقط** ملفات المنصّات (android/ios) ويحافظ على `lib/`.
> راجع `pubspec.yaml` بعدها وتأكّد أن الاعتماديات لم تُمسح (يمكن استرجاعه من git).

ثم من جذر `mobile-flutter`:

```bash
flutter pub get        # يحلّ كل حزم الـ workspace دفعةً واحدة
```

### مفتاح Google Maps

- **Android:** أضِف في `apps/<app>/android/app/src/main/AndroidManifest.xml` داخل `<application>`:
  ```xml
  <meta-data android:name="com.google.android.geo.API_KEY" android:value="YOUR_KEY"/>
  ```
- **iOS:** في `apps/<app>/ios/Runner/AppDelegate.swift` أضِف `GMSServices.provideAPIKey("YOUR_KEY")`.

### Firebase (FCM)

لكل تطبيق: أضِف `android/app/google-services.json` و `ios/Runner/GoogleService-Info.plist`
(الأسهل: `flutterfire configure`). بدون ذلك يعمل التطبيق طبيعياً لكن الإشعارات معطّلة
(التهيئة محميّة بـ try/catch في `main.dart`).

### أذونات المنصّات

- **Android** (`AndroidManifest.xml`): `INTERNET`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`,
  `POST_NOTIFICATIONS`.
- **iOS** (`Info.plist`): `NSLocationWhenInUseUsageDescription`.

---

## التشغيل

```bash
# الزبون (محاكي Android → باك إند محلي)
cd mobile-flutter/apps/customer
flutter run --dart-define=API_URL=http://10.0.2.2:3000/api/v1

# السائق
cd mobile-flutter/apps/driver
flutter run --dart-define=API_URL=http://10.0.2.2:3000/api/v1
```

| البيئة | API_URL |
|---|---|
| محاكي Android → باك إند محلي | `http://10.0.2.2:3000/api/v1` |
| جهاز حقيقي → باك إند محلي | `http://<IP-جهازك>:3000/api/v1` |
| الإنتاج | `https://api.phi-bit.com/api/v1` |

> الافتراضي إن لم تمرّر شيئاً: `http://localhost:3000/api/v1`.

---

## ملاحظات معمارية

- **الحالة:** Riverpod (بلا توليد كود). الاستعلامات `FutureProvider.autoDispose` مع
  استقصاء دوري (`refetchInterval` بديل react-query): الطلبات كل 15ث، البركة كل 20ث.
- **النماذج:** أصناف immutable بـ `fromJson` يدوي عبر `P.*` (لا build_runner) — قابلة للترقية لـ freezed.
- **المصادقة:** نفس مفاتيح التخزين الآمن (`maa.access`/`maa.refresh`) وسلوك single-flight refresh.
- **RTL:** مضبوط عالمياً في `MaterialApp` (locale `ar` + مندوبات `flutter_localizations` + `Directionality`).
- **تطابق الباك إند:** كل نقاط النهاية منقولة حرفياً من تطبيقَي Expo. صُحّحت أخطاء رصدها التدقيق:
  حذف الحساب عبر `DELETE /auth/me`، وحالة السائق بتعداد Prisma الصحيح (`AVAILABLE/ON_ROUTE`).

### معروف / متبقٍّ
- مسح QR للخزان عند الإكمال غير منفّذ بعد (الحقل `qrCode` اختياري في `CompleteOrderInput`).
- لا وضع تجريبي (demo mode) كما في Expo — التطبيق يتطلّب باك إند فعّالاً.
