import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../providers.dart';
import '../widgets/common.dart';
import '../widgets/order_widgets.dart';

/// تفاصيل مهمة السائق — بيانات الزبون، خريطة موقعه، وأزرار الفعل حسب الحالة
/// (ابدأ الجولة / إكمال التسليم / استرجاع خزان / تعذّر التسليم).
class TaskDetailScreen extends ConsumerStatefulWidget {
  const TaskDetailScreen({super.key, required this.taskId});

  final String taskId;

  @override
  ConsumerState<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends ConsumerState<TaskDetailScreen> {
  bool _busy = false;
  ReclaimReason _reclaimReason = ReclaimReason.customerMoved;

  /// بدء الجولة: ASSIGNED → EN_ROUTE.
  Future<void> _startTrip() async {
    setState(() => _busy = true);
    try {
      await ref.read(ordersRepositoryProvider).start(widget.taskId);
      Hap.press();
      // تأكّد أن بثّ الموقع يعمل أثناء EN_ROUTE كي يظهر السائق على خريطة الزبون،
      // حتى إن لم يُفعّل السائق مفتاح الوردية يدوياً (best-effort — لا يُفشِل بدء الجولة).
      final loc = ref.read(locationServiceProvider);
      if (!loc.isTracking) {
        final started = await loc.startShift();
        if (started && mounted) {
          ref.read(onShiftProvider.notifier).state = true;
        }
      }
      if (!mounted) return;
      ref.invalidate(todayTasksProvider);
      showSnack(context, 'بدأت الجولة — الزبون يرى أنك في الطريق');
    } on ApiException catch (e) {
      if (!mounted) return;
      showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// إكمال التسليم (أو استرجاع الخزان) مع تحصيل النقد وإحداثيات الإكمال.
  Future<void> _complete(DriverTask task) async {
    setState(() => _busy = true);
    // نُجهّز جسم الطلب مسبقاً كي نحفظه في الطابور عند فشل الشبكة.
    Map<String, dynamic>? pendingBody;
    final completePath = '/orders/${widget.taskId}/complete';
    try {
      final coords = await ref.read(locationServiceProvider).currentCoords();
      if (coords == null) {
        if (!mounted) return;
        showSnack(context, 'تعذّر تحديد موقعك — فعّل خدمات الموقع',
            error: true);
        return;
      }

      // حاجز الوصول: ارفض الإكمال إن كان السائق بعيداً عن منزل الزبون (مانع
      // احتيال «التعبئة من آخر الشارع»). الباك إند يفرض نفس الحدّ عبر
      // REFILL_GPS_MAX_DISTANCE_M؛ هذا الفحص العميلي يعطي رسالة فورية قبل الإرسال.
      // يُطبَّق على التعبئة فقط (لا الاسترجاع) وعند توفّر إحداثيات الزبون.
      const maxArrivalMetres = 50.0;
      final cust = task.customer;
      if (task.kind != RefillOrderKind.tankReclaim && cust.hasLocation) {
        final metres = LocationService.distanceMetres(
          coords,
          Coords(lng: cust.locationLng!, lat: cust.locationLat!),
        );
        if (metres > maxArrivalMetres) {
          if (!mounted) return;
          showSnack(
            context,
            'أنت بعيد عن موقع الزبون (${metres.round()} م). اقترب أكثر لإتمام التسليم.',
            error: true,
          );
          return;
        }
      }

      final input = CompleteOrderInput(
        paymentMethod: PaymentMethod.cash,
        paidAmountIqd: task.priceIqd,
        completionLng: coords.lng,
        completionLat: coords.lat,
      );
      final isReclaim = task.kind == RefillOrderKind.tankReclaim;
      final reclaimInput = isReclaim
          ? ReclaimInput(complete: input, reason: _reclaimReason)
          : null;
      pendingBody = reclaimInput?.toJson() ?? input.toJson();

      final repo = ref.read(ordersRepositoryProvider);
      if (reclaimInput != null) {
        await repo.reclaim(widget.taskId, reclaimInput);
      } else {
        await repo.complete(widget.taskId, input);
      }

      Hap.success();
      Analytics.capture('order_completed',
          properties: {'orderId': widget.taskId, 'kind': task.kind.name});
      ref.invalidate(todayTasksProvider);
      ref.invalidate(historyProvider);
      if (!mounted) return;
      showSnack(context, 'تم إتمام المهمة بنجاح');
      context.pop();
    } on ApiException catch (e) {
      // فشل شبكة → احفظ العملية في الطابور لتُرسَل لاحقاً (لا تُفقَد).
      if (e.isNetwork && pendingBody != null) {
        await ref
            .read(offlineQueueProvider)
            .enqueue('POST', completePath, pendingBody);
        ref.invalidate(todayTasksProvider);
        if (!mounted) return;
        showSnack(context,
            'لا يوجد اتصال — حُفظت العملية وستُرسَل تلقائياً عند عودة الشبكة.');
        context.pop();
        return;
      }
      if (!mounted) return;
      showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// إلغاء المهمة بسبب من السائق (تعذّر التسليم).
  Future<void> _cancelWithReason(String reason) async {
    setState(() => _busy = true);
    try {
      await ref
          .read(ordersRepositoryProvider)
          .cancel(widget.taskId, reason: reason);
      ref.invalidate(todayTasksProvider);
      if (!mounted) return;
      showSnack(context, 'تم إلغاء المهمة — أبلغ المعمل بالتفاصيل');
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openFailSheet() async {
    final reason = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppTheme.radiusCard)),
      ),
      builder: (sheetContext) {
        const reasons = <String>[
          'الزبون غير متواجد',
          'العنوان خاطئ',
          'رفض الزبون',
          'سبب آخر',
        ];
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'سبب تعذّر التسليم',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 12),
                for (final r in reasons)
                  ListTile(
                    title: Text(r,
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    trailing:
                        const Icon(Icons.chevron_left, color: AppColors.muted),
                    onTap: () => Navigator.of(sheetContext).pop(r),
                  ),
              ],
            ),
          ),
        );
      },
    );

