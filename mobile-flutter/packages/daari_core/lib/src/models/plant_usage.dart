import 'parse.dart';

/// باقة الاشتراك — مطابق لـ Prisma `SubscriptionPlan`.
enum SubscriptionPlan {
  starter('STARTER', 'المبتدئة'),
  pro('PRO', 'الاحترافية'),
  business('BUSINESS', 'الأعمال'),
  enterprise('ENTERPRISE', 'المؤسّسات');

  const SubscriptionPlan(this.value, this.label);
  final String value;
  final String label;

  static SubscriptionPlan fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return SubscriptionPlan.starter;
  }
}

/// حالة المستأجِر — مطابق لـ Prisma `TenantStatus`.
enum TenantStatus {
  trial('TRIAL', 'تجريبي'),
  active('ACTIVE', 'نشط'),
  suspended('SUSPENDED', 'موقوف'),
  cancelled('CANCELLED', 'ملغى');

  const TenantStatus(this.value, this.label);
  final String value;
  final String label;

  static TenantStatus fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return TenantStatus.active;
  }
}

/// استهلاك الاشتراك والباقة الحالية — `GET /plant/usage`.
class PlantUsage {
  const PlantUsage({
    required this.plan,
    required this.status,
    this.trialEndsAt,
    required this.opsThisMonth,
    required this.opsLimit,
    required this.monthlyPriceIqd,
    required this.usagePercent,
    required this.nearLimit,
    required this.overLimit,
  });

  final SubscriptionPlan plan;
  final TenantStatus status;
  final DateTime? trialEndsAt;

  /// عدد العمليات (الطلبات المكتملة) هذا الشهر.
  final int opsThisMonth;
  final int opsLimit;
  final int monthlyPriceIqd;

  /// نسبة الاستهلاك من الحدّ (٠–١٠٠).
  final int usagePercent;

  /// بلغ الاستهلاك ٨٠٪ من الحدّ.
  final bool nearLimit;

  /// بلغ الاستهلاك ١٠٠٪ من الحدّ.
  final bool overLimit;

  factory PlantUsage.fromJson(Map<String, dynamic> json) {
    return PlantUsage(
      plan: SubscriptionPlan.fromValue(json['plan'] as String?),
      status: TenantStatus.fromValue(json['status'] as String?),
      trialEndsAt: P.date(json['trialEndsAt']),
      opsThisMonth: P.intv(json['opsThisMonth']),
      opsLimit: P.intv(json['opsLimit']),
      monthlyPriceIqd: P.intv(json['monthlyPriceIqd']),
      usagePercent: P.intv(json['usagePercent']),
      nearLimit: json['nearLimit'] == true,
      overLimit: json['overLimit'] == true,
    );
  }
}
