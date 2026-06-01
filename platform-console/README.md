# لوحة مالك المنصّة — Platform Console

لوحة **Ahmed / Phi-Bit** لإدارة كامل المنصّة عبر **كل المعامل** (super-admin). منفصلة تماماً عن لوحة المعمل (`dashboard/`) لعزل أمني.

- **التقنية:** Next.js 14 + Tailwind + recharts + TanStack Query (نسخة من بنية `dashboard/`، نفس آلية المصادقة والـ API client).
- **الدخول:** دور `PLATFORM_ADMIN` فقط — اللوحة بالكامل محجوبة لغيره (حساب `07752222558`).
- **الإنتاج:** https://platform.phi-bit.com · خدمة `platform-console.service` · المنفذ **3011**.

## الصفحات
| المسار | الوظيفة | الـ Endpoints |
|---|---|---|
| `/dashboard` | نظرة عامة: KPIs + إيراد ٦ أشهر + توزيع الخطط + صحة النظام + أبرز المعامل | `GET /platform/overview`, `/platform/health`, `/platform/plants` |
| `/dashboard/plants` | كل المعامل + تعليق/تفعيل + تغيير الخطة | `GET /platform/plants`, `POST /platform/plants/:id/status`, `/plan` |
| `/dashboard/platform/wallets` | محافظ العروض + الشحن | `GET /platform/wallets`, `POST /platform/wallets/topup` |
| `/dashboard/health` | صحة النظام (API/DB) | `GET /platform/health` |

## التشغيل المحلي
```bash
cd platform-console
npm install
npm run dev        # http://localhost:3011
```
يتكلّم مع نفس الـ API (`NEXT_PUBLIC_API_BASE_URL` في `.env.production`).

> ⚠️ قيمة MRR تُحسَب من أسعار خطط افتراضية في `backend/src/platform-admin/platform-admin.service.ts` (`PLAN_PRICE_IQD`) — عدّلها للأسعار الحقيقية.
