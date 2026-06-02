import 'dart:async';

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
  Timer? _flushTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // تسجيل توكن الإشعارات + تصريف الطابور الأوفلاين (best-effort).
      ref.read(pushServiceProvider).register();
      _flushQueue();
    });
    // مؤقّت تصريف الطابور كل 60 ثانية (يطابق worker/_layout.tsx).
    _flushTimer =
        Timer.periodic(const Duration(seconds: 60), (_) => _flushQueue());
  }

  @override
  void dispose() {
    _flushTimer?.cancel();
    super.dispose();
  }

  /// يصرّف الطفرات المعلّقة؛ عند نجاح أيٍّ منها يُعيد جلب البيانات المتأثّرة.
  Future<void> _flushQueue() async {
    try {
      final res = await ref.read(offlineQueueProvider).flush();
      if (res.ok > 0) {
        ref.invalidate(todayTasksProvider);
        ref.invalidate(historyProvider);
        ref.invalidate(cashSummaryProvider);
      }
    } catch (_) {
      // best-effort — سنحاول مجدداً في الدورة التالية.
    }
    if (mounted) ref.invalidate(pendingMutationsProvider);
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
      if (mounted) {
        showSnack(context, 'تم قبول الطلب — ابدأ المهمة');
        context.push('/task/${task.id}');
      }
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

    // صرّف الطابور تلقائياً لحظة عودة الاتصال (لم يكن في Expo — كان مؤقّتاً فقط).
    ref.listen<AsyncValue<bool>>(isOnlineProvider, (prev, next) {
      if (prev?.value == false && next.value == true) _flushQueue();
    });

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
                            _availableCard(order),
                            const SizedBox(height: 12),
                          ],
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  _sectionTitle('مهام اليوم', Icons.list_alt),
                  const SizedBox(height: 10),
                  AsyncView<List<DriverTask>>(
                    value: tasksAsync,
                    onRetry: () => ref.invalidate(todayTasksProvider),
                    skeleton: const SkeletonList(count: 2, padding: EdgeInsets.zero),
                    data: (tasks) {
                      if (tasks.isEmpty) {
                        return const EmptyState(
                          icon: Icons.check_circle_outline,
                          title: 'لا مهام اليوم',
                          message: 'اقبل طلباً من البركة لبدء جولتك.',
                        );
                      }
                      return Column(
                        children: [
                          for (final task in tasks) ...[
                            _taskCard(task),
                            const SizedBox(height: 12),
                          ],
                        ],
                      );
                    },
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

  Widget _availableCard(DriverTask order) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.navy50,
                  borderRadius: BorderRadius.circular(14),
                ),
                child:
                    Icon(orderKindIcon(order.kind), color: AppColors.navy600),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(order.customer.fullName,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 15)),
                    const SizedBox(height: 2),
                    Text(
                      '${order.customer.district} · ${order.kind.label}',
                      style: const TextStyle(
                          color: AppColors.muted, fontSize: 12.5),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
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

  Widget _taskCard(DriverTask task) {
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
            const Icon(Icons.chevron_left, color: AppColors.muted),
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
