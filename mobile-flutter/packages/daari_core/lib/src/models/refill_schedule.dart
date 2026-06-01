import 'parse.dart';

/// دورية الجدولة التلقائية.
enum Cadence {
  weekly('WEEKLY', 'كل أسبوع', 7),
  biweekly('BIWEEKLY', 'كل أسبوعين', 14),
  monthly('MONTHLY', 'كل شهر', 30);

  const Cadence(this.value, this.text, this.days);
  final String value;
  final String text;
  final int days;

  static Cadence fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return Cadence.weekly;
  }
}

/// جدولة تعبئة تلقائية — مطابق لـ `RefillSchedule` في features/schedules.ts.
/// `GET /customers/me/schedules`.
class RefillSchedule {
  const RefillSchedule({
    required this.id,
    required this.cadence,
    required this.active,
    this.nextRunAt,
    this.addressId,
    this.createdAt,
  });

  final String id;
  final Cadence cadence;
  final bool active;
  final DateTime? nextRunAt;
  final String? addressId;
  final DateTime? createdAt;

  factory RefillSchedule.fromJson(Map<String, dynamic> json) {
    return RefillSchedule(
      id: P.str(json['id']),
      cadence: Cadence.fromValue(json['cadence'] as String?),
      active: json['active'] != false,
      nextRunAt: P.date(json['nextRunAt']),
      addressId: json['addressId'] as String?,
      createdAt: P.date(json['createdAt']),
    );
  }
}

/// مدخلات إنشاء جدولة. الباك إند (CreateScheduleDto + forbidNonWhitelisted)
/// يقبل فقط cadence + nextRunAt + addressId — لا ترسل `active`.
class ScheduleInput {
  const ScheduleInput({
    required this.cadence,
    required this.nextRunAt,
    this.addressId,
  });

  final Cadence cadence;
  final DateTime nextRunAt;
  final String? addressId;

  Map<String, dynamic> toJson() {
    final body = <String, dynamic>{
      'cadence': cadence.value,
      'nextRunAt': nextRunAt.toUtc().toIso8601String(),
    };
    if (addressId != null) body['addressId'] = addressId;
    return body;
  }
}
