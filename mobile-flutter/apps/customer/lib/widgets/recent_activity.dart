import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';
import 'common.dart';

/// «نشاطك الأخير» — آخر ٣ طلبات + ملخّص (عدد التعبئات وإجمالي الإنفاق).
/// منقول من `RecentActivityList.tsx`. يختفي بهدوء إن لم توجد طلبات.
class RecentActivityList extends ConsumerWidget {
  const RecentActivityList({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(myOrdersProvider);
    final orders = ordersAsync.asData?.value ?? const <RefillOrder>[];
    if (orders.isEmpty) return const SizedBox.shrink();

    final recent = orders.take(3).toList();
    final completed =
        orders.where((o) => o.status == RefillOrderStatus.completed).toList();
    final totalSpent =
        completed.fold<int>(0, (sum, o) => sum + o.paidAmountIqd);
    final refillCount =
        completed.where((o) => o.kind == RefillOrderKind.refill).length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.receipt_long, size: 18, color: AppColors.navy600),
                  SizedBox(width: 6),
                  Text('نشاطك الأخير',
                      style:
                          TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                ],
              ),
              TextButton(
                onPressed: () => context.go('/orders'),
                child: const Text('عرض الكل'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        SectionCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var i = 0; i < recent.length; i++) ...[
                if (i > 0)
                  const Divider(
                      height: 1,
                      indent: 12,
                      endIndent: 12,
                      color: AppColors.line),
                _ActivityRow(order: recent[i]),
              ],
            ],
          ),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.turquoise50,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.turquoise100),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.trending_up,
                      size: 18, color: AppColors.turquoise600),
                  SizedBox(width: 6),
                  Text('سجلّك',
                      style: TextStyle(
                          color: AppColors.turquoise600,
                          fontWeight: FontWeight.w700,
                          fontSize: 11)),
                ],
              ),
              Text(
                '$refillCount تعبئات · ${Fmt.iqd(totalSpent)}',
                style: const TextStyle(
                    color: AppColors.turquoise600,
                    fontWeight: FontWeight.w900,
                    fontSize: 11),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.order});
  final RefillOrder order;

  @override
  Widget build(BuildContext context) {
    final (color, icon) = _visual(order.status);
    final date = order.completedAt ?? order.requestedAt;
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 20, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(order.kind.label,
                    style: const TextStyle(
                        fontSize: 12.5, fontWeight: FontWeight.w700)),
                Text(date == null ? '—' : Fmt.arabicDate(date),
                    style: const TextStyle(
                        fontSize: 10.5, color: AppColors.muted)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(order.priceIqd > 0 ? Fmt.iqd(order.priceIqd) : '—',
                  style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w900,
                      color: color)),
              Text(order.status.label,
                  style: TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w700,
                      color: color)),
            ],
          ),
        ],
      ),
    );
  }

  (Color, IconData) _visual(RefillOrderStatus status) {
    switch (status) {
      case RefillOrderStatus.completed:
        return (AppColors.success, Icons.task_alt);
      case RefillOrderStatus.assigned:
      case RefillOrderStatus.enRoute:
        return (AppColors.navy600, Icons.local_shipping);
      case RefillOrderStatus.cancelled:
      case RefillOrderStatus.failed:
        return (AppColors.danger, Icons.cancel);
      case RefillOrderStatus.pending:
        return (AppColors.warn500, Icons.schedule);
    }
  }
}
