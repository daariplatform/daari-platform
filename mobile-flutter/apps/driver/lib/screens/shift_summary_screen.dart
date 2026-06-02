import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers.dart';
import '../widgets/common.dart';
import '../widgets/order_widgets.dart';

/// شاشة ملخّص الوردية — إنجاز اليوم: المهام المكتملة، النقد المحصّل، وتفصيل
/// حسب نوع المهمة. تصميم احتفالي بسيط بألوان النجاح.
class ShiftSummaryScreen extends ConsumerWidget {
  const ShiftSummaryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(shiftSummaryProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('ملخّص الوردية')),
      body: AsyncView<ShiftSummary>(
        value: summary,
        onRetry: () => ref.invalidate(shiftSummaryProvider),
        data: (data) {
          final kinds = data.byKind.entries.where((e) => e.value > 0).toList();
          return ListView(
            padding: const EdgeInsets.fromLTRB(14, 16, 14, 32),
            children: [
              _HeroCard(completedOrders: data.completedOrders),
              const SizedBox(height: 12),
              _CashCard(collectedCashIqd: data.collectedCashIqd),
              if (kinds.isNotEmpty) ...[
                const SizedBox(height: 12),
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'تفصيل حسب النوع',
                        textAlign: TextAlign.right,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppColors.slate,
                        ),
                      ),
                      const SizedBox(height: 12),
                      for (var i = 0; i < kinds.length; i++) ...[
                        if (i > 0) const SizedBox(height: 10),
                        _KindRow(kind: kinds[i].key, count: kinds[i].value),
                      ],
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 20),
              LoadingButton(
                label: 'أنهِ الوردية',
                icon: Icons.stop_circle_outlined,
                color: AppColors.danger,
                onPressed: () => _endShift(context, ref),
              ),
            ],
          );
        },
      ),
    );
  }

  /// إنهاء الوردية: يوقف تتبّع الموقع، يقلب الحالة OFFLINE، ويعود للرئيسية.
  /// (كان موجوداً في Expo `shift-summary.tsx` وسقط في نقل Flutter.)
  Future<void> _endShift(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('إنهاء الوردية'),
        content:
            const Text('سيتوقّف تتبّع موقعك ولن تصلك طلبات جديدة. متأكّد؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('إلغاء'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child:
                const Text('إنهاء', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(locationServiceProvider).stopShift();
    } on ApiException catch (_) {
      // best-effort — أوقفنا المؤقّت محلياً على أي حال.
    }
    ref.read(onShiftProvider.notifier).state = false;
    if (!context.mounted) return;
    showSnack(context, 'أُنهيت الوردية — عمل موفّق!');
    context.go('/home');
  }
}

/// بطاقة الإنجاز الرئيسية — عدد المهام المكتملة مع كأس احتفالي.
class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.completedOrders});
  final int completedOrders;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [AppColors.water500, AppColors.water700],
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: AppColors.water600.withValues(alpha: 0.28),
            blurRadius: 14,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            width: 70,
            height: 70,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.22),
              borderRadius: BorderRadius.circular(24),
            ),
            child: const Icon(
              Icons.emoji_events,
              size: 40,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'مهام أنجزتها اليوم',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: Colors.white.withValues(alpha: 0.9),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '$completedOrders',
            style: const TextStyle(
              fontSize: 44,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

/// بطاقة النقد المحصّل اليوم.
class _CashCard extends StatelessWidget {
  const _CashCard({required this.collectedCashIqd});
  final int collectedCashIqd;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Row(
        textDirection: TextDirection.rtl,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.water100,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.payments,
              size: 26,
              color: AppColors.water600,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text(
                  'النقد المُحصَّل اليوم',
                  style: TextStyle(fontSize: 11, color: AppColors.slate),
                ),
                const SizedBox(height: 2),
                Text(
                  Fmt.iqd(collectedCashIqd),
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppColors.water700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// صف نوع المهمة في التفصيل — أيقونة + اسم + عدد.
class _KindRow extends StatelessWidget {
  const _KindRow({required this.kind, required this.count});
  final RefillOrderKind kind;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      textDirection: TextDirection.rtl,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: AppColors.navy50,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            orderKindIcon(kind),
            size: 20,
            color: AppColors.navy600,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            kind.label,
            textAlign: TextAlign.right,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: AppColors.ink,
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.navy50,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            '$count',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: AppColors.navy600,
            ),
          ),
        ),
      ],
    );
  }
}
