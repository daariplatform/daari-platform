import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets/common.dart';

/// شاشة تهيئة المعمل — قائمة خطوات الإعداد (مُشتقّة من بيانات الخادم) + تخطّي.
class OnboardingScreen extends ConsumerWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(onboardingStatusProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('تهيئة المعمل')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(onboardingStatusProvider),
        child: AsyncView<OnboardingStatus>(
          value: status,
          onRetry: () => ref.invalidate(onboardingStatusProvider),
          data: (s) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (s.allComplete)
                SectionCard(
                  child: Row(
                    children: const [
                      Icon(Icons.celebration, color: AppColors.water600),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text('اكتملت كل خطوات التهيئة 🎉',
                            style: TextStyle(fontWeight: FontWeight.w800)),
                      ),
                    ],
                  ),
                ),
              if (s.allComplete) const SizedBox(height: 16),
              SectionCard(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Column(
                  children: [
                    _Step(done: s.plantInfoComplete, label: 'معلومات المعمل'),
                    const Divider(height: 1),
                    _Step(done: s.refillPriceSet, label: 'سعر التعبئة'),
                    const Divider(height: 1),
                    _Step(done: s.workingHoursSet, label: 'ساعات العمل'),
                    const Divider(height: 1),
                    _Step(done: s.firstCustomerAdded, label: 'أوّل زبون'),
                    const Divider(height: 1),
                    _Step(done: s.firstDriverHired, label: 'أوّل سائق'),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              if (s.skipped)
                Text('تمّ تخطّي التهيئة في ${Fmt.arabicDate(s.skippedAt)}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.muted))
              else if (!s.allComplete)
                OutlinedButton(
                  onPressed: () => _skip(context, ref),
                  style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(50)),
                  child: const Text('تخطّي التهيئة'),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _skip(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تخطّي التهيئة'),
        content: const Text('تخطّي خطوات الإعداد؟ يمكنك إكمالها لاحقاً.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('إلغاء')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('تخطّي')),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      await ref.read(onboardingRepositoryProvider).skip();
      ref.invalidate(onboardingStatusProvider);
      if (context.mounted) showSnack(context, 'تمّ تخطّي التهيئة');
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    }
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.done, required this.label});
  final bool done;
  final String label;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(
        done ? Icons.check_circle : Icons.radio_button_unchecked,
        color: done ? AppColors.water600 : AppColors.muted,
      ),
      title: Text(label,
          style: TextStyle(
              fontWeight: FontWeight.w700,
              color: done ? AppColors.ink : AppColors.slate)),
    );
  }
}
