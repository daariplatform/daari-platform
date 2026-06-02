import 'package:flutter/widgets.dart';

/// رقم يتزايد تصاعدياً عند تغيّر قيمته — بديل `AnimatedNumber`/`AnimatedCounter`
/// في Expo. عند أول ظهور يعدّ من الصفر إلى القيمة؛ وعند تغيّرها لاحقاً يتحرّك من
/// القيمة الحالية إلى الجديدة (TweenAnimationBuilder يعيد التشغيل من القيمة
/// الراهنة عند تغيّر `end`).
class AnimatedCounter extends StatelessWidget {
  const AnimatedCounter({
    super.key,
    required this.value,
    this.format,
    this.duration = const Duration(milliseconds: 900),
    this.style,
    this.textAlign,
  });

  /// القيمة الهدف.
  final num value;

  /// كيفية تنسيق الرقم للعرض (مثل `Fmt.iqd`). الافتراضي: عدد صحيح.
  final String Function(num value)? format;

  final Duration duration;
  final TextStyle? style;
  final TextAlign? textAlign;

  @override
  Widget build(BuildContext context) {
    final fmt = format ?? (n) => n.round().toString();
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: value.toDouble()),
      duration: duration,
      curve: Curves.easeOutCubic,
      builder: (_, animated, __) =>
          Text(fmt(animated), style: style, textAlign: textAlign),
    );
  }
}
