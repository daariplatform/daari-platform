# 🚀 Play Console Submission Packet — Copy/Paste Ready

> هذي الوثيقة فيها **كل النص الذي ستحتاجه** للرفع على Play Console. كل قسم مُجهّز بالضبط لكل حقل في Console. افتح Console جنباً إلى جنب وانسخ من هنا.

**URL**: https://play.google.com/console

---

## 📦 ملفات AAB جاهزة على Mac

```
~/Downloads/maa-platform/store-assets/aabs/daari-customer-v0.1.0.aab   (64 MB)
~/Downloads/maa-platform/store-assets/aabs/daari-worker-v0.1.0.aab     (78 MB)
```

---

# 📱 APP #1 — داري (الزبائن)

## 1. إنشاء التطبيق

في Play Console → **All apps → Create app**

| الحقل | القيمة |
|---|---|
| **App name** | `داري` |
| **Default language** | `Arabic (العربية)` |
| **App or game** | App |
| **Free or paid** | Free |
| **Declarations** | ✓ Developer Program Policies + ✓ US export laws |

---

## 2. Internal Testing — أول إصدار

**Testing → Internal testing → Create new release**

### App bundle
- ارفع: `~/Downloads/maa-platform/store-assets/aabs/daari-customer-v0.1.0.aab`
- لما يطلب موافقة على Play App Signing → **Continue**

### Release name (يولّده تلقائياً)
```
0.1.0 (1)
```

### Release notes (Arabic)
```
الإصدار الأول التجريبي من داري — منصة خدمات منزلك.

ما هو متاح:
• طلب تعبئة خزان المياه من المعمل التابع لك
• تاريخ تعبئاتك السابقة
• إشعارات تذكير شهرية
• تتبع وصول السائق

للاستخدام: تواصل مع معمل المياه الذي تشتري منه ليفتح لك حساباً ويعطيك رقمك وكلمة المرور.
```

### Testers (Email list — أضفهم في internal testing)
أضف 3-10 إيميلات (لك + مختبرين). يصلهم رابط opt-in عبر إيميل.

---

## 3. App Content (إلزامي قبل أي submit)

### Privacy Policy
- **URL**: `https://daari-admin.phi-bit.com/legal/privacy`

### App access
- اختر: **All or some functionality is restricted**
- **Description**:
```
Login requires credentials provisioned by the partner water plant. To test, use:
Phone: 07710000001
Password: password123

This is a tenant-based platform where the plant administrator (using our web dashboard at daari-admin.phi-bit.com) creates customer accounts and provides them the login credentials.
```

### Ads
- اختر: **No, my app does not contain ads**

### Content rating questionnaire
1. **Email**: `support@phi-bit.com`
2. **Category**: `Tools/Productivity` (أو Lifestyle)
3. كل الأسئلة عن العنف، الجنس، المخدرات، الإرهاب، إلخ → **No**
4. Children-directed content → **No**
5. النتيجة: **Everyone** rating

### Target audience and content
- **Target age groups**: `18+` only
- **Children-directed**: No

### News app
- اختر: **No**

### COVID-19 contact tracing
- اختر: **No**

### Data safety ⚠️ أهم خطوة

#### Section 1: Data collection and security

**Does your app collect or share any of the required user data types?**
→ **Yes**

**Is all of the user data collected by your app encrypted in transit?**
→ **Yes** (نستخدم TLS 1.3 لكل API)

**Do you provide a way for users to request that their data is deleted?**
→ **Yes** — وأضف URL: `mailto:support@phi-bit.com?subject=Daari%20Data%20Deletion%20Request`

#### Section 2: Data types collected

**Personal info → Name**
- Collected: ✓
- Shared: ✗
- Processed ephemerally: ✗
- Required or optional: **Required**
- Purposes: App functionality, Account management
- User-provided: ✓

**Personal info → Phone number**
- Collected: ✓
- Shared: ✗
- Required: **Required**
- Purposes: App functionality, Account management, Communications (for refill reminders)
- User-provided: ✓

