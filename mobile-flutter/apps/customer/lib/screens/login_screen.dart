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
    if (_password.text.isEmpty) {
      showSnack(context, 'أدخل كلمة السر', error: true);
      return;
    }
    setState(() => _loading = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .login(phone: phone, password: _password.text);
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
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 12),
            const Icon(Icons.water_drop, color: AppColors.navy600, size: 56),
            const SizedBox(height: 24),
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
            LoadingButton(label: 'دخول', loading: _loading, onPressed: _submit),
            const SizedBox(height: 16),
            Center(
              child: TextButton(
                onPressed: () => context.push('/signup'),
                child: const Text('ليس لديك حساب؟ سجّل الآن'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
