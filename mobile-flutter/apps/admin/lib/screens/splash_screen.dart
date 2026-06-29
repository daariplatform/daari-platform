import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// شاشة الإقلاع: تستعيد الجلسة ثم توجّه (الرئيسية / تسجيل الدخول).
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
    if (!auth.isAuthenticated) {
      context.go('/login');
      return;
    }
    // جلسة سارية: إن فعّل المستخدم قفل البصمة وكان متاحاً، مُرّ عبر شاشة القفل.
    final locked = await LocalFlags.biometricEnabled() &&
        await BiometricService.isAvailable();
    if (!mounted) return;
    context.go(locked ? '/lock' : '/home');
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
              Icon(Icons.dashboard, color: Colors.white, size: 72),
              SizedBox(height: 16),
              Text('داري — الإدارة',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 30,
                      fontWeight: FontWeight.w900)),
              SizedBox(height: 24),
              SizedBox(
                height: 26,
                width: 26,
                child: CircularProgressIndicator(
                    color: Colors.white, strokeWidth: 2.5),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