    if (reason != null && reason.isNotEmpty) {
      await _cancelWithReason(reason);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tasksAsync = ref.watch(todayTasksProvider);
    final task = tasksAsync.maybeWhen(
      data: (tasks) {
        for (final t in tasks) {
          if (t.id == widget.taskId) return t;
        }
        return null;
      },
      orElse: () => null,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(task == null ? 'تفاصيل المهمة' : task.kind.label),
      ),
      body: AsyncView<List<DriverTask>>(
        value: tasksAsync,
        onRetry: () => ref.invalidate(todayTasksProvider),
        data: (_) {
          if (task == null) {
            return EmptyState(
              icon: Icons.search_off,
              title: 'المهمة غير موجودة',
              message: 'قد تكون اكتملت أو أُلغيت.',
              actionLabel: 'رجوع',
              onAction: () => context.pop(),
            );
          }
          return _TaskBody(
            task: task,
            busy: _busy,
            reclaimReason: _reclaimReason,
            onReclaimReasonChanged: (r) => setState(() => _reclaimReason = r),
            onStart: () => _startTrip(),
            onComplete: () => _complete(task),
            onFail: () => _openFailSheet(),
          );
        },
      ),
    );
  }
}

/// جسم الشاشة — منفصل لإبقاء build نظيفاً.
class _TaskBody extends StatelessWidget {
  const _TaskBody({
    required this.task,
    required this.busy,
    required this.reclaimReason,
    required this.onReclaimReasonChanged,
    required this.onStart,
    required this.onComplete,
    required this.onFail,
  });

  final DriverTask task;
  final bool busy;
  final ReclaimReason reclaimReason;
  final ValueChanged<ReclaimReason> onReclaimReasonChanged;
  final VoidCallback onStart;
  final VoidCallback onComplete;
  final VoidCallback onFail;

