import 'parse.dart';

/// معمل قريب — مطابق لـ `NearestPlant` في types.ts.
/// يأتي من `GET /tenants/nearest` و `GET /tenants/discover` (شاشة التسجيل).
class NearestPlant {
  const NearestPlant({
    required this.id,
    required this.name,
    required this.city,
    required this.distanceKm,
    required this.coverageKm,
    required this.refillPriceIqd,
  });

  final String id;
  final String name;
  final String city;
  final double distanceKm;
  final double coverageKm;

  /// سعر التعبئة لدى المعمل (افتراضي الخادم 1000 د.ع).
  final int refillPriceIqd;

  /// هل الزبون داخل نطاق تغطية المعمل؟
  bool get isWithinCoverage => distanceKm <= coverageKm;

  factory NearestPlant.fromJson(Map<String, dynamic> json) {
    return NearestPlant(
      id: P.str(json['id']),
      name: P.str(json['name']),
      city: P.str(json['city']),
      distanceKm: P.dbl(json['distanceKm']),
      coverageKm: P.dbl(json['coverageKm']),
      refillPriceIqd: P.intv(json['refillPriceIqd'], 1000),
    );
  }
}
