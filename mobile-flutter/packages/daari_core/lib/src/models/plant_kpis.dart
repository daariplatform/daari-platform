import 'parse.dart';

/// مؤشّرات أداء الشاشة الرئيسية للوحة الإدارة (جولة واحدة للخادم).
/// `GET /plant/kpis` — يجمّع إيراد اليوم والطلبات والسائقين النشطين والمخزون والاستهلاك.
class PlantKpis {
  const PlantKpis({
    required this.todayRevenueIqd,
    required this.todayCompletedOrders,
    required this.todayPendingOrders,
    required this.activeDrivers,
    required this.pendingLeadsCount,
    required this.stockLevelLiters,
    required this.stockCapacityLiters,
    required this.stockLow,
    required this.opsThisMonth,
    required this.planLimit,
    required this.nearLimit,
    required this.overLimit,
  });

  final int todayRevenueIqd;
  final int todayCompletedOrders;
  final int todayPendingOrders;

  /// سائقون شُوهدوا خلال آخر ٣٠ دقيقة.
  final int activeDrivers;

  /// عملاء محتملون بانتظار الموافقة.
  final int pendingLeadsCount;

  final int stockLevelLiters;
  final int stockCapacityLiters;
  final bool stockLow;

  final int opsThisMonth;
  final int planLimit;

  /// بلغ الاستهلاك ٨٠٪ من حدّ الباقة.
  final bool nearLimit;

  /// بلغ الاستهلاك ١٠٠٪ من حدّ الباقة.
  final bool overLimit;

  factory PlantKpis.fromJson(Map<String, dynamic> json) {
    return PlantKpis(
      todayRevenueIqd: P.intv(json['todayRevenueIqd']),
      todayCompletedOrders: P.intv(json['todayCompletedOrders']),
      todayPendingOrders: P.intv(json['todayPendingOrders']),
      activeDrivers: P.intv(json['activeDrivers']),
      pendingLeadsCount: P.intv(json['pendingLeadsCount']),
      stockLevelLiters: P.intv(json['stockLevelLiters']),
      stockCapacityLiters: P.intv(json['stockCapacityLiters']),
      stockLow: json['stockLow'] == true,
      opsThisMonth: P.intv(json['opsThisMonth']),
      planLimit: P.intv(json['planLimit']),
      nearLimit: json['nearLimit'] == true,
      overLimit: json['overLimit'] == true,
    );
  }
}
