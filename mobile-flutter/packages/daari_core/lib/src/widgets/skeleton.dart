import 'package:flutter/material.dart';

/// عناصر «الهيكل العظمي» (Skeleton) مع وميض متحرّك (Shimmer) — بديل دوّار
/// `CircularProgressIndicator` أثناء التحميل. تحاكي شكل المحتوى القادم فيبدو
/// الانتظار أقصر وأكثر سلاسة (مكافئ مكتبة `react-content-loader` في Expo).

/// يلفّ أبناءه بوميضٍ متحرّك يكنس عرضهم بتدرّج فاتح. الأبناء يجب أن يكونوا
/// أشكالاً معتمة (مثل [SkeletonBox]) كي يؤثّر فيها `BlendMode.srcATop`.
class Shimmer extends StatefulWidget {
  const Shimmer({
    super.key,
    required this.child,
    this.baseColor = const Color(0xFFE2E8F0),
    this.highlightColor = const Color(0xFFF4F7FB),
    this.period = const Duration(milliseconds: 1100),
  });

  final Widget child;
  final Color baseColor;
  final Color highlightColor;
  final Duration period;

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer>
    with SingleTickerProviderStateMixin {
  // reverse: true يكنس الوميض ذهاباً وإياباً بسلاسة بلا قفزة عند نهاية الدورة.
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: widget.period)
        ..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            return LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [
                widget.baseColor,
                widget.highlightColor,
                widget.baseColor,
              ],
              // قمّة الوميض في المنتصف (0.5) كي تبقى مرئيّة طوال الدورة.
              stops: const [0.0, 0.5, 1.0],
              transform: _SlidingGradientTransform(_controller.value),
            ).createShader(bounds);
          },
          child: child,
        );
      },
    );
  }
}

/// يحرّك تدرّج الوميض أفقياً من خارج اليسار إلى خارج اليمين.
class _SlidingGradientTransform extends GradientTransform {
  const _SlidingGradientTransform(this.slidePercent);

  final double slidePercent;

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) {
    // قمّة الوميض (التدرّج عند 0.5) تقع عند x = slidePercent * width، فتكنس من
    // الحافة اليسرى إلى اليمنى مع slidePercent من 0 إلى 1 (ثم تعود بـ reverse).
    return Matrix4.translationValues(
      bounds.width * (slidePercent - 0.5),
      0,
      0,
    );
  }
}

/// مستطيل نائب بزوايا ناعمة — لبنة بناء الهياكل العظمية. لونه معتم ليكنسه الوميض.
class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius = 10,
  });

  final double? width;
  final double height;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFFE2E8F0),
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }
}

/// قائمة بطاقات نائبة وامِضة — حالة التحميل الافتراضية لـ `AsyncView`.
/// تصلح ملءَ الشاشة أو ضمن قسمٍ صغير (ترتفع بمقدار محتواها فقط).
class SkeletonList extends StatelessWidget {
  const SkeletonList({
    super.key,
    this.count = 6,
    this.padding = const EdgeInsets.all(16),
    this.itemHeight = 76,
  });

  final int count;
  final EdgeInsetsGeometry padding;
  final double itemHeight;

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: Padding(
        padding: padding,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < count; i++) ...[
              if (i > 0) const SizedBox(height: 12),
              SkeletonBox(height: itemHeight, borderRadius: 16),
            ],
          ],
        ),
      ),
    );
  }
}
