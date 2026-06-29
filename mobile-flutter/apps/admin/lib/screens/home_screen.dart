import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets/common.dart';

/// الشاشة الرئيسية للإدارة — لوحة مؤشّرات حيّة (KPIs + لقطة + خطّ نشاط).
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kpis = ref.watch(adminKpisProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('لوحة المعمل'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(adminKpisProvider);
              ref.invalidate(adminInsightsProvider);
              ref.invalidate(adminActivityFeedProvider);
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(adminKpisProvider);
          ref.invalidate(adminInsightsProvider);
          ref.invalidate(adminActivityFeedProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AsyncView<PlantKpis>(
              value: kpis,
              onRetry: () => ref.invalidate(adminKpisProvider),
              data: (k) => _KpiGrid(kpis: k),
            ),
            const SizedBox(height: 20),
            const _SectionTitle('نظرة سريعة'),
            const SizedBox(height: 10),
            const _InsightsCard(),
            const SizedBox(height: 20),
            const _SectionTitle('آخر النشاط'),
            const SizedBox(height: 10),
            const _ActivityList(),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800));
  }
}

class _KpiGrid extends StatelessWidget {
  const _KpiGrid({required this.kpis});
  final PlantKpis kpis;

  @override
  Widget build(BuildContext context) {
    final cards = <Widget>[
      _StatCard(
        icon: Icons.payments_outlined,
        color: AppColors.water600,
        label: 'إيراد اليوم',
        value: Fmt.iqd(kpis.todayRevenueIqd),
      ),
      _StatCard(
        icon: Icons.check_circle_outline,
        color: AppColors.navy600,
        label: 'مكتملة اليوم',
        value: '${kpis.todayCompletedOrders}',
      ),
      _StatCard(
        icon: Icons.hourglass_bottom,
        color: AppColors.warning,
        label: 'قيد الانتظار',
        value: '${kpis.todayPendingOrders}',
      ),
      _StatCard(
        icon: Icons.local_shipping_outlined,
        color: AppColors.turquoise600,
        label: 'سائقون نشطون',
        value: '${kpis.activeDrivers}',
      ),
      _StatCard(
        icon: Icons.water_drop_outlined,
        color: kpis.stockLow ? AppColors.danger : AppColors.navy600,
        label: 'المخزون (لتر)',
        value: '${kpis.stockLevelLiters} / ${kpis.stockCapacityLiters}',
      ),
      _StatCard(
        icon: Icons.speed_outlined,
        color: kpis.overLimit
            ? AppColors.danger
            : (kpis.nearLimit ? AppColors.warning : AppColors.slate),
        label: 'العمليات / الحدّ',
        value: '${kpis.opsThisMonth} / ${kpis.planLimit}',
      ),
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.5,
      children: cards,
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: color, size: 26),
          Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
          Text(label,
              style: const TextStyle(color: AppColors.slate, fontSize: 12)),
        ],
      ),
    );
  }
}

class _InsightsCard extends ConsumerWidget {
  const _InsightsCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final insights = ref.watch(adminInsightsProvider);
    return AsyncView<PlantInsights>(
      value: insights,
      onRetry: () => ref.invalidate(adminInsightsProvider),
      skeleton: const SizedBox(height: 90, child: SkeletonList()),
      data: (i) => SectionCard(
        child: Column(
          children: [
            _InsightRow(
              icon: Icons.emoji_events_outlined,
              label: 'أفضل سائق',
              value: i.bestDriver == null
                  ? '—'
                  : '${i.bestDriver!.fullName} (${i.bestDriver!.completedOrders})',
            ),
            const Divider(height: 18),
            _InsightRow(
              icon: Icons.star_outline,
              label: 'أعلى زبون',
              value: i.topCustomer == null
                  ? '—'
                  : '${i.topCustomer!.fullName} · ${Fmt.iqd(i.topCustomer!.totalSpendIqd)}',
            ),
            const Divider(height: 18),
            _InsightRow(
              icon: Icons.schedule,
              label: 'ساعة الذروة',
              value: i.peakHourToday == null ? '—' : '${i.peakHourToday}:00',
            ),
            const Divider(height: 18),
            _InsightRow(
              icon: i.growthVsLastWeekPct >= 0
                  ? Icons.trending_up
                  : Icons.trending_down,
              label: 'النموّ مقابل الأسبوع الماضي',
              value: '${i.growthVsLastWeekPct.toStringAsFixed(1)}٪',
              valueColor: i.growthVsLastWeekPct >= 0
                  ? AppColors.water600
                  : AppColors.danger,
            ),
          ],
        ),
      ),
    );
  }
}

class _InsightRow extends StatelessWidget {
  const _InsightRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.slate),
        const SizedBox(width: 10),
        Expanded(
            child: Text(label,
                style: const TextStyle(color: AppColors.slate, fontSize: 13))),
        Text(value,
            style: TextStyle(
                fontWeight: FontWeight.w800,
                color: valueColor ?? AppColors.ink)),
      ],
    );
  }
}

class _ActivityList extends ConsumerWidget {
  const _ActivityList();

  static const _icons = {
    ActivityEventKind.order: Icons.receipt_long_outlined,
    ActivityEventKind.lead: Icons.person_add_alt,
    ActivityEventKind.stock: Icons.water_drop_outlined,
    ActivityEventKind.driver: Icons.local_shipping_outlined,
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(adminActivityFeedProvider);
    return AsyncView<List<ActivityEvent>>(
      value: feed,
      onRetry: () => ref.invalidate(adminActivityFeedProvider),
      skeleton: const SizedBox(height: 120, child: SkeletonList()),
      data: (events) {
        if (events.isEmpty) {
          return const EmptyState(
            icon: Icons.inbox_outlined,
            title: 'لا نشاط بعد',
            message: 'ستظهر هنا أحدث الطلبات والعملاء والتغيّرات.',
          );
        }
        return SectionCard(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            children: [
              for (var idx = 0; idx < events.length; idx++) ...[
                if (idx > 0) const Divider(height: 1),
                ListTile(
                  leading: Icon(_icons[events[idx].kind] ?? Icons.circle,
                      color: AppColors.navy600),
                  title: Text(events[idx].title,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(events[idx].subtitle),
                  trailing: Text(Fmt.arabicDate(events[idx].createdAt),
                      style: const TextStyle(
                          color: AppColors.muted, fontSize: 11)),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
