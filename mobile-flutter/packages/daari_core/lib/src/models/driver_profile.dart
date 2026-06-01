import 'parse.dart';

/// حالة السائق — قيم Prisma الفعلية (schema.prisma: DriverStatus).
/// ملاحظة: نسخة Expo استعملت ONLINE/ON_TRIP/BREAK بالخطأ؛ هنا نطابق الباك إند.
enum DriverStatus {
  offline('OFFLINE', 'غير متصل'),
  available('AVAILABLE', 'متاح'),
  onRoute('ON_ROUTE', 'في مهمة'),
  onBreak('ON_BREAK', 'استراحة');

  const DriverStatus(this.value, this.label);
  final String value;
  final String label;

  bool get isOnShift => this != DriverStatus.offline;

  static DriverStatus fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return DriverStatus.offline;
  }
}

/// ملفّ السائق الكامل — مطابق لـ `DriverProfile` في worker/queries.ts.
/// `GET /drivers/me`.
class DriverProfile {
  const DriverProfile({
    required this.id,
    required this.tenantId,
    required this.userId,
    required this.status,
    required this.isActive,
    this.vehiclePlate,
    this.baseSalaryIqd,
    this.commissionPerRefillIqd,
    this.joinDate,
    this.tanksFullOnVan,
    this.tanksEmptyOnVan,
    this.fullName,
  });

  final String id;
  final String tenantId;
  final String userId;
  final DriverStatus status;
  final bool isActive;
  final String? vehiclePlate;
  final int? baseSalaryIqd;
  final int? commissionPerRefillIqd;
  final DateTime? joinDate;
  final int? tanksFullOnVan;
  final int? tanksEmptyOnVan;
  final String? fullName;

  factory DriverProfile.fromJson(Map<String, dynamic> json) {
    final user = P.obj(json['user']);
    return DriverProfile(
      id: P.str(json['id']),
      tenantId: P.str(json['tenantId']),
      userId: P.str(json['userId']),
      status: DriverStatus.fromValue(json['status'] as String?),
      isActive: json['isActive'] != false,
      vehiclePlate: json['vehiclePlate'] as String?,
      baseSalaryIqd: json['baseSalaryIqd'] == null ? null : P.intv(json['baseSalaryIqd']),
      commissionPerRefillIqd:
          json['commissionPerRefillIqd'] == null ? null : P.intv(json['commissionPerRefillIqd']),
      joinDate: P.date(json['joinDate']),
      tanksFullOnVan: json['tanksFullOnVan'] == null ? null : P.intv(json['tanksFullOnVan']),
      tanksEmptyOnVan: json['tanksEmptyOnVan'] == null ? null : P.intv(json['tanksEmptyOnVan']),
      fullName: (user?['fullName'] ?? json['fullName']) as String?,
    );
  }
}

/// أداء السائق — مطابق لـ `DriverPerf` في worker/queries.ts.
/// `GET /drivers/me/perf?period=week|month`.
class DriverPerf {
  const DriverPerf({
    required this.completedOrders,
    required this.revenueIqd,
    required this.bonusIqd,
    required this.fullName,
    this.avgCompletionMin,
    this.customerRating,
  });

  final int completedOrders;
  final int revenueIqd;
  final int bonusIqd;
  final String fullName;
  final double? avgCompletionMin;
  final double? customerRating;

  factory DriverPerf.fromJson(Map<String, dynamic> json) {
    return DriverPerf(
      completedOrders: P.intv(json['completedOrders']),
      revenueIqd: P.intv(json['revenueIqd']),
      bonusIqd: P.intv(json['bonusIqd']),
      fullName: P.str(json['fullName']),
      avgCompletionMin:
          json['avgCompletionMin'] == null ? null : P.dbl(json['avgCompletionMin']),
      customerRating: json['customerRating'] == null ? null : P.dbl(json['customerRating']),
    );
  }
}
