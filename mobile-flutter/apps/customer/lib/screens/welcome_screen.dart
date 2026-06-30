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
                const SizedBox(height: 16),
                const Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _Badge(icon: Icons.location_on, label: 'معامل في منطقتك'),
                    _Badge(icon: Icons.local_shipping, label: 'توصيل خزان'),
                    _Badge(icon: Icons.check_circle, label: 'دخول مباشر'),
                  ],
                ),
                const Spacer(),
                const Text('كيف تستخدم داري؟',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w800)),
                const SizedBox(height: 12),
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
                const SizedBox(height: 4),
                Text('اكتشف معملاً قريباً واطلب الخدمة فوراً.',
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 12)),
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
                const SizedBox(height: 4),
                Text('أعطاك المعمل رقماً وكلمة مرور؟ ادخل مباشرةً.',
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 12)),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => Launchers.openUrl(
                      'https://daari-admin.phi-bit.com/legal/terms'),
                  child: Text('الشروط والخصوصية',
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.9),
                          decoration: TextDecoration.underline,
                          decorationColor: Colors.white70)),
                ),
                Text('من فاي‑بِت · إصدار 1.0.0',
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.6),
                        fontSize: 11)),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// شارة منفعة صغيرة (أيقونة + نص) على خلفية شبه شفّافة.
class _Badge extends StatelessWidget {
  const _Badge({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 14),
          const SizedBox(width: 5),
          Text(label,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
