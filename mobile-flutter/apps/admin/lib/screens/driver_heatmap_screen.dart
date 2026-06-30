import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets/common.dart';

/// الخريطة الحرارية للسائقين — لكلّ سائق المناطق التي خدمها مع كثافة الطلبات
/// والإيراد. يقرأ `GET /plant/reports/driver-heatmap` (آخر 30 يوماً).
class DriverHeatmapScreen extends ConsumerWidget {
  const DriverHeatmapScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(driverHeatmapProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('الخريطة الحرارية')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(driverHeatmapProvider),
        child: AsyncView<DriverHeatmap>(
          value: value,
          onRetry: () => ref.invalidate(driverHeatmapProvider),
          data: (map) {
            if (map.drivers.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 80),
                  EmptyState(
                    icon: Icons.map_outlined,
                    title: 'لا بيانات توصيل',
                    message: 'لا طلبات مكتملة بمناطق محدّدة خلال آخر 30 يوماً.',
                  ),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: map.drivers.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _DriverHeatCard(row: map.drivers[i]),
            );
          },
        ),
      ),
    );
  }
}

class _DriverHeatCard extends StatelessWidget {
  const _DriverHeatCard({required this.row});
  final DriverHeatmapRow row;

  @override
  Widget build(BuildContext context) {
    final districts = row.districts;
    final totalOrders =
        districts.fold<int>(0, (s, d) => s + d.orderCount);
    final maxOrders =
        districts.fold<int>(1, (m, d) => d.orderCount > m ? d.orderCount : m);

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.person_pin_circle_outlined,
                  color: AppColors.navy600, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(row.fullName,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w800)),
              ),
              Text('$totalOrders طلب',
                  style: const TextStyle(
                      color: AppColors.slate, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 12),
          for (final d in districts) ...[
            _DistrictBar(district: d, max: maxOrders),
            const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

class _DistrictBar extends StatelessWidget {
  const _DistrictBar({required this.district, required this.max});
  final HeatmapDistrict district;
  final int max;

  @override
  Widget build(BuildContext context) {
    final d = district;
    final fraction = (d.orderCount / max).clamp(0.0, 1.0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(d.district.isEmpty ? 'غير محدّدة' : d.district,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700)),
            ),
            Text('${d.orderCount} · ${Fmt.iqdShort(d.revenueIqd)}',
                style:
                    const TextStyle(color: AppColors.muted, fontSize: 12)),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: fraction,
            minHeight: 7,
            backgroundColor: AppColors.line,
            valueColor:
                const AlwaysStoppedAnimation<Color>(AppColors.water600),
          ),
        ),
      ],
    );
  }
}
