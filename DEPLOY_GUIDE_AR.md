# دليل النشر — داري (خطوة بخطوة) 🚀

> **لمن هذا الدليل؟** لك، لتأخذ المشروع من «الكود جاهز» إلى «التطبيق يعمل على الإنترنت».
> مكتوب ببساطة. نفّذ الخطوات بالترتيب. كل أمر جاهز للنسخ.
>
> **ما ينشره هذا:** خادم الـ API (NestJS) + لوحة الويب (Next.js). تطبيقات الجوّال (Flutter)
> تُبنى وتُوقَّع بشكل منفصل لاحقاً (القسم «لاحقاً» في الأسفل).

---

## ما الذي تحتاجه قبل البدء

1. **خادم (VPS)** بنظام **Ubuntu 22.04** أو أحدث — **2 غيغابايت RAM على الأقل**. (أي مزوّد: Hetzner، DigitalOcean، Contabo…).
2. **نطاق (domain)** — نطاقان فرعيان: واحد للـ API وواحد للوحة. مثال: `api.example.com` و`admin.example.com`.
3. **جهازك** (اللابتوب) عليه **Git** و**Node.js** و**مفتاح SSH** للخادم.

> 💡 كل تغييرات قاعدة البيانات المتراكمة (idempotency المال + أمان التوكنات + حماية الدفاتر المالية) **تُطبَّق تلقائياً** في أوّل نشر على قاعدة فارغة — لا خطوة يدوية.

---

## الخطوات

### 0) جهّز الخادم والنطاق
- اطلب الخادم، واحصل على الـ IP.
- في لوحة نطاقك، أضِف سجلَّي **A** يشيران إلى IP الخادم:
  - `api.example.com → IP`
  - `admin.example.com → IP`
- انسخ مفتاح SSH إلى الخادم لتدخل بلا كلمة سرّ:
  ```bash
  ssh-copy-id -i ~/.ssh/phibit_deploy.pub root@IP_الخادم
  ```

### 1) ثبّت المتطلّبات على الخادم
ادخل الخادم (`ssh root@IP`) وثبّت الحزم (سكربت التجهيز **يتوقّع وجودها**):
```bash
apt update && apt install -y \
  postgresql postgresql-contrib postgis \
  redis-server nginx certbot python3-certbot-nginx curl
# Node.js 20+ :
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs
```

### 2) عدّل اسم نطاقك في إعدادات nginx
على **جهازك** (داخل مجلّد المشروع)، بدّل النطاقات الافتراضية بنطاقك في ملفَّين:
- `deploy/nginx/daari-water-api.conf` → غيّر `server_name api.phi-bit.com;` إلى نطاق الـ API.
- `deploy/nginx/daari-water-dashboard.conf` → غيّر `server_name daari-admin.phi-bit.com;` إلى نطاق اللوحة.

### 3) شغّل سكربت التجهيز (مرّة واحدة على الخادم)
ارفع المستودع للخادم (أو استنسخه هناك) وشغّل:
```bash
cd /root/daari-water-platform   # حيث وضعت المستودع
bash deploy/vps-bootstrap.sh
```
هذا **ينشئ قاعدة بيانات `daari_water` + مستخدمها + امتداد PostGIS**، ويثبّت خدمات systemd وnginx ومهمّة النسخ الاحتياطي وتدوير السجلّات. **احفظ كلمة سرّ قاعدة البيانات** التي يطبعها (تحتاجها في الخطوة التالية).

### 4) املأ ملفّ الإعدادات (.env)
على الخادم:
```bash
cp /root/daari-water-platform/backend/.env.production.example \
   /var/www/daari-water-api/.env
nano /var/www/daari-water-api/.env
```
**غيّر هذه القيم إلزامياً:**
| المتغيّر | القيمة |
|---|---|
| `DATABASE_URL` | استخدم كلمة السرّ من الخطوة 3 (`...daari_water:كلمة_السرّ@localhost:5432/daari_water`) |
| `JWT_SECRET` | ولّده: `openssl rand -hex 64` |
| `PLATFORM_ADMIN_PHONE` | رقم هاتف مالك المنصّة (أنت) |
| `PLATFORM_ADMIN_PASSWORD` | **كلمة سرّ قويّة** (النشر يفشل عمداً إن تركتها فارغة) |
| `APP_URL` | `https://api.example.com` (نطاق الـ API) |
| `CORS_ORIGINS` | `https://admin.example.com` (نطاق اللوحة) |

