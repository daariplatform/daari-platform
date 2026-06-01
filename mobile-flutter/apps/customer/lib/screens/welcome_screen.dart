import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// شاشة الترحيب — مدخل الدخول/التسجيل.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppTheme.skyGradient),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              children: [
                const Spacer(),
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.water_drop, color: Colors.white, size: 80),
                ),
                const SizedBox(height: 28),
                const Text('داري',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 40,
                        fontWeight: FontWeight.w900)),
                const SizedBox(height: 10),
                Text('خدمات منزلك بضغطة زر',
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.9), fontSize: 16)),
                const Spacer(),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.navy700),
                    onPressed: () => context.push('/signup'),
                    child: const Text('حساب جديد'),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Colors.white70),
                      minimumSize: const Size.fromHeight(52),
                    ),
                    onPressed: () => context.push('/login'),
                    child: const Text('لديّ حساب — تسجيل الدخول'),
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
