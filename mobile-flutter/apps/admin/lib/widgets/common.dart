import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';

/// زرّ أساسي مع حالة تحميل (يعطّل نفسه ويُظهر دوّاراً).
class LoadingButton extends StatelessWidget {
  const LoadingButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.icon,
    this.color,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      style: color == null
          ? null
          : ElevatedButton.styleFrom(backgroundColor: color),
      onPressed: loading ? null : onPressed,
      child: loading
          ? const SizedBox(
              height: 22,
              width: 22,
              child: CircularProgressIndicator(
                  strokeWidth: 2.4, color: Colors.white),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 20),
                  const SizedBox(width: 8)
                ],
                Text(label),
              ],
            ),
    );
  }
}

/// حقل إدخال موحّد بعنوان.
class LabeledField extends StatelessWidget {
  const LabeledField({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.keyboardType,
    this.obscure = false,
    this.maxLength,
    this.prefixIcon,
    this.textInputAction,
    this.onSubmitted,
  });

  final String label;
  final TextEditingController controller;
  final String? hint;
  final TextInputType? keyboardType;
  final bool obscure;
  final int? maxLength;
  final IconData? prefixIcon;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.slate,
                fontSize: 13)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          obscureText: obscure,
          maxLength: maxLength,
          textInputAction: textInputAction,
          onSubmitted: onSubmitted,
          decoration: InputDecoration(
            hintText: hint,
            counterText: '',
            prefixIcon: prefixIcon == null ? null : Icon(prefixIcon),
          ),
        ),
      ],
    );
  }
}

/// بطاقة بيضاء بزوايا ناعمة وظلّ خفيف.
class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.line),
        boxShadow: [
          BoxShadow(
            color: AppColors.ink.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }
}

/// حالة فارغة/خطأ موحّدة (أيقونة + عنوان + وصف + زر اختياري).
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 64, color: AppColors.muted),
            const SizedBox(height: 16),
            Text(title,
                textAlign: TextAlign.center,
                style:
                    const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            if (message != null) ...[
              const SizedBox(height: 8),
              Text(message!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.slate, height: 1.6)),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 20),
              OutlinedButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

/// عرض موحّد لـ AsyncValue: تحميل/خطأ/بيانات مع زر إعادة محاولة.
class AsyncView<T> extends StatelessWidget {
  const AsyncView({
    super.key,
    required this.value,
    required this.data,
    this.onRetry,
    this.skeleton,
  });

  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final VoidCallback? onRetry;

  /// هيكل التحميل المخصّص؛ إن تُرك فارغاً نعرض [SkeletonList] الافتراضي.
  final Widget? skeleton;

  @override
  Widget build(BuildContext context) {
    return value.when(
      loading: () => skeleton ?? const SkeletonList(),
      error: (e, _) {
        final msg = e is ApiException ? e.message : 'حدث خطأ. حاول مجدداً.';
        final forbidden = e is ApiException && e.isForbidden;
        return EmptyState(
          icon: forbidden ? Icons.lock_outline : Icons.cloud_off,
          title: forbidden ? 'لا تملك صلاحية' : 'تعذّر التحميل',
          message: msg,
          actionLabel: onRetry == null ? null : 'إعادة المحاولة',
          onAction: onRetry,
        );
      },
      data: data,
    );
  }
}

/// عرض رسالة SnackBar موحّدة.
void showSnack(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..clearSnackBars()
    ..showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: error ? AppColors.danger : AppColors.ink,
      behavior: SnackBarBehavior.floating,
    ));
}

/// شريط اختيار مدى التقارير — يقرأ/يضبط [reportWindowProvider] المشترك.
/// عند ضبط مدى تتحدّث كل مزوّدات التقارير تلقائياً (تراقب نفس الحالة).
class ReportWindowBar extends ConsumerWidget {
  const ReportWindowBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final w = ref.watch(reportWindowProvider);
    final hasRange = w.from != null && w.to != null;
    final label = hasRange
        ? '${Fmt.arabicDate(w.from)} — ${Fmt.arabicDate(w.to)}'
        : 'الفترة الافتراضية';

    return SectionCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          const Icon(Icons.date_range, color: AppColors.navy600, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('الفترة',
                    style: TextStyle(fontSize: 11, color: AppColors.muted)),
                Text(label,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 13)),
              ],
            ),
          ),
          if (hasRange)
            IconButton(
              tooltip: 'مسح',
              visualDensity: VisualDensity.compact,
              icon: const Icon(Icons.close, size: 18, color: AppColors.muted),
              onPressed: () => ref.read(reportWindowProvider.notifier).state =
                  (from: null, to: null),
            ),
          TextButton(
            onPressed: () => _pick(context, ref, w),
            child: Text(hasRange ? 'تغيير' : 'اختر فترة'),
          ),
        ],
      ),
    );
  }

  Future<void> _pick(
      BuildContext context, WidgetRef ref, ReportWindow current) async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 3),
      lastDate: now,
      initialDateRange: (current.from != null && current.to != null)
          ? DateTimeRange(start: current.from!, end: current.to!)
          : null,
      locale: const Locale('ar'),
      helpText: 'اختر الفترة',
      saveText: 'تطبيق',
    );
    if (picked == null) return;
    ref.read(reportWindowProvider.notifier).state =
        (from: picked.start, to: picked.end);
  }
}
