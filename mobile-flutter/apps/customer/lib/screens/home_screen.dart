import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';
import '../widgets/common.dart';
import '../widgets/gradient_header.dart';
import '../widgets/order_widgets.dart';
import '../widgets/recent_activity.dart';

/// الشاشة الرئيسية للزبون: الرصيد + سعر التعبئة (أو حملة) + زر الطلب + الطلب النشط.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  bool _placing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // تسجيل توكن الإشعارات (best-effort) + فتح شاشة الطلب عند النقر على إشعار.
      ref.read(pushServiceProvider).register(
        onOpenNotification: (orderId, type) {
          if (orderId != null && orderId.isNotEmpty && context.mounted) {
            context.push('/order/$orderId');
          }
        },
      );
      // أوّل دخول: حوّل لتدفّق الإعداد إن لم يكتمل بعد.
      if (!await LocalFlags.hasSeenOnboarding() && mounted) {
        if (context.mounted) context.go('/onboarding');
      }
    });
  }

  Future<void> _placeOrder(CustomerProfile profile) async {
    setState(() => _placing = true);
    try {
      final order = await ref
          .read(ordersRepositoryProvider)
          .createRefill(customerId: profile.id);
      Hap.success();
      Analytics.capture('order_placed', properties: {'orderId': order.id});
      ref.invalidate(myOrdersProvider);
      ref.invalidate(myProfileProvider);
      if (mounted) {
        showSnack(context, 'تم إرسال طلبك! سيصلك سائق قريباً.');
        context.push('/order/${order.id}');
      }
    } on ApiException catch (e) {
      Hap.error();
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(myProfileProvider);
    final promoAsync = ref.watch(activePromoProvider);
    final ordersAsync = ref.watch(myOrdersProvider);

    return Scaffold(
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(myProfileProvider);
              ref.invalidate(myOrdersProvider);
              ref.invalidate(activePromoProvider);
            },
            child: AsyncView<CustomerProfile>(
          value: profileAsync,
          onRetry: () => ref.invalidate(myProfileProvider),
          data: (profile) {
            final promo = promoAsync.asData?.value;
            final orders = ordersAsync.asData?.value ?? const <RefillOrder>[];
            RefillOrder? activeOrder;
            for (final o in orders) {
              if (o.status.isActive) {
                activeOrder = o;
                break;
              }
            }
            final hasTank = profile.tanks.isNotEmpty;

            return ListView(
              padding: EdgeInsets.zero,
              children: [
                GradientHeader(
                  title: 'مرحباً ${profile.fullName}',
                  subtitle: profile.district,
                  trailing: IconButton(
                    onPressed: () => context.push('/notifications'),
                    icon: const Icon(Icons.notifications_outlined, color: Colors.white),
                  ),
                  child: _balanceCard(profile),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      if (activeOrder != null) _activeOrderCard(activeOrder),
                      _orderCard(profile, promo, hasTank),
                      const SizedBox(height: 14),
                      RefillStatusStrip(lastRefillAt: profile.lastRefillAt),
                      const SizedBox(height: 16),
                      _quickLinks(),
                      const SizedBox(height: 18),
                      const RecentActivityList(),
                    ],
                  ),
                ),
              ],
            );
          },
            ),
          ),
          const Positioned.fill(
            child: RainBackground(density: RainDensity.light),
          ),
        ],
      ),
    );
  }

  Widget _balanceCard(CustomerProfile profile) {
    final credit = profile.balanceIqd >= 0;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.account_balance_wallet, color: Colors.white),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(credit ? 'رصيدك' : 'عليك',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.85))),
                Text(Fmt.iqd(profile.balanceIqd.abs()),
                    style: const TextStyle(
                        color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
              ],
            ),
          ),
          _chip('${profile.totalRefills} تعبئة'),
        ],
      ),
    );
  }

  Widget _chip(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.22),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(text,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      );

  Widget _activeOrderCard(RefillOrder order) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: InkWell(
        onTap: () => context.push('/order/${order.id}'),
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        child: SectionCard(
          child: Row(
            children: [
              const Icon(Icons.local_shipping, color: AppColors.warn600, size: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('لديك طلب جارٍ',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    OrderStatusPill(status: order.status),
                  ],
                ),
              ),
              const Icon(Icons.chevron_left, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }

  Widget _orderCard(CustomerProfile profile, ActivePromo? promo, bool hasTank) {
    final hasPromo = promo != null;
    final price = hasPromo ? promo.promoPriceIqd : profile.refillPriceIqd;

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.water_drop, color: AppColors.navy600, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('تعبئة خزان مياه',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                    Row(
                      children: [
                        if (hasPromo) ...[
                          Text(Fmt.iqd(profile.refillPriceIqd),
                              style: const TextStyle(
                                  color: AppColors.muted,
                                  decoration: TextDecoration.lineThrough,
                                  fontSize: 13)),
                          const SizedBox(width: 8),
                        ],
                        Text(Fmt.iqd(price),
                            style: const TextStyle(
                                color: AppColors.navy700,
                                fontSize: 16,
                                fontWeight: FontWeight.w900)),
                      ],
                    ),
                  ],
                ),
              ),
              if (hasPromo)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.danger.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text('-${promo.discountPercent}%',
                      style: const TextStyle(
                          color: AppColors.danger, fontWeight: FontWeight.w800)),
                ),
            ],
          ),
          const SizedBox(height: 16),
          if (!hasTank)
            const _InfoBanner(
              icon: Icons.hourglass_top,
              text: 'بانتظار تسليم الخزان من المعمل. ستتمكّن من الطلب بعد التسليم.',
            )
          else
            LoadingButton(
              label: 'اطلب تعبئة الآن',
              icon: Icons.add,
              loading: _placing,
              onPressed: () => _placeOrder(profile),
            ),
        ],
      ),
    );
  }

  Widget _quickLinks() {
    final items = [
      (Icons.location_on_outlined, 'عناويني', '/addresses'),
      (Icons.event_repeat, 'الجدولة', '/schedules'),
      (Icons.card_giftcard, 'المحفظة', '/wallet'),
      (Icons.headset_mic_outlined, 'الدعم', '/support'),
    ];
    return GridView.count(
      crossAxisCount: 4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 0.85,
      children: items
          .map((it) => InkWell(
                onTap: () => context.push(it.$3),
                borderRadius: BorderRadius.circular(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.navy50,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(it.$1, color: AppColors.navy600),
                    ),
                    const SizedBox(height: 6),
                    Text(it.$2, style: const TextStyle(fontSize: 12.5)),
                  ],
                ),
              ))
          .toList(),
    );
  }
}

class _InfoBanner extends StatelessWidget {
  const _InfoBanner({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.warn500.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.warn600),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text,
                style: const TextStyle(color: AppColors.warn600, height: 1.5)),
          ),
        ],
      ),
    );
  }
}
