import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers.dart';
import '../widgets/common.dart';

/// جرد الفان — تعديل عدد الخزانات الممتلئة/الفارغة المحمّلة على الشاحنة
/// عبر عدّادَين (+ / −)، ثم حفظها إلى `POST /drivers/me/van-inventory`.
/// القيم الابتدائية تأتي من ملفّ السائق (`driverProfileProvider`).
class VanInventoryScreen extends ConsumerStatefulWidget {
  const VanInventoryScreen({super.key});

  @override
  ConsumerState<VanInventoryScreen> createState() => _VanInventoryScreenState();
}

class _VanInventoryScreenState extends ConsumerState<VanInventoryScreen> {
  int _full = 0;
  int _empty = 0;
  bool _hydrated = false;
  bool _saving = false;

  /// بذر العدّادَين من قيم الخادم مرّة واحدة عند وصول الملفّ.
  void _hydrate(DriverProfile driver) {
    if (_hydrated) return;
    _hydrated = true;
    _full = driver.tanksFullOnVan ?? 0;
    _empty = driver.tanksEmptyOnVan ?? 0;
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(driverRepositoryProvider).updateVanInventory(
            tanksFullOnVan: _full,
            tanksEmptyOnVan: _empty,
          );
      if (!mounted) return;
      ref.invalidate(driverProfileProvider);
      showSnack(context, 'تم حفظ جرد الفان');
    } on ApiException catch (e) {
      if (!mounted) return;
      showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(driverProfileProvider);

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(title: const Text('جرد الفان')),
      body: AsyncView<DriverProfile>(
        value: profile,
        onRetry: () => ref.invalidate(driverProfileProvider),
        data: (driver) {
          _hydrate(driver);
          final total = _full + _empty;

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
            children: [
              _TotalCard(total: total),
              const SizedBox(height: 14),
              _StepperCard(
                label: 'خزانات ممتلئة',
                hint: 'جاهزة للتسليم',
                icon: Icons.water_drop,
                tint: AppColors.water600,
                value: _full,
                onChanged: (v) => setState(() => _full = v),
              ),
              const SizedBox(height: 14),
              _StepperCard(
                label: 'خزانات فارغة',
                hint: 'مسحوبة من الزبائن',
                icon: Icons.opacity,
                tint: AppColors.slate,
                value: _empty,
                onChanged: (v) => setState(() => _empty = v),
              ),
              const SizedBox(height: 24),
              LoadingButton(
                label: 'حفظ الجرد',
                icon: Icons.save_outlined,
                loading: _saving,
                onPressed: _save,
              ),
            ],
          );
        },
      ),
    );
  }
}

/// بطاقة ملخّص: إجمالي الخزانات على الفان.
class _TotalCard extends StatelessWidget {
  const _TotalCard({required this.total});

  final int total;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: AppTheme.tealGradient,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      ),
      child: Row(
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.22),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.local_shipping_outlined,
                color: Colors.white, size: 30),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('إجمالي الخزانات على الفان',
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.9),
                        fontSize: 13,
                        fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text('$total',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 30,
                        fontWeight: FontWeight.w900)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// عدّاد خزانات بزرّي + و − (لا يقلّ عن 0).
class _StepperCard extends StatelessWidget {
  const _StepperCard({
    required this.label,
    required this.hint,
    required this.icon,
    required this.tint,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final String hint;
  final IconData icon;
  final Color tint;
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: tint.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: tint, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text(hint,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.muted)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _StepButton(
                icon: Icons.remove,
                tint: tint,
                onTap: value <= 0 ? null : () => onChanged(value - 1),
              ),
              Text('$value',
                  style: const TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.w900,
                      color: AppColors.ink)),
              _StepButton(
                icon: Icons.add,
                tint: tint,
                onTap: () => onChanged(value + 1),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// زرّ خطوة دائري (+/−) — مُعطّل عندما يكون onTap = null.
class _StepButton extends StatelessWidget {
  const _StepButton({
    required this.icon,
    required this.tint,
    required this.onTap,
  });

  final IconData icon;
  final Color tint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final disabled = onTap == null;
    return Material(
      color: disabled
          ? AppColors.line.withValues(alpha: 0.4)
          : tint.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: SizedBox(
          width: 56,
          height: 56,
          child: Icon(icon,
              size: 28, color: disabled ? AppColors.muted : tint),
        ),
      ),
    );
  }
}
