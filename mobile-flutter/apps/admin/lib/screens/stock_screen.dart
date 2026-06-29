import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets/common.dart';

/// شاشة المخزون — عرض مستوى المياه + إضافة كمّية (top-up) أو ضبط المستويات.
class StockScreen extends ConsumerWidget {
  const StockScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stock = ref.watch(stockProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('المخزون')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(stockProvider),
        child: AsyncView<WaterStock>(
          value: stock,
          onRetry: () => ref.invalidate(stockProvider),
          data: (s) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.water_drop,
                            color:
                                s.isLow ? AppColors.danger : AppColors.navy600,
                            size: 28),
                        const SizedBox(width: 10),
                        Text('${s.currentLiters} لتر',
                            style: const TextStyle(
                                fontSize: 24, fontWeight: FontWeight.w900)),
                        const Spacer(),
                        Text('${s.fillPercent}٪',
                            style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: s.isLow
                                    ? AppColors.danger
                                    : AppColors.water600)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: (s.fillPercent / 100).clamp(0.0, 1.0),
                        minHeight: 12,
                        backgroundColor: AppColors.line,
                        color: s.isLow ? AppColors.danger : AppColors.navy600,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                        'السعة: ${s.capacityLiters} لتر · حدّ التنبيه: ${s.lowThresholdLiters} لتر',
                        style: const TextStyle(
                            color: AppColors.slate, fontSize: 12)),
                    if (s.lastTopUpAt != null) ...[
                      const SizedBox(height: 4),
                      Text(
                          'آخر تعبئة: ${Fmt.arabicDateTime(s.lastTopUpAt)}'
                          '${s.lastTopUpLiters != null ? ' (+${s.lastTopUpLiters} لتر)' : ''}',
                          style: const TextStyle(
                              color: AppColors.muted, fontSize: 12)),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 20),
              LoadingButton(
                label: 'إضافة كمّية (تعبئة)',
                icon: Icons.add,
                onPressed: () => _topUpDialog(context, ref),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => _adjustDialog(context, ref, s),
                icon: const Icon(Icons.tune),
                label: const Text('ضبط المستويات يدوياً'),
                style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(50)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _topUpDialog(BuildContext context, WidgetRef ref) async {
    final ctrl = TextEditingController();
    final liters = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('إضافة كمّية'),
        content: TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          autofocus: true,
          decoration: const InputDecoration(
              hintText: 'عدد اللترات المضافة', suffixText: 'لتر'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
          TextButton(
            onPressed: () {
              final v = int.tryParse(ctrl.text.trim());
              Navigator.pop(ctx, (v != null && v > 0) ? v : null);
            },
            child: const Text('إضافة'),
          ),
        ],
      ),
    );
    if (liters == null || !context.mounted) return;
    await _apply(
        context,
        ref,
        () =>
            ref.read(plantRepositoryProvider).updateStock(topUpLiters: liters));
  }

  Future<void> _adjustDialog(
      BuildContext context, WidgetRef ref, WaterStock s) async {
    final current = TextEditingController(text: '${s.currentLiters}');
    final capacity = TextEditingController(text: '${s.capacityLiters}');
    final threshold = TextEditingController(text: '${s.lowThresholdLiters}');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('ضبط المستويات'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            LabeledField(
                label: 'المستوى الحالي (لتر)',
                controller: current,
                keyboardType: TextInputType.number),
            const SizedBox(height: 10),
            LabeledField(
                label: 'السعة القصوى (لتر)',
                controller: capacity,
                keyboardType: TextInputType.number),
            const SizedBox(height: 10),
            LabeledField(
                label: 'حدّ التنبيه (لتر)',
                controller: threshold,
                keyboardType: TextInputType.number),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('إلغاء')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('حفظ')),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    await _apply(
      context,
      ref,
      () => ref.read(plantRepositoryProvider).updateStock(
            currentLiters: int.tryParse(current.text.trim()),
            capacityLiters: int.tryParse(capacity.text.trim()),
            lowThresholdLiters: int.tryParse(threshold.text.trim()),
          ),
    );
  }

  Future<void> _apply(BuildContext context, WidgetRef ref,
      Future<WaterStock> Function() action) async {
    try {
      await action();
      ref.invalidate(stockProvider);
      ref.invalidate(adminKpisProvider);
      if (context.mounted) showSnack(context, 'تم تحديث المخزون');
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    }
  }
}
