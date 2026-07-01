import 'dart:math' as math;

import 'enums.dart';
import 'order_rating.dart';
import 'parse.dart';

/// مرجع مختصر للسائق داخل الطلب — يطابق `driver: { id, user: { fullName } }`.
/// تفاصيل الطلب تضيف الإحداثيات الحيّة (currentLat/currentLng) لحساب الـ ETA.
class OrderDriverRef {
  const OrderDriverRef({
    required this.id,
    required this.fullName,
    this.phone,
    this.vehiclePlate,
    this.currentLat,
    this.currentLng,
  });

  final String id;
  final String fullName;
  final String? phone;
  final String? vehiclePlate;
  final double? currentLat;
  final double? currentLng;

  bool get hasLocation => currentLat != null && currentLng != null;
  bool get hasPhone => phone != null && phone!.isNotEmpty;

  factory OrderDriverRef.fromJson(Map<String, dynamic> json) {
    final user = P.obj(json['user']);
    final lat = json['currentLat'] ?? json['lastLat'];
    final lng = json['currentLng'] ?? json['lastLng'];
    return OrderDriverRef(
      id: P.str(json['id']),
      fullName: P.str(user?['fullName']),
      phone: (user?['phone'] ?? json['phone']) as String?,
      vehiclePlate: json['vehiclePlate'] as String?,
      currentLat: lat == null ? null : P.dbl(lat),
      currentLng: lng == null ? null : P.dbl(lng),
    );
  }
}

/// طلب تعبئة — مطابق لـ `RefillOrder` في types.ts.
/// يأتي من `GET /orders/me` و `GET /orders/:id` (الأخير يضيف `rating`).
class RefillOrder {
  const RefillOrder({
    required this.id,
    required this.status,
    required this.kind,
    required this.priceIqd,
    required this.paidAmountIqd,
    this.requestedAt,
    this.completedAt,
    this.customerConfirmedAt,
    this.paymentMethod,
    this.notes,
    this.driver,
    this.rating,
    this.deliveryLat,
    this.deliveryLng,
    this.customerName,
  });

  final String id;
  final RefillOrderStatus status;
  final RefillOrderKind kind;
  final int priceIqd;
  final int paidAmountIqd;
  final DateTime? requestedAt;
  final DateTime? completedAt;

  /// وقت تأكيد الزبون للاستلام (null = لم يؤكّد بعد) — يحكم إظهار أزرار التأكيد/الإبلاغ.
  final DateTime? customerConfirmedAt;

  /// طريقة الدفع (مثل `CASH`)؛ null إن لم تُرسَل.
  final String? paymentMethod;

  /// ملاحظات الطلب (اختيارية).
  final String? notes;

  final OrderDriverRef? driver;

  /// تقييم الزبون (يأتي فقط مع تفاصيل الطلب، null إن لم يُقيَّم بعد).
  final OrderRating? rating;

  /// إحداثيات وجهة التوصيل (لحساب الـ ETA في شاشة التتبّع).
  final double? deliveryLat;
  final double? deliveryLng;

  /// اسم الزبون (من `customer.fullName` على نقاط السجلّ/التفاصيل)؛ null للطلبات
  /// بلا زبون مرتبط أو حين لا تُرجِعه النقطة. (الخادم يضمّ `customer` في
  /// `/orders/me/history` — تحقّق خصومي: `Customer.fullName` حقل scalar.)
  final String? customerName;

  bool get isRated => rating != null;

  /// تقدير زمن الوصول بالدقائق من موقع السائق الحالي (سرعة 22 كم/س، حدّ 3 دقائق).
  /// يرجع null إن لم تتوفّر إحداثيات السائق/الوجهة.
  int? get etaMinutes {
    final dLat = deliveryLat, dLng = deliveryLng;
    final drv = driver;
    if (dLat == null || dLng == null || drv == null || !drv.hasLocation) {
      return null;
    }
    final km = _haversineKm(drv.currentLat!, drv.currentLng!, dLat, dLng);
    final minutes = (km / 22 * 60).round() + 3;
    return minutes < 3 ? 3 : minutes;
  }

  static double _haversineKm(
      double aLat, double aLng, double bLat, double bLng,) {
    const r = 6371.0;
    double toRad(double d) => d * math.pi / 180;
    final dLat = toRad(bLat - aLat);
    final dLng = toRad(bLng - aLng);
    final s = math.pow(math.sin(dLat / 2), 2) +
        math.cos(toRad(aLat)) *
            math.cos(toRad(bLat)) *
            math.pow(math.sin(dLng / 2), 2);
    return 2 * r * math.asin(math.sqrt(s.toDouble()));
  }

  factory RefillOrder.fromJson(Map<String, dynamic> json) {
    final driverJson = P.obj(json['driver']);
    final ratingJson = P.obj(json['rating']);
    final customer = P.obj(json['customer']);
    final dLat = json['deliveryLat'] ?? customer?['locationLat'];
    final dLng = json['deliveryLng'] ?? customer?['locationLng'];
    return RefillOrder(
      id: P.str(json['id']),
      status: RefillOrderStatus.fromValue(json['status'] as String?),
      kind: RefillOrderKind.fromValue(json['kind'] as String?),
      priceIqd: P.intv(json['priceIqd']),
      paidAmountIqd: P.intv(json['paidAmountIqd']),
      requestedAt: P.date(json['requestedAt']),
      completedAt: P.date(json['completedAt']),
      customerConfirmedAt: P.date(json['customerConfirmedAt']),
      paymentMethod: json['paymentMethod'] as String?,
      notes: json['notes'] as String?,
      driver: driverJson == null ? null : OrderDriverRef.fromJson(driverJson),
      rating: ratingJson == null ? null : OrderRating.fromJson(ratingJson),
      deliveryLat: dLat == null ? null : P.dbl(dLat),
      deliveryLng: dLng == null ? null : P.dbl(dLng),
      customerName: (customer?['fullName'] as String?)?.trim(),
    );
  }
}
