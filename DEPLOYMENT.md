# Deployment Guide — Maa Platform Mobile Apps

دليل النشر الكامل لتطبيقَي **ماء** (الزبون + العامل) إلى App Store و Google Play باستخدام Expo + EAS.

## 0. المتطلبات الأولية (مرة واحدة)

```bash
# Node 20+ و npm
npm install -g eas-cli
eas --version   # يجب أن يكون ≥ 12

# تسجيل دخول لحساب Expo (سيفتح المتصفح)
eas login
eas whoami      # تأكد من الحساب
```

### حسابات لازم تجهّزها قبل النشر

| الحساب | لماذا | التكلفة |
|---|---|---|
| Apple Developer | للنشر على App Store | $99/سنة |
| Google Play Console | للنشر على Play Store | $25 مرة واحدة |
| Expo / EAS | للبناء والتحديثات الفورية (OTA) | مجاناً (مع free tier) |
| Firebase project | لـ FCM (إشعارات) + Crashlytics | مجاناً |
| Google Maps Platform | للخرائط والمسافات | مفعّل بـ billing |
| WhatsApp Business API (Meta) | للتذكيرات | مجاناً مع رسوم لكل رسالة |
| ZainCash Merchant | لاستلام مدفوعات الاشتراك | حسب الاتفاق |

## 1. إعداد كل تطبيق (مرة واحدة)

```bash
cd mobile-customer   # نفس الخطوات لـ mobile-worker لاحقاً

# يثبّت dependencies
npm install

# يربط المشروع بحسابك في Expo ويولّد projectId
eas init

# بعد eas init، عدّل app.json:
#  - بدّل "REPLACE_WITH_PROJECT_ID_AFTER_eas_init" بالـ projectId المُولَّد
#  - بدّل URL في updates.url بنفس الطريقة
#  - حدّث apiBaseUrl في extra إلى backend URL الحقيقي

# جرّب التشغيل المحلي
npm start
# امسح QR code بـ Expo Go على هاتفك
```

## 2. الأصول المطلوبة قبل أول build

في `assets/` لكل تطبيق ضع:

| الملف | الحجم | الوصف |
|---|---|---|
| `icon.png` | 1024×1024 | أيقونة التطبيق |
| `adaptive-icon.png` | 1024×1024 | أيقونة Android (شفاف) |
| `splash.png` | 1284×2778 | شاشة البداية |
| `notification-icon.png` | 96×96 | أيقونة الإشعار (أبيض شفاف لـ Android) |
| `favicon.png` | 48×48 | للنسخة الويب |

استخدم https://appicon.co أو https://easyappicon.com لتوليدها من ملف واحد 1024×1024.

## 3. البناء (Builds)

### Development build (للتطوير على الجهاز)

```bash
# Android (يصدر APK يمكن تثبيته مباشرة)
eas build --profile development --platform android

# iOS (يحتاج جهاز iOS مسجّل لدى Apple Developer)
eas build --profile development --platform ios
```

### Preview build (للاختبار الداخلي قبل الإطلاق)

```bash
eas build --profile preview --platform android
# سيعطيك رابط لتحميل APK، شاركه مع الفريق
```

### Production build (للمتاجر)

```bash
eas build --profile production --platform android
eas build --profile production --platform ios

# انتظر ~15-30 دقيقة لكل منصة
# EAS يعطيك رابط تحميل .aab (Android) و .ipa (iOS)
```

## 4. التقديم للمتاجر

### Google Play

