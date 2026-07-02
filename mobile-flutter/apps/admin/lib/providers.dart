import 'dart:async';

import 'package:daari_core/daari_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// مزوّدات الاستعلام لتطبيق الإدارة — تغلّف طبقة `/plant/*` في `daari_core`.
///
/// نمط الاستقصاء (polling): بعد كل جلب ناجح نجدول مؤقّتاً يستدعي
/// `ref.invalidateSelf()` فيُعيد الجلب — بديل `refetchInterval`.
void _poll(Ref ref, Duration every) {
  final timer = Timer(every, ref.invalidateSelf);
  ref.onDispose(timer.cancel);
}

/// مدى تاريخ مختار للتقارير (يوماً كاملاً لكلٍّ من الطرفين). كلاهما null = الافتراضي
/// (يطبّق الخادم نافذته الافتراضية لكلّ تقرير: 7 أيام للإيراد، الشهر للمتصدّرين…).
typedef ReportWindow = ({DateTime? from, DateTime? to});

/// تحويل المدى إلى `from`/`to` بصيغة ISO يفهمها الخادم.
/// `from` = بداية اليوم 00:00، `to` = نهايته 23:59:59 — يجعل الشمول صحيحاً مع
/// نقاط الخادم الحصرية (`lt`) والشاملة (`lte`) على السواء.
extension ReportWindowIso on ReportWindow {
  String? get fromIso => from == null
      ? null
      : DateTime(from!.year, from!.month, from!.day).toIso8601String();
  String? get toIso => to == null
      ? null
      : DateTime(to!.year, to!.month, to!.day, 23, 59, 59).toIso8601String();
}

/// المدى المختار المشترك بين شاشتَي التقارير (الأساسية والمتقدّمة) + التصدير.
/// غير autoDispose ليبقى الاختيار ثابتاً عبر التنقّل بين التبويبات/الشاشات.
final reportWindowProvider =
    StateProvider<ReportWindow>((ref) => (from: null, to: null));

/// مؤشّرات الشاشة الرئيسية — استقصاء كل 30 ثانية.
final adminKpisProvider = FutureProvider.autoDispose<PlantKpis>((ref) async {
  final kpis = await ref.watch(plantRepositoryProvider).kpis();
  _poll(ref, const Duration(seconds: 30));
  return kpis;
});

/// لقطة سريعة (أفضل سائق/زبون، ساعة الذروة، النموّ).
final adminInsightsProvider =
    FutureProvider.autoDispose<PlantInsights>((ref) async {
  return ref.watch(reportsRepositoryProvider).insights();
});

/// خطّ النشاط الموحّد — استقصاء كل 30 ثانية.
final adminActivityFeedProvider =
    FutureProvider.autoDispose<List<ActivityEvent>>((ref) async {
  final feed = await ref.watch(plantRepositoryProvider).activityFeed(limit: 12);
  _poll(ref, const Duration(seconds: 30));
  return feed;
});

/// استهلاك الاشتراك والباقة.
final adminUsageProvider = FutureProvider.autoDispose<PlantUsage>((ref) {
  return ref.watch(plantRepositoryProvider).usage();
});

/// إيراد المدى المختار (الافتراضي: آخر 7 أيام).
final revenue7dProvider = FutureProvider.autoDispose<List<RevenueDay>>((ref) {
  final w = ref.watch(reportWindowProvider);
  return ref
      .watch(reportsRepositoryProvider)
      .revenue7d(from: w.fromIso, to: w.toIso);
});

/// أفضل الزبائن في المدى المختار (الافتراضي: الشهر الحالي).
final topCustomersProvider =
    FutureProvider.autoDispose<List<TopCustomer>>((ref) {
  final w = ref.watch(reportWindowProvider);
  return ref
      .watch(reportsRepositoryProvider)
      .topCustomers(from: w.fromIso, to: w.toIso);
});

