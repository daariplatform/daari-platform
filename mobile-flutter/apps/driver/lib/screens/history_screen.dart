import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers.dart';
import '../widgets/common.dart';
import '../widgets/gradient_header.dart';
import '../widgets/order_widgets.dart';

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

              return RefreshIndicator(
                onRefresh: () async => ref.invalidate(historyProvider),
                child: ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                  itemCount: orders.length + 1,
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      return _SummaryStrip(
                        count: orders.length,
                        totalCash: totalCash,
                      );
                    }
                    final order = orders[index - 1];
                    return _HistoryCard(order: order);
                  },
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
                      Text(order.kind.label,
                          style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 3),
                      Text(when == null ? 'غير مؤرّخ' : Fmt.arabicDateTime(when),
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.muted)),
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
