# 🚀 دليل الإطلاق الفعلي لمنصّة "داري" — Step by Step

**المطوّر**: أحمد العاني — Phi-Bit ([phi-bit.com](https://phi-bit.com))
**التواصل**: support@phi-bit.com

اتبع هذا الدليل **بالترتيب**. كل خطوة لها مدة تقديرية ومخرجات واضحة.

---

## 📋 قبل البدء — تأكّد من حصولك على:

- [x] حساب Google Play Console مدفوع ($٢٥ مرة واحدة) ← **لديك**
- [ ] حساب Expo (مجاني) — انشئ من [expo.dev/signup](https://expo.dev/signup)
- [ ] Domain مسجّل (مثلاً `daari.app` أو `phi-bit.com/maa`)
- [ ] خادم backend مستضاف (سنُحدّد لاحقاً، يمكن البدء بـ Vercel + Railway مجاناً)
- [ ] صور أيقونة التطبيق الحقيقية (أو سأولّد لك واحدة بسيطة الآن)

---

## المرحلة ١ — الإعداد المحلي (٢٠ دقيقة)

### 1.1 تسجيل دخول EAS
```bash
cd /Users/ahmedalani/Downloads/daari-platform/mobile-customer
npx eas-cli login
# سيفتح المتصفح — سجّل دخولك بحساب Expo
npx eas-cli whoami
# يجب أن يظهر اسم حسابك
```

### 1.2 ربط المشروع بحسابك
```bash
# داخل mobile-customer
npx eas-cli init
# سيسألك أن يُولّد projectId — اضغط Y
# سيعدّل app.json تلقائياً (يضع الـprojectId الحقيقي مكان REPLACE_WITH_PROJECT_ID_AFTER_eas_init)
```

كرّر نفس الخطوة لـ mobile-worker:
```bash
cd ../mobile-worker
npx eas-cli init
```

### 1.3 تحديث `owner` في app.json
حالياً `"owner": "phibit"`. إذا اسم حسابك في Expo مختلف، عدّل القيمة في:
- `mobile-customer/app.json`
- `mobile-worker/app.json`

```bash
# اعرف اسم حسابك من:
npx eas-cli whoami
```

---

## المرحلة ٢ — أيقونات وصور (٣٠ دقيقة)

### 2.1 صمّم أيقونة بسيطة
- اذهب إلى [appicon.co](https://www.appicon.co/) أو [icon.kitchen](https://icon.kitchen/)
- ارفع صورة 1024×1024 بشعار 💧 على خلفية #0891b2
- نزّل الحزمة → استخرج وضع:
  - `icon.png` (1024×1024) في `mobile-customer/assets/` و `mobile-worker/assets/`
  - `adaptive-icon.png` (1024×1024 شفاف) في نفس المكان

### 2.2 شاشة Splash
- اصنع PNG 1284×2778 — خلفية #0891b2، شعار 💧 في الوسط
- ضعها كـ `splash.png` في كلا assets/

### 2.3 لقطات شاشة Play Store
ابدأ الـapps في وضع Preview، التقط ٨ لقطات شاشة لكل تطبيق على هاتفك. ارفعها لـ Play Console.

---

## المرحلة ٣ — استضافة المستندات القانونية (١٥ دقيقة)

Google Play **يطلب رابطاً مباشراً** لسياسة الخصوصية. حلول سريعة:

### الخيار أ: GitHub Pages (مجاني)
1. أنشئ repo جديد `phi-bit/daari-legal`
2. ارفع `legal/PRIVACY_POLICY_AR.md` و `TERMS_OF_SERVICE_AR.md`
3. فعّل GitHub Pages من Settings → Pages
4. الرابط يصبح: `https://phi-bit.github.io/daari-legal/PRIVACY_POLICY_AR`

### الخيار ب: phi-bit.com (إذا متاح لديك)
ارفع الملفات على موقعك الحالي:
- `https://phi-bit.com/daari/privacy.html`
- `https://phi-bit.com/daari/terms.html`

### الخيار ج: Notion + custom domain (أسرع)
1. أنشئ صفحة Notion عامة بنص الخصوصية
2. شارك الرابط
3. ضعه في Play Console

**احتفظ بالرابط لاستخدامه في Play Console.**

---

## المرحلة ٤ — Backend الإنتاجي (٢-٣ ساعات أول مرة)

⚠️ **التطبيق لن يعمل بدون backend متاح على الإنترنت.** خيارات سريعة:

### الأسرع: Railway (مجاني للبداية)
1. ادخل [railway.app](https://railway.app) ← سجّل بـ GitHub
2. اضغط "New Project" → "Deploy from GitHub repo"
3. اربط `daari-platform/backend`
4. أضف PostgreSQL: New → Database → PostgreSQL
5. Railway يعطيك URL مثل `https://daari-backend-production.up.railway.app`

### عدّل `apiBaseUrl` في كلا التطبيقَين:
```json
// mobile-customer/app.json
"extra": {
  ...
  "apiBaseUrl": "https://your-backend.railway.app/api/v1"
}
```

### بدائل أخرى:
- **DigitalOcean** ($٤٠/شهر): تحكم كامل
- **AWS EC2 + RDS**: للحجم الأكبر
- **Vercel** (مجاني للأمر backend بسيط): ضع NestJS كـserverless

---

## المرحلة ٥ — بناء أول APK تجريبي (Preview Build) — ٢٠-٣٠ دقيقة

اختبر أن كل شيء يعمل **قبل** الإنتاج:

```bash
cd mobile-customer
npx eas-cli build --profile preview --platform android
# يأخذ ~15-25 دقيقة
# في النهاية يعطيك رابط لتحميل .apk على هاتفك
```

ثبّت الـAPK واختبر:
- ✅ تسجيل دخول OTP يعمل
- ✅ تطلب موقع → تصل لـbackend
- ✅ زر "اطلب تعبئة" يرسل request وينجح
- ✅ WhatsApp link يفتح

كرّر للـworker:
```bash
cd ../mobile-worker
npx eas-cli build --profile preview --platform android
```

---

## المرحلة ٦ — بناء الإنتاج (Production AAB) — ٣٠ دقيقة

عندما تتأكد أن الـPreview يعمل تماماً:

```bash
cd mobile-customer
npx eas-cli build --profile production --platform android
# يولّد .aab بدل .apk (Google Play يقبل AAB فقط للإنتاج الحالي)
# يأخذ ~15-25 دقيقة
```

في النهاية تستلم ملف `.aab` — احفظه.

كرّر للـworker.

---

## المرحلة ٧ — رفع التطبيق على Google Play (٤٥ دقيقة)

### 7.1 إنشاء التطبيق في Play Console

١. ادخل [play.google.com/console](https://play.google.com/console)
٢. اضغط "Create app"
٣. املأ:
   - **App name**: ماء — توصيل مياه الشرب
   - **Default language**: Arabic (Iraq) - ar-IQ
   - **App or game**: App
   - **Free or paid**: Free
   - ☑ Acceptance of Play Console declarations

### 7.2 املأ "App content"

من القائمة الجانبية → **App content** → كل بند:

| البند | الإجابة |
|---|---|
| Privacy policy | الرابط من المرحلة ٣ |
| App access | All functionality is available without restrictions (إلا إذا تريد محدوداً) |
| Ads | ❌ No, my app does not contain ads (للزبون: ⚠ نعم — لاحقاً عند تفعيل إعلانات الشركاء) |
| Content rating | املأ الاستبيان (٢-٣ دقائق) — Everyone |
| Target audience | 18+ (للزبون والعامل) |
| News app | ❌ No |
| COVID-19 contact tracing | ❌ No |
| Data safety | استخدم محتوى `PLAY_STORE_LISTING_CUSTOMER.md` |

### 7.3 املأ "Store listing"

من القائمة → **Main store listing**:

| الحقل | المحتوى |
|---|---|
| App name | ماء — توصيل مياه الشرب |
| Short description | (من PLAY_STORE_LISTING_CUSTOMER.md) |
| Full description | (من PLAY_STORE_LISTING_CUSTOMER.md) |
| App icon | 512×512 PNG |
| Feature graphic | 1024×500 PNG |
| Phone screenshots | ٢-٨ لقطات |
| Categorization | Lifestyle |
| Email | support@phi-bit.com |
| Phone (اختياري) | رقم Phi-Bit |
| Website | https://phi-bit.com |

### 7.4 رفع AAB
١. من القائمة → **Production** → **Create new release**
٢. اضغط "Choose signing key" → "Use Google Play App Signing" (موصى به)
٣. ارفع الملف `.aab` الذي ولّده EAS
٤. **Release name**: 0.1.0
٥. **Release notes**:
   ```
   الإصدار الأول من تطبيق داري — منصّة توصيل مياه الشرب المنزلية في العراق.
   - طلب تعبئة بضغطة زر
   - تذكيرات تلقائية شهرية
   - تتبّع السائق وموقعه
   - تأكيدات WhatsApp فورية
   ```
٦. اضغط **Review release** → **Start rollout to production**

### 7.5 تجاوز Google Play Review (٣-٧ أيام)

Google ستراجع التطبيق. توقّع:
- ✅ يتم القبول من المحاولة الأولى → 🎉
- ⚠️ طلب توضيح للأذونات → جاوبهم بالنصوص الموجودة في PLAY_STORE_LISTING
- ⚠️ رفض بسبب Background Location → استخدم الفيديو المذكور في PLAY_STORE_LISTING_WORKER

---

## المرحلة ٨ — تفعيل التحديثات الفورية (OTA) — ١٠ دقائق

بعد قبول التطبيق على Google Play:

```bash
cd mobile-customer
npx eas-cli update:configure
# يُكوّن EAS Update لـ runtimeVersion = appVersion
```

بعدها أي تعديل بسيط (نص، لون، إصلاح bug في JS):

```bash
npx eas-cli update --auto
# المستخدمون يستلمون التحديث خلال دقائق دون انتظار Google
```

---

## المرحلة ٩ — Pilot ميداني (أسبوع)

### يوم ١-٢: معمل تجريبي واحد
- اختر معمل صديق في بغداد
- ادخل بياناته في النظام (٣٠ زبون نموذجي)
- ركّب التطبيق على هاتف صاحب المعمل + ٢ سائقين
- درّبهم في المعمل (٢ ساعة)

### يوم ٣-٧: مراقبة لصيقة
- افحص Sentry يومياً صباحاً (٥ دقائق)
- اتصل بصاحب المعمل كل مساء (١٠ دقائق)
- اجمع feedback: ما يعمل، ما يربكهم، ما يطلبونه

### بعد أسبوع: تقييم
- هل وفّروا وقتاً؟ كم?
- هل قلّ "النسيان" في التعبئات؟
- ما الأخطاء التقنية؟
- هل سيدفعون $80K/شهر للاشتراك؟

إذا الجواب "نعم" → ابدأ بـ ٥ معامل في الأسبوع التالي.
إذا "لا" → نُصلح ونعيد.

---

## ⚠️ الأخطاء الشائعة وحلولها

### "Google Play rejected: Privacy policy not accessible"
- تأكد رابط الخصوصية يفتح من **أي متصفح بدون تسجيل دخول**
- الرابط يبدأ بـ https:// (ليس http://)

### "Background location not justified"
- أضف فيديو ٣٠ ثانية يُظهر الاستخدام
- استخدم نص التبرير من PLAY_STORE_LISTING_WORKER

### "App crashes on first launch"
- ادخل Sentry فوراً → ستُرى Stack trace
- على الأرجح Backend غير متاح → تحقق `apiBaseUrl`

### "OTP login doesn't work in production"
- أنت بحاجة SMS provider حقيقي (Zain Iraq أو Twilio)
- وحدّث `auth.service.ts` ليُرسل عبر provider بدل الـmock

---

## 📞 الدعم

في أي خطوة تحتاج مساعدة:
- افتح conversation مع Claude في Claude Code
- أرني output الـerror أو screenshot من Play Console
- سأرشدك للحل خلال دقائق

**شركة Phi-Bit** | أحمد العاني | [phi-bit.com](https://phi-bit.com) | support@phi-bit.com