**Personal info → Address**
- Collected: ✓
- Shared: ✗
- Required: **Required**
- Purposes: App functionality (to deliver water to home)
- User-provided: ✓

**Location → Approximate location**
- Collected: ✓
- Shared: ✗
- Required: **Required**
- Purposes: App functionality (find nearest plant)
- User-provided: ✗ (auto from device)

**Photos and videos → Photos** (worker app only, NOT customer)
- (skip in customer app form)

**App activity → App interactions**
- Collected: ✓
- Shared: ✗
- Required: **Optional**
- Purposes: Analytics
- User-provided: ✗

**Crash logs (App info and performance → Crash logs)**
- Collected: ✓
- Shared: ✗ (Sentry هو معالج للبيانات نيابةً عنا، ليس "shared" بمعنى Play Store)
- Required: **Optional**
- Purposes: Analytics
- User-provided: ✗

### Government apps
- **No**

### Financial features
- **My app does not provide any financial features**
  (الدفع نقداً للسائق — لا integration مالي داخل التطبيق)

### Health
- **My app does not provide any health features**

---

## 4. Store Listing

### Short description (80 char max)
```
خدمات منزلك بضغطة زر — توصيل المياه المعقّمة لباب بيتك
```

### Full description (4000 char max)
```
🏠 داري — أسهل طريقة لطلب الخدمات المنزلية

منصّة "داري" تربطك بمعمل تنقية المياه الأقرب لمنطقتك، وتتيح لك طلب تعبئة خزانك المنزلي بضغطة زر — بدون مكالمات ولا انتظار.

✨ المميزات الرئيسية:

💧 طلب تعبئة فوري
اضغط زراً واحداً واطلب تعبئة خزانك. ستستلم تأكيداً مع الوقت المتوقع للوصول.

📍 تتبّع السائق
شاهد موقع السائق على الخريطة عند الطريق إليك، ومتى سيصل.

🔔 تذكيرات تلقائية
نُذكّرك تلقائياً قبل انتهاء الماء في خزانك، حتى لا تنفد منك المياه أبداً.

📋 سجل كامل
احتفظ بسجل دائم لكل تعبئة، تواريخها، السائق الذي قام بها، والمبالغ المدفوعة.

🏠 موقع بيتك محفوظ
تُسجّل عنوان بيتك مرة واحدة، وكل طلباتك القادمة تذهب لنفس المكان.

🤝 شراكة مع المعامل المعتمدة
نعمل مع معامل تنقية مياه RO مرخّصة في العراق — مياه نظيفة ومضمونة.

🚛 خدمات إضافية مستقبلية
قريباً: غاز منزلي، تنظيف خزانات، فلاتر RO، وخدمات منزلية أخرى من شركاء موثوقين.

💰 أسعار شفافة
١٠٠٠ دينار لكل تعبئة. الدفع عند التوصيل نقداً. لا رسوم خفية.

🔒 خصوصيتك محمية
نطلب موقعك مرة واحدة فقط لتسجيل عنوان بيتك. لا نتتبّعك. لا نشارك بياناتك مع أي طرف ثالث.

📱 سهل الاستخدام
واجهة بسيطة بالعربية تماماً، مصمّمة لتعمل حتى مع ضعف الإنترنت.

━━━━━━━━━━━━━━━━━━━━━━━━

كيف يعمل؟
١. اطلب من معمل المياه فتح حساب لك — يعطيك رقم هاتفك + كلمة المرور
٢. حمّل التطبيق وسجّل دخول
٣. حدّد موقع بيتك على الخريطة (مرة واحدة)
٤. السائق يصلك بخزان مجاناً ويملأه
٥. كل شهر تطلب تعبئة جديدة بضغطة زر

━━━━━━━━━━━━━━━━━━━━━━━━

منصّة "داري" من تطوير شركة Phi-Bit (phi-bit.com) — منصّة عراقية لإدارة معامل المياه والتوصيل المنزلي.

للدعم: support@phi-bit.com
الموقع: https://phi-bit.com
```

