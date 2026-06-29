import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// شاشة القفل البيومتري — تظهر عند الإقلاع البارد إن فعّل المستخدم القفل.
/// تحرس جلسةً سارية أصلاً: نجاح البصمة يفتح اللوحة، والخروج يعيد لتسجيل الدخول.
class LockScreen extends ConsumerStatefulWidget {
  const LockScreen({super.key});

  @override
  ConsumerState<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends ConsumerState<LockScreen> {
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    // مُطالبة تلقائية بمجرّد الظهور (مثل تطبيق Expo).
    WidgetsBinding.instance.addPostFrameCallback((_) => _unlock());
  }

  Future<void> _unlock() async {
    if (_busy) return;
    setState(() => _busy = true);
    final ok = await BiometricService.authenticate('افتح لوحة إدارة داري');
    if (!mounted) return;
    if (ok) {
      context.go('/home');
      return;
    }
    setState(() => _busy = false);
  }

  Future<void> _logout() async {
    await LocalFlags.setBiometricEnabled(false);
    await ref.read(authControllerProvider.notifier).logout();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppTheme.skyGradient),
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.lock_outline, color: Colors.white, size: 72),
                  const SizedBox(height: 16),
                  const Text('لوحة الإدارة مقفلة',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  const Text('أكّد هويتك للمتابعة',
                      style: TextStyle(color: Colors.white70, fontSize: 14)),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _busy ? null : _unlock,
                      icon: _busy
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2.4, color: AppColors.navy600))
                          : const Icon(Icons.fingerprint),
                      label: const Text('فتح بالبصمة'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.navy700,
                        minimumSize: const Size.fromHeight(52),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: _busy ? null : _logout,
                    child: const Text('تسجيل الخروج بحساب آخر',
                        style: TextStyle(color: Colors.white)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
