import 'dart:async';

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
  String? _selectedAddressId; // null = العنوان الافتراضي.

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

  Future<void> _placeOrder(CustomerProfile profile, String? addressId) async {
    setState(() => _placing = true);
    try {
      final order = await ref
          .read(ordersRepositoryProvider)
          .createRefill(customerId: profile.id, addressId: addressId);
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
    final addressesAsync = ref.watch(myAddressesProvider);

    return Scaffold(
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(myProfileProvider);
              ref.invalidate(myOrdersProvider);
              ref.invalidate(activePromoProvider);
            },
            child: profileAsync.when(
          loading: () => const SkeletonList(),
          error: (e, _) => _ProfileError(
            message: e is ApiException
                ? e.message
                : 'تعذّر تحميل ملفّك. حاول مجدداً.',
            onRetry: () => ref.invalidate(myProfileProvider),
            onLogout: () =>
                ref.read(authControllerProvider.notifier).logout(),
          ),
          data: (profile) {
            final promo = promoAsync.asData?.value;
            final orders = ordersAsync.asData?.value ?? const <RefillOrder>[];
            final addresses =
                addressesAsync.valueOrNull ?? const <SavedAddress>[];
            RefillOrder? activeOrder;
            for (final o in orders) {
              // طلب تعبئة حيّ فقط (لا يحجبه توصيل/استرجاع خزان من نوع آخر).
              if (o.kind == RefillOrderKind.refill && o.status.isActive) {
                activeOrder = o;
                break;
              }
            }
            final hasTank = profile.tanks.isNotEmpty;
            final defaultAddressId = addresses.isEmpty
                ? null
                : addresses
                    .firstWhere((a) => a.isDefault,
                        orElse: () => addresses.first)
                    .id;
            final selectedAddressId = _selectedAddressId ?? defaultAddressId;

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
                      _orderCard(profile, promo, hasTank, activeOrder,
                          addresses, selectedAddressId),
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
          if (profile.totalRefills > 0) _chip('${profile.totalRefills} تعبئة'),
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

  Widget _orderCard(CustomerProfile profile, ActivePromo? promo, bool hasTank,
      RefillOrder? activeOrder, List<SavedAddress> addresses,
      String? selectedAddressId) {
    final hasPromo = promo != null;
    final price = hasPromo ? promo.promoPriceIqd : profile.refillPriceIqd;
    final showSelector =
        hasTank && activeOrder == null && addresses.isNotEmpty;

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (hasPromo) ...[
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text('🎉 عرض محدود!',
                    style: TextStyle(
                        color: AppColors.success,
                        fontWeight: FontWeight.w800,
                        fontSize: 12)),
              ),
            ),
            const SizedBox(height: 10),
          ],
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
          else if (activeOrder != null)
            // طلب نشط قائم: لا نسمح بطلب جديد (يمنع الطلبات المكرّرة) — نوجّه للمتابعة.
            LoadingButton(
              label: 'طلبك قيد التنفيذ — تابِع الطلب',
              icon: Icons.local_shipping_outlined,
              color: AppColors.warn600,
              onPressed: () => context.push('/order/${activeOrder.id}'),
            )
          else ...[
            if (showSelector) ...[
              _AddressSelector(
                addresses: addresses,
                selectedId: selectedAddressId,
                onSelected: (id) =>
                    setState(() => _selectedAddressId = id),
              ),
              const SizedBox(height: 12),
            ],
            LoadingButton(
              label: 'اطلب تعبئة الآن',
              icon: Icons.add,
              loading: _placing,
              onPressed: () => _placeOrder(profile, selectedAddressId),
            ),
          ],
          if (hasPromo && promo.endAt != null) ...[
            const SizedBox(height: 10),
            _PromoCountdown(endAt: promo.endAt!),
          ],
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

/// أيقونة تسمية العنوان (البيت/العمل/مخصّص).
IconData _labelIcon(AddressLabel label) {
  switch (label) {
    case AddressLabel.home:
      return Icons.home_outlined;
    case AddressLabel.work:
      return Icons.work_outline;
    case AddressLabel.custom:
      return Icons.place_outlined;
  }
}

/// حالة خطأ تحميل الملف الشخصي — مع إعادة محاولة وتسجيل خروج.
class _ProfileError extends StatelessWidget {
  const _ProfileError({
    required this.message,
    required this.onRetry,
    required this.onLogout,
  });

  final String message;
  final VoidCallback onRetry;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off, size: 64, color: AppColors.muted),
            const SizedBox(height: 16),
            const Text('تعذّر التحميل',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.slate, height: 1.6)),
            const SizedBox(height: 20),
            OutlinedButton(
                onPressed: onRetry, child: const Text('إعادة المحاولة')),
            const SizedBox(height: 6),
            TextButton.icon(
              onPressed: onLogout,
              icon: const Icon(Icons.logout, size: 18, color: AppColors.danger),
              label: const Text('تسجيل الخروج',
                  style: TextStyle(color: AppColors.danger)),
            ),
          ],
        ),
      ),
    );
  }
}

/// منتقي عنوان التوصيل على الشاشة الرئيسية (شريط أفقي «توصيل إلى»).
class _AddressSelector extends StatelessWidget {
  const _AddressSelector({
    required this.addresses,
    required this.selectedId,
    required this.onSelected,
  });

  final List<SavedAddress> addresses;
  final String? selectedId;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('توصيل إلى',
            style: TextStyle(
                color: AppColors.slate,
                fontSize: 12,
                fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final a in addresses) ...[
                ChoiceChip(
                  avatar: Icon(_labelIcon(a.label), size: 16),
                  label: Text(a.title),
                  selected: selectedId == a.id,
                  onSelected: (_) => onSelected(a.id),
                ),
                const SizedBox(width: 8),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// عدّاد تنازلي للعرض الترويجي (يُحدَّث كل 30 ثانية، يحمرّ في آخر 5 دقائق).
class _PromoCountdown extends StatefulWidget {
  const _PromoCountdown({required this.endAt});
  final DateTime endAt;

  @override
  State<_PromoCountdown> createState() => _PromoCountdownState();
}

class _PromoCountdownState extends State<_PromoCountdown> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final remaining = widget.endAt.difference(DateTime.now());
    if (remaining.isNegative) return const SizedBox.shrink();
    final hours = remaining.inHours;
    final minutes = remaining.inMinutes % 60;
    final urgent = remaining.inMinutes < 5;
    final color = urgent ? AppColors.danger : AppColors.warn600;
    final label = hours > 0
        ? 'ينتهي العرض خلال $hours ساعة و $minutes دقيقة'
        : 'ينتهي العرض خلال $minutes دقيقة';
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.timer_outlined, size: 16, color: color),
        const SizedBox(width: 6),
        Text(label,
            style: TextStyle(
                color: color, fontSize: 12.5, fontWeight: FontWeight.w700)),
      ],
    );
  }
}
