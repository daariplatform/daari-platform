# دليل تهيئة Firebase (FCM) — منصّة داري

> **الغرض:** تفعيل إشعارات الدفع (FCM) للتطبيقات الثلاثة والخادم. **معظم الربط البرمجي جاهز** — هذا الدليل
> يحصر ما تبقّى في **خطوات كونسول Firebase + إسقاط ملفّات + متغيّر بيئة على الخادم** (عناصر بشرية، القسم 5 في
> [`../PROGRESS.md`](../PROGRESS.md)).
>
> **آخر تحديث:** 2026-07-01 (الجلسة #17).

---

## 0) الحالة الحالية — ما هو **مربوط مسبقاً** (لا تكرّره)

| المكوّن | الحالة |
|---|---|
| حزم Flutter (`firebase_core ^3.6.0` · `firebase_messaging ^15.1.3`) | ✅ في `daari_core` والتطبيقات الثلاثة |
| تهيئة `Firebase.initializeApp()` (best-effort في `main.dart`) | ✅ لا تتعطّل قبل التهيئة (try/catch) |
| خدمة الدفع (`push_service.dart`: `getToken` + `registerToken` + معالجات مقدّمة/خلفية) | ✅ جاهزة |
| **ربط Gradle لمكوّن `google-services`** | ✅ **مشروط (#17)** — يُفعَّل تلقائياً عند وجود `google-services.json`، ولا يكسر البناء بدونه |
| صلاحيات Android (`INTERNET` + `POST_NOTIFICATIONS`؛ + الموقع للزبون/السائق) | ✅ في الـ manifest |
| الخادم (`firebase-admin` في `push.service.ts`) | ✅ يعمل، ويتحوّل no-op بأمان بلا اعتماد |
| `.gitignore` (يتجاهل `google-services.json` · `GoogleService-Info.plist` · المفاتيح) | ✅ الأسرار محميّة |

> **الخلاصة:** يتبقّى **عملك أنت فقط** — إنشاء مشروع Firebase، تنزيل الملفّات ووضعها، وضبط اعتماد الخادم. لا حاجة لأي تعديل كود.

---

## 1) إنشاء مشروع Firebase

1. من [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → أنشئ مشروعاً واحداً (مثلاً `Daari`).
2. فعّل **Cloud Messaging** (مُفعَّل افتراضياً في المشاريع الجديدة).

---

## 2) Android (الأساسي) — تسجيل التطبيقات وإسقاط `google-services.json`

سجّل **ثلاثة تطبيقات Android** في المشروع، **كلٌّ بمعرّف حزمته الدقيق**:

| التطبيق | معرّف الحزمة (Android package name) | مكان ملفّ `google-services.json` |
|---|---|---|
| الزبون | `com.phibit.daaricustomer` | `mobile-flutter/apps/customer/android/app/google-services.json` |
| السائق | `com.phibit.daaridriver` | `mobile-flutter/apps/driver/android/app/google-services.json` |
| الإدارة | `com.phibit.daariadmin` | `mobile-flutter/apps/admin/android/app/google-services.json` |

لكل تطبيق: **Add app → Android** → أدخِل معرّف الحزمة → نزّل `google-services.json` → ضعه في المسار المقابل أعلاه.

> ⚠️ **لا تخلط الملفّات** — كلٌّ يحوي معرّف حزمته؛ الملفّ الخاطئ في المجلّد الخاطئ يفشل البناء.
> بمجرّد وجود الملفّ، **يُفعَّل مكوّن `google-services` تلقائياً** عند `flutter run`/البناء (الربط المشروط في `android/app/build.gradle.kts`).
> `SHA-1`/`SHA-256`: غير مطلوبة لـ FCM؛ تلزم فقط إن استُخدم Google Sign-In / Dynamic Links لاحقاً.

---

## 3) بديل مؤتمَت (اختياري): `flutterfire configure`

أداة FlutterFire تُسجّل التطبيقات وتنزّل الإعدادات آلياً (تحتاج **Firebase CLI + تسجيل دخولك**):

```bash
dart pub global activate flutterfire_cli
# لكلّ تطبيق:
cd mobile-flutter/apps/customer && flutterfire configure --project=<firebase-project-id>
```

> ⚠️ **تنبيه:** الأداة **تعدّل ملفّات Gradle بنفسها**. بما أنّ المكوّن مربوط مشروطاً هنا (#17)، فالطريقة اليدوية
> (§2) **أبسط وأكثر اتّساقاً**. إن أصررت على `flutterfire configure`، احذف الكتلة المشروطة `if (file("google-services.json")…)`
> من `app/build.gradle.kts` أولاً لتفادي تطبيق المكوّن مرّتين.

---

## 4) iOS (ثانوي — بعد إتقان Android)

1. سجّل **ثلاثة تطبيقات iOS** بنفس معرّفات الحزمة (bundle id) أعلاه.
2. نزّل `GoogleService-Info.plist` لكلٍّ وضعه في `mobile-flutter/apps/<app>/ios/Runner/` (وأضِفه لهدف Runner في Xcode).
3. FCM على iOS يتطلّب إضافةً: **مفتاح APNs** (من حساب Apple Developer) مرفوعاً في Firebase → Cloud Messaging، وتفعيل **Push Notifications capability** + **Background Modes → Remote notifications** في Xcode.

---

## 5) الخادم — اعتماد حساب الخدمة (لإرسال الإشعارات)

الخادم يقرأ الاعتماد **مرّة عند أوّل استخدام** (انظر [`../backend/src/notifications/push.service.ts`](../backend/src/notifications/push.service.ts)):

1. كونسول Firebase → ⚙️ **Project settings → Service accounts → Generate new private key** → ينزّل ملفّ JSON
   (اسمه الافتراضي مثل `daariplatform-xxxxx-firebase-adminsdk-xxxxx.json`).
2. ⚠️ **إن لم يكن لديك خادم بعد:** احفظ الملفّ في مكان **سرّي خارج المستودع** (مدير كلمات مرور / مجلّد آمن).
   لا يَنتهي، وستستعمله عند تجهيز الخادم. **لا تضعه داخل مجلّد المشروع** (لكن كشبكة أمان، `.gitignore` الجذر
   يتجاهل الآن `*firebase-adminsdk*.json` و`*service-account*.json`). حتى ذلك الحين يبقى الإرسال **no-op** بأمان.
3. عند وجود الخادم، ضع الملفّ **خارج مجلّد النشر** واضبط المسار في `.env`:
   > 🚫 **لا تضعه داخل `/var/www/daari-water-api/`** — `deploy.sh` يستخدم `rsync --delete` فيحذفه عند أوّل نشر.
   > `.env` نفسه مُستثنى من النشر فيبقى.
   ```bash
   # على الخادم:
   mkdir -p /etc/daari-water
   mv <downloaded>.json /etc/daari-water/firebase-service-account.json
   chmod 600 /etc/daari-water/firebase-service-account.json
   chown daari-water:daari-water /etc/daari-water/firebase-service-account.json
   echo 'FIREBASE_SERVICE_ACCOUNT_PATH=/etc/daari-water/firebase-service-account.json' >> /var/www/daari-water-api/.env
   systemctl restart daari-water-api
   ```
   البديل (inline بدل ملفّ): `FIREBASE_SERVICE_ACCOUNT_JSON={...}` في `.env` (سطر واحد). كلاهما يعمل — اختر واحداً.

> بلا اعتماد يبقى الإرسال **no-op** (تحذير واحد في السجلّ: «Firebase not configured … push disabled») — لا تعطّل.
> العميل يسجّل رمز الجهاز تلقائياً عبر `POST /notifications/register-token` بعد الدخول.

---

## 6) اسم العرض (قرار مرتبط — القسم 5 في PROGRESS)

`android:label` حالياً `daari_customer`/`daari_driver`/`daari_admin`، بينما عنوان التطبيق في الكود **«داري»**.
قرّر الاسم النهائي (**«داري»** عربي أم **«Daari»**؟) وحدّثه في:
- Android: `android:label` في كلّ `apps/<app>/android/app/src/main/AndroidManifest.xml`.
- iOS: `CFBundleName`/`CFBundleDisplayName` في `Info.plist`.

> (منفصل عن FCM لكنّه لازم لأوّل بناء موقّع — يمكن حسمه الآن أو مع التوقيع.)

---

## 7) التحقّق (بعد الإعداد)

- [ ] `flutter run` على جهاز حقيقي → **لا استثناء Firebase** في السجلّ، والتطبيق يقلع.
- [ ] بعد الدخول: يظهر صفّ في جدول `PushToken` (نُفِّذ `registerToken`).
- [ ] أرسل إشعار اختبار: كونسول Firebase → **Cloud Messaging → Send test message** (بالرمز)، أو عبر بثّ الإدارة.
- [ ] يصل الإشعار، ونقره يفتح الشاشة الصحيحة (`data.orderId`/`data.kind`).
- [ ] أكمِل قسم **و) الإشعارات** في [`DEVICE_QA_CHECKLIST.md`](DEVICE_QA_CHECKLIST.md).

---

## 8) الأمان

كل ملفّات الاعتماد (`google-services.json` · `GoogleService-Info.plist` · مفتاح حساب الخدمة · `key.properties` · keystores)
**مُتجاهَلة في git** ([`.gitignore`](.gitignore)). لا تلتزمها؛ وزّعها عبر قناة آمنة أو أسرار CI. مفتاح **حساب الخدمة**
(الخادم) هو الأخطر — صلاحيته إرسال لكل الأجهزة؛ احفظه على الخادم فقط.
