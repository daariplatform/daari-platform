# Runbook — تفعيل idempotency على الإنتاج (`clientRequestId` عبر `prisma db push`)

> **الغرض:** تطبيق التغيير المُودَع في الدفعة 6ب (إغلاق ثغرة «مزدوجة الشحن» المالية) على قاعدة بيانات
> الخادم بأمان، مع نسخة احتياطية ومعاينة مسبقة للـ SQL وتحقّق بعدي وخطة تراجع.
>
> **آخر تحديث:** 2026-07-01 · مرتبط بـ [`../PROGRESS.md`](../PROGRESS.md) (المرحلة 2 — السائق) والقرار #16/6ب.

---

## 0) الخلاصة (TL;DR)

- **التغيير:** عمود `clientRequestId String?` (nullable) + قيد `@@unique([tenantId, clientRequestId])` على
  جدولَي `RefillOrder` و`CashHandover`.
- **الطبيعة:** **إضافي، متوافق رجعياً، غير هدّام** — لا حذف ولا تعديل لأعمدة قائمة. Expo (بلا مفتاح) لا يتأثّر.
- **مؤتمَت أصلاً:** كل نشر عادي للـ API عبر [`deploy.sh`](deploy.sh) **يشغّل `prisma db push` تلقائياً**
  (السطر 79). فإن نشرت الـ API بالطريقة المعتادة `./deploy/deploy.sh api` **يُطبَّق التغيير دون أي خطوة يدوية**.
- **دور هذا الـ runbook:** إحاطة النشر بأمان (نسخة احتياطية + معاينة SQL + تحقّق + تراجع) لمن يريد الطمأنينة،
  أو لمن يريد تطبيق المخطّط وحده دون نشر كامل للكود.

---

## 1) ما الذي سيتغيّر بالضبط

| الجدول | التغيير | SQL المتوقّع (تقريبي) |
|---|---|---|
| `RefillOrder` | + عمود nullable | `ALTER TABLE "RefillOrder" ADD COLUMN "clientRequestId" TEXT;` |
| `RefillOrder` | + فهرس فريد | `CREATE UNIQUE INDEX "RefillOrder_tenantId_clientRequestId_key" ON "RefillOrder"("tenantId", "clientRequestId");` |
| `CashHandover` | + عمود nullable | `ALTER TABLE "CashHandover" ADD COLUMN "clientRequestId" TEXT;` |
| `CashHandover` | + فهرس فريد | `CREATE UNIQUE INDEX "CashHandover_tenantId_clientRequestId_key" ON "CashHandover"("tenantId", "clientRequestId");` |

> المصدر: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) — الأسطر 504/567 (RefillOrder)
> و652/657 (CashHandover). أسماء الفهارس أعلاه هي تسمية Prisma الافتراضية `{Table}_{col…}_key`؛ **أكّد الاسم
> الفعلي من مخرجات المعاينة (الخطوة ب) قبل أي تراجع.**

---

## 2) لماذا هو آمن

- **العمود nullable** وPostgres يعامل `NULL` كقيمة **متمايزة** في الفهرس الفريد → كل الصفوف القائمة (قيمتها
  `NULL`) لا تتعارض، فلا يفشل بناء الفهرس بسبب تكرار.
- **بيئة نظيفة:** لا شيء منشور على المتاجر بعد (PROGRESS §1) → الجداول صغيرة → بناء الفهرس شبه فوري وقفل
  الكتابة اللحظي مهمَل عملياً.
