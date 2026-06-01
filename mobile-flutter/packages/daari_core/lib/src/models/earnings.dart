import 'enums.dart';
import 'parse.dart';

/// يوم أرباح — سلسلة يومية للرسم البياني. مطابق لـ `EarningsDay`.
/// `GET /drivers/me/earnings?period=week|month`.
class EarningsDay {
  const EarningsDay({
    required this.date,
    required this.completedOrders,
    required this.commissionIqd,
    required this.bonusIqd,
  });

  /// تاريخ ISO (YYYY-MM-DD).
  final String date;
  final int completedOrders;
  final int commissionIqd;
  final int bonusIqd;

  int get totalIqd => commissionIqd + bonusIqd;

  factory EarningsDay.fromJson(Map<String, dynamic> json) {
    return EarningsDay(
      date: P.str(json['date']),
      completedOrders: P.intv(json['completedOrders']),
      commissionIqd: P.intv(json['commissionIqd']),
      bonusIqd: P.intv(json['bonusIqd']),
    );
  }
}

/// ملخّص الوردية — مطابق لـ `ShiftSummary`.
/// `GET /drivers/me/shift-summary`.
class ShiftSummary {
  const ShiftSummary({
    required this.completedOrders,
    required this.collectedCashIqd,
    required this.byKind,
  });

  final int completedOrders;
  final int collectedCashIqd;

  /// عدد المهام لكل نوع (REFILL / TANK_DELIVERY / TANK_RECLAIM).
  final Map<RefillOrderKind, int> byKind;

  factory ShiftSummary.fromJson(Map<String, dynamic> json) {
    final raw = P.obj(json['byKind']) ?? const {};
    final byKind = <RefillOrderKind, int>{};
    raw.forEach((key, value) {
      final kind = RefillOrderKind.fromValue(key);
      byKind[kind] = P.intv(value);
    });
    return ShiftSummary(
      completedOrders: P.intv(json['completedOrders']),
      collectedCashIqd: P.intv(json['collectedCashIqd']),
      byKind: byKind,
    );
  }
}
