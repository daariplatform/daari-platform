import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets/common.dart';

/// تقارير متقدّمة — ساعات الذروة + استغلال الخزّانات + احتفاظ الأفواج + تصدير.
class AdvancedReportsScreen extends ConsumerWidget {
  const AdvancedReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('تقارير متقدّمة')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(peakHoursProvider);
          ref.invalidate(tankUtilizationProvider);
          ref.invalidate(cohortProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const ReportWindowBar(),
            const SizedBox(height: 20),
            const _Title('ساعات الذروة'),
            const SizedBox(height: 10),
            const _PeakHoursCard(),
            const SizedBox(height: 20),
            const _Title('استغلال الخزّانات'),
            const SizedBox(height: 10),
            const _TankUtilizationCard(),
            const SizedBox(height: 20),
            const _Title('احتفاظ الأفواج'),
            const SizedBox(height: 10),
            const _CohortCard(),
            const SizedBox(height: 20),
            const _Title('تصدير تقرير'),
            const SizedBox(height: 10),
            const _ExportCard(),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _Title extends StatelessWidget {
  const _Title(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800));
  }
}

class _PeakHoursCard extends ConsumerWidget {
  const _PeakHoursCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(peakHoursProvider);
    return AsyncView<List<PeakHour>>(
      value: value,
      onRetry: () => ref.invalidate(peakHoursProvider),
      skeleton: const SizedBox(height: 120, child: SkeletonList()),
      data: (hours) {
        final max =
            hours.fold<int>(1, (m, h) => h.orderCount > m ? h.orderCount : m);
        return SectionCard(
          child: SizedBox(
            height: 140,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final h in hours)
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Container(
                          height: 100 * (h.orderCount / max),
                          margin: const EdgeInsets.symmetric(horizontal: 0.5),
                          decoration: BoxDecoration(
                            color: AppColors.navy400,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(height: 4),
                        if (h.hour % 6 == 0)
                          Text('${h.hour}',
                              style: const TextStyle(
                                  fontSize: 9, color: AppColors.muted)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _TankUtilizationCard extends ConsumerWidget {
  const _TankUtilizationCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(tankUtilizationProvider);
    return AsyncView<TankUtilization>(
      value: value,
      onRetry: () => ref.invalidate(tankUtilizationProvider),
      skeleton: const SizedBox(height: 90, child: SkeletonList()),
      data: (t) => SectionCard(
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _Stat(
                    label: 'نشطة',
                    value: '${t.activeCount}',
                    color: AppColors.water600),
                _Stat(
                    label: 'خفيفة',
                    value: '${t.lightCount}',
                    color: AppColors.warning),
                _Stat(
                    label: 'خاملة',
                    value: '${t.idleCount}',
                    color: AppColors.danger),
              ],
            ),
            const Divider(height: 20),
            Row(
              children: [
                const Text('متوسّط التعبئة لكل خزان نشط',
                    style: TextStyle(color: AppColors.slate, fontSize: 13)),
                const Spacer(),
                Text(t.avgRefillsPerActiveTank.toStringAsFixed(1),
                    style: const TextStyle(fontWeight: FontWeight.w800)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value,
            style: TextStyle(
                fontSize: 22, fontWeight: FontWeight.w900, color: color)),
        const SizedBox(height: 2),
        Text(label,
            style: const TextStyle(color: AppColors.slate, fontSize: 12)),
      ],
    );
  }
}

class _CohortCard extends ConsumerWidget {
  const _CohortCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(cohortProvider);
    return AsyncView<CohortReport>(
      value: value,
      onRetry: () => ref.invalidate(cohortProvider),
      skeleton: const SizedBox(height: 120, child: SkeletonList()),
      data: (report) {
        if (report.cohorts.isEmpty) {
          return const EmptyState(
              icon: Icons.grid_on, title: 'لا بيانات أفواج بعد');
        }
        return SectionCard(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            children: [
              for (var i = 0; i < report.cohorts.length; i++) ...[
                if (i > 0) const Divider(height: 1),
                _CohortRowTile(row: report.cohorts[i]),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _CohortRowTile extends StatelessWidget {
  const _CohortRowTile({required this.row});
  final CohortRow row;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      title: Text('${row.cohortMonth} · ${row.size} زبون',
          style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Wrap(
        spacing: 6,
        children: [
          for (final pct in row.retention)
            Text('${pct.toStringAsFixed(0)}٪',
                style: const TextStyle(fontSize: 11, color: AppColors.slate)),
        ],
      ),
    );
  }
}

class _ExportCard extends ConsumerStatefulWidget {
  const _ExportCard();

  @override
  ConsumerState<_ExportCard> createState() => _ExportCardState();
}

class _ExportCardState extends ConsumerState<_ExportCard> {
  static const _reports = {
    'revenue': 'الإيراد',
    'top-customers': 'أفضل الزبائن',
    'top-drivers': 'أفضل السائقين',
    'cohort': 'الأفواج',
  };
  String _report = 'revenue';
  String _type = 'pdf';
  bool _loading = false;

  Future<void> _export() async {
    setState(() => _loading = true);
    try {
      final w = ref.read(reportWindowProvider);
      final res = await ref.read(reportsRepositoryProvider).exportReport(
            type: _type,
            report: _report,
            from: w.fromIso,
            to: w.toIso,
          );
      await Launchers.openUrl(res.url);
      if (mounted) showSnack(context, 'تمّ توليد الملف وفتحه');
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        children: [
          DropdownButtonFormField<String>(
            initialValue: _report,
            decoration: const InputDecoration(labelText: 'التقرير'),
            items: _reports.entries
                .map(
                    (e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                .toList(),
            onChanged: (v) => setState(() => _report = v ?? _report),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _type,
            decoration: const InputDecoration(labelText: 'الصيغة'),
            items: const [
              DropdownMenuItem(value: 'pdf', child: Text('PDF')),
              DropdownMenuItem(value: 'xlsx', child: Text('Excel')),
            ],
            onChanged: (v) => setState(() => _type = v ?? _type),
          ),
          const SizedBox(height: 14),
          LoadingButton(
            label: 'تصدير وفتح',
            icon: Icons.download,
            loading: _loading,
            onPressed: _export,
          ),
        ],
      ),
    );
  }
}