1. أنشئ تطبيقاً جديداً في [Play Console](https://play.google.com/console)
2. املأ نموذج "Data safety" بدقة:
   - **Location**: نعم، يُجمع — للتحقق من توصيل الماء
   - **Photos**: نعم، يُجمع (تطبيق العامل) — لإثبات التعبئة
   - **App activity**: نعم — لتتبع الطلبات
   - **لا** نشارك أي بيانات شخصية مع طرف ثالث (مهم!)
3. أنشئ Service Account للتقديم الآلي:
   - [Google Cloud Console](https://console.cloud.google.com) → Service Accounts
   - أضف دور "Service Account User"
   - في Play Console → API access → اربط الـ Service Account
   - حمّل ملف JSON واحفظه كـ `google-service-account.json` في جذر كل تطبيق (مذكور في .gitignore)
4. قدّم:
   ```bash
   eas submit --platform android --profile production
   ```

### App Store

1. أنشئ App ID في [Apple Developer Portal](https://developer.apple.com/account)
2. أنشئ تطبيقاً جديداً في [App Store Connect](https://appstoreconnect.apple.com)
3. املأ "App Privacy" بنفس دقة Google
4. عدّل `eas.json`:
   ```json
   "submit": {
     "production": {
       "ios": {
         "appleId": "your-apple-id@example.com",
         "ascAppId": "1234567890",
         "appleTeamId": "ABCD1234EF"
       }
     }
   }
   ```
5. قدّم:
   ```bash
   eas submit --platform ios --profile production
   ```

## 5. مراجعة المتاجر — نصائح للنجاح

### للزبون (mobile-customer)
- اشرح في الوصف: "تطبيق لطلب توصيل ماء معبأ منزلياً"
- Screenshots: الشاشة الرئيسية، طلب التعبئة، شاشة الطلبات، الملف الشخصي
- الموقع مطلوب **مرة واحدة فقط** — اذكر هذا في الوصف صراحة
- لا تطلب صلاحيات لا تستخدمها

### للعامل (mobile-worker) — **انتباه** ⚠️

تطبيق العامل يستخدم Background Location، وهذا يحتاج تبريراً قوياً:

**في وصف App Store Review** (في App Store Connect → App Review):
> "هذا التطبيق مخصص لسائقي توصيل المياه — يستخدمونه أثناء العمل فقط. نتتبّع موقعهم في الخلفية لتأكيد وصولهم إلى عناوين الزبائن وحساب عمولاتهم بدقة. التتبّع يتوقف تلقائياً عند انتهاء وردية العمل. لا يُستخدم لأي غرض إعلاني."

**في Play Console — Background Location**:
- اختر "Vehicle Tracking" كحالة الاستخدام
- ارفع فيديو 30 ثانية يُظهر شاشة "وردية نشطة" وكيف يوقفها السائق

**Demo Account للمراجعين**:
- جهّز حساب اختبار (هاتف + كلمة مرور) واذكره في "App Review Information"
- مثال: `0770000999 / TestPass2026!`

## 6. التحديثات الفورية (OTA Updates)

أكبر ميزة في EAS: **بعد النشر، يمكنك دفع تحديثات JS/TS فوراً دون انتظار مراجعة المتاجر**.

```bash
# دفع تحديث لقناة الإنتاج
eas update --branch production --message "إصلاح زر التأكيد"

# المستخدمون يستلمون التحديث عند فتح التطبيق التالي (خلال ثوان)
```

⚠️ **حدود OTA**:
- يعمل فقط للتغييرات في JS/TS (UI، logic، API calls)
- التغييرات في native code (إذن جديد، حزمة جديدة) تتطلب build كامل + رفع للمتاجر
- التغيير في `runtimeVersion` يمنع OTA — اتركه على `appVersion` لتلقائي

## 7. بعد النشر (المراقبة)

### Sentry للأخطاء (موصى به جداً)

```bash
npx expo install @sentry/react-native
# اتبع: https://docs.expo.dev/guides/using-sentry/
```

### EAS Insights

تلقائي مع EAS — يُظهر:
- عدد التحميلات
- نسب التحديثات الناجحة
- crashes

### Backend monitoring
- UptimeRobot للـ uptime check (مجاناً)
- Sentry للأخطاء على backend أيضاً

## 8. checklist قبل أول submission

### للزبون
- [ ] أيقونات وsplash موجودة
- [ ] eas init مكتمل + projectId مُحدَّث
- [ ] apiBaseUrl يشير لـ backend production
- [ ] جرّبت OTP signup من نهاية لنهاية
- [ ] جرّبت طلب تعبئة وأنه يصل لـ backend
- [ ] نصوص الأذونات في app.json واضحة بالعربية
- [ ] Privacy Policy URL متوفّر (ارفع على موقعك أو GitHub Pages)
- [ ] Terms URL متوفّر
- [ ] App description + screenshots جاهزة

### للعامل
- [ ] كل ما سبق
- [ ] Background location يعمل ويوقف عند تسجيل الخروج
- [ ] الكاميرا تطلب إذن فقط عند الحاجة
- [ ] Offline queue يخزّن ويزامن
- [ ] فيديو شرح Background Location لـ Play Console
- [ ] حساب demo للمراجعين مع تعليمات كاملة

## 9. التكلفة المتوقعة شهرياً

| البند | التكلفة |
|---|---|
| EAS Builds (≤30/شهر) | مجاناً |
| EAS Update (≤1000 MAU) | مجاناً |
| Google Maps API (~10k طلب/يوم) | $50-150 |
| WhatsApp Business API | $0.05-0.10 لكل رسالة |
| Apple Developer | $99/سنة ÷ 12 = $8 |
| **الإجمالي شهرياً** | **~$200-400** |

## 10. الأسئلة الشائعة

**هل يمكنني الاختبار قبل النشر للمتاجر؟**
نعم — استخدم EAS preview builds، يُعطيك APK / TestFlight link لشاركها مع 100 شخص مجاناً.

**كم يأخذ البناء؟**
~15-30 دقيقة لكل platform. Apple أبطأ عادة.

**كم تأخذ مراجعة المتاجر؟**
- Google Play: 1-3 أيام (أحياناً 7 إذا فيه تنبيهات)
- App Store: 1-3 أيام عادة

**ماذا لو رفضوا البناء؟**
شائع جداً مع Background Location. اقرأ الرفض بعناية، عدّل الوصف، أعد التقديم. عادة لا يأخذ أكثر من جولة-جولتين.
