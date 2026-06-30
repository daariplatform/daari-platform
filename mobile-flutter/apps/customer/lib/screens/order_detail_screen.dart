import 'dart:math' as math;

import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../providers.dart';
import '../widgets/common.dart';
import '../widgets/order_widgets.dart';

/// تفاصيل طلب واحد + التتبّع: خطّ زمني للحالات، بطاقة ETA، معلومات السائق،
/// وأزرار الإجراءات حسب حالة الطلب (إلغاء/تأكيد/إبلاغ/تقييم).
class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orderAsync = ref.watch(orderProvider(orderId));
    return Scaffold(
      appBar: AppBar(title: const Text('تفاصيل الطلب')),
      body: AsyncView<RefillOrder>(
        value: orderAsync,
        onRetry: () => ref.invalidate(orderProvider(orderId)),
        data: (order) => _OrderBody(orderId: orderId, order: order),
      ),
    );
  }
}

class _OrderBody extends ConsumerWidget {
  const _OrderBody({required this.orderId, required this.order});

  final String orderId;
  final RefillOrder order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = order.status;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _Header(order: order),
        const SizedBox(height: 16),
        _StatusCard(status: status),
        if (status.isActive &&
            order.deliveryLat != null &&
            order.deliveryLng != null) ...[
          const SizedBox(height: 12),
          _TrackingMap(order: order),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => Launchers.navigate(
                lat: order.deliveryLat!, lng: order.deliveryLng!),
            icon: const Icon(Icons.navigation_outlined),
            label: const Text('افتح في خرائط Google'),
          ),
        ],
        if (status == RefillOrderStatus.enRoute && order.etaMinutes != null) ...[
          const SizedBox(height: 12),
          _EtaCard(minutes: order.etaMinutes!),
        ],
        if (order.driver != null) ...[
          const SizedBox(height: 12),
          _DriverCard(driver: order.driver!),
        ],
        const SizedBox(height: 12),
        _PriceCard(order: order),
        const SizedBox(height: 16),
        if (status.isActive) _CancelButton(orderId: orderId),
        if (status == RefillOrderStatus.completed) ...[
          if (order.isRated)
            _RatedCard(rating: order.rating!)
          else
            _RatingForm(orderId: orderId),
          const SizedBox(height: 12),
          // التأكيد/الإبلاغ يظهران فقط قبل تأكيد الزبون؛ بعده تظهر لافتة شكر.
          if (order.customerConfirmedAt == null) ...[
            _ConfirmButton(orderId: orderId),
            const SizedBox(height: 10),
            _DisputeButton(orderId: orderId),
          ] else
            const _ConfirmedBanner(),
        ],
        const SizedBox(height: 24),
      ],
    );
  }
}

/// ترويسة: رقم الطلب + الشارة + المبلغ + التاريخ.
class _Header extends StatelessWidget {
  const _Header({required this.order});

  final RefillOrder order;

  @override
  Widget build(BuildContext context) {
    final shortId = order.id.length <= 6
        ? order.id.toUpperCase()
        : order.id.substring(order.id.length - 6).toUpperCase();
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('رقم الطلب',
                        style: TextStyle(color: AppColors.muted, fontSize: 12)),
                    const SizedBox(height: 2),
                    Text('#$shortId',
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 18)),
                  ],
                ),
              ),
              OrderStatusPill(status: order.status),
            ],
          ),
          const Divider(height: 24, color: AppColors.line),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('المبلغ',
                        style: TextStyle(color: AppColors.muted, fontSize: 12)),
                    const SizedBox(height: 2),
                    Text(Fmt.iqd(order.priceIqd),
                        style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                            color: AppColors.water600)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('التاريخ',
                      style: TextStyle(color: AppColors.muted, fontSize: 12)),
                  const SizedBox(height: 2),
                  Text(Fmt.arabicDate(order.requestedAt),
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 13)),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// مرحلة في الخطّ الزمني.
class _Stage {
  const _Stage(this.status, this.label, this.icon);
  final RefillOrderStatus status;
  final String label;
  final IconData icon;
}

