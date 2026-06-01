import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';
import '../widgets/common.dart';
import '../widgets/gradient_header.dart';

/// تبويب «حسابي»: ملخّص الزبون + روابط الأقسام + تغيير كلمة السر + تسجيل الخروج.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(myProfileProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(myProfileProvider),
        child: AsyncView<CustomerProfile>(
          value: profileAsync,
          onRetry: () => ref.invalidate(myProfileProvider),
          data: (profile) {
            final credit = profile.balanceIqd >= 0;
            return ListView(
              padding: EdgeInsets.zero,
              children: [
                GradientHeader(
                  title: profile.fullName,
                  subtitle: profile.phone,
                  leading: const CircleAvatar(
                    radius: 26,
                    backgroundColor: Colors.white24,
                    child: Icon(Icons.person, color: Colors.white, size: 30),
                  ),
                  child: Row(
                    children: [
                      _HeaderChip(
                        icon: Icons.verified_user_outlined,
                        label: profile.status.label,
                      ),
                      const SizedBox(width: 10),
                      _HeaderChip(
                        icon: Icons.place_outlined,
                        label: profile.district,
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // ملخّص الحساب: التعبئات + الرصيد.
                      SectionCard(
                        child: Row(
                          children: [
                            Expanded(
                              child: _StatTile(
                                icon: Icons.water_drop_outlined,
                                color: AppColors.navy600,
                                label: 'إجمالي التعبئات',
                                value: '${profile.totalRefills}',
                              ),
                            ),
                            Container(width: 1, height: 44, color: AppColors.line),
                            Expanded(
                              child: _StatTile(
                                icon: Icons.account_balance_wallet_outlined,
                                color: credit ? AppColors.success : AppColors.danger,
                                label: credit ? 'رصيدك' : 'عليك',
                                value: Fmt.iqd(profile.balanceIqd.abs()),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // روابط الأقسام.
                      SectionCard(
                        padding: EdgeInsets.zero,
                        child: Column(
                          children: [
                            _LinkTile(
                              icon: Icons.location_on_outlined,
                              tint: AppColors.navy600,
                              label: 'عناويني',
                              onTap: () => context.push('/addresses'),
                            ),
                            const _LinkDivider(),
                            _LinkTile(
                              icon: Icons.event_repeat,
                              tint: AppColors.success,
                              label: 'الجدولة التلقائية',
                              onTap: () => context.push('/schedules'),
                            ),
                            const _LinkDivider(),
                            _LinkTile(
                              icon: Icons.account_balance_wallet_outlined,
                              tint: AppColors.water600,
                              label: 'المحفظة والنقاط',
                              onTap: () => context.push('/wallet'),
                            ),
                            const _LinkDivider(),
                            _LinkTile(
                              icon: Icons.notifications_outlined,
                              tint: AppColors.turquoise500,
                              label: 'الإشعارات',
                              onTap: () => context.push('/notifications'),
                            ),
                            const _LinkDivider(),
                            _LinkTile(
                              icon: Icons.settings_outlined,
                              tint: AppColors.slate,
                              label: 'الإعدادات',
                              onTap: () => context.push('/settings'),
                            ),
                            const _LinkDivider(),
                            _LinkTile(
                              icon: Icons.headset_mic_outlined,
                              tint: AppColors.warn600,
                              label: 'المساعدة والدعم',
                              onTap: () => context.push('/support'),
                            ),
                          ],
                        ),
                      ),

                      if (profile.acceptedTermsAt != null) ...[
                        const SizedBox(height: 16),
                        _TermsBanner(at: profile.acceptedTermsAt!),
                      ],

                      const SizedBox(height: 16),
                      OutlinedButton.icon(
                        onPressed: () => _showChangePassword(context),
                        icon: const Icon(Icons.lock_outline),
                        label: const Text('تغيير كلمة السر'),
                      ),
                      const SizedBox(height: 10),
                      LoadingButton(
                        label: 'تسجيل الخروج',
                        icon: Icons.logout,
                        color: AppColors.danger,
                        onPressed: () => _confirmLogout(context, ref),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<void> _showChangePassword(BuildContext context) {
    return showDialog<void>(
      context: context,
      builder: (_) => const _ChangePasswordDialog(),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تسجيل الخروج'),
        content: const Text('هل تريد الخروج من حسابك؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('إلغاء'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('خروج', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    // الراوتر يعيد التوجيه تلقائياً عند تبدّل حالة المصادقة.
    await ref.read(authControllerProvider.notifier).logout();
  }
}

/// حوار تغيير كلمة السر — حقلان مع حالة تحميل ومعالجة الأخطاء.
class _ChangePasswordDialog extends ConsumerStatefulWidget {
  const _ChangePasswordDialog();

  @override
  ConsumerState<_ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends ConsumerState<_ChangePasswordDialog> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final current = _current.text.trim();
    final next = _next.text.trim();
    if (!Validators.isPassword(next)) {
      showSnack(context, 'كلمة السر الجديدة قصيرة جداً.', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(authRepositoryProvider).changePassword(
            currentPassword: current,
            newPassword: next,
          );
      if (!mounted) return;
      Navigator.of(context).pop();
      showSnack(context, 'تم تغيير كلمة السر بنجاح.');
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('تغيير كلمة السر'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          LabeledField(
            label: 'كلمة السر الحالية',
            controller: _current,
            obscure: true,
            prefixIcon: Icons.lock_outline,
            hint: '••••••••',
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'كلمة السر الجديدة',
            controller: _next,
            obscure: true,
            prefixIcon: Icons.lock_reset,
            hint: '8 أحرف على الأقل',
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
          child: const Text('إلغاء'),
        ),
        FilledButton(
          onPressed: _saving ? null : _submit,
          child: _saving
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                )
              : const Text('حفظ'),
        ),
      ],
    );
  }
}

class _HeaderChip extends StatelessWidget {
  const _HeaderChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 16),
          const SizedBox(width: 6),
          Text(label,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: color, size: 26),
        const SizedBox(height: 8),
        Text(value,
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: color)),
        const SizedBox(height: 2),
        Text(label,
            style: const TextStyle(color: AppColors.slate, fontSize: 12)),
      ],
    );
  }
}

class _LinkTile extends StatelessWidget {
  const _LinkTile({
    required this.icon,
    required this.tint,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final Color tint;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: tint.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(11),
        ),
        child: Icon(icon, color: tint, size: 20),
      ),
      title: Text(label,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
      trailing: const Icon(Icons.chevron_left, color: AppColors.muted),
    );
  }
}

class _LinkDivider extends StatelessWidget {
  const _LinkDivider();

  @override
  Widget build(BuildContext context) {
    return const Divider(height: 1, indent: 64, endIndent: 16, color: AppColors.line);
  }
}

class _TermsBanner extends StatelessWidget {
  const _TermsBanner({required this.at});
  final DateTime at;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.task_alt, color: AppColors.success),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('عقدك موقّع',
                    style: TextStyle(
                        color: AppColors.success, fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text('وقّعت شروط الخدمة في ${Fmt.arabicDate(at)}',
                    style: const TextStyle(color: AppColors.slate, fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
