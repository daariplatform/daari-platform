# داري — خارطة المتابعة (اقرأني أوّلاً) 🧭

> **الغرض:** هذا الملف هو **نقطة البداية في كل محادثة جديدة**. اقرأه لتعرف: أين وصلنا، ما القرارات
> المثبّتة، وما الخطوة التالية. يُحدَّث **في نهاية كل جلسة** (الأقسام 3 و 4 و 9).
>
> للهيكلية العامة للمشروع → [`STRUCTURE.md`](STRUCTURE.md).

**آخر تحديث:** 2026-06-28 · **الجلسة:** #1

---

## 1) أين نحن الآن (نبذة)

نُحوّل **واجهة الجوّال** من Expo/React Native إلى **Flutter** ونجعلها الواجهة الرسمية، مع **حذف Expo
نهائياً** لاحقاً. **الخادم (NestJS+Prisma) يبقى كما هو** (لا إعادة كتابة بـ FastAPI)، و**لوحات الويب تبقى
Next.js**. الإشعارات على الخادم تحوّلت من Expo Push إلى **Firebase FCM**. لا شيء منشور على المتاجر بعد
(بداية نظيفة).

تطبيقا الزبون والسائق بـ Flutter **قرب التكافؤ**؛ تطبيق الإدارة بـ Flutter **غير مبنيّ بعد** (أكبر قطعة عمل).

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

1. **(لا يحتاج حسابك)** بناء طبقة بيانات الإدارة: `plant_repository` + نماذجها في `daari_core`
   (تغطّي ~17–20 نقطة `/plant/*`)، تمهيداً لبناء تطبيق admin بـ Flutter — **أكبر قطعة متبقّية**.
2. **(يحتاج حسابك — انظر القسم 5)** تجهيز Firebase + توقيع Android، لتمكين أول بناء موقّع للزبون/السائق.
3. تجهيز سكربت بناء/توقيع محلّي ($0، بديل EAS).

---

## 5) 🔑 بانتظارك (عناصر بشرية تحجب التقدّم)

- [ ] **مشروع Firebase**: سجّل 3 تطبيقات Android بأسماء الحِزَم أعلاه (+ iOS إن لزم)، ونزّل:
  - `google-services.json` → `android/app/` لكل تطبيق
  - `GoogleService-Info.plist` → `ios/Runner/` لكل تطبيق
  - **مفتاح حساب خدمة** → للخادم عبر `FIREBASE_SERVICE_ACCOUNT_JSON` أو `FIREBASE_SERVICE_ACCOUNT_PATH`
- [ ] **توقيع Android**: `keytool -genkey -v -keystore daari.keystore -alias daari -keyalg RSA -keysize 2048 -validity 10000`
  ثم `android/key.properties` (storePassword, keyPassword, keyAlias, storeFile) لكل تطبيق.
- [ ] **اسم العرض** للتطبيق (`android:label` / iOS `CFBundleName`، حالياً `daari_customer`/`daari_driver`): «داري»؟ «Daari»؟

---

## 6) 📋 المتبقّي (المراحل)

- **المرحلة 0 — الأساس:** أسماء الحِزَم ✅ · Firebase ⏳ · توقيع ⏳ · سكربت بناء محلّي ⏳ · قناة FCM بالخادم ✅
- **المرحلة 1 — الزبون:** إغلاق فجوات التكافؤ + QA شامل → إصدار → تقاعد `mobile-customer`.
- **المرحلة 2 — السائق:** إغلاق الفجوات + ⚠️ **QA طابور المال غير المتصل** + اختبار ميداني → تقاعد `mobile-worker`.
- **المرحلة 3 — الإدارة (الأكبر):** `plant_repository` في core + ~34 شاشة + معالج onboarding + خريطة سائقين حيّة + بصمة (`local_auth`) → تقاعد `mobile-admin`.
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
- القلب المشترك لـ Flutter → `mobile-flutter/packages/daari_core/` (ينقصه `plant_repository`)
- تطبيقات Flutter → `mobile-flutter/apps/{customer,driver}` (admin غير موجود بعد)

---

## 9) 🗒️ سجلّ الجلسات

| # | التاريخ | الخلاصة |
|---|---|---|
| 1 | 2026-06-28 | تحليل (FastAPI/Flutter) → قرار: إبقاء الخادم، اعتماد Flutter، حذف Expo، إشعارات FCM. تنفيذ: توحيد أسماء الحِزَم (customer/driver)، تحويل إشعارات الخادم إلى FCM (يبني نظيفاً)، تحديث STRUCTURE + إنشاء هذا الملف. |

---

> **كيف تُحدِّث هذا الملف في نهاية الجلسة:** أضِف ما أُنجِز في القسم 3، حدّث «ابدأ من هنا» (القسم 4)
> و«بانتظارك» (القسم 5)، وأضِف سطراً في سجلّ الجلسات (القسم 9) مع التاريخ.