/// أفضل السائقين في المدى المختار (الافتراضي: الشهر الحالي).
final topDriversProvider = FutureProvider.autoDispose<List<TopDriver>>((ref) {
  final w = ref.watch(reportWindowProvider);
  return ref
      .watch(reportsRepositoryProvider)
      .topDrivers(from: w.fromIso, to: w.toIso);
});

/// أعضاء الفريق.
final teamListProvider = FutureProvider.autoDispose<List<TeamMember>>((ref) {
  return ref.watch(teamRepositoryProvider).list();
});

/// مخزون المياه.
final stockProvider = FutureProvider.autoDispose<WaterStock>((ref) {
  return ref.watch(plantRepositoryProvider).getStock();
});

/// حملات التخفيض + رصيد المحفظة.
final campaignsProvider = FutureProvider.autoDispose<PromoCampaignList>((ref) {
  return ref.watch(promoRepositoryProvider).listCampaigns();
});

/// سجلّ عمليات البثّ الترويجي.
final blastHistoryProvider =
    FutureProvider.autoDispose<List<PromoNotification>>((ref) {
  return ref.watch(promoRepositoryProvider).blastHistory();
});

/// احتفاظ الأفواج في المدى المختار.
final cohortProvider = FutureProvider.autoDispose<CohortReport>((ref) {
  final w = ref.watch(reportWindowProvider);
  return ref
      .watch(reportsRepositoryProvider)
      .cohort(from: w.fromIso, to: w.toIso);
});

/// توزيع الطلبات حسب ساعة اليوم في المدى المختار.
final peakHoursProvider = FutureProvider.autoDispose<List<PeakHour>>((ref) {
  final w = ref.watch(reportWindowProvider);
  return ref
      .watch(reportsRepositoryProvider)
      .peakHours(from: w.fromIso, to: w.toIso);
});

/// استغلال الخزّانات.
final tankUtilizationProvider =
    FutureProvider.autoDispose<TankUtilization>((ref) {
  return ref.watch(reportsRepositoryProvider).tankUtilization();
});

/// حالة قائمة تهيئة المعمل.
final onboardingStatusProvider =
    FutureProvider.autoDispose<OnboardingStatus>((ref) {
  return ref.watch(onboardingRepositoryProvider).status();
});

/// المواقع الحيّة لسائقي المعمل — استقصاء كل 15 ثانية (كالداشبورد).
final liveDriversProvider =
    FutureProvider.autoDispose<List<LiveDriver>>((ref) async {
  final drivers = await ref.watch(driverRepositoryProvider).liveDrivers();
  _poll(ref, const Duration(seconds: 15));
  return drivers;
});

/// نافذة أداء السائقين المختارة (بالأيام: 30 · 60 · 90).
final driverPerfWindowProvider = StateProvider.autoDispose<int>((ref) => 30);

/// أداء السائقين خلال النافذة المختارة (مرتّب تنازلياً حسب الطلبات المكتملة).
final driverPerformanceProvider =
    FutureProvider.autoDispose<List<DriverPerformance>>((ref) {
  final days = ref.watch(driverPerfWindowProvider);
  return ref.watch(plantRepositoryProvider).driverPerformance(days: days);
});

/// الخريطة الحرارية لتوصيل السائقين حسب المناطق (آخر 30 يوماً).
final driverHeatmapProvider = FutureProvider.autoDispose<DriverHeatmap>((ref) {
  return ref.watch(reportsRepositoryProvider).driverHeatmap();
});

/// متابعة حالة بثّ ترويجي حيّة — يستقصي كل 5 ثوانٍ ما دام في الطابور (QUEUED).
final blastStatusProvider = FutureProvider.autoDispose
    .family<PromoNotification, String>((ref, id) async {
  final blast = await ref.watch(promoRepositoryProvider).blastStatus(id);
  if (blast.status == PromoStatus.queued) {
    _poll(ref, const Duration(seconds: 5));
  }
  return blast;
});
