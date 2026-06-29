import 'enums.dart';
import 'parse.dart';

/// زبون مضمَّن داخل مهمة السائق (مع إحداثيات التوصيل).
class TaskCustomer {
  const TaskCustomer({
    required this.id,
    required this.fullName,
    required this.phone,
    required this.district,
    required this.addressLine,
    this.locationLng,
    this.locationLat,
  });

  final String id;
  final String fullName;
  final String phone;
  final String district;
  final String addressLine;
  final double? locationLng;
  final double? locationLat;

  bool get hasLocation => locationLng != null && locationLat != null;

  factory TaskCustomer.fromJson(Map<String, dynamic> json) {
    return TaskCustomer(
      id: P.str(json['id']),
      fullName: P.str(json['fullName']),
      phone: P.str(json['phone']),
      district: P.str(json['district']),
      addressLine: P.str(json['addressLine']),
      locationLng:
          json['locationLng'] == null ? null : P.dbl(json['locationLng']),
      locationLat:
          json['locationLat'] == null ? null : P.dbl(json['locationLat']),
    );
  }
}

/// خزان مضمَّن داخل المهمة (للمسح/التحقّق).
class TaskTank {
  const TaskTank(
      {required this.id, required this.qrCode, required this.capacity});

  final String id;
  final String qrCode;
  final String capacity;

  factory TaskTank.fromJson(Map<String, dynamic> json) {
    return TaskTank(
      id: P.str(json['id']),
      qrCode: P.str(json['qrCode']),
      capacity: P.str(json['capacity']),
    );
  }
}

/// مهمة السائق — مطابق لـ `DriverTask` في worker/queries.ts.
/// تأتي من `GET /orders/me/today` و `GET /orders/me/available`.
class DriverTask {
  const DriverTask({
    required this.id,
    required this.status,
    required this.kind,
    required this.customer,
    required this.priceIqd,
    this.tank,
    this.scheduledFor,
  });

  final String id;
  final RefillOrderStatus status;
  final RefillOrderKind kind;
  final TaskCustomer customer;
  final int priceIqd;
  final TaskTank? tank;
  final DateTime? scheduledFor;

  factory DriverTask.fromJson(Map<String, dynamic> json) {
    final tankJson = P.obj(json['tank']);
    return DriverTask(
      id: P.str(json['id']),
      status: RefillOrderStatus.fromValue(json['status'] as String?),
      kind: RefillOrderKind.fromValue(json['kind'] as String?),
      customer: TaskCustomer.fromJson(P.obj(json['customer']) ?? const {}),
      priceIqd: P.intv(json['priceIqd']),
      tank: tankJson == null ? null : TaskTank.fromJson(tankJson),
      scheduledFor: P.date(json['scheduledFor']),
    );
  }
}
