import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';
import '../widgets/common.dart';
import '../widgets/gradient_header.dart';
import '../widgets/order_widgets.dart';

/// الشاشة الرئيسية للسائق: الترويسة + مفتاح الوردية + بركة الطلبات المتاحة
/// + مهام اليوم + روابط سريعة (النقد/الأرباح/الوردية/الفان/البيع الفوري).
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  bool _claiming = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // تسجيل توكن الإشعارات + فتح المهمة عند النقر على إشعار.
      // (تصريف الطابور صار على مستوى التطبيق في `_AppChrome` بـ main.dart.)
      ref.read(pushServiceProvider).register(
        onOpenNotification: (orderId, type) {
          if (orderId != null && orderId.isNotEmpty && context.mounted) {
            context.push('/task/$orderId');
          }
        },
      );
    });
  }

  Future<void> _toggleShift(bool value) async {
    ref.read(onShiftProvider.notifier).state = value;
    final location = ref.read(locationServiceProvider);
    try {
      if (value) {
        final ok = await location.startShift();
        if (!ok) {
          ref.read(onShiftProvider.notifier).state = false;
          if (mounted) {
            showSnack(context, 'فعّل خدمة الموقع لبدء الوردية', error: true);
          }
          return;
        }
        if (mounted) showSnack(context, 'بدأت الوردية — التتبّع يعمل');
      } else {
        await location.stopShift();
        if (mounted) showSnack(context, 'أُنهيت الوردية');
      }
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    }
  }

  Future<void> _claim(DriverTask task) async {
    if (_claiming) return;
    setState(() => _claiming = true);
    try {
      await ref.read(ordersRepositoryProvider).claim(task.id);
      Hap.success();
      Analytics.capture('order_claimed', properties: {'orderId': task.id});
      ref.invalidate(availableOrdersProvider);
      ref.invalidate(todayTasksProvider);
      if (!mounted) return;
      // حوار تأكيد بدل التنقّل التلقائي + snackbar (يطابق Expo «فتح المهمة»).
      final open = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('تم قبول الطلب'),
          content: const Text('أصبح ضمن مهامك. افتح المهمة لبدء الجولة.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('لاحقاً'),
            ),
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('فتح المهمة'),
            ),
          ],
        ),
      );
      if (open == true && mounted) context.push('/task/${task.id}');
    } on ApiException catch (e) {
      Hap.error();
      ref.invalidate(availableOrdersProvider);
      if (mounted) {
        showSnack(
          context,
          e.isConflict ? 'سبقك سائق آخر' : e.message,
          error: true,
        );
      }
    } finally {
      if (mounted) setState(() => _claiming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(driverProfileProvider);
    final availableAsync = ref.watch(availableOrdersProvider);
    final tasksAsync = ref.watch(todayTasksProvider);
    final onShift = ref.watch(onShiftProvider);
    final driverCoords = ref.watch(driverCoordsProvider).valueOrNull;
    final nearestFirst = ref.watch(nearestFirstProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(driverProfileProvider);
          ref.invalidate(availableOrdersProvider);
          ref.invalidate(todayTasksProvider);
        },
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            GradientHeader(
              title: 'مرحباً ${profileAsync.asData?.value.fullName ?? 'سائق'}',
              subtitle: onShift ? 'الوردية فعّالة' : 'غير متصل',
              trailing: _shiftSwitch(onShift),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _syncBanner(),
                  _quickLinks(),
                  const SizedBox(height: 20),
                  _sectionTitle('طلبات متاحة', Icons.flash_on),
                  const SizedBox(height: 10),
                  AsyncView<List<DriverTask>>(
                    value: availableAsync,
                    onRetry: () => ref.invalidate(availableOrdersProvider),
                    skeleton: const SkeletonList(count: 2, padding: EdgeInsets.zero),
                    data: (orders) {
                      if (orders.isEmpty) {
                        return const EmptyState(
                          icon: Icons.inbox_outlined,
                          title: 'لا طلبات متاحة الآن',
                          message: 'ستظهر الطلبات الجديدة هنا فور توفّرها.',
                        );
                      }
                      return Column(
                        children: [
                          for (final order in orders) ...[
                            _availableCard(order, driverCoords),
                            const SizedBox(height: 12),
                          ],
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  AsyncView<List<DriverTask>>(
                    value: tasksAsync,
                    onRetry: () => ref.invalidate(todayTasksProvider),
                    skeleton: const SkeletonList(count: 2, padding: EdgeInsets.zero),
                    data: (tasks) =>
                        _todaySection(tasks, driverCoords, nearestFirst),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// شريط الحالة: «غير متصل» و/أو «N عملية بانتظار المزامنة». يختفي عند الاتصال
  /// وخلوّ الطابور. يجمع وظيفتَي OfflineBanner و WorkerHeader-badge من Expo.
  Widget _syncBanner() {
    final online = ref.watch(isOnlineProvider).value ?? true;
    final pending = ref.watch(pendingMutationsProvider).value ?? 0;
    if (online && pending == 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        children: [
          if (!online)
            _banner(
              color: AppColors.danger,
              icon: Icons.wifi_off,
              text: 'أنت غير متصل بالإنترنت — تعمل دون اتصال.',
            ),
          if (pending > 0) ...[
            if (!online) const SizedBox(height: 8),
            _banner(
              color: AppColors.warn600,
              icon: Icons.sync,
              text: '$pending عملية بانتظار المزامنة — ستُرسَل تلقائياً.',
            ),
          ],
        ],
      ),
    );
  }

  Widget _banner({
    required Color color,
    required IconData icon,
    required String text,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                  color: color, fontWeight: FontWeight.w700, fontSize: 12.5),
            ),
          ),
        ],
      ),
    );
  }

  Widget _shiftSwitch(bool onShift) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          onShift ? 'متصل' : 'غير متصل',
          style:
              const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
        const SizedBox(width: 6),
        Switch(
          value: onShift,
          onChanged: _toggleShift,
          activeThumbColor: Colors.white,
          activeTrackColor: AppColors.success,
        ),
      ],
    );
  }

  Widget _sectionTitle(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: AppColors.navy600, size: 20),
        const SizedBox(width: 8),
        Text(title,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
      ],
    );
  }

  Widget _newBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.success,
        borderRadius: BorderRadius.circular(999),
      ),
      child: const Text('جديد',
          style: TextStyle(
              color: Colors.white,
              fontSize: 10.5,
              fontWeight: FontWeight.w900)),
    );
  }

  Widget _miniChip(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: AppColors.slate),
          const SizedBox(width: 4),
          Text(text,
              style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.slate)),
        ],
      ),
    );
  }

  Widget _availableCard(DriverTask order, Coords? driverCoords) {
    final tank = order.tank;
    final name = order.customer.fullName;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              // صورة بالحرف الأوّل من اسم الزبون.
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.navy50,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  name.isEmpty ? '؟' : name.substring(0, 1),
                  style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                      color: AppColors.navy600),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 15)),
                    const SizedBox(height: 2),
                    Text(
                      order.customer.district,
                      style: const TextStyle(
                          color: AppColors.muted, fontSize: 12.5),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  _newBadge(),
                  const SizedBox(height: 6),
                  DistanceChip(driver: driverCoords, customer: order.customer),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          // شارات: النوع + سعة الخزّان + رمز QR (حين يتوفّر الخزّان).
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _miniChip(orderKindIcon(order.kind), order.kind.label),
              if (tank != null)
                _miniChip(Icons.water_drop_outlined, tank.capacity),
              if (tank != null) _miniChip(Icons.qr_code_2, tank.qrCode),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppTheme.radiusInput),
            ),
            child: Row(
              children: [
                const Text('تحصيل عند التسليم',
                    style: TextStyle(
                        color: AppColors.success, fontWeight: FontWeight.w700)),
                const Spacer(),
                Text(Fmt.iqd(order.priceIqd),
                    style: const TextStyle(
                        color: AppColors.success,
                        fontWeight: FontWeight.w900,
                        fontSize: 16)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          LoadingButton(
            label: 'قبول',
            icon: Icons.check,
            color: AppColors.success,
            loading: _claiming,
            onPressed: () => _claim(order),
          ),
        ],
      ),
    );
  }

  Widget _taskCard(DriverTask task, Coords? driverCoords) {
    return InkWell(
      onTap: () => context.push('/task/${task.id}'),
      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      child: SectionCard(
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.navy50,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(orderKindIcon(task.kind), color: AppColors.navy600),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(task.customer.fullName,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text(
                    '${task.customer.district} · ${task.kind.label}',
                    style:
                        const TextStyle(color: AppColors.muted, fontSize: 12.5),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  OrderStatusPill(status: task.status),
                ],
              ),
            ),
            DistanceChip(driver: driverCoords, customer: task.customer),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_left, color: AppColors.muted),
          ],
        ),
      ),
    );
  }

  /// قسم «مهام اليوم»: بطاقة المهمة النشطة (EN_ROUTE) المميَّزة + مفتاح «الأقرب
  /// أولاً» + قائمة البقيّة (مرتّبة بالمسافة عند التفعيل). يطابق بنية worker/home.tsx.
  Widget _todaySection(
      List<DriverTask> tasks, Coords? driverCoords, bool nearestFirst) {
    DriverTask? active;
    final others = <DriverTask>[];
    for (final t in tasks) {
      if (active == null && t.status == RefillOrderStatus.enRoute) {
        active = t;
      } else {
        others.add(t);
      }
    }
    if (nearestFirst && driverCoords != null) {
      others.sort((a, b) => _distMetres(driverCoords, a.customer)
          .compareTo(_distMetres(driverCoords, b.customer)));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (active != null) ...[
          _activeTaskCard(active, driverCoords),
          const SizedBox(height: 14),
        ],
        Row(
          children: [
            Expanded(child: _sectionTitle('مهام اليوم', Icons.list_alt)),
            _nearestFirstChip(nearestFirst, driverCoords),
          ],
        ),
        const SizedBox(height: 10),
        if (others.isEmpty && active == null)
          const EmptyState(
            icon: Icons.check_circle_outline,
            title: 'لا مهام اليوم',
            message: 'اقبل طلباً من البركة لبدء جولتك.',
          )
        else
          for (final task in others) ...[
            _taskCard(task, driverCoords),
            const SizedBox(height: 12),
          ],
      ],
    );
  }

  /// المسافة بالأمتار، أو ما لا نهاية للمهام بلا إحداثيات (تُرتَّب أخيراً).
  double _distMetres(Coords driver, TaskCustomer c) {
    if (!c.hasLocation) return double.infinity;
    return LocationService.distanceMetres(
        driver, Coords(lng: c.locationLng!, lat: c.locationLat!));
  }

  /// مفتاح «الأقرب أولاً»: يبدّل الفرز، وعند التفعيل بلا موقع يعيد جلب GPS وينبّه إن تعذّر.
  Widget _nearestFirstChip(bool active, Coords? driverCoords) {
    final locating = ref.watch(driverCoordsProvider).isLoading;
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: () async {
        final next = !active;
        ref.read(nearestFirstProvider.notifier).state = next;
        if (next && driverCoords == null) {
          final coords = await ref.refresh(driverCoordsProvider.future);
          if (coords == null && mounted) {
            showSnack(context,
                'GPS غير متاح — فعّل خدمات الموقع للترتيب حسب الأقرب.',
                error: true);
          }
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? AppColors.water600 : AppColors.water100,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.near_me,
                size: 14, color: active ? Colors.white : AppColors.water700),
            const SizedBox(width: 4),
            Text(
              locating ? 'جارٍ التحديد…' : 'الأقرب أولاً',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: active ? Colors.white : AppColors.water700),
            ),
          ],
        ),
      ),
    );
  }

  /// بطاقة المهمة النشطة (قيد التنفيذ) — CTA متدرّج بارز يقود لمتابعة الجولة.
  Widget _activeTaskCard(DriverTask task, Coords? driverCoords) {
    final dist = distanceLabel(
        driverCoords, task.customer.locationLat, task.customer.locationLng);
    return InkWell(
      onTap: () => context.push('/task/${task.id}'),
      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [AppColors.water500, AppColors.water700],
          ),
          borderRadius: BorderRadius.circular(AppTheme.radiusCard),
          boxShadow: [
            BoxShadow(
              color: AppColors.water600.withValues(alpha: 0.28),
              blurRadius: 14,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text('قيد التنفيذ',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 11.5)),
                ),
                const Spacer(),
                if (dist != null)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.near_me, size: 14, color: Colors.white),
                      const SizedBox(width: 4),
                      Text(dist,
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 12.5)),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(orderKindIcon(task.kind), color: Colors.white, size: 26),
                const SizedBox(width: 8),
                Text(task.kind.label,
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 18)),
              ],
            ),
            const SizedBox(height: 6),
            Text(task.customer.fullName,
                style: const TextStyle(color: Colors.white, fontSize: 15)),
            const SizedBox(height: 2),
            Text(
              '${task.customer.district} · ${task.customer.addressLine}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.85), fontSize: 13),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(vertical: 11),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppTheme.radiusInput),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.navigation, size: 18, color: AppColors.water700),
                  SizedBox(width: 6),
                  Text('تابِع المهمة',
                      style: TextStyle(
                          color: AppColors.water700,
                          fontWeight: FontWeight.w900,
                          fontSize: 14)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _quickLinks() {
    final items = <(IconData, String, String)>[
      (Icons.payments, 'النقد', '/cash'),
      (Icons.emoji_events, 'الأرباح', '/earnings'),
      (Icons.assignment_turned_in, 'الوردية', '/shift-summary'),
      (Icons.local_shipping, 'جرد الفان', '/van-inventory'),
      (Icons.point_of_sale, 'بيع فوري', '/walkin'),
    ];
    return GridView.count(
      crossAxisCount: 5,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 8,
      childAspectRatio: 0.7,
      children: [
        for (final it in items)
          InkWell(
            onTap: () => context.push(it.$3),
            borderRadius: BorderRadius.circular(14),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.navy50,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(it.$1, color: AppColors.navy600, size: 22),
                ),
                const SizedBox(height: 6),
                Text(it.$2,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11.5)),
              ],
            ),
          ),
      ],
    );
  }
}