### App icon (512×512)
```
~/Downloads/maa-platform/store-assets/play-store-icon-customer.png
```

### Feature graphic (1024×500)
```
~/Downloads/maa-platform/store-assets/feature-graphic-customer.png
```

### Screenshots (Phone — 4 minimum) ⚠️ يلزم 4 لقطات

التقطها من **BlueStacks** بعد تشغيل التطبيق:
1. شاشة تسجيل الدخول
2. الشاشة الرئيسية (بعد الدخول بـ`07710000001`/`password123`)
3. صفحة الطلبات
4. صفحة Profile/Settings

**أبعاد مقبولة**: 320-3840 px (طول/عرض)، PNG أو JPEG. BlueStacks الافتراضي 1280×720 = ✓

---

## 5. Store presence → Choose countries/regions

- اختر: **Iraq** فقط (أو أضف Saudi Arabia / UAE لو تريد، لكن نوصي Iraq فقط للبداية)

---

## 6. App pricing
- **Free**

---

## 7. Submit Internal Testing

- اضغط **Review release** → **Start rollout to Internal testing**
- ستحصل على **رابط opt-in** للمختبرين (Test track)
- موافقة Google: **2-24 ساعة** عادةً

---

═══════════════════════════════════════════════════════════════

# 🚛 APP #2 — داري للعاملين

كل شيء **مطابق للأول** لكن مع التغييرات التالية:

## 1. إنشاء التطبيق
- **App name**: `داري — للعاملين`
- باقي الحقول نفس Customer

## 2. AAB upload
```
~/Downloads/maa-platform/store-assets/aabs/daari-worker-v0.1.0.aab
```

## 3. Release notes (Arabic)
```
الإصدار الأول التجريبي من داري للعاملين.

تطبيق سائقي معامل المياه والبائعين المتجولين على منصة داري.

ما هو متاح:
• استقبال مهام التعبئة من المعمل
• تتبع GPS أثناء العمل
• تأكيد كل تعبئة بصورة + موقع
• حساب العمولات الشهرية

للاستخدام: تواصل مع معمل المياه الذي تعمل لديه ليفتح لك حساب سائق.
```

## 4. Data Safety — اختلافات عن Customer

**أضف هذه البيانات الإضافية:**

**Location → Precise location**
- Collected: ✓
- Shared: ✗ (مع المعمل فقط داخلياً، ليس "shared" بمعنى Play Store)
- Required: **Required**
- Purposes: App functionality (لتأكيد التعبئة بـGPS) + Fraud prevention
- User-provided: ✗ (auto from device)

**Photos and videos → Photos**
- Collected: ✓
- Shared: ✗
- Required: **Required**
- Purposes: App functionality (proof of refill)
- User-provided: ✓

## 5. Short description (للعاملين)
```
تطبيق سائقي معامل المياه — مهام يومية، GPS، حساب عمولات
```

