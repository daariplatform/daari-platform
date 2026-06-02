import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers.dart';
import '../widgets/common.dart';

/// عتبة المكافأة: عند بلوغ هذه النقاط يحصل الزبون على تعبئة مجانية.
const int kRewardThreshold = 100;

/// شاشة «المحفظة والنقاط»: الرصيد + نقاط الولاء + سجلّ الدفعات (من الطلبات المدفوعة).
class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(myProfileProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('المحفظة والنقاط')),
      body: AsyncView<CustomerProfile>(
        value: profileAsync,
        onRetry: () => ref.invalidate(myProfileProvider),
        data: (profile) {
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(myProfileProvider);
              ref.invalidate(myOrdersProvider);
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _LoyaltyHero(points: profile.loyaltyPoints),
                const SizedBox(height: 14),
                _BalanceCard(balanceIqd: profile.balanceIqd),
                const SizedBox(height: 14),
                const _PointsInfo(),
                const SizedBox(height: 24),
                const Text(
                  'سجلّ الدفعات',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
                const _PaymentHistory(),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// بطاقة متدرّجة لنقاط الولاء مع شريط تقدّم نحو [kRewardThreshold].
class _LoyaltyHero extends StatelessWidget {
  const _LoyaltyHero({required this.points});

  final int points;

  @override
  Widget build(BuildContext context) {
    final clamped = points < 0 ? 0 : points;
    final progress =
        (clamped / kRewardThreshold).clamp(0.0, 1.0).toDouble();
    final remaining = kRewardThreshold - clamped;
    final ready = remaining <= 0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppTheme.tealGradient,
        borderRadius: BorderRadius.circular(AppTheme.radiusHero),
        boxShadow: [
          BoxShadow(
            color: AppColors.turquoise600.withValues(alpha: 0.30),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.card_giftcard, color: Colors.white, size: 30),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'نقاط الولاء',
                      style: TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                    const SizedBox(height: 2),
                    AnimatedCounter(
                      value: clamped,
                      format: (n) => '${n.round()} نقطة',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 34,
                        fontWeight: FontWeight.w900,
                        height: 1.1,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '${(progress * 100).round()}%',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 10,
              backgroundColor: Colors.white.withValues(alpha: 0.25),
              valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
            ),
          ),
          const SizedBox(height: 12),
          if (ready)
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.22),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                'مكافأة جاهزة! تعبئة مجانية بانتظارك',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            )
          else
            Text(
              'باقٍ $remaining نقطة لتعبئة مجانية',
              style: const TextStyle(color: Colors.white, fontSize: 12),
            ),
        ],
      ),
    );
  }
}

/// بطاقة الرصيد: موجب = لك، سالب = عليك، صفر = مدفوع بالكامل.
class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.balanceIqd});

  final int balanceIqd;

  @override
  Widget build(BuildContext context) {
    final isCredit = balanceIqd > 0;
    final isZero = balanceIqd == 0;
    final color =
        isZero ? AppColors.slate : (isCredit ? AppColors.water600 : AppColors.danger);

    final String label;
    final String amountText;
    if (isZero) {
      label = 'رصيد الحساب';
      amountText = 'مدفوع بالكامل';
    } else if (isCredit) {
      label = 'رصيد لك';
      amountText = Fmt.iqd(balanceIqd);
    } else {
      label = 'مبلغ مستحق عليك';
      amountText = Fmt.iqd(balanceIqd.abs());
    }

    return SectionCard(
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(15),
            ),
            child: Icon(Icons.account_balance_wallet, color: color, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(color: AppColors.slate, fontSize: 12),
                ),
                const SizedBox(height: 4),
                Text(
                  amountText,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// بطاقة توضيحية لكيفية كسب النقاط.
class _PointsInfo extends StatelessWidget {
  const _PointsInfo();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.turquoise50,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.turquoise200),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: AppColors.turquoise600, size: 22),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'تكسب نقاط ولاء مع كل تعبئة. اجمع $kRewardThreshold نقطة لتحصل على تعبئة مجانية.',
              style: TextStyle(
                color: AppColors.turquoise700,
                fontSize: 12,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// سجلّ الدفعات: الطلبات المكتملة ذات [RefillOrder.paidAmountIqd] أكبر من صفر.
class _PaymentHistory extends ConsumerWidget {
  const _PaymentHistory();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(myOrdersProvider);

    return ordersAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) {
        final msg = e is ApiException ? e.message : 'تعذّر تحميل الدفعات.';
        return EmptyState(
          icon: Icons.cloud_off,
          title: 'تعذّر تحميل الدفعات',
          message: msg,
          actionLabel: 'إعادة المحاولة',
          onAction: () => ref.invalidate(myOrdersProvider),
        );
      },
      data: (orders) {
        final paid = orders
            .where((o) =>
                o.status == RefillOrderStatus.completed && o.paidAmountIqd > 0)
            .toList();

        if (paid.isEmpty) {
          return const EmptyState(
            icon: Icons.receipt_long_outlined,
            title: 'لا توجد مدفوعات بعد',
            message: 'ستظهر هنا دفعاتك بعد إتمام أول تعبئة.',
          );
        }

        return Column(
          children: [
            for (final o in paid) ...[
              _PaymentTile(order: o),
              const SizedBox(height: 10),
            ],
          ],
        );
      },
    );
  }
}

/// عنصر دفعة واحدة (المبلغ + التاريخ) قابل للنقر لفتح تفاصيل الطلب.
class _PaymentTile extends StatelessWidget {
  const _PaymentTile({required this.order});

  final RefillOrder order;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      onTap: () => context.push('/order/${order.id}'),
      child: SectionCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.water50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.payments_outlined,
                  color: AppColors.water600, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    Fmt.iqd(order.paidAmountIqd),
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: AppColors.ink,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    Fmt.arabicDate(order.completedAt ?? order.requestedAt),
                    style: const TextStyle(color: AppColors.muted, fontSize: 11),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_left, color: AppColors.muted, size: 20),
          ],
        ),
      ),
    );
  }
}
