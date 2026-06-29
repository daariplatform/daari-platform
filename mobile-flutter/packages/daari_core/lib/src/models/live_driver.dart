import 'driver_profile.dart' show DriverStatus;
import 'parse.dart';

/// موقع سائق حيّ — `GET /drivers/live` (لوحة الإدارة، استقصاء كل ١٥ ثانية).
/// قد يكون بلا إحداثيات إن لم يبثّ موقعه بعد.
class LiveDriver {
  const LiveDriver({
    required this.id,
    required this.fullName,
    required this.phone,
    this.vehiclePlate,
    required this.status,
    this.currentLat,
    this.currentLng,
    this.lastLocationAt,
    this.lastSeenMinutesAgo,
    required this.inactive,
  });

  final String id;
  final String fullName;
  final String phone;
  final String? vehiclePlate;
  final DriverStatus status;

  final double? currentLat;
  final double? currentLng;
  final DateTime? lastLocationAt;

  /// منذ كم دقيقة آخر تحديث موقع (null إن لم يبثّ قطّ).
  final int? lastSeenMinutesAgo;

  /// في وردية لكن لم يبثّ موقعاً منذ > ٣٠ دقيقة.
  final bool inactive;

  /// هل يملك إحداثيات صالحة للعرض على الخريطة؟
  bool get hasLocation => currentLat != null && currentLng != null;

  factory LiveDriver.fromJson(Map<String, dynamic> json) {
    return LiveDriver(
      id: P.str(json['id']),
      fullName: P.str(json['fullName']),
      phone: P.str(json['phone']),
      vehiclePlate: json['vehiclePlate'] as String?,
      status: DriverStatus.fromValue(json['status'] as String?),
      currentLat: json['currentLat'] == null ? null : P.dbl(json['currentLat']),
      currentLng: json['currentLng'] == null ? null : P.dbl(json['currentLng']),
      lastLocationAt: P.date(json['lastLocationAt']),
      lastSeenMinutesAgo: json['lastSeenMinutesAgo'] == null
          ? null
          : P.intv(json['lastSeenMinutesAgo']),
      inactive: json['inactive'] == true,
    );
  }
}
