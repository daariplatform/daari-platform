import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';
import '../widgets/common.dart';
import 'map_picker_screen.dart';

/// شاشة «عناويني» — عرض العناوين المحفوظة مع إضافة/تعديل/حذف وتعيين الافتراضي.
class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addresses = ref.watch(myAddressesProvider);
    final count = addresses.valueOrNull?.length;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('عناويني'),
            Text(
              count == null ? 'إدارة عناوين التوصيل' : '$count عنوان محفوظ',
              style: const TextStyle(
                  fontSize: 11.5, fontWeight: FontWeight.normal),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(context, ref),
        icon: const Icon(Icons.add_location_alt_outlined),
        label: const Text('عنوان جديد'),
      ),
      body: AsyncView<List<SavedAddress>>(
        value: addresses,
        onRetry: () => ref.invalidate(myAddressesProvider),
        data: (items) {
          if (items.isEmpty) {
            return EmptyState(
              icon: Icons.location_off_outlined,
              title: 'لا توجد عناوين محفوظة',
              message: 'احفظ عناوينك المتكررة (البيت، العمل) لطلب التوصيل بسرعة.',
              actionLabel: 'أضف عنوانك الأول',
              onAction: () => _openForm(context, ref),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, i) => _AddressCard(
              address: items[i],
              onEdit: () => _openForm(context, ref, existing: items[i]),
              onDelete: () => _confirmDelete(context, ref, items[i]),
              onMakeDefault: () => _makeDefault(context, ref, items[i]),
            ),
          );
        },
      ),
    );
  }

  Future<void> _openForm(
    BuildContext context,
    WidgetRef ref, {
    SavedAddress? existing,
  }) async {
    final input = await showModalBottomSheet<AddressInput>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddressFormSheet(existing: existing),
    );
    if (input == null) return;

    final repo = ref.read(customerRepositoryProvider);
    try {
      if (existing == null) {
        await repo.createAddress(input);
      } else {
        await repo.updateAddress(existing.id, input);
      }
      ref.invalidate(myAddressesProvider);
      if (context.mounted) {
        showSnack(context, existing == null ? 'تمت إضافة العنوان' : 'تم حفظ التعديلات');
      }
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    }
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    SavedAddress address,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('حذف العنوان'),
        content: Text('حذف «${address.title}»؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('إلغاء'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('حذف'),
          ),
        ],
      ),
    );
    if (ok != true) return;

    try {
      await ref.read(customerRepositoryProvider).deleteAddress(address.id);
      ref.invalidate(myAddressesProvider);
      if (context.mounted) showSnack(context, 'تم حذف العنوان');
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    }
  }

  Future<void> _makeDefault(
    BuildContext context,
    WidgetRef ref,
    SavedAddress address,
  ) async {
    try {
      await ref.read(customerRepositoryProvider).makeDefaultAddress(address.id);
      ref.invalidate(myAddressesProvider);
      if (context.mounted) showSnack(context, 'تم تعيين العنوان الافتراضي');
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    }
  }
}

/// أيقونة تمثّل تسمية العنوان.
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

/// بطاقة عنوان واحد مع أزرار الأفعال.
class _AddressCard extends StatelessWidget {
  const _AddressCard({
    required this.address,
    required this.onEdit,
    required this.onDelete,
    required this.onMakeDefault,
  });

