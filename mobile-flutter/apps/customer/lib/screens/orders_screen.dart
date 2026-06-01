import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers.dart';
import '../widgets/common.dart';
import '../widgets/order_widgets.dart';

/// تبويب «الطلبات» — سجلّ طلبات الزبون مع إمكانية إعادة الطلب على المكتملة.
class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersValue = ref.watch(myOrdersProvider);

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(title: const Text('طلباتي')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(myOrdersProvider),
        child: AsyncView<List<RefillOrder>>(
          value: ordersValue,
          onRetry: () => ref.invalidate(myOrdersProvider),
          data: (orders) {
            if (orders.isEmpty) {
              return ListView(
                padding: const EdgeInsets.all(20),
                children: const [
                  SizedBox(height: 80),
                  EmptyState(
                    icon: Icons.local_shipping_outlined,
                    title: 'لا توجد طلبات بعد',
                    message:
                        'اطلب تعبئتك الأولى من الشاشة الرئيسية وستظهر طلباتك هنا.',
                  ),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              itemCount: orders.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, i) => _OrderCard(order: orders[i]),
            );
          },
        ),
      ),
    );
  }
}

/// بطاقة طلب واحد مع زر «إعادة الطلب» للمكتملة.
class _OrderCard extends ConsumerStatefulWidget {
  const _OrderCard({required this.order});
  final RefillOrder order;

  @override
  ConsumerState<_OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends ConsumerState<_OrderCard> {
  bool _reordering = false;

  Future<void> _reorder() async {
    final profileAsync = ref.read(myProfileProvider);
    final profile = profileAsync.valueOrNull;
    if (profile == null) {
      showSnack(context, 'تعذّر تحميل ملفّك. حاول مجدداً.', error: true);
      return;
    }
    setState(() => _reordering = true);
    try {
      final created = await ref
          .read(ordersRepositoryProvider)
          .createRefill(customerId: profile.id);
      if (!mounted) return;
      ref.invalidate(myOrdersProvider);
      showSnack(context, 'تم إرسال طلبك. سيتولّاه أحد السائقين.');
      context.push('/order/${created.id}');
    } on ApiException catch (e) {
      if (!mounted) return;
      showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _reordering = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final isCompleted = order.status == RefillOrderStatus.completed;

    return SectionCard(
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        onTap: () => context.push('/order/${order.id}'),
        child: Padding(
          padding: const EdgeInsets.all(2),
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
                    child: Icon(
                      orderKindIcon(order.kind),
                      color: AppColors.navy600,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          order.kind.label,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          order.requestedAt == null
                              ? '—'
                              : Fmt.arabicDate(order.requestedAt),
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 12.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(
                    Icons.chevron_left,
                    color: AppColors.muted,
                    size: 22,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Divider(height: 1, color: AppColors.line),
              const SizedBox(height: 12),
              Row(
                children: [
                  OrderStatusPill(status: order.status),
                  const Spacer(),
                  Text(
                    order.priceIqd > 0 ? Fmt.iqd(order.priceIqd) : 'مجاناً',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: AppColors.water600,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
              if (isCompleted) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: LoadingButton(
                    label: 'إعادة الطلب',
                    icon: Icons.refresh,
                    loading: _reordering,
                    onPressed: _reorder,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
