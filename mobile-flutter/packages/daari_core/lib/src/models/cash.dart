import 'parse.dart';

/// ملخّص نقد السائق اليوم — مطابق لـ `CashSummary` في worker/queries.ts.
/// `GET /drivers/me/cash-summary`.
class CashSummary {
  const CashSummary({
    required this.collectedTodayIqd,
    required this.handedOverTodayIqd,
    required this.pendingIqd,
  });

  final int collectedTodayIqd;
  final int handedOverTodayIqd;
  final int pendingIqd;

  factory CashSummary.fromJson(Map<String, dynamic> json) {
    return CashSummary(
      collectedTodayIqd: P.intv(json['collectedTodayIqd']),
      handedOverTodayIqd: P.intv(json['handedOverTodayIqd']),
      pendingIqd: P.intv(json['pendingIqd']),
    );
  }
}

/// حالة تسليم النقد.
enum CashHandoverStatus {
  pending('PENDING', 'بانتظار التأكيد'),
  confirmed('CONFIRMED', 'مؤكَّد');

  const CashHandoverStatus(this.value, this.label);
  final String value;
  final String label;

  static CashHandoverStatus fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return CashHandoverStatus.pending;
  }
}

/// قيد تسليم نقد — مطابق لـ `CashHandover` في worker/queries.ts.
/// `GET /drivers/me/cash-handovers`.
class CashHandover {
  const CashHandover({
    required this.id,
    required this.amountIqd,
    required this.status,
    this.note,
    this.createdAt,
    this.confirmedAt,
  });

  final String id;
  final int amountIqd;
  final CashHandoverStatus status;
  final String? note;
  final DateTime? createdAt;
  final DateTime? confirmedAt;

  factory CashHandover.fromJson(Map<String, dynamic> json) {
    return CashHandover(
      id: P.str(json['id']),
      amountIqd: P.intv(json['amountIqd']),
      status: CashHandoverStatus.fromValue(json['status'] as String?),
      note: json['note'] as String?,
      createdAt: P.date(json['createdAt']),
      confirmedAt: P.date(json['confirmedAt']),
    );
  }
}