## 6. Full description (للعاملين)
```
🚛 داري للعاملين — تطبيق سائقي معامل المياه والبائعين المتجولين

التطبيق المتخصّص لسائقي معامل تنقية المياه والبائعين المتجولين على منصّة داري. صُمّم خصيصاً للعمل الميداني السريع.

✨ المميزات الرئيسية:

📋 مهامك اليومية
شاهد كل التعبئات والتوصيلات المعيّنة لك اليوم في قائمة واحدة، مرتّبة حسب الأقرب.

🗺️ ملاحة ذكية
اضغط زراً للملاحة المباشرة إلى الزبون عبر Google Maps. مسار محسّن يوفر الوقت والوقود.

📍 تأكيد GPS عند التعبئة
يثبّت موقعك تلقائياً عند كل تعبئة — يحمي حقوقك ويُثبت إنجازاتك للمعمل.

📷 صورة دليل
التقط صورة الخزان كدليل تعبئة. سهل وسريع.

💰 احسب عمولاتك
شاهد عمولاتك المتراكمة شهرياً وأرباحك المتوقعة.

⚙️ يعمل بدون إنترنت
استمر بالعمل حتى لو كنت في منطقة ضعيفة التغطية — كل شيء يتزامن تلقائياً.

🔒 تتبّع آمن
تتبّع GPS أثناء وردية العمل فقط. ينتهي تماماً عند تسجيل الخروج.

━━━━━━━━━━━━━━━━━━━━━━━━

كيف يعمل؟
١. اطلب من المعمل فتح حساب سائق لك — يعطيك رقم هاتفك + كلمة المرور
٢. حمّل التطبيق وسجّل دخول
٣. تشاهد قائمة المهام اليومية من المعمل
٤. تنفّذ كل تعبئة (GPS تلقائي + صورة)
٥. تستلم راتبك + عمولاتك آخر الشهر

━━━━━━━━━━━━━━━━━━━━━━━━

منصّة "داري" من تطوير شركة Phi-Bit (phi-bit.com).

للدعم: support@phi-bit.com
```

## 7. Screenshots (Worker app)

1. شاشة اختيار الدور (Driver/Vendor)
2. شاشة تسجيل دخول السائق
3. قائمة مهام اليوم
4. تفاصيل مهمة + زر "تأكيد التعبئة"

اشترك بحساب `07700000002 / password123` في staging APK لتأخذ اللقطات.

---

═══════════════════════════════════════════════════════════════

# ✅ ترتيب الخطوات الفعلية (افعل بهذا الترتيب)

## في Play Console:

### للتطبيق الأول (داري — الزبائن):

1. ☐ **Create app** (~2 دقيقة) — أعلاه App #1 §1
2. ☐ **App content** (~15 دقيقة) — املأ الأقسام التالية:
   - ☐ Privacy policy (URL)
   - ☐ App access (with test credentials)
   - ☐ Ads (No)
   - ☐ Content rating (questionnaire ~5 دقائق)
   - ☐ Target audience (18+)
   - ☐ News (No)
   - ☐ COVID (No)
   - ☐ **Data safety** (~10 دقائق — أهم)
   - ☐ Government apps (No)
   - ☐ Financial features (No)
   - ☐ Health (No)
3. ☐ **Store listing** (~10 دقائق):
   - ☐ Short description
   - ☐ Full description
   - ☐ App icon (512×512)
   - ☐ Feature graphic (1024×500)
   - ☐ **Phone screenshots (4)** — التقط من BlueStacks الآن
4. ☐ **Choose countries** (Iraq)
5. ☐ **App pricing** (Free)
6. ☐ **Internal testing → Create release → Upload AAB → Add testers → Submit** (~5 دقائق)

### للتطبيق الثاني (داري للعاملين):
كل الخطوات السابقة لكن مع النصوص والمحتوى من القسم "APP #2" أعلاه.

---

## الوقت المتوقع:
- App #1 الأول: **~45 دقيقة** (الأول دائماً أبطأ)
- App #2 الثاني: **~25 دقيقة** (تعرف الواجهة الآن)
- **المجموع**: ~70 دقيقة + التقاط الـscreenshots

## بعد Submit:
- Internal Testing موافقة Google: **2-24 ساعة**
- اختبر مع 5-10 أشخاص لمدة **أسبوع**
- إذا OK: **Promote to Production** (موافقة 3-7 أيام)

═══════════════════════════════════════════════════════════════

# 🆘 إذا واجهت مشكلة

ابعث لي screenshot من الشاشة + رسالة الخطأ. ساعدك خطوة بخطوة.

أخطاء شائعة:
- **"This release does not include any languages"**: انقل لـSet up your app → Translations → اختر Arabic
- **"Privacy policy required"**: عُد إلى Policy → App content → أدخل الـURL
- **"Data safety incomplete"**: عُد إلى App content → Data safety → أكمل كل الأقسام
