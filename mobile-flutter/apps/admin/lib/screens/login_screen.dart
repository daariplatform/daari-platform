import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../router.dart';
import '../widgets/common.dart';

/// تسجيل دخول الإدارة بالهاتف + كلمة السر (حساب المالك/المدير/المحاسب).
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
      // حارس الراوتر ينقلنا إلى /home تلقائياً عند تغيّر حالة المصادقة؛
      // ثم نعرض تفعيل البصمة فوق الـ Navigator الجذر.
      await _offerBiometricEnrolment();
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// بعد أوّل دخول ناجح: اعرض تفعيل قفل البصمة (إن كان متاحاً ولم يُفعَّل بعد).
  /// نؤكّد بمسحةٍ واحدة الآن لنضمن أنّ البصمة تعمل قبل تخزين العلَم. يُعرض الحوار
  /// فوق الـ Navigator الجذر لأنّ الحارس ربّما نقلنا إلى /home بالفعل (فيُفكَّك
  /// سياق هذه الشاشة).
  Future<void> _offerBiometricEnrolment() async {
    if (await LocalFlags.biometricEnabled()) return;
    if (!await BiometricService.isAvailable()) return;
    final label = await BiometricService.label();
    final navContext = adminRootNavigatorKey.currentContext;
    if (navContext == null || !navContext.mounted) return;
    final enable = await showDialog<bool>(
      context: navContext,
      builder: (ctx) => AlertDialog(
        title: Text('تفعيل $label؟'),
        content: const Text(
            'فعّله لتفتح لوحة الإدارة بسرعة دون كلمة السر في المرّات القادمة.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('لاحقاً')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('تفعيل')),
        ],
      ),
    );
    if (enable != true) return;
    final ok = await BiometricService.authenticate('أكّد هويتك لتفعيل القفل');
    if (ok) await LocalFlags.setBiometricEnabled(true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('دخول الإدارة')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 12),
            const Icon(Icons.dashboard, color: AppColors.navy600, size: 56),
            const SizedBox(height: 8),
            const Center(
              child: Text('لوحة المعمل',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate)),
            ),
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
            const SizedBox(height: 16),
            LoadingButton(label: 'دخول', loading: _loading, onPressed: _submit),
          ],
        ),
      ),
    );
  }
}