const _stages = <_Stage>[
  _Stage(
      RefillOrderStatus.pending, 'تم استلام طلبك', Icons.description_outlined),
  _Stage(RefillOrderStatus.assigned, 'تم تعيين سائق', Icons.person_outline),
  _Stage(RefillOrderStatus.enRoute, 'السائق في الطريق إليك',
      Icons.local_shipping_outlined),
  _Stage(RefillOrderStatus.completed, 'تم التسليم', Icons.check_circle_outline),
];

/// بطاقة الحالة: خطّ زمني أو رسالة إلغاء.
class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.status});

  final RefillOrderStatus status;

  @override
  Widget build(BuildContext context) {
    final cancelled = status == RefillOrderStatus.cancelled ||
        status == RefillOrderStatus.failed;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text('حالة الطلب',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          ),
          const SizedBox(height: 12),
          if (cancelled)
            _CancelledBanner(label: status.label)
          else
            _Timeline(status: status),
        ],
      ),
    );
  }
}

class _CancelledBanner extends StatelessWidget {
  const _CancelledBanner({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AppTheme.radiusInput),
      ),
      child: Row(
        children: [
          const Icon(Icons.cancel_outlined, color: AppColors.danger, size: 26),
          const SizedBox(width: 10),
          Expanded(
            child: Text(label,
                style: const TextStyle(
                    color: AppColors.danger, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}

/// لافتة شكر تظهر بعد تأكيد الزبون استلامَه (بدل أزرار التأكيد/الإبلاغ).
class _ConfirmedBanner extends StatelessWidget {
  const _ConfirmedBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AppTheme.radiusInput),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.35)),
      ),
      child: const Row(
        children: [
          Icon(Icons.check_circle, color: AppColors.success, size: 26),
          SizedBox(width: 10),
          Expanded(
            child: Text('تأكّد استلام التعبئة. شكراً لك!',
                style: TextStyle(
                    color: AppColors.success, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}

class _Timeline extends StatelessWidget {
  const _Timeline({required this.status});

  final RefillOrderStatus status;

  @override
  Widget build(BuildContext context) {
    final currentIdx = _stages.indexWhere((s) => s.status == status);
    return Column(
      children: [
        for (var i = 0; i < _stages.length; i++)
          _TimelineRow(
            stage: _stages[i],
            done: currentIdx >= 0 && i < currentIdx,
            current: i == currentIdx,
            isLast: i == _stages.length - 1,
          ),
      ],
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.stage,
    required this.done,
    required this.current,
    required this.isLast,
  });

  final _Stage stage;
  final bool done;
  final bool current;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final active = done || current;
    final color = active ? AppColors.water600 : AppColors.line;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: active ? AppColors.water600 : AppColors.navy50,
                  shape: BoxShape.circle,
                ),
                child: Icon(stage.icon,
                    size: 18, color: active ? Colors.white : AppColors.muted),
              ),
              if (!isLast)
                Expanded(
                  child:
                      Container(width: 2, color: done ? color : AppColors.line),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 8, bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(stage.label,
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: active ? AppColors.ink : AppColors.muted)),
                  if (current)
                    const Padding(
                      padding: EdgeInsets.only(top: 2),
                      child: Text('جارٍ التحديث...',
                          style:
                              TextStyle(color: AppColors.slate, fontSize: 12)),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// بطاقة تقدير الوصول.
/// خريطة التتبّع الحيّ: علامة وجهة التوصيل (دائماً) + علامة السائق (عند توفّر
/// موقعه)، تتحرّك كاميرتها لتشمل الاثنين. الطلب يُعاد جلبه كل ١٥ث (orderProvider)
/// فتتحدّث علامة السائق تلقائياً أثناء `EN_ROUTE`. منقولة من خريطة Expo
/// (order/[id].tsx OrderMap).
class _TrackingMap extends StatefulWidget {
  const _TrackingMap({required this.order});
  final RefillOrder order;

  @override
  State<_TrackingMap> createState() => _TrackingMapState();
}

class _TrackingMapState extends State<_TrackingMap> {
  GoogleMapController? _controller;

  LatLng? get _delivery {
    final lat = widget.order.deliveryLat, lng = widget.order.deliveryLng;
    if (lat == null || lng == null) return null;
    return LatLng(lat, lng);
  }

  LatLng? get _driver {
    final d = widget.order.driver;
    if (d == null || !d.hasLocation) return null;
    return LatLng(d.currentLat!, d.currentLng!);
  }

  @override
  void didUpdateWidget(covariant _TrackingMap old) {
    super.didUpdateWidget(old);
    _fitCamera();
  }

  /// يحرّك الكاميرا لتشمل الوجهة والسائق (أو يتمركز على الوجهة وحدها).
  Future<void> _fitCamera() async {
    final controller = _controller;
    final delivery = _delivery;
    if (controller == null || delivery == null) return;
    final driver = _driver;
    if (driver == null) {
      await controller.animateCamera(CameraUpdate.newLatLngZoom(delivery, 15));
      return;
    }
    final bounds = LatLngBounds(
      southwest: LatLng(
        math.min(delivery.latitude, driver.latitude),
        math.min(delivery.longitude, driver.longitude),
      ),
      northeast: LatLng(
        math.max(delivery.latitude, driver.latitude),
        math.max(delivery.longitude, driver.longitude),
      ),
    );
    await controller.animateCamera(CameraUpdate.newLatLngBounds(bounds, 64));
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final delivery = _delivery;
    if (delivery == null) return const SizedBox.shrink();
    final driver = _driver;
    final markers = <Marker>{
      Marker(
        markerId: const MarkerId('delivery'),
        position: delivery,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
        infoWindow: const InfoWindow(title: 'عنوان التوصيل'),
      ),
      if (driver != null)
        Marker(
          markerId: const MarkerId('driver'),
          position: driver,
          icon:
              BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
          infoWindow: const InfoWindow(title: 'السائق'),
        ),
    };
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      child: SizedBox(
        height: 220,
        child: GoogleMap(
          initialCameraPosition:
              CameraPosition(target: driver ?? delivery, zoom: 14),
          markers: markers,
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
          compassEnabled: false,
          mapToolbarEnabled: false,
          onMapCreated: (controller) {
            _controller = controller;
            _fitCamera();
          },
        ),
      ),
    );
  }
}

class _EtaCard extends StatelessWidget {
  const _EtaCard({required this.minutes});

  final int minutes;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.navy50,
        borderRadius: BorderRadius.circular(AppTheme.radiusInput),
        border: Border.all(color: AppColors.water600.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          const Icon(Icons.access_time, color: AppColors.water600, size: 24),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('يصل خلال ~$minutes دقيقة تقريباً',
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                        color: AppColors.navy700)),
                const SizedBox(height: 2),
                const Text('تقدير حسب موقع السائق الحالي — يتحدّث تلقائياً',
                    style: TextStyle(color: AppColors.slate, fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// بطاقة السائق + زر الاتصال.
class _DriverCard extends StatelessWidget {
  const _DriverCard({required this.driver});

  final OrderDriverRef driver;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text('السائق',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: const BoxDecoration(
                  color: AppColors.water600,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.person, color: Colors.white, size: 28),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(driver.fullName,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 15)),
                    if (driver.vehiclePlate != null &&
                        driver.vehiclePlate!.trim().isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text('المركبة: ${driver.vehiclePlate}',
                          style: const TextStyle(
                              color: AppColors.muted, fontSize: 12)),
                    ],
                  ],
                ),
              ),
              IconButton.filledTonal(
                onPressed: driver.hasPhone
                    ? () => Launchers.call(driver.phone!)
                    : null,
                icon: const Icon(Icons.call),
                color: AppColors.water600,
                tooltip: 'اتصال',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// تفاصيل الدفع.
class _PriceCard extends StatelessWidget {
  const _PriceCard({required this.order});

  final RefillOrder order;

  @override
  Widget build(BuildContext context) {
    final hasCompleted = order.completedAt != null;
    final hasNotes = order.notes != null && order.notes!.trim().isNotEmpty;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text('تفاصيل الدفع',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          ),
          const SizedBox(height: 8),
          _Row(label: 'النوع', value: order.kind.label),
          _Row(label: 'سعر التعبئة', value: Fmt.iqd(order.priceIqd)),
          if (order.paidAmountIqd > 0)
            _Row(label: 'المدفوع', value: Fmt.iqd(order.paidAmountIqd)),
          _Row(
            label: 'طريقة الدفع',
            value: _paymentLabel(order.paymentMethod),
            last: !hasCompleted && !hasNotes,
          ),
          if (hasCompleted)
            _Row(
              label: 'وقت التسليم',
              value: Fmt.arabicDateTime(order.completedAt),
              last: !hasNotes,
            ),
          if (hasNotes)
            _Row(label: 'ملاحظات', value: order.notes!.trim(), last: true),
        ],
      ),
    );
  }
}

/// تسمية طريقة الدفع للعرض (الافتراضي نقداً عند الاستلام).
String _paymentLabel(String? method) {
  switch (method) {
    case 'CASH':
    case null:
    case '':
      return 'نقداً عند الاستلام';
    default:
      return method;
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.last = false});

  final String label;
  final String value;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: last
          ? null
          : const BoxDecoration(
              border: Border(bottom: BorderSide(color: AppColors.line)),
            ),
      child: Row(
        children: [
          Text(label,
              style: const TextStyle(color: AppColors.slate, fontSize: 13)),
          const Spacer(),
          Text(value,
              style:
                  const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
        ],
      ),
    );
  }
}

/// زر إلغاء الطلب (للحالات النشطة).
class _CancelButton extends ConsumerStatefulWidget {
  const _CancelButton({required this.orderId});

  final String orderId;

  @override
  ConsumerState<_CancelButton> createState() => _CancelButtonState();
}

class _CancelButtonState extends ConsumerState<_CancelButton> {
  bool _loading = false;

  Future<void> _cancel() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('إلغاء الطلب'),
        content: const Text('هل أنت متأكّد من إلغاء هذا الطلب؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('تراجع'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('نعم، إلغاء'),
          ),
        ],
      ),
    );
    if (ok != true) return;

    setState(() => _loading = true);
    try {
      await ref.read(ordersRepositoryProvider).cancel(widget.orderId);
      ref.invalidate(orderProvider(widget.orderId));
      ref.invalidate(myOrdersProvider);
      if (!mounted) return;
      showSnack(context, 'تم إلغاء طلبك بنجاح');
    } on ApiException catch (e) {
      if (!mounted) return;
      showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LoadingButton(
      label: 'إلغاء الطلب',
      icon: Icons.close,
      loading: _loading,
      color: AppColors.danger,
      onPressed: _cancel,
    );
  }
}

