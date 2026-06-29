import 'parse.dart';

/// نماذج تقارير الإدارة — تخدم نقاط `GET /plant/reports/*`.

/// يوم إيراد — `GET /plant/reports/revenue-7d` (سلسلة زمنية، فجوات مملوءة بصفر).
class RevenueDay {
  const RevenueDay({
    required this.date,
    required this.revenueIqd,
    required this.orders,
  });

  /// تاريخ ISO (YYYY-MM-DD).
  final String date;
  final int revenueIqd;
  final int orders;

  factory RevenueDay.fromJson(Map<String, dynamic> json) {
    return RevenueDay(
      date: P.str(json['date']),
      revenueIqd: P.intv(json['revenueIqd']),
      orders: P.intv(json['orders']),
    );
  }
}

/// زبون في قائمة الأعلى إنفاقاً — `GET /plant/reports/top-customers`.
class TopCustomer {
  const TopCustomer({
    required this.customerId,
    required this.fullName,
    this.phone,
    this.district,
    required this.spentIqd,
    required this.orderCount,
  });

  final String customerId;
  final String fullName;
  final String? phone;
  final String? district;
  final int spentIqd;
  final int orderCount;

  factory TopCustomer.fromJson(Map<String, dynamic> json) {
    return TopCustomer(
      customerId: P.str(json['customerId']),
      fullName: P.str(json['fullName']),
      phone: json['phone'] as String?,
      district: json['district'] as String?,
      spentIqd: P.intv(json['spentIqd']),
      orderCount: P.intv(json['orderCount']),
    );
  }
}

/// سائق في قائمة الأعلى أداءً — `GET /plant/reports/top-drivers`.
class TopDriver {
  const TopDriver({
    required this.driverId,
    required this.fullName,
    this.phone,
    this.vehiclePlate,
    required this.completedOrders,
    required this.revenueIqd,
    required this.bonusIqd,
  });

  final String driverId;
  final String fullName;
  final String? phone;
  final String? vehiclePlate;
  final int completedOrders;
  final int revenueIqd;
  final int bonusIqd;

  factory TopDriver.fromJson(Map<String, dynamic> json) {
    return TopDriver(
      driverId: P.str(json['driverId']),
      fullName: P.str(json['fullName']),
      phone: json['phone'] as String?,
      vehiclePlate: json['vehiclePlate'] as String?,
      completedOrders: P.intv(json['completedOrders']),
      revenueIqd: P.intv(json['revenueIqd']),
      bonusIqd: P.intv(json['bonusIqd']),
    );
  }
}

/// أفضل سائق ضمن لقطة [PlantInsights].
class InsightDriver {
  const InsightDriver({
    required this.id,
    required this.fullName,
    required this.completedOrders,
  });

  final String id;
  final String fullName;
  final int completedOrders;

  factory InsightDriver.fromJson(Map<String, dynamic> json) {
    return InsightDriver(
      id: P.str(json['id']),
      fullName: P.str(json['fullName']),
      completedOrders: P.intv(json['completedOrders']),
    );
  }
}

/// أعلى زبون ضمن لقطة [PlantInsights].
class InsightCustomer {
  const InsightCustomer({
    required this.id,
    required this.fullName,
    required this.totalSpendIqd,
  });

  final String id;
  final String fullName;
  final int totalSpendIqd;

  factory InsightCustomer.fromJson(Map<String, dynamic> json) {
    return InsightCustomer(
      id: P.str(json['id']),
      fullName: P.str(json['fullName']),
      totalSpendIqd: P.intv(json['totalSpendIqd']),
    );
  }
}

/// لقطة سريعة للشاشة الرئيسية — `GET /plant/reports/insights`.
class PlantInsights {
  const PlantInsights({
    this.bestDriver,
    this.topCustomer,
    this.peakHourToday,
    required this.growthVsLastWeekPct,
  });

  final InsightDriver? bestDriver;
  final InsightCustomer? topCustomer;

  /// أكثر ساعات اليوم ازدحاماً (٠–٢٣)، أو null عند قلّة الطلبات.
  final int? peakHourToday;

  /// نموّ مقارنةً بالأسبوع الماضي (٪).
  final double growthVsLastWeekPct;

  factory PlantInsights.fromJson(Map<String, dynamic> json) {
    final driver = P.obj(json['bestDriver']);
    final customer = P.obj(json['topCustomer']);
    return PlantInsights(
      bestDriver: driver == null ? null : InsightDriver.fromJson(driver),
      topCustomer: customer == null ? null : InsightCustomer.fromJson(customer),
      peakHourToday:
          json['peakHourToday'] == null ? null : P.intv(json['peakHourToday']),
      growthVsLastWeekPct: P.dbl(json['growthVsLastWeekPct']),
    );
  }
}

/// توزيع الطلبات حسب ساعة اليوم — `GET /plant/reports/peak-hours` (٢٤ خانة دائماً).
class PeakHour {
  const PeakHour({
    required this.hour,
    required this.orderCount,
  });

  /// الساعة ٠–٢٣ بتوقيت الخادم (بغداد).
  final int hour;
  final int orderCount;

  factory PeakHour.fromJson(Map<String, dynamic> json) {
    return PeakHour(
      hour: P.intv(json['hour']),
      orderCount: P.intv(json['orderCount']),
    );
  }
}

/// صفّ احتفاظ لفوج تسجيل — جزء من [CohortReport].
class CohortRow {
  const CohortRow({
    required this.cohortMonth,
    required this.size,
    required this.retention,
  });

  /// شهر الفوج (YYYY-MM).
  final String cohortMonth;
  final int size;