  final SavedAddress address;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onMakeDefault;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: AppColors.navy50,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(_labelIcon(address.label), color: AppColors.navy600),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            address.title,
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                          ),
                        ),
                        if (address.isDefault) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.success.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text(
                              'افتراضي',
                              style: TextStyle(
                                color: AppColors.success,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      address.addressLine,
                      style: const TextStyle(color: AppColors.slate, height: 1.5, fontSize: 13),
                    ),
                    if (address.district != null && address.district!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        address.district!,
                        style: const TextStyle(color: AppColors.muted, fontSize: 12),
                      ),
                    ],
                    if (address.hasPin) ...[
                      const SizedBox(height: 4),
                      const Row(
                        children: [
                          Icon(Icons.location_on,
                              size: 12, color: AppColors.water600),
                          SizedBox(width: 4),
                          Text('موقع محدد على الخريطة',
                              style: TextStyle(
                                  color: AppColors.water600, fontSize: 11)),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 24, color: AppColors.line),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (!address.isDefault)
                _ActionChip(
                  icon: Icons.star_outline,
                  label: 'اجعله افتراضياً',
                  color: AppColors.navy600,
                  onTap: onMakeDefault,
                ),
              _ActionChip(
                icon: Icons.edit_outlined,
                label: 'تعديل',
                color: AppColors.slate,
                onTap: onEdit,
              ),
              _ActionChip(
                icon: Icons.delete_outline,
                label: 'حذف',
                color: AppColors.danger,
                onTap: onDelete,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// زرّ فعل صغير على شكل شريحة.
class _ActionChip extends StatelessWidget {
  const _ActionChip({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}

/// نموذج إضافة/تعديل عنوان داخل BottomSheet.
class _AddressFormSheet extends StatefulWidget {
  const _AddressFormSheet({this.existing});

  final SavedAddress? existing;

  @override
  State<_AddressFormSheet> createState() => _AddressFormSheetState();
}

class _AddressFormSheetState extends State<_AddressFormSheet> {
  late AddressLabel _label;
  late final TextEditingController _title;
  late final TextEditingController _addressLine;
  late final TextEditingController _district;
  double? _lat;
  double? _lng;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _label = e?.label ?? AddressLabel.home;
    _title = TextEditingController(text: e?.title ?? '');
    _addressLine = TextEditingController(text: e?.addressLine ?? '');
    _district = TextEditingController(text: e?.district ?? '');
    _lat = e?.lat;
    _lng = e?.lng;
  }

  Future<void> _pickOnMap() async {
    final result = await context.push<MapPickResult>(
      '/map-picker',
      extra: (_lat != null && _lng != null)
          ? MapPickerArgs(lat: _lat!, lng: _lng!)
          : null,
    );
    if (result == null || !mounted) return;
    setState(() {
      _lat = result.lat;
      _lng = result.lng;
      // املأ السطر التفصيلي تلقائياً إن كان فارغاً.
      if (result.address.isNotEmpty && _addressLine.text.trim().isEmpty) {
        _addressLine.text = result.address;
      }
    });
  }

  @override
  void dispose() {
    _title.dispose();
    _addressLine.dispose();
    _district.dispose();
    super.dispose();
  }

  void _submit() {
    final title = _title.text.trim();
    final addressLine = _addressLine.text.trim();
    if (title.isEmpty || addressLine.isEmpty) {
      showSnack(context, 'أدخل اسماً للعنوان والسطر التفصيلي', error: true);
      return;
    }
    final district = _district.text.trim();
    Navigator.pop(
      context,
      AddressInput(
        label: _label,
        title: title,
        addressLine: addressLine,
        district: district.isEmpty ? null : district,
        lat: _lat,
        lng: _lng,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final isEdit = widget.existing != null;
    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusHero)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
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
              Text(
                isEdit ? 'تعديل العنوان' : 'عنوان جديد',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 16),
              const Text(
                'نوع العنوان',
                style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.slate, fontSize: 13),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  for (final l in AddressLabel.values) ...[
                    Expanded(
                      child: _LabelOption(
                        label: l,
                        selected: _label == l,
                        onTap: () => setState(() => _label = l),
                      ),
                    ),
                    if (l != AddressLabel.values.last) const SizedBox(width: 8),
                  ],
                ],
              ),
              const SizedBox(height: 16),
              LabeledField(
                label: 'اسم العنوان',
                controller: _title,
                hint: 'مثال: بيت أهلي',
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              LabeledField(
                label: 'السطر التفصيلي',
                controller: _addressLine,
                hint: 'الحي، الشارع، رقم البيت…',
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              LabeledField(
                label: 'المنطقة (اختياري)',
                controller: _district,
                hint: 'الحيّ أو المنطقة',
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _pickOnMap,
                  icon: Icon(
                    _lat != null ? Icons.check_circle : Icons.map_outlined,
                    color: _lat != null ? AppColors.water600 : null,
                  ),
                  label: Text(_lat != null
                      ? 'تم تحديد الموقع على الخريطة'
                      : 'حدّد الموقع على الخريطة (اختياري)'),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: LoadingButton(
                  label: isEdit ? 'حفظ التعديلات' : 'إضافة العنوان',
                  onPressed: _submit,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// خيار اختيار التسمية (البيت/العمل/مخصص).
class _LabelOption extends StatelessWidget {
  const _LabelOption({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final AddressLabel label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.navy600 : AppColors.slate;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusInput),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: selected ? AppColors.navy50 : AppColors.bg,
          borderRadius: BorderRadius.circular(AppTheme.radiusInput),
          border: Border.all(color: selected ? AppColors.navy600 : AppColors.line),
        ),
        child: Column(
          children: [
            Icon(_labelIcon(label), size: 20, color: color),
            const SizedBox(height: 4),
            Text(
              label.text,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
