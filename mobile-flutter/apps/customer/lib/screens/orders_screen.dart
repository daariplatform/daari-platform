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
    final count = ordersValue.valueOrNull?.length;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: const Text('طلباتي'),
        actions: [
          if (count != null && count > 0)
            Padding(
              padding: const EdgeInsets.only(left: 16),
              child: Center(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.navy50,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text('$count طلب',
                      style: const TextStyle(
                          color: AppColors.navy700,
                          fontWeight: FontWeight.w800,
                          fontSize: 12.5)),
                ),
              ),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(myOrdersProvider),
        child: AsyncView<List<RefillOrder>>(
          value: ordersValue,
          onRetry: () => ref.invalidate(myOrdersProvider),
          data: (orders) {
            if (orders.isEmpty) {
              return ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  const SizedBox(height: 80),
                  EmptyState(
                    icon: Icons.local_shipping_outlined,
                    title: 'لا توجد طلبات بعد',
                    message:
                        'اطلب تعبئتك الأولى من الشاشة الرئيسية وستظهر طلباتك هنا.',
                    actionLabel: 'اطلب تعبئتك الأولى',
                    onAction: () => context.go('/home'),
                  ),
                ],
              );
            }
            // تجميع الطلبات حسب الشهر بترويسات (واردة الأحدث أولاً).
            final children = <Widget>[];
            String? currentMonth;
            for (final o in orders) {
              final month = Fmt.arabicMonthYear(o.requestedAt);
              if (month != currentMonth) {
                children.add(SizedBox(height: children.isEmpty ? 0 : 8));
                children.add(_MonthHeader(label: month));
                currentMonth = month;
              }
              children.add(Padding(
                padding: const EdgeInsets.only(top: 12),
                child: _OrderCard(order: o),
              ));
            }
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: children,
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
  bool _receiptOpen = false;

  Future<void> _reorder() async {
    final profileAsync = ref.read(myProfileProvider);
    final profile = profileAsync.valueOrNull;
    if (profile == null) {
      showSnack(context, 'تعذّر تحميل ملفّك. حاول مجدداً.', error: true);
      return;
    }
    // حارس الطلب النشط: إن كان هناك طلب تعبئة حيّ، تابِعه بدل إنشاء طلب مكرّر.
    final orders = ref.read(myOrdersProvider).valueOrNull ?? const [];
    RefillOrder? active;
    for (final o in orders) {
      if (o.kind == RefillOrderKind.refill && o.status.isActive) {
        active = o;
        break;
      }
    }
    if (active != null) {
      showSnack(context, 'لديك طلب قيد التنفيذ — نوجّهك لمتابعته.');
      context.push('/order/${active.id}');
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
    final statusColor = orderStatusColor(order.status);
    // «إعادة الطلب» تخصّ التعبئة المكتملة فقط (لا توصيل/استرجاع/بيع فوري).
    final canReorder = isCompleted && order.kind == RefillOrderKind.refill;

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
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      orderStatusIcon(order.status),
                      color: statusColor,
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
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () =>
                            setState(() => _receiptOpen = !_receiptOpen),
                        icon: Icon(
                            _receiptOpen
                                ? Icons.keyboard_arrow_up
                                : Icons.receipt_long_outlined,
                            size: 18),
                        label: const Text('الإيصال'),
                      ),
                    ),
                    if (canReorder) ...[
                      const SizedBox(width: 10),
                      Expanded(
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
                if (_receiptOpen) ...[
                  const SizedBox(height: 12),
                  _Receipt(order: order),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// إيصال مضمّن قابل للطيّ للطلب المكتمل (معاينة سريعة دون فتح التفاصيل).
class _Receipt extends StatelessWidget {
  const _Receipt({required this.order});
  final RefillOrder order;

  @override
  Widget build(BuildContext context) {
    final shortId = order.id.length <= 6
        ? order.id.toUpperCase()
        : order.id.substring(order.id.length - 6).toUpperCase();
    final paymentLabel = (order.paymentMethod == null ||
            order.paymentMethod!.isEmpty ||
            order.paymentMethod == 'CASH')
        ? 'نقداً عند الاستلام'
        : order.paymentMethod!;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.bg,
        borderRadius: BorderRadius.circular(AppTheme.radiusInput),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          _ReceiptRow(label: 'رقم الطلب', value: '#$shortId'),
          _ReceiptRow(
              label: 'المبلغ',
              value: order.priceIqd > 0 ? Fmt.iqd(order.priceIqd) : 'مجاناً'),
          if (order.paidAmountIqd > 0)
            _ReceiptRow(label: 'المدفوع', value: Fmt.iqd(order.paidAmountIqd)),
          _ReceiptRow(label: 'طريقة الدفع', value: paymentLabel),
          if (order.driver != null)
            _ReceiptRow(label: 'السائق', value: order.driver!.fullName),
          _ReceiptRow(
            label: 'تاريخ التسليم',
            value: Fmt.arabicDate(order.completedAt ?? order.requestedAt),
          ),
        ],
      ),
    );
  }
}

/// ترويسة مجموعة شهرية في قائمة الطلبات (نقطة + اسم الشهر + خطّ فاصل).
class _MonthHeader extends StatelessWidget {
  const _MonthHeader({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 2),
      child: Row(
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: const BoxDecoration(
                color: AppColors.navy600, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text(label,
              style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                  color: AppColors.slate)),
          const SizedBox(width: 10),
          const Expanded(child: Divider(color: AppColors.line)),
        ],
      ),
    );
  }
}

class _ReceiptRow extends StatelessWidget {
  const _ReceiptRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(label,
              style: const TextStyle(color: AppColors.slate, fontSize: 12.5)),
          const Spacer(),
          Text(value,
              style:
                  const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
        ],
      ),
    );
  }
}
