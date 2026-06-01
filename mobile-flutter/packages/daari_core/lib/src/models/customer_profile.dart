import 'enums.dart';
import 'parse.dart';
import 'tank.dart';

/// ملفّ الزبون — مطابق لـ `CustomerProfile` في types.ts (نسخة الزبون،
/// التي تتضمّن `refillPriceIqd`). يأتي من `GET /customers/me`.
class CustomerProfile {
  const CustomerProfile({
    required this.id,
    required this.fullName,
    required this.phone,
    required this.district,
    required this.addressLine,
    required this.status,
    required this.totalRefills,
    required this.balanceIqd,
    required this.tanks,
    required this.refillPriceIqd,
    this.loyaltyPoints = 0,
    this.lastRefillAt,
    this.acceptedTermsAt,
    this.movedAt,
  });

  final String id;
  final String fullName;
  final String phone;
  final String district;
  final String addressLine;
  final CustomerStatus status;
  final int totalRefills;

  /// رصيد الزبون: موجب = دائن، سالب = مدين.
  final int balanceIqd;
  final List<Tank> tanks;

  /// سعر التعبئة الحالي (من `Tenant.refillPriceIqd`).
  final int refillPriceIqd;

  /// نقاط الولاء (قد يحذفها الباك إند → الافتراضي 0).
  final int loyaltyPoints;
  final DateTime? lastRefillAt;
  final DateTime? acceptedTermsAt;
  final DateTime? movedAt;

  bool get hasAcceptedTerms => acceptedTermsAt != null;

  factory CustomerProfile.fromJson(Map<String, dynamic> json) {
    return CustomerProfile(
      id: P.str(json['id']),
      fullName: P.str(json['fullName']),
      phone: P.str(json['phone']),
      district: P.str(json['district']),
      addressLine: P.str(json['addressLine']),
      status: CustomerStatus.fromValue(json['status'] as String?),
      totalRefills: P.intv(json['totalRefills']),
      balanceIqd: P.intv(json['balanceIqd']),
      tanks: P.list(json['tanks'], Tank.fromJson),
      refillPriceIqd: P.intv(json['refillPriceIqd']),
      loyaltyPoints: P.intv(json['loyaltyPoints']),
      lastRefillAt: P.date(json['lastRefillAt']),
      acceptedTermsAt: P.date(json['acceptedTermsAt']),
      movedAt: P.date(json['movedAt']),
    );
  }
}
