import 'parse.dart';

/// مخزون المياه للمعمل — `GET /plant/stock` و `POST /plant/stock`.
/// يُنشأ صفّ افتراضي تلقائياً عند أوّل قراءة إن لم يوجد.
class WaterStock {
  const WaterStock({
    required this.id,
    required this.tenantId,
    required this.currentLiters,
    required this.capacityLiters,
    required this.lowThresholdLiters,
    this.lastTopUpAt,
    this.lastTopUpLiters,
    this.updatedAt,
    this.createdAt,
  });

  final String id;
  final String tenantId;
  final int currentLiters;
  final int capacityLiters;

  /// حدّ التنبيه عند انخفاض المخزون.
  final int lowThresholdLiters;

  final DateTime? lastTopUpAt;
  final int? lastTopUpLiters;
  final DateTime? updatedAt;
  final DateTime? createdAt;

  bool get isLow => currentLiters <= lowThresholdLiters;

  /// نسبة الامتلاء (٠–١٠٠).
  int get fillPercent =>
      capacityLiters <= 0 ? 0 : (currentLiters * 100 / capacityLiters).round();

  factory WaterStock.fromJson(Map<String, dynamic> json) {
    return WaterStock(
      id: P.str(json['id']),
      tenantId: P.str(json['tenantId']),
      currentLiters: P.intv(json['currentLiters']),
      capacityLiters: P.intv(json['capacityLiters']),
      lowThresholdLiters: P.intv(json['lowThresholdLiters']),
      lastTopUpAt: P.date(json['lastTopUpAt']),
      lastTopUpLiters: json['lastTopUpLiters'] == null
          ? null
          : P.intv(json['lastTopUpLiters']),
      updatedAt: P.date(json['updatedAt']),
      createdAt: P.date(json['createdAt']),
    );
  }
}
