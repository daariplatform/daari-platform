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

/// مخزون المياه.
final waterStockProvider = FutureProvider.autoDispose<WaterStock>((ref) {
  return ref.watch(plantRepositoryProvider).getStock();
});

/// إيراد آخر 7 أيام (لشاشة التقارير).
final revenue7dProvider = FutureProvider.autoDispose<List<RevenueDay>>((ref) {
  return ref.watch(reportsRepositoryProvider).revenue7d();
});

/// أفضل الزبائن (الشهر الحالي).
final topCustomersProvider =
    FutureProvider.autoDispose<List<TopCustomer>>((ref) {
  return ref.watch(reportsRepositoryProvider).topCustomers();
});

/// أفضل السائقين (الشهر الحالي).
final topDriversProvider = FutureProvider.autoDispose<List<TopDriver>>((ref) {
  return ref.watch(reportsRepositoryProvider).topDrivers();
});

/// أعضاء الفريق.
final teamListProvider = FutureProvider.autoDispose<List<TeamMember>>((ref) {
  return ref.watch(teamRepositoryProvider).list();
});

/// مخزون المياه (للشاشة المخصّصة — منفصل عن [waterStockProvider] في الرئيسية).
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

/// احتفاظ الأفواج.
final cohortProvider = FutureProvider.autoDispose<CohortReport>((ref) {
  return ref.watch(reportsRepositoryProvider).cohort();
});

/// توزيع الطلبات حسب ساعة اليوم.
final peakHoursProvider = FutureProvider.autoDispose<List<PeakHour>>((ref) {
  return ref.watch(reportsRepositoryProvider).peakHours();
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
