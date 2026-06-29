import 'parse.dart';

/// حالة حملة التخفيض — مطابق لـ Prisma `PromoCampaignStatus`.
enum PromoCampaignStatus {
  active('ACTIVE', 'نشطة'),
  pausedByOwner('PAUSED_BY_OWNER', 'موقوفة من المالك'),
  expired('EXPIRED', 'منتهية'),
  outOfBudget('OUT_OF_BUDGET', 'نفد الرصيد');

  const PromoCampaignStatus(this.value, this.label);
  final String value;
  final String label;

  static PromoCampaignStatus fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return PromoCampaignStatus.active;
  }

  /// هل الحملة ما تزال تعمل (نشطة وغير موقوفة)؟
  bool get isRunning => this == PromoCampaignStatus.active;
}

/// حملة تخفيض سعري مموّلة من المحفظة — `GET/POST /plant/promos`، `POST /plant/promos/:id/pause`.
/// تختلف عن [PromoNotification] (بثّ إشعارات لمرّة واحدة).
class PromoCampaign {
  const PromoCampaign({
    required this.id,
    required this.tenantId,
    required this.originalPriceIqd,
    required this.promoPriceIqd,
    required this.costPerOrderIqd,
    this.startAt,
    this.endAt,
    required this.status,
    this.pausedAt,
    this.pausedByUserId,
    required this.walletBalanceAtStartIqd,
    required this.pushSentCount,
    required this.pushFailedCount,
    required this.orderCount,
    required this.totalDeductedIqd,
    required this.totalRevenueIqd,
    required this.createdById,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String tenantId;
  final int originalPriceIqd;
  final int promoPriceIqd;

  /// تكلفة المعمل لكل طلب ضمن الحملة (دائماً ١٠٠٠).
  final int costPerOrderIqd;

  final DateTime? startAt;
  final DateTime? endAt;
  final PromoCampaignStatus status;
  final DateTime? pausedAt;
  final String? pausedByUserId;

  final int walletBalanceAtStartIqd;
  final int pushSentCount;
  final int pushFailedCount;
  final int orderCount;
  final int totalDeductedIqd;
  final int totalRevenueIqd;

  final String createdById;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  int get savingIqd => originalPriceIqd - promoPriceIqd;

  factory PromoCampaign.fromJson(Map<String, dynamic> json) {
    return PromoCampaign(
      id: P.str(json['id']),
      tenantId: P.str(json['tenantId']),
      originalPriceIqd: P.intv(json['originalPriceIqd']),
      promoPriceIqd: P.intv(json['promoPriceIqd']),
      costPerOrderIqd: P.intv(json['costPerOrderIqd']),
      startAt: P.date(json['startAt']),
      endAt: P.date(json['endAt']),
      status: PromoCampaignStatus.fromValue(json['status'] as String?),
      pausedAt: P.date(json['pausedAt']),
      pausedByUserId: json['pausedByUserId'] as String?,
      walletBalanceAtStartIqd: P.intv(json['walletBalanceAtStartIqd']),
      pushSentCount: P.intv(json['pushSentCount']),
      pushFailedCount: P.intv(json['pushFailedCount']),
      orderCount: P.intv(json['orderCount']),
      totalDeductedIqd: P.intv(json['totalDeductedIqd']),
      totalRevenueIqd: P.intv(json['totalRevenueIqd']),
      createdById: P.str(json['createdById']),
      createdAt: P.date(json['createdAt']),
      updatedAt: P.date(json['updatedAt']),
    );
  }
}

/// قائمة الحملات مع رصيد المحفظة الحالي — استجابة `GET /plant/promos`.
class PromoCampaignList {
  const PromoCampaignList({
    required this.walletBalanceIqd,
    required this.campaigns,
  });

  final int walletBalanceIqd;
  final List<PromoCampaign> campaigns;

  factory PromoCampaignList.fromJson(Map<String, dynamic> json) {
    return PromoCampaignList(
      walletBalanceIqd: P.intv(json['walletBalanceIqd']),
      campaigns: P.list(json['campaigns'], PromoCampaign.fromJson),
    );
  }
}