/// زر تأكيد الاستلام (بعد اكتمال الطلب).
class _ConfirmButton extends ConsumerStatefulWidget {
  const _ConfirmButton({required this.orderId});

  final String orderId;

  @override
  ConsumerState<_ConfirmButton> createState() => _ConfirmButtonState();
}

class _ConfirmButtonState extends ConsumerState<_ConfirmButton> {
  bool _loading = false;

  Future<void> _confirm() async {
    setState(() => _loading = true);
    try {
      await ref.read(ordersRepositoryProvider).confirm(widget.orderId);
      ref.invalidate(orderProvider(widget.orderId));
      ref.invalidate(myOrdersProvider);
      if (!mounted) return;
      showSnack(context, 'تأكّد استلامك بنجاح. نسعد بخدمتك دائماً');
    } on ApiException catch (e) {
      if (!mounted) return;
      showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LoadingButton(
      label: 'أكّد الاستلام',
      icon: Icons.check_circle_outline,
      loading: _loading,
      color: AppColors.success,
      onPressed: _confirm,
    );
  }
}

/// زر الإبلاغ عن مشكلة — يفتح حواراً بحقل نصّ.
class _DisputeButton extends ConsumerStatefulWidget {
  const _DisputeButton({required this.orderId});

  final String orderId;

