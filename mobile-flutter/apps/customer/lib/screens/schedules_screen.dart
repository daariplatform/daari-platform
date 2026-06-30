import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets/common.dart';

/// شاشة الجدولة التلقائية للزبون: إنشاء طلب تعبئة دوري وإدارته (تفعيل/حذف).
class SchedulesScreen extends ConsumerWidget {
  const SchedulesScreen({super.key});

  Future<void> _toggle(
    BuildContext context,
    WidgetRef ref,
    RefillSchedule schedule,
    bool value,
  ) async {
    try {
      await ref
          .read(customerRepositoryProvider)
          .updateSchedule(schedule.id, {'active': value});
      ref.invalidate(mySchedulesProvider);
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    }
  }

  Future<void> _delete(
    BuildContext context,
    WidgetRef ref,
    RefillSchedule schedule,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('حذف الجدولة'),
        content: const Text('إيقاف التعبئة التلقائية وحذفها؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('إلغاء'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('حذف'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(customerRepositoryProvider).deleteSchedule(schedule.id);
      ref.invalidate(mySchedulesProvider);
      if (context.mounted) showSnack(context, 'تم حذف الجدولة.');
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    }
  }

  Future<void> _openCreate(BuildContext context, WidgetRef ref) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CreateScheduleSheet(ref: ref),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schedulesAsync = ref.watch(mySchedulesProvider);
    final addresses =
        ref.watch(myAddressesProvider).valueOrNull ?? const <SavedAddress>[];

