import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers.dart';
import '../widgets/common.dart';

/// شاشة «أرباحي» — سلسلة الأرباح اليومية (عمولة + بونص) للأسبوع أو الشهر.
///
/// تبديل الفترة (آخر ٧ أيام / آخر ٣٠ يوم) يعيد جلب `earningsProvider(period)`،
/// نعرض الإجمالي بارزاً ثم مخطّطاً بسيطاً بأشرطة (Container بارتفاع نسبي،
/// بدون مكتبة خارجية) ثم قائمة تفصيلية بالأيام.
class EarningsScreen extends ConsumerStatefulWidget {
  const EarningsScreen({super.key});

  @override
  ConsumerState<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends ConsumerState<EarningsScreen> {
  String _period = 'week';

  @override
  Widget build(BuildContext context) {
    final earnings = ref.watch(earningsProvider(_period));

    return Scaffold(
      appBar: AppBar(title: const Text('أرباحي')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: SizedBox(
              width: double.infinity,
              child: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'week', label: Text('آخر ٧ أيام')),
                  ButtonSegment(value: 'month', label: Text('آخر ٣٠ يوم')),
                ],
                selected: {_period},
                showSelectedIcon: false,
                onSelectionChanged: (selection) {
                  setState(() => _period = selection.first);
                },
              ),
            ),
          ),
          Expanded(
            child: AsyncView<List<EarningsDay>>(
              value: earnings,
              onRetry: () => ref.invalidate(earningsProvider(_period)),
              data: (days) {
                if (days.isEmpty) {
                  return const EmptyState(
                    icon: Icons.insights_outlined,
                    title: 'لا توجد أرباح في هذه الفترة',
                    message: 'عند إكمال المهام، ستظهر عمولاتك وبونصك هنا.',
                  );
                }

                final totalCommission =
                    days.fold<int>(0, (s, d) => s + d.commissionIqd);
                final totalBonus =
                    days.fold<int>(0, (s, d) => s + d.bonusIqd);
                final totalOrders =
                    days.fold<int>(0, (s, d) => s + d.completedOrders);
                final total = totalCommission + totalBonus;
                final maxTotal = days.fold<int>(
                  0,
                  (m, d) => d.totalIqd > m ? d.totalIqd : m,
                );

                return RefreshIndicator(
                  onRefresh: () async =>
                      ref.invalidate(earningsProvider(_period)),
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
                    children: [
                      _TotalHero(
                        total: total,
                        commission: totalCommission,
                        bonus: totalBonus,
                        orders: totalOrders,
                      ),
                      const SizedBox(height: 16),
                      _BarChartCard(
                        days: days,
                        maxTotal: maxTotal,
                        isMonth: _period == 'month',
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'تفاصيل الأيام',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: AppColors.ink,
                        ),
                      ),
                      const SizedBox(height: 10),
                      for (final day in days.reversed)
                        _DayRow(day: day),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// بطاقة الإجمالي البارزة + تفكيك العمولة/البونص/المهام.
class _TotalHero extends StatelessWidget {
  const _TotalHero({
    required this.total,
    required this.commission,
    required this.bonus,
    required this.orders,
  });

  final int total;
  final int commission;
  final int bonus;
  final int orders;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppTheme.tealGradient,
        borderRadius: BorderRadius.circular(AppTheme.radiusHero),
        boxShadow: [
          BoxShadow(
            color: AppColors.turquoise600.withValues(alpha: 0.25),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'إجمالي الأرباح في الفترة',
            style: TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          AnimatedCounter(
            value: total,
            format: (n) => Fmt.iqd(n.round()),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 30,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: Colors.white24),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _MiniTotal(
                  label: 'عمولات',
                  value: commission,
                  format: (n) => Fmt.iqd(n.round()),
                ),
              ),
              Expanded(
                child: _MiniTotal(
                  label: 'بونص',
                  value: bonus,
                  format: (n) => Fmt.iqd(n.round()),
                ),
              ),
              Expanded(
                child: _MiniTotal(label: 'مهام', value: orders),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MiniTotal extends StatelessWidget {
  const _MiniTotal({required this.label, required this.value, this.format});

  final String label;
  final num value;
  final String Function(num value)? format;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 3),
        AnimatedCounter(
          value: value,
          format: format,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

/// أسماء الأيام العربية المختصرة (الإثنين=1 .. الأحد=7 حسب DateTime.weekday).
const List<String> _weekdayAr = ['إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت', 'أحد'];

/// بطاقة المخطّط: عمود لكل يوم بارتفاع نسبي إلى أعلى قيمة.
class _BarChartCard extends StatelessWidget {
  const _BarChartCard({
    required this.days,
    required this.maxTotal,
    required this.isMonth,
  });

  final List<EarningsDay> days;
  final int maxTotal;
  final bool isMonth;

  static const double _chartHeight = 150;
  static const double _labelArea = 18;

  @override
  Widget build(BuildContext context) {
    final barWidth = isMonth ? 12.0 : 26.0;
    final gap = isMonth ? 6.0 : 10.0;
    final maxBarHeight = _chartHeight - _labelArea;

    final bars = <Widget>[];
    for (var i = 0; i < days.length; i++) {
      final day = days[i];
      final ratio = maxTotal > 0 ? day.totalIqd / maxTotal : 0.0;
      final barHeight = day.totalIqd > 0
          ? (ratio * maxBarHeight).clamp(4.0, maxBarHeight)
          : 0.0;
      final parsed = DateTime.tryParse(day.date);

      String label;
      if (isMonth) {
        label = parsed != null && parsed.day % 5 == 0 ? '${parsed.day}' : '';
      } else {
        label = parsed != null ? _weekdayAr[parsed.weekday - 1] : '';
      }

      bars.add(SizedBox(
        width: barWidth,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Container(
              width: barWidth,
              height: barHeight,
              decoration: BoxDecoration(
                gradient: day.totalIqd > 0
                    ? const LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [AppColors.water400, AppColors.water600],
                      )
                    : null,
                color: day.totalIqd > 0 ? null : AppColors.line,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(6),
                ),
              ),
            ),
            const SizedBox(height: 4),
            SizedBox(
              height: _labelArea - 4,
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.clip,
                style: const TextStyle(
                  fontSize: 9,
                  color: AppColors.muted,
                ),
              ),
            ),
          ],
        ),
      ));
    }

    // أحدث يوم على اليمين (RTL): نعكس ترتيب الأعمدة.
    final row = Row(
      mainAxisAlignment:
          isMonth ? MainAxisAlignment.start : MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (var i = bars.length - 1; i >= 0; i--) ...[
          bars[i],
          if (isMonth && i > 0) SizedBox(width: gap),
        ],
      ],
    );

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.bar_chart, size: 18, color: AppColors.water600),
              SizedBox(width: 6),
              Text(
                'العمولة + البونص اليومي',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppColors.slate,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: _chartHeight,
            child: isMonth
                ? SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    reverse: true,
                    child: row,
                  )
                : row,
          ),
        ],
      ),
    );
  }
}

/// صف يوم واحد في القائمة التفصيلية.
class _DayRow extends StatelessWidget {
  const _DayRow({required this.day});

  final EarningsDay day;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SectionCard(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  Fmt.arabicDate(day.date),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink,
                  ),
                ),
                Text(
                  Fmt.iqd(day.totalIqd),
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    color: AppColors.water600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            const Divider(height: 1, color: AppColors.line),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _DayStat(
                    label: 'المهام',
                    value: '${day.completedOrders}',
                  ),
                ),
                Expanded(
                  child: _DayStat(
                    label: 'العمولة',
                    value: Fmt.iqd(day.commissionIqd),
                  ),
                ),
                Expanded(
                  child: _DayStat(
                    label: 'البونص',
                    value: Fmt.iqd(day.bonusIqd),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _DayStat extends StatelessWidget {
  const _DayStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            color: AppColors.muted,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w800,
            color: AppColors.slate,
          ),
        ),
      ],
    );
  }
}
