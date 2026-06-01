import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers.dart';
import '../widgets/common.dart';

/// شاشة «تسوية النقد» — ملخّص ما حصّله السائق وسلّمه اليوم، مع نموذج
/// تسليم النقد للمعمل وسجلّ التسليمات السابقة بحالاتها.
class CashScreen extends ConsumerWidget {
  const CashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(cashSummaryProvider);
    final handovers = ref.watch(cashHandoversProvider);

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(title: const Text('تسوية النقد')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(cashSummaryProvider);
          ref.invalidate(cashHandoversProvider);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            AsyncView<CashSummary>(
              value: summary,
              onRetry: () => ref.invalidate(cashSummaryProvider),
              data: (s) => _SummarySection(summary: s),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                const Icon(Icons.receipt_long, size: 18, color: AppColors.water600),
                const SizedBox(width: 6),
                const Text(
                  'سجلّ التسليمات',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _HandoversSection(handovers: handovers, ref: ref),
          ],
        ),
      ),
    );
  }
}

/// قسم الملخّص: بطاقات «محصّل اليوم» و«سُلّم اليوم» و«المتبقّي» + زر التسليم.
class _SummarySection extends StatelessWidget {
  const _SummarySection({required this.summary});

  final CashSummary summary;

  @override
  Widget build(BuildContext context) {
    final pending = summary.pendingIqd;
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _StatCard(
                icon: Icons.account_balance_wallet,
                label: 'محصّل اليوم',
                value: Fmt.iqd(summary.collectedTodayIqd),
                color: AppColors.success,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _StatCard(
                icon: Icons.upload,
                label: 'سُلّم اليوم',
                value: Fmt.iqd(summary.handedOverTodayIqd),
                color: AppColors.water600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _StatCard(
          icon: Icons.savings,
          label: 'المتبقّي بانتظار التسليم',
          value: Fmt.iqd(pending),
          color: pending > 0 ? AppColors.warn600 : AppColors.success,
          wide: true,
        ),
        const SizedBox(height: 14),
        LoadingButton(
          label: 'تسليم نقد',
          icon: Icons.payments,
          color: AppColors.water600,
          onPressed: () => _openHandoverDialog(context, pending),
        ),
      ],
    );
  }
}

/// يفتح حوار إدخال مبلغ التسليم وملاحظة اختيارية.
Future<void> _openHandoverDialog(BuildContext context, int pending) {
  return showDialog<void>(
    context: context,
    builder: (_) => _HandoverDialog(pending: pending),
  );
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    this.wide = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      padding: const EdgeInsets.all(14),
      child: wide
          ? Row(
              children: [
                _IconBadge(icon: icon, color: color),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label,
                          style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.muted,
                              fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      Text(value,
                          style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: color)),
                    ],
                  ),
                ),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _IconBadge(icon: icon, color: color),
                const SizedBox(height: 10),
                Text(label,
                    style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.muted,
                        fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(value,
                    style: TextStyle(
                        fontSize: 17, fontWeight: FontWeight.w900, color: color)),
              ],
            ),
    );
  }
}

class _IconBadge extends StatelessWidget {
  const _IconBadge({required this.icon, required this.color});

  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(11),
      ),
      child: Icon(icon, size: 20, color: color),
    );
  }
}

/// حوار تسليم النقد — حقل مبلغ رقمي + ملاحظة اختيارية.
class _HandoverDialog extends ConsumerStatefulWidget {
  const _HandoverDialog({required this.pending});

  final int pending;

  @override
  ConsumerState<_HandoverDialog> createState() => _HandoverDialogState();
}

class _HandoverDialogState extends ConsumerState<_HandoverDialog> {
  late final TextEditingController _amount;
  final _note = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _amount = TextEditingController(
      text: widget.pending > 0 ? '${widget.pending}' : '',
    );
  }

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final amount = int.tryParse(_amount.text.trim());
    if (amount == null || amount <= 0) {
      showSnack(context, 'أدخل مبلغاً صحيحاً أكبر من صفر.', error: true);
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(driverRepositoryProvider).handoverCash(
            amountIqd: amount,
            note: _note.text.trim().isEmpty ? null : _note.text.trim(),
          );
      ref.invalidate(cashSummaryProvider);
      ref.invalidate(cashHandoversProvider);
      if (!mounted) return;
      Navigator.of(context).pop();
      showSnack(context, 'سُجّل تسليم النقد. بانتظار تأكيد المعمل.');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      showSnack(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('تسليم نقد للمعمل'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            LabeledField(
              label: 'المبلغ المسلَّم (د.ع)',
              controller: _amount,
              hint: '0',
              keyboardType: const TextInputType.numberWithOptions(decimal: false),
              prefixIcon: Icons.payments,
            ),
            const SizedBox(height: 12),
            LabeledField(
              label: 'ملاحظة (اختياري)',
              controller: _note,
              hint: 'مثال: تسليم نهاية الوردية',
              prefixIcon: Icons.notes,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          child: const Text('إلغاء'),
        ),
        SizedBox(
          width: 130,
          child: LoadingButton(
            label: 'تسليم',
            icon: Icons.check_circle,
            color: AppColors.water600,
            loading: _submitting,
            onPressed: _submit,
          ),
        ),
      ],
    );
  }
}

/// قسم سجلّ التسليمات (تحميل/خطأ/قائمة).
class _HandoversSection extends StatelessWidget {
  const _HandoversSection({required this.handovers, required this.ref});

  final AsyncValue<List<CashHandover>> handovers;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<CashHandover>>(
      value: handovers,
      onRetry: () => ref.invalidate(cashHandoversProvider),
      data: (items) {
        if (items.isEmpty) {
          return const EmptyState(
            icon: Icons.inbox_outlined,
            title: 'لا توجد تسليمات بعد',
            message: 'عند تسليم النقد للمعمل، ستظهر القيود هنا.',
          );
        }
        return Column(
          children: [
            for (final h in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _HandoverRow(handover: h),
              ),
          ],
        );
      },
    );
  }
}

class _HandoverRow extends StatelessWidget {
  const _HandoverRow({required this.handover});

  final CashHandover handover;

  @override
  Widget build(BuildContext context) {
    final confirmed = handover.status == CashHandoverStatus.confirmed;
    final color = confirmed ? AppColors.success : AppColors.warn600;
    return SectionCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              confirmed ? Icons.check_circle : Icons.schedule,
              color: color,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Fmt.iqd(handover.amountIqd),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 3),
                Text(
                  handover.createdAt == null
                      ? 'غير مؤرّخ'
                      : Fmt.arabicDateTime(handover.createdAt),
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
                if (handover.note != null && handover.note!.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    handover.note!,
                    style: const TextStyle(fontSize: 12, color: AppColors.slate),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              handover.status.label,
              style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w800, color: color),
            ),
          ),
        ],
      ),
    );
  }
}
