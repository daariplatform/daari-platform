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
  });

  final String customerId;
  final PaymentMethod paymentMethod;
  final int paidAmountIqd;
  final double completionLng;
  final double completionLat;
  final int? walkinLiters;

  Map<String, dynamic> toJson() {
    final body = <String, dynamic>{
      'customerId': customerId,
      'paymentMethod': paymentMethod.value,
      'paidAmountIqd': paidAmountIqd,
      'completionLng': completionLng,
      'completionLat': completionLat,
    };
    if (walkinLiters != null) body['walkinLiters'] = walkinLiters;
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
