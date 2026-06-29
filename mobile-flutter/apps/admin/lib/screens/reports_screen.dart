import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets/common.dart';

/// شاشة التقارير — إيراد آخر 7 أيام + أفضل الزبائن والسائقين.
/// (تقارير أعمق — الأفواج/الخريطة الحرارية/الاستغلال — تُضاف لاحقاً.)
class ReportsScreen extends ConsumerWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('التقارير')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(revenue7dProvider);
          ref.invalidate(topCustomersProvider);
          ref.invalidate(topDriversProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const _CardTitle('إيراد آخر 7 أيام'),
            const SizedBox(height: 10),
            _RevenueCard(),
            const SizedBox(height: 20),
            const _CardTitle('أفضل الزبائن (هذا الشهر)'),
            const SizedBox(height: 10),
            _TopCustomersCard(),
            const SizedBox(height: 20),
            const _CardTitle('أفضل السائقين (هذا الشهر)'),
            const SizedBox(height: 10),
            _TopDriversCard(),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _CardTitle extends StatelessWidget {
  const _CardTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800));
  }
}

class _RevenueCard extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(revenue7dProvider);
    return AsyncView<List<RevenueDay>>(
      value: value,
      onRetry: () => ref.invalidate(revenue7dProvider),
      data: (days) {
        if (days.isEmpty) {
          return const EmptyState(
              icon: Icons.bar_chart, title: 'لا بيانات إيراد بعد');
        }
        return SectionCard(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            children: [
              for (var i = 0; i < days.length; i++) ...[
                if (i > 0) const Divider(height: 1),
                ListTile(
                  dense: true,
                  title: Text(Fmt.arabicDate(days[i].date)),
                  subtitle: Text('${days[i].orders} طلب'),
                  trailing: Text(Fmt.iqd(days[i].revenueIqd),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _TopCustomersCard extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(topCustomersProvider);
    return AsyncView<List<TopCustomer>>(
      value: value,
      onRetry: () => ref.invalidate(topCustomersProvider),
      data: (rows) {
        if (rows.isEmpty) {
          return const EmptyState(
              icon: Icons.people_outline, title: 'لا زبائن بعد');
        }
        return SectionCard(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            children: [
              for (var i = 0; i < rows.length; i++) ...[
                if (i > 0) const Divider(height: 1),
                ListTile(
                  dense: true,
                  leading: CircleAvatar(
                      radius: 14,
                      backgroundColor: AppColors.navy100,
                      child: Text('${i + 1}',
                          style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: AppColors.navy700))),
                  title: Text(rows[i].fullName),
                  subtitle: Text('${rows[i].orderCount} طلب'),
                  trailing: Text(Fmt.iqd(rows[i].spentIqd),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _TopDriversCard extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(topDriversProvider);
    return AsyncView<List<TopDriver>>(
      value: value,
      onRetry: () => ref.invalidate(topDriversProvider),
      data: (rows) {
        if (rows.isEmpty) {
          return const EmptyState(
              icon: Icons.local_shipping_outlined, title: 'لا سائقين بعد');
        }
        return SectionCard(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            children: [
              for (var i = 0; i < rows.length; i++) ...[
                if (i > 0) const Divider(height: 1),
                ListTile(
                  dense: true,
                  leading: CircleAvatar(
                      radius: 14,
                      backgroundColor: AppColors.turquoise100,
                      child: Text('${i + 1}',
                          style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: AppColors.turquoise700))),
                  title: Text(rows[i].fullName),
                  subtitle: Text('${rows[i].completedOrders} طلب مكتمل'),
                  trailing: Text(Fmt.iqd(rows[i].revenueIqd),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
