# مرجع API — Maa Platform

كل المسارات تبدأ بـ `/api/v1`. التوثيق التفاعلي مولّد آلياً عبر Swagger على `/api/docs`.

## المصادقة

```
POST /auth/login                      Body: { phone, password }     ← السائق + المعمل
POST /auth/login/otp                  Body: { phone, otp, fullName? } ← الزبون فقط (يُنشَأ كـ CUSTOMER)
POST /auth/refresh                    Body: { refreshToken }
POST /auth/logout                     Body: { refreshToken }
GET  /auth/me                         يعيد { id, phone, role, tenantId, capabilities }
```

كل المسارات الأخرى تتطلب `Authorization: Bearer <accessToken>`.

OTP في وضع التطوير = آخر ٦ أرقام من الهاتف. استبدله بـ provider حقيقي قبل الإطلاق.

### استجابة تسجيل الدخول

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "...",
  "expiresIn": 900,
  "capabilities": ["driver", "vendor"]
}
```

`capabilities` تحدّد ما يستطيع المستخدم فعله — التطبيق يستخدمها لاختيار الواجهة.

## المعمل (Tenant)

```
POST /tenants/register                Body: { plantName, city, ownerFullName, ownerPhone, ownerPassword, plan? }
GET  /tenants/me/stats                إحصاءات لوحة المعمل
```

## الخزانات

```
POST /tanks                           إنشاء خزان جديد
GET  /tanks?status=                   قائمة (مع فلتر الحالة)
GET  /tanks/inventory                 جرد مجمّع حسب الحالة
GET  /tanks/qr/:code                  بحث بـ QR (للسائق)
POST /tanks/:id/assign                Body: { customerId }
POST /tanks/:id/reclaim
```

## الزبائن

```
POST /customers                       Body: { fullName, phone, district, addressLine, ... }
GET  /customers?status=&district=&search=
GET  /customers/:id                   تفاصيل + آخر ١٠ طلبات
```

## السائقون

```
POST /drivers                         Body: { fullName, phone, password, vehiclePlate?, ... }
GET  /drivers
GET  /drivers/me                      ملف السائق (للسائق نفسه)
POST /drivers/me/location             Body: { lng, lat }
POST /drivers/me/status               Body: { status: AVAILABLE|ON_ROUTE|OFFLINE|ON_BREAK }
GET  /drivers/:id/performance?from=&to=
```

## الطلبات

```
POST /orders                          Body: { customerId, tankId?, kind?, scheduledFor? }
GET  /orders?status=&driverId=
POST /orders/:id/assign               Body: { driverId }
GET  /orders/me/today                 (للسائق) قائمة اليوم
POST /orders/:id/start                (السائق بدأ التحرّك)
POST /orders/:id/complete             Body: { qrCode?, paymentMethod, paidAmountIqd, proofPhotoUrl? }
POST /orders/:id/cancel               Body: { reason }
```

## المحاسبة

```
POST /accounting/expenses             Body: { category, amountIqd, description, ... }
GET  /accounting/expenses?from=&to=&category=
POST /accounting/salaries/compute     Body: { driverId, periodStart, periodEnd, bonusIqd?, deductionIqd? }
POST /accounting/salaries/:id/pay
GET  /accounting/pnl?from=&to=        تقرير الربح والخسارة
```

## البائعون المتجولون

```
POST /vendors/me/register             أي مستخدم مسجّل دخول (حتى لو سائق)
                                      Body: { vehicleType, vehiclePlate?, maxCapacityLiters? }
POST /vendors/:id/approve             platform_admin فقط
POST /vendors/me/availability         capability: vendor
POST /vendors/deliveries              capability: customer
GET  /vendors/deliveries/:id/candidates  capability: vendor | platform_admin
POST /vendors/deliveries/:id/accept   capability: vendor
POST /vendors/deliveries/:id/delivered capability: vendor
GET  /vendors/me/wallet               capability: vendor
```

> سائق معمل يستطيع أن يكون بائعاً أيضاً: يستدعي `POST /vendors/me/register` بـ JWT الخاص به، يحصل على PENDING_APPROVAL، وبعد موافقة platform_admin تُضاف `vendor` إلى قدراته في الـ JWT التالي.

## التنبيهات

تُرسَل تلقائياً يومياً 9 صباحاً عبر cron داخلي:
- زبون لم يعبّأ ٢٥+ يوم → REFILL_REMINDER (WhatsApp + SMS fallback)
- زبون لم يعبّأ ٣٥+ يوم → REFILL_WARNING (تنبيه سحب الخزان)

كل رسالة تُسجَّل في `NotificationLog` لمراجعتها من اللوحة.