وأنشئ ملفّ إعداد اللوحة على **جهازك** قبل النشر (اللوحة تُبنى محلياً):
```bash
echo 'NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1' > dashboard/.env.production
```

### 5) انشر (من جهازك)
```bash
SSH_TARGET=root@IP_الخادم ./deploy/deploy.sh both
```
هذا **يبني محلياً** ثم يرفع ويشغّل، و**تلقائياً**: يطبّق تغييرات قاعدة البيانات (`db push`) + **يزرع حساب المالك** + ينشئ مجلّدات الرفع. في النهاية يطبع `✓ running` للخدمتين.

> إن كان خادمك **مخصّصاً لداري فقط**، لن يتعثّر فحص السجلّ (يتخطّاه تلقائياً). إن ظهرت رسالة عن `/root/PROJECTS.md`، فأنت على خادم مشترك — اتبع تعليمات الرسالة أو أضِف `SKIP_REGISTRY_CHECK=1` قبل الأمر.

### 6) فعّل HTTPS (شهادة SSL مجانية)
على الخادم:
```bash
certbot --nginx -d api.example.com -d admin.example.com
```

### 7) تحقّق أنّ كل شيء يعمل
- افتح `https://admin.example.com` في المتصفّح → صفحة الدخول.
- سجّل دخول **المالك** برقمك وكلمة السرّ من الخطوة 4 → يجب أن تدخل لوحة المنصّة.
- افحص صحّة الـ API: `curl https://api.example.com/api/v1/health`.

### 8) اختبار ميداني على جهاز فعلي
اتبع **[`mobile-flutter/DEVICE_QA_CHECKLIST.md`](mobile-flutter/DEVICE_QA_CHECKLIST.md)** — يغطّي ما لا يُثبته البناء: GPS/الخرائط، البصمة، وأهمّها **idempotency طابور المال** (إثبات أنّ إعادة الإرسال لا تُكرّر البيع).

---

## لاحقاً (ليست ضرورية لأوّل تشغيل)

- **الإشعارات (Firebase/FCM):** حمّلتَ مفتاح حساب الخدمة سابقاً. ضعه على الخادم **خارج مجلّد النشر** (`/etc/daari-water/google-service-account.json` — مجلّد النشر يُمحى مع كل `rsync`). القالب يشير لهذا المسار أصلاً. التفاصيل: [`mobile-flutter/FIREBASE_SETUP.md`](mobile-flutter/FIREBASE_SETUP.md).
- **مفتاح خرائط جوجل:** لخريطة الأسطول في تطبيق الإدارة (بدونه تظهر رمادية بلا تعطّل). مرّره عند بناء تطبيق الإدارة.
- **توقيع أندرويد + بناء التطبيقات:** لإصدار APK/AAB موقّع. الخطوات في [`PROGRESS.md`](PROGRESS.md) القسم 5.

---

## إن تعثّر شيء
- **الخدمة لا تعمل؟** على الخادم: `systemctl status daari-water-api` و`journalctl -u daari-water-api -n 50`.
- **500 عند الدخول؟** غالباً `.env` ناقص (DATABASE_URL/JWT_SECRET). راجع الخطوة 4 وأعد `systemctl restart daari-water-api`.
- **النشر توقّف عند `/root/PROJECTS.md`؟** انظر الملاحظة في الخطوة 5.

> **الإجراء الآمن لتغييرات قاعدة البيانات** (نسخة احتياطية → معاينة → تطبيق → تراجع): [`deploy/RUNBOOK-clientRequestId-db-push.md`](deploy/RUNBOOK-clientRequestId-db-push.md).
