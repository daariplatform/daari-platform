import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';

/// شاشة إقلاع السائق: تستعيد الجلسة ثم توجّه (الرئيسية / الدخول).
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _boot());
  }

  Future<void> _boot() async {
    await ref.read(authControllerProvider.notifier).hydrate();
    if (!mounted) return;
    final auth = ref.read(authControllerProvider);
    if (auth.isAuthenticated) {
      // استئناف تتبّع GPS تلقائياً لأي سائق مسجَّل عند الإقلاع (مطابقة Expo
      // _layout). نلتقط مزوّدات التطبيق (تبقى حيّة بعد إغلاق هذه الشاشة) ثم
      // نطلق المهمة دون انتظار كي لا نحبس التنقّل على جلب الموقع.
      final location = ref.read(locationServiceProvider);
      final shift = ref.read(onShiftProvider.notifier);
      () async {
        try {
          if (await location.startShift()) shift.state = true;
        } catch (_) {
          // أُنكِر إذن الموقع أو تعذّر — يبقى المفتاح يدويّاً من الرئيسية.
        }
      }();
      context.go('/home');
    } else {
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppTheme.skyGradient),
        child: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.local_shipping, color: Colors.white, size: 72),
              SizedBox(height: 16),
              Text('داري — السائق',
                  style: TextStyle(
                      color: Colors.white, fontSize: 26, fontWeight: FontWeight.w900)),
              SizedBox(height: 24),
              SizedBox(
                height: 26,
                width: 26,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
