import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../widgets/common.dart';

/// تسجيل الدخول بالهاتف + كلمة السر (يحدّدهما المعمل).
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    // أعِد البناء عند تغيّر المدخلات لتفعيل/تعطيل زرّ الدخول.
    _phone.addListener(_onChange);
    _password.addListener(_onChange);
  }

  void _onChange() => setState(() {});

  bool get _canSubmit =>
      Validators.isPhone(_phone.text.trim()) &&
      Validators.isPassword(_password.text);

  @override
  void dispose() {
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final phone = _phone.text.trim();
    if (!Validators.isPhone(phone)) {
      showSnack(context, 'أدخل رقماً بصيغة 07XXXXXXXXX', error: true);
      return;
    }
    if (!Validators.isPassword(_password.text)) {
      showSnack(context, 'أدخل كلمة السر (6 أحرف على الأقل)', error: true);
      return;
    }
    setState(() => _loading = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .login(phone: phone, password: _password.text);
      if (mounted) context.go('/home');
    } on ApiException catch (e) {
      if (mounted) showSnack(context, _loginError(e), error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// رسائل خطأ خاصّة بسياق الدخول (تتفادى رسالة 401 العامّة المضلّلة).
  String _loginError(ApiException e) {
    if (e.isRateLimited) {
      return 'محاولات كثيرة. حاول بعد ١٥ دقيقة.';
    }
    if (e.isUnauthorized) {
      return 'بيانات الدخول غير صحيحة. تواصل مع معمل المياه لإعادة تعيين كلمة السر.';
    }
    return e.message;
  }

  /// دخول تجريبي (وضع العرض): يعتمد على fixtures الـ DemoInterceptor.
  Future<void> _demoLogin() async {
    setState(() => _loading = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .login(phone: '07710000001', password: 'demo');
      if (mounted) context.go('/home');
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('تسجيل الدخول')),
      body: Stack(
        children: [
          const Positioned.fill(
            child: RainBackground(
              density: RainDensity.light,
              color: AppColors.navy300,
            ),
          ),
          SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 12),
            const Icon(Icons.water_drop, color: AppColors.navy600, size: 56),
            const SizedBox(height: 12),
            const Text(
              'استخدم رقم الهاتف وكلمة السر التي زوّدك بها معمل المياه.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.slate, height: 1.6, fontSize: 13),
            ),
            const SizedBox(height: 20),
            LabeledField(
              label: 'رقم الهاتف',
              controller: _phone,
              hint: '07XXXXXXXXX',
              keyboardType: TextInputType.phone,
              maxLength: 11,
              prefixIcon: Icons.phone_outlined,
            ),
            const SizedBox(height: 14),
            LabeledField(
              label: 'كلمة السر',
              controller: _password,
              obscure: true,
              obscureToggle: true,
              prefixIcon: Icons.lock_outline,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submit(),
            ),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton(
                onPressed: () => context.push('/forgot'),
                child: const Text('نسيت كلمة السر؟'),
              ),
            ),
            const SizedBox(height: 8),
            LoadingButton(
                label: 'دخول',
                loading: _loading,
                onPressed: _canSubmit ? _submit : null),
            const SizedBox(height: 16),
            Center(
              child: TextButton(
                onPressed: () => context.push('/signup'),
                child: const Text('ليس لديك حساب؟ سجّل الآن'),
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'باستخدامك التطبيق توافق على الشروط والأحكام وسياسة الخصوصية.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.5),
            ),
            if (Env.demoMode) ...[
              const SizedBox(height: 4),
              OutlinedButton.icon(
                onPressed: _loading ? null : _demoLogin,
                icon: const Icon(Icons.play_circle_outline),
                label: const Text('دخول تجريبي (بدون إنترنت)'),
              ),
            ],
          ],
        ),
      ),
        ],
      ),
    );
  }
}
