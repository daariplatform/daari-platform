import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets/common.dart';

/// أداء السائقين — قائمة مرتّبة تنازلياً حسب الطلبات المكتملة، مع منتقي نافذة
/// زمنية (30 · 60 · 90 يوماً). يقرأ `GET /plant/driver-performance?days=`.
class DriverPerformanceScreen extends ConsumerWidget {
  const DriverPerformanceScreen({super.key});

  static const _windows = {30: '30 يوماً', 60: '60 يوماً', 90: '90 يوماً'};

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final days = ref.watch(driverPerfWindowProvider);
    final value = ref.watch(driverPerformanceProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('أداء السائقين')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(
              children: [
                for (final w in _windows.entries) ...[
                  ChoiceChip(
                    label: Text(w.value),
                    selected: days == w.key,
                    onSelected: (_) => ref
                        .read(driverPerfWindowProvider.notifier)
                        .state = w.key,
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(driverPerformanceProvider),
              child: AsyncView<List<DriverPerformance>>(
                value: value,
                onRetry: () => ref.invalidate(driverPerformanceProvider),
                data: (rows) {
                  if (rows.isEmpty) {
                    return ListView(
                      children: const [
                        SizedBox(height: 80),
                        EmptyState(
                          icon: Icons.local_shipping_outlined,
                          title: 'لا بيانات أداء',
                          message: 'لا طلبات مكتملة ضمن هذه النافذة.',
                        ),
                      ],
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: rows.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) =>
                        _PerfCard(rank: i + 1, perf: rows[i]),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PerfCard extends StatelessWidget {
  const _PerfCard({required this.rank, required this.perf});
  final int rank;
  final DriverPerformance perf;

  @override
  Widget build(BuildContext context) {
    final p = perf;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: AppColors.navy100,
                child: Text('$rank',
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.navy700)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.fullName,
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text(
                      p.vehiclePlate == null || p.vehiclePlate!.isEmpty
                          ? p.phone
                          : '${p.phone} · ${p.vehiclePlate}',
                      style: const TextStyle(
                          color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              _StatusChip(status: p.status),
            ],
          ),
          const Divider(height: 20),
          Row(
            children: [
              _Metric(
                  label: 'طلبات مكتملة', value: '${p.completedOrders}'),
              _Metric(label: 'الإيراد', value: Fmt.iqdShort(p.revenueIqd)),
              _Metric(label: 'الحوافز', value: Fmt.iqdShort(p.bonusEarnedIqd)),
            ],
          ),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style: const TextStyle(
                  fontSize: 16, fontWeight: FontWeight.w900)),
          const SizedBox(height: 2),
          Text(label,
              style: const TextStyle(color: AppColors.slate, fontSize: 11)),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final DriverStatus status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      DriverStatus.available => AppColors.water600,
      DriverStatus.onRoute => AppColors.navy600,
      DriverStatus.onBreak => AppColors.warning,
      DriverStatus.offline => AppColors.muted,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(status.label,
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w800)),
    );
  }
}