  @override
  ConsumerState<_DisputeButton> createState() => _DisputeButtonState();
}

class _DisputeButtonState extends ConsumerState<_DisputeButton> {
  bool _loading = false;

  Future<void> _dispute() async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('الإبلاغ عن مشكلة'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('صف المشكلة باختصار:'),
            const SizedBox(height: 10),
            TextField(
              controller: controller,
              autofocus: true,
              maxLines: 3,
              maxLength: 300,
              textInputAction: TextInputAction.done,
              decoration: const InputDecoration(
                hintText: 'مثال: لم تصل التعبئة / الخزان غير صحيح',
                counterText: '',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('إلغاء'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('إرسال'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (!mounted) return;
    if (reason == null) return;

    setState(() => _loading = true);
    try {
      final text = reason.isEmpty ? 'مشكلة في الطلب' : reason;
      await ref.read(ordersRepositoryProvider).dispute(widget.orderId, text);
      ref.invalidate(orderProvider(widget.orderId));
      if (!mounted) return;
      showSnack(context, 'تم إرسال الشكوى. سيتواصل معك المعمل خلال 24 ساعة');
    } on ApiException catch (e) {
      if (!mounted) return;
      showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: _loading ? null : _dispute,
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.warn600,
        side: const BorderSide(color: AppColors.warn600),
        minimumSize: const Size.fromHeight(48),
      ),
      icon: _loading
          ? const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(strokeWidth: 2.4),
            )
          : const Icon(Icons.report_problem_outlined, size: 20),
      label: const Text('أبلغ عن مشكلة'),
    );
  }
}

/// عرض التقييم المسجّل (نجوم + تعليق).
class _RatedCard extends StatelessWidget {
  const _RatedCard({required this.rating});

  final OrderRating rating;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text('تقييمك',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              for (var i = 1; i <= 5; i++)
                Icon(
                  i <= rating.stars
                      ? Icons.star_rounded
                      : Icons.star_outline_rounded,
                  color: AppColors.warning,
                  size: 30,
                ),
            ],
          ),
          if (rating.comment != null && rating.comment!.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.bg,
                borderRadius: BorderRadius.circular(AppTheme.radiusInput),
              ),
              child: Text(rating.comment!,
                  style: const TextStyle(color: AppColors.slate, height: 1.6)),
            ),
          ],
          const SizedBox(height: 10),
          const Center(
            child: Text('شكراً لمساعدتنا على تحسين الخدمة',
                style: TextStyle(color: AppColors.muted, fontSize: 11)),
          ),
        ],
      ),
    );
  }
}

