import 'package:flutter/material.dart';

enum RainDensity { light, medium, heavy }

/// خلفية متحركة بقطرات ماء تنزل من فوق — بديل `RainBackground.tsx`.
///
/// محرّك واحد (ticker واحد) يقود كل القطرات؛ موضع كل قطرة يُحسب من قيمة المحرّك
/// + إزاحة طور ثابتة لكل قطرة (deterministic، بلا وميض على إعادة البناء). خفيفة
/// وتُغطّي كامل الأب. لا تلتقط اللمس.
class RainBackground extends StatefulWidget {
  const RainBackground({
    super.key,
    this.density = RainDensity.medium,
    this.color = Colors.white,
  });

  final RainDensity density;

  /// لون القطرات — أبيض فوق الأسطح الملوّنة (الهيدر)، أو لون فاتح فوق الأبيض.
  final Color color;

  @override
  State<RainBackground> createState() => _RainBackgroundState();
}

class _RainBackgroundState extends State<RainBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 6),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  int get _count => switch (widget.density) {
        RainDensity.light => 8,
        RainDensity.medium => 12,
        RainDensity.heavy => 18,
      };

  @override
  Widget build(BuildContext context) {
    // مواصفات شبه عشوائية ثابتة (نفس صيغة Expo).
    final drops = List.generate(_count, (i) {
      return _DropSpec(
        leftFraction: ((i * 37) % 100) / 100,
        size: 6 + ((i * 13) % 8).toDouble(),
        phase: ((i * 350) % 4000) / 4000,
        speed: 0.6 + ((i * 47) % 80) / 100, // 0.6..1.4 دورة لكل دورة محرّك
        opacity: 0.18 + ((i * 7) % 4) * 0.06,
      );
    });

    return IgnorePointer(
      child: ClipRect(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final h = constraints.maxHeight.isFinite
                ? constraints.maxHeight
                : MediaQuery.of(context).size.height;
            final w = constraints.maxWidth.isFinite
                ? constraints.maxWidth
                : MediaQuery.of(context).size.width;
            return AnimatedBuilder(
              animation: _controller,
              builder: (context, _) {
                return Stack(
                  children: [
                    for (final d in drops)
                      Positioned(
                        left: d.leftFraction * w,
                        top: _yFor(d, h),
                        child: Icon(
                          Icons.water_drop,
                          size: d.size,
                          color: widget.color.withValues(alpha: d.opacity),
                        ),
                      ),
                  ],
                );
              },
            );
          },
        ),
      ),
    );
  }

  double _yFor(_DropSpec d, double height) {
    final t = ((_controller.value * d.speed) + d.phase) % 1.0;
    return t * (height + 50) - 25;
  }
}

class _DropSpec {
  const _DropSpec({
    required this.leftFraction,
    required this.size,
    required this.phase,
    required this.speed,
    required this.opacity,
  });

  final double leftFraction;
  final double size;
  final double phase;
  final double speed;
  final double opacity;
}
