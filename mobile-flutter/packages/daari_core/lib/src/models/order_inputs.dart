import 'dart:math';

/// مُعرِّف طلب عميل (بصيغة UUIDv4) لإزالة التكرار على الخادم. يُولَّد **مرّة**
/// عند الإرسال ويُعاد استخدامه لو حُفظت العملية في الطابور وأُعيد إرسالها —
/// فيرجع الخادم الصفّ الأصلي بدل تسجيل العملية مرّتين (منع مزدوج الشحن).
String newClientRequestId() {
  final r = Random.secure();
  String hex(int len) =>
      List.generate(len, (_) => r.nextInt(16).toRadixString(16)).join();
  // النِبّل 13 = «4» (الإصدار)، والنِبّل 17 من 8..b (المتغيّر).
  return '${hex(8)}-${hex(4)}-4${hex(3)}-'
      '${(8 + r.nextInt(4)).toRadixString(16)}${hex(3)}-${hex(12)}';
}

/// طريقة الدفع — نقدي بحكم العمل، لكن نبقي الاتحاد لتوافق الباك إند.
enum PaymentMethod {
  cash('CASH', 'نقداً'),
  zaincash('ZAINCASH', 'زين كاش'),
  asiaHawala('ASIA_HAWALA', 'آسيا حوالة'),
  credit('CREDIT', 'آجل');

  const PaymentMethod(this.value, this.label);
  final String value;
  final String label;
}

/// سبب استرجاع الخزان.
enum ReclaimReason {
  nonCompliance('NON_COMPLIANCE', 'عدم التزام'),
  maintenance('MAINTENANCE', 'صيانة'),
  customerMoved('CUSTOMER_MOVED', 'الزبون انتقل'),
  customerCancelled('CUSTOMER_CANCELLED', 'الزبون ألغى'),
  tankDamaged('TANK_DAMAGED', 'خزان تالف'),
  other('OTHER', 'أخرى');

  const ReclaimReason(this.value, this.label);
  final String value;
  final String label;
}

/// جسم إكمال طلب — مطابق لـ `CompleteRefillBody` في worker/queries.ts.
class CompleteOrderInput {
  const CompleteOrderInput({
    required this.paymentMethod,
    required this.paidAmountIqd,
    required this.completionLng,
    required this.completionLat,
    this.qrCode,
  });

  final PaymentMethod paymentMethod;
  final int paidAmountIqd;
  final double completionLng;
  final double completionLat;
  final String? qrCode;

  Map<String, dynamic> toJson() {
    final body = <String, dynamic>{
      'paymentMethod': paymentMethod.value,
      'paidAmountIqd': paidAmountIqd,
      'completionLng': completionLng,
      'completionLat': completionLat,
    };
    if (qrCode != null && qrCode!.isNotEmpty) body['qrCode'] = qrCode;
    return body;
  }
}

/// جسم استرجاع خزان — يوسّع إكمال الطلب بسبب الاسترجاع.
class ReclaimInput {
  const ReclaimInput({
    required this.complete,
    required this.reason,
    this.notes,
  });

  final CompleteOrderInput complete;
  final ReclaimReason reason;
  final String? notes;

  Map<String, dynamic> toJson() {
    final body = complete.toJson();
    body['reclaimReason'] = reason.value;
    if (notes != null && notes!.isNotEmpty) body['reclaimNotes'] = notes;
    return body;
  }
}

/// جسم بيع فوري (walk-in) — مطابق لـ `WalkinRefillBody`.
class WalkinRefillInput {
  const WalkinRefillInput({
    required this.customerId,
    required this.paymentMethod,
    required this.paidAmountIqd,
    required this.completionLng,
    required this.completionLat,
    this.walkinLiters,
    this.clientRequestId,
  });

  final String customerId;
  final PaymentMethod paymentMethod;
  final int paidAmountIqd;
  final double completionLng;
  final double completionLat;
  final int? walkinLiters;

  /// مفتاح إزالة التكرار على الخادم (UUID) — يمنع تسجيل البيع مرّتين عند إعادة
  /// إرسال الطابور بعد الاتصال.
  final String? clientRequestId;

  Map<String, dynamic> toJson() {
    final body = <String, dynamic>{
      'customerId': customerId,
      'paymentMethod': paymentMethod.value,
      'paidAmountIqd': paidAmountIqd,
      'completionLng': completionLng,
      'completionLat': completionLat,
    };
    if (walkinLiters != null) body['walkinLiters'] = walkinLiters;
    if (clientRequestId != null) body['clientRequestId'] = clientRequestId;
    return body;
  }
}

/// جسم تسجيل زبون جديد بواسطة السائق — مطابق لـ `RegisterNewCustomerBody`.
class RegisterCustomerInput {
  const RegisterCustomerInput({
    required this.fullName,
    required this.phone,
    required this.district,
    required this.addressLine,
    required this.locationLng,
    required this.locationLat,
    this.notes,
  });

  final String fullName;
  final String phone;
  final String district;
  final String addressLine;
  final double locationLng;
  final double locationLat;
  final String? notes;

  Map<String, dynamic> toJson() {
    final body = <String, dynamic>{
      'fullName': fullName,
      'phone': phone,
      'district': district,
      'addressLine': addressLine,
      'locationLng': locationLng,
      'locationLat': locationLat,
    };
    if (notes != null && notes!.isNotEmpty) body['notes'] = notes;
    return body;
  }
}