/// نموذج التقييم النجمي + تعليق اختياري.
class _RatingForm extends ConsumerStatefulWidget {
  const _RatingForm({required this.orderId});

  final String orderId;

  @override
  ConsumerState<_RatingForm> createState() => _RatingFormState();
}

class _RatingFormState extends ConsumerState<_RatingForm> {
  int _stars = 0;
  bool _loading = false;
  final _comment = TextEditingController();

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_stars == 0) {
      showSnack(context, 'اختر عدد النجوم أولاً', error: true);
      return;
    }
    setState(() => _loading = true);
    try {
      final comment = _comment.text.trim();
      await ref.read(ordersRepositoryProvider).rate(
            widget.orderId,
            stars: _stars,
            comment: comment.isEmpty ? null : comment,
          );
      ref.invalidate(orderProvider(widget.orderId));
      if (!mounted) return;
      showSnack(context, 'شكراً! تم إرسال تقييمك');
    } on ApiException catch (e) {
      if (!mounted) return;
      showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Center(
            child: Text('كيف كانت تجربتك؟',
                style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: AppColors.navy700)),
          ),
          const SizedBox(height: 4),
          const Center(
            child: Text('قيّم تعبئتك ليصلك خدمة أفضل في المرة القادمة',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.slate, fontSize: 12)),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 1; i <= 5; i++)
                IconButton(
                  onPressed: _loading ? null : () => setState(() => _stars = i),
                  iconSize: 38,
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  constraints: const BoxConstraints(),
                  icon: Icon(
                    i <= _stars
                        ? Icons.star_rounded
                        : Icons.star_outline_rounded,
                    color: AppColors.warning,
                  ),
                ),
            ],
          ),
          if (_stars > 0) ...[
            const SizedBox(height: 12),
            TextField(
              controller: _comment,
              maxLines: 3,
              maxLength: 300,
              decoration: const InputDecoration(
                hintText: 'أضف تعليقاً (اختياري)…',
                counterText: '',
              ),
            ),
          ],
          const SizedBox(height: 12),
          LoadingButton(
            label: 'إرسال التقييم',
            icon: Icons.send,
            loading: _loading,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }
}
