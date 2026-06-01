import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers.dart';
import '../widgets/common.dart';

/// شاشة دخول السائق — حسابات السائقين ينشئها المعمل (لا تسجيل ذاتي).
/// بعد الدخول تُبدأ الوردية best-effort ثم ننتقل للرئيسية.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _loading = false;

  @override
  void dispose() {
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final phone = _phone.text.trim();
    final password = _password.text;

    if (!Validators.isPhone(phone)) {
      showSnack(context, 'أدخل رقم هاتف عراقي صحيح (07XXXXXXXXX).', error: true);
      return;
    }
    if (!Validators.isPassword(password)) {
      showSnack(context, 'كلمة المرور 6 محارف على الأقل.', error: true);
      return;
    }

    setState(() => _loading = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .login(phone: phone, password: password);
      if (!mounted) return;

      // بدء الوردية best-effort: لا يُفشل الدخول إن رُفض إذن الموقع.
      try {
        final started = await ref.read(locationServiceProvider).startShift();
        if (started) {
          ref.read(onShiftProvider.notifier).state = true;
        }
      } catch (_) {
        // تجاهل — التتبّع يبقى متوقّفاً ويمكن تشغيله من الرئيسية.
      }

      if (!mounted) return;
      context.go('/home');
    } on ApiException catch (e) {
      if (!mounted) return;
      showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(gradient: AppTheme.skyGradient),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
            child: Column(
              children: [
                const SizedBox(height: 12),
                // شعار شاحنة.
                Container(
                  width: 84,
                  height: 84,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
                  ),
                  child: const Icon(Icons.local_shipping, color: Colors.white, size: 46),
                ),
                const SizedBox(height: 14),
                const Text(
                  'سائق المعمل',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'دخول بالبيانات التي زوّدك بها المعمل',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.9),
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 24),
                SectionCard(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'تسجيل الدخول',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'استخدم رقم الهاتف وكلمة المرور المسجّلَين لدى معملك.',
                        style: TextStyle(color: AppColors.slate, height: 1.6, fontSize: 13),
                      ),
                      const SizedBox(height: 18),
                      LabeledField(
                        label: 'رقم الهاتف',
                        controller: _phone,
                        hint: '07XXXXXXXXX',
                        keyboardType: TextInputType.phone,
                        maxLength: 11,
                        prefixIcon: Icons.phone_iphone,
                        textInputAction: TextInputAction.next,
                      ),
                      const SizedBox(height: 14),
                      _PasswordField(
                        controller: _password,
                        obscure: _obscure,
                        onToggle: () => setState(() => _obscure = !_obscure),
                        onSubmitted: (_) => _submit(),
                      ),
                      const SizedBox(height: 22),
                      LoadingButton(
                        label: 'دخول',
                        icon: Icons.login,
                        loading: _loading,
                        onPressed: _submit,
                      ),
                      const SizedBox(height: 10),
                      Center(
                        child: TextButton(
                          onPressed: _loading ? null : () => context.push('/forgot'),
                          child: const Text(
                            'نسيت كلمة المرور؟',
                            style: TextStyle(
                              color: AppColors.navy700,
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ),
                      const Divider(height: 24),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.info_outline, size: 18, color: AppColors.navy600),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'لم تستلم بيانات الدخول؟ تواصل مع صاحب معملك ليفتح لك حساباً من اللوحة.',
                              style: const TextStyle(
                                color: AppColors.slate,
                                fontSize: 11.5,
                                height: 1.6,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// حقل كلمة المرور مع زر إظهار/إخفاء — مبنيّ بنفس نمط LabeledField.
class _PasswordField extends StatelessWidget {
  const _PasswordField({
    required this.controller,
    required this.obscure,
    required this.onToggle,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final bool obscure;
  final VoidCallback onToggle;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'كلمة المرور',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            color: AppColors.slate,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          obscureText: obscure,
          keyboardType: TextInputType.visiblePassword,
          textInputAction: TextInputAction.done,
          onSubmitted: onSubmitted,
          inputFormatters: [FilteringTextInputFormatter.deny(RegExp(r'\s'))],
          decoration: InputDecoration(
            hintText: '••••••',
            prefixIcon: const Icon(Icons.lock_outline),
            suffixIcon: IconButton(
              icon: Icon(obscure ? Icons.visibility : Icons.visibility_off),
              color: AppColors.muted,
              onPressed: onToggle,
              tooltip: obscure ? 'إظهار' : 'إخفاء',
            ),
          ),
        ),
      ],
    );
  }
}