    return Scaffold(
      appBar: AppBar(title: const Text('الجدولة التلقائية')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openCreate(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('جدولة'),
      ),
      body: AsyncView<List<RefillSchedule>>(
        value: schedulesAsync,
        onRetry: () => ref.invalidate(mySchedulesProvider),
        data: (schedules) {
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(mySchedulesProvider),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              children: [
                const _ExplainerBanner(),
                const SizedBox(height: 16),
                if (schedules.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 48),
                    child: EmptyState(
                      icon: Icons.event_repeat,
                      title: 'لا توجد تعبئة تلقائية',
                      message:
                          'فعّل تعبئة دورية ولن تقلق على نفاد الماء — نطلب لك تلقائياً.',
                    ),
                  )
                else
                  ...schedules.map(
                    (s) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _ScheduleCard(
                        schedule: s,
                        addresses: addresses,
                        onToggle: (v) => _toggle(context, ref, s, v),
                        onDelete: () => _delete(context, ref, s),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// لافتة توضّح أن الجدولة تنشئ طلباً تلقائياً دورياً.
class _ExplainerBanner extends StatelessWidget {
  const _ExplainerBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.navy50,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.navy100),
      ),
      child: Row(
        children: [
          const Icon(Icons.autorenew, color: AppColors.navy600, size: 26),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'نُرسل لك طلب تعبئة تلقائياً حسب الجدولة — يصلك السائق دون أن تطلب يدوياً.',
              style: TextStyle(color: AppColors.navy700, height: 1.6, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

/// منتقي عنوان التوصيل (اختياري) في نموذج إنشاء الجدولة — «الافتراضي» = null.
class _AddressPicker extends StatelessWidget {
  const _AddressPicker({
    required this.addresses,
    required this.selectedId,
    required this.onSelected,
  });

  final List<SavedAddress> addresses;
  final String? selectedId;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    if (addresses.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        const Text('عنوان التوصيل (اختياري)',
            style: TextStyle(
                color: AppColors.slate,
                fontSize: 12,
                fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              ChoiceChip(
                label: const Text('الافتراضي'),
                selected: selectedId == null,
                onSelected: (_) => onSelected(null),
              ),
              for (final a in addresses) ...[
                const SizedBox(width: 8),
                ChoiceChip(
                  avatar: Icon(_addressLabelIcon(a.label), size: 16),
                  label: Text(a.title),
                  selected: selectedId == a.id,
                  onSelected: (_) => onSelected(a.id),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// أيقونة تسمية العنوان (البيت/العمل/مخصّص).
IconData _addressLabelIcon(AddressLabel label) {
  switch (label) {
    case AddressLabel.home:
      return Icons.home_outlined;
    case AddressLabel.work:
      return Icons.work_outline;
    case AddressLabel.custom:
      return Icons.place_outlined;
  }
}

/// بطاقة جدولة واحدة.
class _ScheduleCard extends StatelessWidget {
  const _ScheduleCard({
    required this.schedule,
    required this.addresses,
    required this.onToggle,
    required this.onDelete,
  });

  final RefillSchedule schedule;
  final List<SavedAddress> addresses;
  final ValueChanged<bool> onToggle;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final active = schedule.active;
    SavedAddress? addr;
    if (schedule.addressId != null) {
      for (final a in addresses) {
        if (a.id == schedule.addressId) {
          addr = a;
          break;
        }
      }
    }
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: active
                      ? AppColors.turquoise500.withValues(alpha: 0.14)
                      : AppColors.muted.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  Icons.repeat,
                  color: active ? AppColors.water600 : AppColors.muted,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      schedule.cadence.text,
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'التعبئة القادمة: ${Fmt.arabicDate(schedule.nextRunAt)}',
                      style: const TextStyle(color: AppColors.slate, fontSize: 13),
                    ),
                    if (addr != null) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(_addressLabelIcon(addr.label),
                              size: 14, color: AppColors.water600),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(addr.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    color: AppColors.water600,
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700)),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              Switch(value: active, onChanged: onToggle),
            ],
          ),
          const Divider(height: 24),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: onDelete,
              style: TextButton.styleFrom(foregroundColor: AppColors.danger),
              icon: const Icon(Icons.delete_outline, size: 18),
              label: const Text('حذف الجدولة'),
            ),
          ),
        ],
      ),
    );
  }
}

/// نموذج إنشاء جدولة جديدة: اختيار الدورية + موعد بداية مشتقّ منها.
class _CreateScheduleSheet extends StatefulWidget {
  const _CreateScheduleSheet({required this.ref});

  final WidgetRef ref;

  @override
  State<_CreateScheduleSheet> createState() => _CreateScheduleSheetState();
}

class _CreateScheduleSheetState extends State<_CreateScheduleSheet> {
  Cadence _cadence = Cadence.monthly;
  bool _saving = false;
  String? _addressId; // null = العنوان الافتراضي للحساب.
  late DateTime _nextDate;

  @override
  void initState() {
    super.initState();
    _nextDate = DateTime.now().add(Duration(days: _cadence.days));
  }

  void _selectCadence(Cadence c) {
    setState(() {
      _cadence = c;
      _nextDate = DateTime.now().add(Duration(days: c.days));
    });
  }

  /// تعديل أوّل تعبئة بمقدار يوم (لا يُسمح بتاريخ في الماضي).
  void _nudge(int delta) {
    final candidate = _nextDate.add(Duration(days: delta));
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    if (candidate.isBefore(today)) return;
    setState(() => _nextDate = candidate);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.ref.read(customerRepositoryProvider).createSchedule(
            ScheduleInput(
                cadence: _cadence,
                nextRunAt: _nextDate,
                addressId: _addressId),
          );
      widget.ref.invalidate(mySchedulesProvider);
      if (mounted) {
        Navigator.of(context).pop();
        showSnack(context, 'تم تفعيل التعبئة التلقائية.');
      }
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: AppColors.line,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'تعبئة تلقائية جديدة',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            const Text(
              'كل متى تريد أن نرسل لك طلب تعبئة تلقائياً؟',
              style: TextStyle(color: AppColors.slate),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 10,
              children: Cadence.values
                  .map(
                    (c) => ChoiceChip(
                      label: Text(c.text),
                      selected: _cadence == c,
                      onSelected:
                          _saving ? null : (_) => _selectCadence(c),
                    ),
                  )
                  .toList(),
            ),
            _AddressPicker(
              addresses: widget.ref.read(myAddressesProvider).valueOrNull ??
                  const <SavedAddress>[],
              selectedId: _addressId,
              onSelected: (id) => setState(() => _addressId = id),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.navy50,
                borderRadius: BorderRadius.circular(AppTheme.radiusInput),
              ),
              child: Row(
                children: [
                  const Icon(Icons.calendar_today,
                      color: AppColors.navy600, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('أول تعبئة',
                            style: TextStyle(
                                color: AppColors.slate, fontSize: 12)),
                        const SizedBox(height: 2),
                        Text(
                          Fmt.arabicDate(_nextDate),
                          style:
                              const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: _saving ? null : () => _nudge(-1),
                    icon: const Icon(Icons.remove_circle_outline),
                    color: AppColors.navy600,
                    tooltip: 'يوم أقل',
                  ),
                  IconButton(
                    onPressed: _saving ? null : () => _nudge(1),
                    icon: const Icon(Icons.add_circle_outline),
                    color: AppColors.navy600,
                    tooltip: 'يوم أكثر',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            LoadingButton(
              label: 'تفعيل التعبئة التلقائية',
              icon: Icons.check,
              loading: _saving,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }
}