- **الكود المستهلك مُودَع بالفعل:** `createWalkinRefill` ([orders.service.ts:1189](../backend/src/orders/orders.service.ts#L1189))
  و`createForDriver` مع التقاط `P2002` ([cash-handover.service.ts:34-59](../backend/src/cash-handover/cash-handover.service.ts#L34))
  + حقول `clientRequestId` في الـ DTOs. فتطبيق القيد يُفعّل حماية جاهزة، لا يكسر شيئاً.

---

## 3) معطيات البيئة (مستخرجة من `deploy.sh` و`backup-db.sh`)

| العنصر | القيمة |
|---|---|
| VPS | عيّنه في `SSH_TARGET` (مثل `root@1.2.3.4`) عبر `~/.ssh/phibit_deploy` — **الخادم السابق `45.84.138.119` أُلغي، لا افتراضي** |
| دليل الـ API | `/var/www/daari-water-api` |
| الخدمة (systemd) | `daari-water-api` |
| المستخدم | `daari-water` |
| `DATABASE_URL` | في `/var/www/daari-water-api/.env` (يقرأه prisma تلقائياً من الدليل) |
| آلية المخطّط | `prisma db push` **حصراً** — **لا يوجد مجلّد `prisma/migrations/`** (لا تستخدم `migrate deploy`) |

> ⚠️ **تنبيه في `scripts/backup-db.sh`:** قيمته الافتراضية `ENV_FILE=/var/www/daari-api/.env` تشير إلى **مسار
> قديم مختلف** عن دليل الـ API الفعلي `/var/www/daari-water-api`. عند تشغيله يدوياً مرّر
> `ENV_FILE=/var/www/daari-water-api/.env` صراحةً، أو استخدم أمر `pg_dump` المباشر في الخطوة (أ) أدناه.

---

## 4) الإجراء

كل الأوامر التالية تُشغَّل **على الـ VPS** (لأنّ `DATABASE_URL` يشير إلى `localhost` هناك)، من داخل دليل الـ API.

```bash
ssh -i ~/.ssh/phibit_deploy "$SSH_TARGET"   # عيّن SSH_TARGET=root@<خادمك> أولاً
cd /var/www/daari-water-api
```

### الخطوة أ — نسخة احتياطية (إلزامية قبل أي تغيير)

```bash
set -a; source /var/www/daari-water-api/.env; set +a
mkdir -p /var/backups/daari
pg_dump --no-owner --no-privileges "$DATABASE_URL" \
  | gzip -9 > "/var/backups/daari/pre-clientRequestId-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
ls -lh /var/backups/daari/pre-clientRequestId-*.sql.gz   # تأكّد أنّ الحجم > 0
```

### الخطوة ب — معاينة الـ SQL الدقيق (قراءة فقط — لا يغيّر شيئاً)

```bash
set -a; source /var/www/daari-water-api/.env; set +a
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

- **المتوقّع:** فقط العبارتان `ADD COLUMN` + العبارتان `CREATE UNIQUE INDEX` من الجدول في §1 (لا شيء غيرها).
- **🚫 توقّف فوراً** إن ظهر أي `DROP TABLE` / `DROP COLUMN` / `ALTER COLUMN` على جداول أخرى → معناه أنّ قاعدة
  البيانات الحيّة **انحرفت** عن المخطّط، ويجب التحقيق قبل أي `db push` (وإلا قد يطلب `--accept-data-loss`).

### الخطوة ج — التطبيق (اختر مساراً واحداً)

**المسار الموصى به — نشر متكامل (كود + مخطّط معاً)** من جهازك المحلّي:

```bash
./deploy/deploy.sh api
```

> يبني الخادم محلياً، يزامن الملفات، ثم يشغّل على الـ VPS: `prisma db push --skip-generate` + `prisma generate`
> + إعادة تشغيل الخدمة (deploy.sh: 58, 79-83). هذا **الأنظف** لأنّه يشحن الكود المستهلك للمفتاح والقيد معاً.

**المسار الجراحي — تطبيق المخطّط وحده** (استخدمه فقط إن كان كود الدفعة 6ب **منشوراً بالفعل** على الخادم):

```bash
# على الـ VPS، داخل /var/www/daari-water-api
npx prisma db push --skip-generate
npx prisma generate
systemctl restart daari-water-api
```

> `db push` غير تفاعلي وسيرفض أي عملية هدّامة تلقائياً (تغييرنا إضافي بحت، فلن يطلب `--accept-data-loss`).

### الخطوة د — التحقّق البعدي

```bash
# 1) الخدمة حيّة
systemctl is-active daari-water-api

# 2) الأعمدة موجودة
psql "$DATABASE_URL" -c "SELECT table_name, column_name, is_nullable
  FROM information_schema.columns
  WHERE column_name = 'clientRequestId'
    AND table_name IN ('RefillOrder','CashHandover');"

# 3) الفهارس الفريدة موجودة
psql "$DATABASE_URL" -c "SELECT indexname, indexdef FROM pg_indexes
  WHERE tablename IN ('RefillOrder','CashHandover')
    AND indexdef ILIKE '%clientRequestId%';"
```

**اختبار idempotency وظيفي (الإثبات الحقيقي):** من تطبيق السائق، نفّذ بيعاً فورياً (walk-in) أو تسليم نقد
**وأنت غير متصل**، ثم أعد الاتصال لإجبار الطابور على التفريغ مرّتين (أو كرّر العملية بنفس `clientRequestId`).
النتيجة الصحيحة: **صفّ واحد فقط** يُسجَّل (لا مضاعفة إيراد/تسليم). تحقّق بعدّ الصفوف:

```bash
psql "$DATABASE_URL" -c "SELECT \"clientRequestId\", count(*)
  FROM \"RefillOrder\"
  WHERE \"clientRequestId\" IS NOT NULL
  GROUP BY 1 HAVING count(*) > 1;"   # يجب أن يُرجِع صفر صفوف
```

---

## 5) خطة التراجع (Rollback)

التغيير إضافي، فالتراجع بسيط وآمن. **أكّد أسماء الفهارس الفعلية** من الخطوة (د-3) أولاً، ثم:

```sql
-- على قاعدة البيانات (psql "$DATABASE_URL")
DROP INDEX IF EXISTS "RefillOrder_tenantId_clientRequestId_key";
DROP INDEX IF EXISTS "CashHandover_tenantId_clientRequestId_key";
ALTER TABLE "RefillOrder"  DROP COLUMN IF EXISTS "clientRequestId";
ALTER TABLE "CashHandover" DROP COLUMN IF EXISTS "clientRequestId";
```

> إن كان القيد قد أُنشئ كـ CONSTRAINT بدل INDEX في نسخة Prisma لديك، استخدم
> `ALTER TABLE "…" DROP CONSTRAINT IF EXISTS "…";` بالاسم الظاهر في المعاينة.
>
> البديل الشامل: الاستعادة من نسخة الخطوة (أ) —
> `gunzip -c pre-clientRequestId-*.sql.gz | psql "$DATABASE_URL"`.

---

## 6) قائمة تحقّق نهائية

- [ ] نسخة احتياطية أُنشئت وحجمها > 0 (الخطوة أ)
- [ ] معاينة الـ SQL أظهرت **فقط** العمودين + الفهرسين، لا شيء هدّام (الخطوة ب)
- [ ] طُبِّق التغيير عبر `deploy.sh api` أو `db push` الجراحي (الخطوة ج)
- [ ] الخدمة `daari-water-api` نشطة، والأعمدة/الفهارس مؤكّدة (الخطوة د)
- [ ] اختبار idempotency الوظيفي: إعادة الإرسال لا تُكرّر البيع/التسليم
- [ ] تحديث [`../PROGRESS.md`](../PROGRESS.md) §7 (رفع تحذير «يتطلّب `prisma db push`») بعد نجاح التطبيق

---

## 7) ملاحظات تشغيلية

- **`npx prisma …` على الـ VPS:** حزمة `prisma` (الـ CLI) في `devDependencies`، والنشر يشغّل `npm ci --omit=dev`،
  فيتكفّل `npx` بجلب الـ CLI عند الحاجة (نفس ما يعتمد عليه `deploy.sh` أصلاً). إن تعذّر الجلب، ثبّت مؤقتاً
  `npm i -D prisma@5` داخل الدليل ثم أعد المحاولة.
- **`migrate deploy` ممنوع هنا:** المستودع بلا مجلّد migrations؛ استخدام `prisma migrate deploy` يُنشئ **صفر جداول**
  ويُعطّل الـ API (تحذير صريح في [deploy.sh:74-78](deploy.sh#L74)). استخدم `db push` حصراً.
- **زمن القفل:** `CREATE UNIQUE INDEX` (غير `CONCURRENTLY`) يقفل الكتابة أثناء البناء. مهمَل على الجداول
  الصغيرة الحالية؛ إن كبرت الجداول مستقبلاً، فكّر ببناء الفهرس يدوياً بـ `CREATE UNIQUE INDEX CONCURRENTLY`
  في نافذة صيانة بدل `db push`.
