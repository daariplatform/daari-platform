import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FilteringTextInputFormatter;
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
              child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[Icon(icon, size: 20), const SizedBox(width: 8)],
                Text(label),
              ],
            ),
    );
  }
}

/// حقل إدخال موحّد بعنوان.
/// عند [obscure] = true يمكن تفعيل [obscureToggle] لإظهار زرّ عين يبدّل الرؤية.
class LabeledField extends StatefulWidget {
  const LabeledField({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.keyboardType,
    this.obscure = false,
    this.obscureToggle = false,
    this.digitsOnly = false,
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

  /// يُظهر زرّ إظهار/إخفاء (يُفعَّل فقط مع [obscure] = true).
  final bool obscureToggle;

  /// ترشيح الأرقام لحظياً (يحذف غير الأرقام أثناء الكتابة).
  final bool digitsOnly;
  final int? maxLength;
  final IconData? prefixIcon;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;

  @override
  State<LabeledField> createState() => _LabeledFieldState();
}

class _LabeledFieldState extends State<LabeledField> {
  late bool _obscured = widget.obscure;

  @override
  Widget build(BuildContext context) {
    final showEye = widget.obscure && widget.obscureToggle;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label,
            style: const TextStyle(
                fontWeight: FontWeight.w700, color: AppColors.slate, fontSize: 13)),
        const SizedBox(height: 6),
        TextField(
          controller: widget.controller,
          keyboardType: widget.keyboardType,
          obscureText: _obscured,
          maxLength: widget.maxLength,
          textInputAction: widget.textInputAction,
          onSubmitted: widget.onSubmitted,
          inputFormatters: widget.digitsOnly
              ? [FilteringTextInputFormatter.digitsOnly]
              : null,
          decoration: InputDecoration(
            hintText: widget.hint,
            counterText: '',
            prefixIcon:
                widget.prefixIcon == null ? null : Icon(widget.prefixIcon),
            suffixIcon: showEye
                ? IconButton(
                    icon: Icon(_obscured
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined),
                    onPressed: () => setState(() => _obscured = !_obscured),
                  )
                : null,
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
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
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
/// حالة التحميل تعرض هيكلاً وامِضاً (Shimmer) بدل دوّار — يمكن تخصيصه عبر [skeleton].
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