  @override
  Widget build(BuildContext context) {
    final customer = task.customer;
    final isAssigned = task.status == RefillOrderStatus.assigned;
    final isEnRoute = task.status == RefillOrderStatus.enRoute;
    final isReclaim = task.kind == RefillOrderKind.tankReclaim;
    final completeVerb =
        task.kind == RefillOrderKind.tankDelivery ? 'التوصيل' : 'التعبئة';

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        // حالة المهمة
        Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: AppColors.navy50,
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(orderKindIcon(task.kind),
                  color: AppColors.navy600, size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                task.kind.label,
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
              ),
            ),
            OrderStatusPill(status: task.status),
          ],
        ),
        const SizedBox(height: 16),

        // بطاقة الزبون
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                customer.fullName,
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              _InfoRow(icon: Icons.phone, text: customer.phone),
              const SizedBox(height: 6),
              _InfoRow(icon: Icons.place, text: customer.district),
              const SizedBox(height: 6),
              _InfoRow(icon: Icons.home, text: customer.addressLine),
              if (task.tank != null) ...[
                const SizedBox(height: 6),
                _InfoRow(
                  icon: Icons.qr_code_2,
                  text: 'QR ${task.tank!.qrCode} · ${task.tank!.capacity}',
                ),
              ],
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: LoadingButton(
                      label: 'اتصال',
                      icon: Icons.call,
                      color: AppColors.success,
                      onPressed: () => Launchers.call(customer.phone),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: LoadingButton(
                      label: 'واتساب',
                      icon: Icons.chat,
                      color: AppColors.turquoise500,
                      onPressed: () => Launchers.whatsapp(
                        customer.phone,
                        text: 'مرحباً، أنا سائق «داري» بخصوص طلبك.',
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        // الخريطة + الملاحة
        if (customer.hasLocation) ...[
          const SizedBox(height: 16),
          _CustomerMap(lat: customer.locationLat!, lng: customer.locationLng!),
          const SizedBox(height: 10),
          LoadingButton(
            label: 'ابدأ الملاحة',
            icon: Icons.navigation,
            color: AppColors.water600,
            onPressed: () => Launchers.navigate(
              lat: customer.locationLat!,
              lng: customer.locationLng!,
            ),
          ),
        ],

        const SizedBox(height: 16),

        // بطاقة المبلغ المحصّل
        SectionCard(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'يُحصّل نقداً عند التسليم',
                style: TextStyle(
                    fontSize: 13,
                    color: AppColors.slate,
                    fontWeight: FontWeight.w700),
              ),
              Text(
                Fmt.iqd(task.priceIqd),
                style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: AppColors.water600),
              ),
            ],
          ),
        ),

        // اختيار سبب السحب (لمهام الاسترجاع)
        if (isReclaim && isEnRoute) ...[
          const SizedBox(height: 16),
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'سبب سحب الخزان',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 6),
                RadioGroup<ReclaimReason>(
                  groupValue: reclaimReason,
                  onChanged: (v) {
                    if (busy || v == null) return;
                    onReclaimReasonChanged(v);
                  },
                  child: Column(
                    children: [
                      for (final r in ReclaimReason.values)
                        RadioListTile<ReclaimReason>(
                          value: r,
                          activeColor: AppColors.danger,
                          contentPadding: EdgeInsets.zero,
                          title: Text(r.label,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w700)),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],

        const SizedBox(height: 20),

        // الأفعال حسب الحالة
        if (isAssigned)
          LoadingButton(
            label: 'ابدأ الجولة',
            icon: Icons.play_arrow,
            loading: busy,
            onPressed: busy ? null : onStart,
          )
        else if (isEnRoute)
          LoadingButton(
            label:
                isReclaim ? 'أكّد سحب الخزان' : 'إكمال $completeVerb والتحصيل',
            icon: Icons.check_circle,
            color: isReclaim ? AppColors.danger : AppColors.success,
            loading: busy,
            onPressed: busy ? null : onComplete,
          )
        else
          SectionCard(
            child: Row(
              children: [
                const Icon(Icons.info_outline,
                    color: AppColors.muted, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'هذه المهمة بحالة «${task.status.label}» ولا تتطلّب إجراءً الآن.',
                    style:
                        const TextStyle(color: AppColors.slate, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),

        // تعذّر التسليم
        if (isAssigned || isEnRoute) ...[
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: busy ? null : onFail,
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.danger,
              side: const BorderSide(color: AppColors.danger),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            icon: const Icon(Icons.cancel_outlined, size: 20),
            label: const Text('تعذّر التسليم'),
          ),
        ],
      ],
    );
  }
}

/// سطر معلومة بأيقونة.
class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: AppColors.muted),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 14, color: AppColors.ink),
          ),
        ),
      ],
    );
  }
}

/// خريطة صغيرة بعلامة على موقع الزبون.
class _CustomerMap extends StatelessWidget {
  const _CustomerMap({required this.lat, required this.lng});

  final double lat;
  final double lng;

  @override
  Widget build(BuildContext context) {
    final target = LatLng(lat, lng);
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      child: SizedBox(
        height: 180,
        child: GoogleMap(
          initialCameraPosition: CameraPosition(target: target, zoom: 15),
          markers: {
            Marker(
              markerId: const MarkerId('customer'),
              position: target,
              infoWindow: const InfoWindow(title: 'موقع الزبون'),
            ),
          },
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
          liteModeEnabled: true,
        ),
      ),
    );
  }
}
