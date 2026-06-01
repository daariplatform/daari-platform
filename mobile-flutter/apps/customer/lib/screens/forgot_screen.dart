import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../widgets/common.dart';
import '../widgets/otp_field.dart';

/// استعادة كلمة السر — خطوتان: إرسال رمز ثم تعيين كلمة سر جديدة.
class ForgotScreen extends ConsumerStatefulWidget {
  const ForgotScreen({super.key});

  @override
  ConsumerState<ForgotScreen> createState() => _ForgotScreenState();
}

class _ForgotScreenState extends ConsumerState<ForgotScreen> {
  final _phone = TextEditingController();
  final _otp = TextEditingController();
  final _newPassword = TextEditingController();
  int _step = 1;
  bool _loading = false;
  bool _otpError = false;

  @override
  void dispose() {
    _phone.dispose();
    _otp.dispose();
    _newPassword.dispose();
    super.dispose();
  }

  Future<void> _requestCode() async {
    final phone = _phone.text.trim();
    if (!Validators.isPhone(phone)) {
      showSnack(context, 'أدخل رقماً بصيغة 07XXXXXXXXX', error: true);
      return;
    }
    setState(() => _loading = true);
    try {
      await ref.read(authRepositoryProvider).forgotPassword(phone);
      if (mounted) setState(() => _step = 2);
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _reset() async {
    if (!Validators.isOtp(_otp.text)) {
      setState(() => _otpError = true);
      return;
    }
    if (!Validators.isPassword(_newPassword.text)) {
      showSnack(context, 'كلمة السر 6 محارف على الأقل', error: true);
      return;
    }
    setState(() {
      _loading = true;
      _otpError = false;
    });
    try {
      await ref.read(authRepositoryProvider).resetPassword(
            phone: _phone.text.trim(),
            otp: _otp.text.trim(),
            newPassword: _newPassword.text,
          );
      if (mounted) {
        showSnack(context, 'تم تغيير كلمة السر. سجّل الدخول الآن.');
        context.go('/login');
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _otpError = true);
        showSnack(context, e.message, error: true);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('استعادة كلمة السر')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Icon(_step == 1 ? Icons.lock_reset : Icons.sms_outlined,
                color: AppColors.navy600, size: 56),
            const SizedBox(height: 24),
            if (_step == 1) ...[
              const Text('أدخل رقمك وسنرسل لك رمزاً عبر واتساب/رسالة.',
                  style: TextStyle(color: AppColors.slate, height: 1.6)),
              const SizedBox(height: 16),
              LabeledField(
                label: 'رقم الهاتف',
                controller: _phone,
                hint: '07XXXXXXXXX',
                keyboardType: TextInputType.phone,
                maxLength: 11,
                prefixIcon: Icons.phone_outlined,
              ),
              const SizedBox(height: 16),
              LoadingButton(
                  label: 'إرسال الرمز', loading: _loading, onPressed: _requestCode),
            ] else ...[
              Text('أرسلنا رمزاً إلى ${_phone.text}',
                  style: const TextStyle(color: AppColors.slate, height: 1.6)),
              const SizedBox(height: 16),
              OtpCodeField(controller: _otp, error: _otpError),
              const SizedBox(height: 8),
              LabeledField(
                label: 'كلمة السر الجديدة',
                controller: _newPassword,
                obscure: true,
                prefixIcon: Icons.lock_outline,
              ),
              const SizedBox(height: 16),
              LoadingButton(
                  label: 'تعيين كلمة السر', loading: _loading, onPressed: _reset),
              TextButton(
                onPressed: _loading ? null : _requestCode,
                child: const Text('إعادة إرسال الرمز'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
