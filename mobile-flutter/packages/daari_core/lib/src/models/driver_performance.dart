import 'driver_profile.dart' show DriverStatus;
import 'parse.dart';

/// أداء سائق ضمن نافذة زمنية — `GET /plant/driver-performance?days=`.
/// مرتّبة تنازلياً حسب عدد الطلبات المكتملة.
class DriverPerformance {
  const DriverPerformance({
    required this.driverId,
    required this.fullName,
    required this.phone,
    this.vehiclePlate,
    required this.status,
    required this.completedOrders,
    required this.revenueIqd,
    required this.bonusEarnedIqd,
    required this.baseSalaryIqd,
    required this.windowDays,
  });

  final String driverId;
  final String fullName;
  final String phone;
  final String? vehiclePlate;
  final DriverStatus status;
  final int completedOrders;
  final int revenueIqd;
  final int bonusEarnedIqd;
  final int baseSalaryIqd;

  /// طول النافذة بالأيام (افتراضي ٣٠، أقصى ٩٠).
  final int windowDays;

  factory DriverPerformance.fromJson(Map<String, dynamic> json) {
    return DriverPerformance(
      driverId: P.str(json['driverId']),
      fullName: P.str(json['fullName']),
      phone: P.str(json['phone']),
      vehiclePlate: json['vehiclePlate'] as String?,
      status: DriverStatus.fromValue(json['status'] as String?),
      completedOrders: P.intv(json['completedOrders']),
      revenueIqd: P.intv(json['revenueIqd']),
      bonusEarnedIqd: P.intv(json['bonusEarnedIqd']),
      baseSalaryIqd: P.intv(json['baseSalaryIqd']),
      windowDays: P.intv(json['windowDays']),
    );
  }
}
