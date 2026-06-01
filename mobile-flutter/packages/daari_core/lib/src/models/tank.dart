import 'enums.dart';
import 'parse.dart';

/// خزان مياه — مطابق لـ `Tank` في types.ts.
class Tank {
  const Tank({
    required this.id,
    required this.serialNumber,
    required this.qrCode,
    required this.capacity,
    required this.status,
    this.lastRefillAt,
  });

  final String id;
  final String serialNumber;
  final String qrCode;
  final TankCapacity capacity;
  final TankStatus status;
  final DateTime? lastRefillAt;

  factory Tank.fromJson(Map<String, dynamic> json) {
    return Tank(
      id: P.str(json['id']),
      serialNumber: P.str(json['serialNumber']),
      qrCode: P.str(json['qrCode']),
      capacity: TankCapacity.fromValue(json['capacity'] as String?),
      status: TankStatus.fromValue(json['status'] as String?),
      lastRefillAt: P.date(json['lastRefillAt']),
    );
  }
}