  /// نسب الاحتفاظ (٠–١٠٠) لكل شهر لاحق؛ الشهر ٠ = ١٠٠ إن كان الحجم > ٠.
  final List<double> retention;

  factory CohortRow.fromJson(Map<String, dynamic> json) {
    final raw = json['retention'];
    final retention = raw is List
        ? raw.map((e) => P.dbl(e)).toList(growable: false)
        : const <double>[];
    return CohortRow(
      cohortMonth: P.str(json['cohortMonth']),
      size: P.intv(json['size']),
      retention: retention,
    );
  }
}

/// تقرير احتفاظ الأفواج — `GET /plant/reports/cohort`.
class CohortReport {
  const CohortReport({required this.cohorts});

  final List<CohortRow> cohorts;

  factory CohortReport.fromJson(Map<String, dynamic> json) {
    return CohortReport(
      cohorts: P.list(json['cohorts'], CohortRow.fromJson),
    );
  }
}

/// منطقة خدمها سائق — جزء من [DriverHeatmapRow].
class HeatmapDistrict {
  const HeatmapDistrict({
    required this.district,
    required this.orderCount,
    required this.revenueIqd,
  });

  final String district;
  final int orderCount;
  final int revenueIqd;

  factory HeatmapDistrict.fromJson(Map<String, dynamic> json) {
    return HeatmapDistrict(
      district: P.str(json['district']),
      orderCount: P.intv(json['orderCount']),
      revenueIqd: P.intv(json['revenueIqd']),
    );
  }
}

/// صفّ خريطة حرارية لسائق — جزء من [DriverHeatmap].
class DriverHeatmapRow {
  const DriverHeatmapRow({
    required this.driverId,
    required this.fullName,
    required this.districts,
  });

  final String driverId;
  final String fullName;

  /// المناطق مرتّبة تنازلياً حسب عدد الطلبات.
  final List<HeatmapDistrict> districts;

  factory DriverHeatmapRow.fromJson(Map<String, dynamic> json) {
    return DriverHeatmapRow(
      driverId: P.str(json['driverId']),
      fullName: P.str(json['fullName']),
      districts: P.list(json['districts'], HeatmapDistrict.fromJson),
    );
  }
}

/// خريطة توصيل السائقين الحرارية — `GET /plant/reports/driver-heatmap`.
class DriverHeatmap {
  const DriverHeatmap({required this.drivers});

  final List<DriverHeatmapRow> drivers;

  factory DriverHeatmap.fromJson(Map<String, dynamic> json) {
    return DriverHeatmap(
      drivers: P.list(json['drivers'], DriverHeatmapRow.fromJson),
    );
  }
}

/// صفّ استغلال خزان — جزء من [TankUtilization].
class TankUtilizationRow {
  const TankUtilizationRow({
    required this.tankId,
    required this.qrCode,
    required this.serialNumber,
    required this.capacity,
    required this.status,
    required this.customerId,
    this.daysSinceInstall,
    this.daysSinceLastRefill,
    required this.refills30d,
    required this.bucket,
  });

  final String tankId;
  final String qrCode;
  final String serialNumber;
  final String capacity;
  final String status;
  final String customerId;
  final int? daysSinceInstall;
  final int? daysSinceLastRefill;
  final int refills30d;

  /// التصنيف: `active` (>٢ تعبئة/٣٠ يوم) · `light` (١–٢) · `idle` (٠).
  final String bucket;

  factory TankUtilizationRow.fromJson(Map<String, dynamic> json) {
    return TankUtilizationRow(
      tankId: P.str(json['tankId']),
      qrCode: P.str(json['qrCode']),
      serialNumber: P.str(json['serialNumber']),
      capacity: P.str(json['capacity']),
      status: P.str(json['status']),
      customerId: P.str(json['customerId']),
      daysSinceInstall: json['daysSinceInstall'] == null
          ? null
          : P.intv(json['daysSinceInstall']),
      daysSinceLastRefill: json['daysSinceLastRefill'] == null
          ? null
          : P.intv(json['daysSinceLastRefill']),
      refills30d: P.intv(json['refills30d']),
      bucket: P.str(json['bucket']),
    );
  }
}

/// استغلال الخزّانات — `GET /plant/reports/tank-utilization`.
class TankUtilization {
  const TankUtilization({
    required this.tanks,
    required this.activeCount,
    required this.lightCount,
    required this.idleCount,
    required this.avgRefillsPerActiveTank,
  });

  final List<TankUtilizationRow> tanks;
  final int activeCount;
  final int lightCount;
  final int idleCount;
  final double avgRefillsPerActiveTank;

  factory TankUtilization.fromJson(Map<String, dynamic> json) {
    return TankUtilization(
      tanks: P.list(json['tanks'], TankUtilizationRow.fromJson),
      activeCount: P.intv(json['activeCount']),
      lightCount: P.intv(json['lightCount']),
      idleCount: P.intv(json['idleCount']),
      avgRefillsPerActiveTank: P.dbl(json['avgRefillsPerActiveTank']),
    );
  }
}

/// نتيجة تصدير تقرير (PDF/Excel) — `POST /plant/reports/export`.
class ReportExport {
  const ReportExport({
    required this.url,
    this.expiresAt,
  });

  /// رابط عام للملف (صالح ٢٤ ساعة).
  final String url;
  final DateTime? expiresAt;

  factory ReportExport.fromJson(Map<String, dynamic> json) {
    return ReportExport(
      url: P.str(json['url']),
      expiresAt: P.date(json['expiresAt']),
    );
  }
}
