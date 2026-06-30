import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers.dart';
import '../widgets/common.dart';
import '../widgets/gradient_header.dart';
import '../widgets/order_widgets.dart';

const _arWeekdays = [
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
  'الأحد',
];

/// تسمية قسم التاريخ: اليوم / أمس / اسم اليوم (خلال الأسبوع) / التاريخ.
String _bucketLabel(DateTime? date) {
  if (date == null) return 'غير مؤرّخ';
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final that = DateTime(date.year, date.month, date.day);
  final diff = today.difference(that).inDays;
  if (diff <= 0) return 'اليوم';
  if (diff == 1) return 'أمس';
  if (diff < 7) return _arWeekdays[date.weekday - 1];
  return Fmt.arabicDate(date);
}

/// تبويب «السجلّ» — كل المهام التي أنجزها السائق مع التاريخ والمبلغ المحصّل.
class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(historyProvider);

    return Column(
      children: [
        const GradientHeader(title: 'سجلّي', subtitle: 'كل ما أنجزته من مهام'),
        Expanded(
          child: AsyncView<List<RefillOrder>>(
            value: history,
            onRetry: () => ref.invalidate(historyProvider),
            data: (orders) {
              if (orders.isEmpty) {
                return const EmptyState(
                  icon: Icons.history,
                  title: 'سجلّك فارغ حالياً',
                  message: 'عند إكمال أول مهمة، ستظهر هنا مع كل التفاصيل.',
                );
              }

              final totalCash = orders.fold<int>(
                0,
                (sum, o) => sum + (o.paidAmountIqd > 0 ? o.paidAmountIqd : 0),
              );

              // تقسيم بالتاريخ: اليوم/أمس/اسم اليوم/التاريخ — مع عدّاد لكل قسم.
              // (الطلبات تأتي مرتّبة تنازلياً من الباك إند.)
              final counts = <String, int>{};
              for (final o in orders) {
                final b = _bucketLabel(o.completedAt ?? o.requestedAt);
                counts[b] = (counts[b] ?? 0) + 1;
              }

              final items = <Widget>[
                _SummaryStrip(count: orders.length, totalCash: totalCash),
              ];
              String? current;
              for (final o in orders) {
                final b = _bucketLabel(o.completedAt ?? o.requestedAt);
                if (b != current) {
                  current = b;
                  items.add(_SectionHeader(label: b, count: counts[b] ?? 0));
                }
                items.add(_HistoryCard(order: o));
              }

              return RefreshIndicator(
                onRefresh: () async => ref.invalidate(historyProvider),
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                  children: items,
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// شريط ملخّص أعلى القائمة: عدد المهام + إجمالي التحصيل.
class _SummaryStrip extends StatelessWidget {
  const _SummaryStrip({required this.count, required this.totalCash});

  final int count;
  final int totalCash;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(
            child: _SummaryTile(
              label: 'إجمالي المهام',
              value: '$count',
              color: AppColors.navy600,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _SummaryTile(
              label: 'إجمالي التحصيل',
              value: Fmt.iqd(totalCash),
              color: AppColors.water600,
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.muted, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text(value,
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w900, color: color)),
        ],
      ),
    );
  }
}

/// رأس قسم تاريخي لاصق بصرياً: التسمية + عدد المهام في القسم.
class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label, required this.count});

  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 6, 4, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w900,
              color: AppColors.slate,
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.navy50,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '$count',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: AppColors.navy600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// بطاقة مهمة واحدة في السجلّ.
class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.order});

  final RefillOrder order;

  @override
  Widget build(BuildContext context) {
    final when = order.completedAt ?? order.requestedAt;
    final isFree = order.paidAmountIqd <= 0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SectionCard(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.navy50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(orderKindIcon(order.kind),
                      color: AppColors.navy600, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // اسم الزبون أولاً (لمن كانت المهمّة)، مع بديل عند غيابه.
                      Text(
                        (order.customerName?.isNotEmpty ?? false)
                            ? order.customerName!
                            : '— مجهول —',
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${order.kind.label} · ${when == null ? 'غير مؤرّخ' : Fmt.arabicDate(when)}',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.muted),
                      ),
                    ],
                  ),
                ),
                OrderStatusPill(status: order.status),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(height: 1, color: AppColors.line),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('المبلغ المحصّل',
                    style: TextStyle(fontSize: 13, color: AppColors.slate)),
                Text(isFree ? 'مجاناً' : Fmt.iqd(order.paidAmountIqd),
                    style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        color: isFree ? AppColors.muted : AppColors.water600)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
