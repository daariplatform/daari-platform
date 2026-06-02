import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../widgets/common.dart';

/// شاشة الإعدادات — اللغة، تغيير كلمة السر، عن التطبيق، وحذف الحساب.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('الإعدادات')),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          // ── الحساب ──
          if (user != null) ...[
            _SectionLabel('الحساب'),
            _Tile(
              icon: Icons.person_outline,
              tint: AppColors.water600,
              title: 'الاسم',
              trailing: Text(
                user.fullName ?? '—',
                style: const TextStyle(color: AppColors.slate),
              ),
            ),
            _Tile(
              icon: Icons.call_outlined,
              tint: AppColors.water600,
              title: 'رقم الهاتف',
              trailing: Text(
                user.phone,
                style: const TextStyle(color: AppColors.slate),
              ),
            ),
          ],

          // ── التفضيلات ──
          _SectionLabel('التفضيلات'),
          _Tile(
            icon: Icons.language_outlined,
            tint: AppColors.turquoise500,
            title: 'اللغة',
            trailing: const Text('العربية', style: TextStyle(color: AppColors.slate)),
            chevron: true,
            onTap: () => showSnack(context, 'دعم الإنجليزية قريباً'),
          ),
          _Tile(
            icon: Icons.key_outlined,
            tint: AppColors.warn500,
            title: 'تغيير كلمة السر',
            chevron: true,
            onTap: () => _showChangePassword(context, ref),
          ),

          // ── المساعدة والقانونية ──
          _SectionLabel('المساعدة والقانونية'),
          _Tile(
            icon: Icons.description_outlined,
            tint: AppColors.navy600,
            title: 'شروط الخدمة',
            chevron: true,
            onTap: () =>
                Launchers.openUrl('https://daari-admin.phi-bit.com/legal/terms'),
          ),
          _Tile(
            icon: Icons.privacy_tip_outlined,
            tint: AppColors.turquoise500,
            title: 'سياسة الخصوصية',
            chevron: true,
            onTap: () => Launchers.openUrl(
              'https://daari-admin.phi-bit.com/legal/privacy',
            ),
          ),

          // ── حول ──
          _SectionLabel('حول'),
          _Tile(
            icon: Icons.info_outline,
            tint: AppColors.slate,
            title: 'عن التطبيق',
            chevron: true,
            onTap: () => _showAbout(context),
          ),

          const SizedBox(height: 12),

          // ── منطقة الخطر ──
          _SectionLabel('منطقة الخطر'),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'حذف الحساب نهائياً يمسح بياناتك ولا يمكن استرجاعها.',
                    style: TextStyle(color: AppColors.slate, height: 1.6, fontSize: 13),
                  ),
                  const SizedBox(height: 14),
                  OutlinedButton.icon(
                    onPressed: () => _confirmDelete(context, ref),
                    icon: const Icon(Icons.delete_outline),
                    label: const Text('حذف الحساب'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.danger,
                      side: const BorderSide(color: AppColors.danger),
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 8),
          const Center(
            child: Text(
              'داري • الإصدار 1.0.0',
              style: TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  // ─────────────────────────── حول التطبيق ───────────────────────────
  void _showAbout(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('عن التطبيق'),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'داري — خدمة توصيل المياه في العراق.',
              style: TextStyle(height: 1.6),
            ),
            SizedBox(height: 12),
            Text(
              'الإصدار 1.0.0',
              style: TextStyle(color: AppColors.slate),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('حسناً'),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────── تغيير كلمة السر ───────────────────────────
  void _showChangePassword(BuildContext context, WidgetRef ref) {
    showDialog<void>(
      context: context,
      builder: (_) => const _ChangePasswordDialog(),
    );
  }

  // ─────────────────────────── حذف الحساب ───────────────────────────
  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('حذف الحساب'),
        content: const Text(
          'سيتم حذف بياناتك نهائياً ولا يمكن استرجاعها. هل أنت متأكد؟',
          style: TextStyle(height: 1.6),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('إلغاء'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('حذف'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    if (!context.mounted) return;

    try {
      await ref.read(authRepositoryProvider).deleteAccount();
      await ref.read(authControllerProvider.notifier).logout();
      // بعد الخروج يتكفّل redirect الخاص بـ go_router بالعودة لشاشة الدخول.
    } on ApiException catch (e) {
      if (!context.mounted) return;
      showSnack(context, e.message, error: true);
    }
  }
}

// ═══════════════════════════ حوار تغيير كلمة السر ═══════════════════════════
class _ChangePasswordDialog extends ConsumerStatefulWidget {
  const _ChangePasswordDialog();

  @override
  ConsumerState<_ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends ConsumerState<_ChangePasswordDialog> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final current = _current.text;
    final next = _next.text;
    final confirm = _confirm.text;

    if (!Validators.isPassword(current) || !Validators.isPassword(next)) {
      showSnack(context, 'كلمة السر يجب أن تكون 6 أحرف على الأقل', error: true);
      return;
    }
    if (next != confirm) {
      showSnack(context, 'كلمتا السر غير متطابقتين', error: true);
      return;
    }

    setState(() => _loading = true);
    try {
      await ref
          .read(authRepositoryProvider)
          .changePassword(currentPassword: current, newPassword: next);
      if (!mounted) return;
      Navigator.of(context).pop();
      showSnack(context, 'تم تغيير كلمة السر بنجاح');
    } on ApiException catch (e) {
      if (!mounted) return;
      showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('تغيير كلمة السر'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            LabeledField(
              label: 'كلمة السر الحالية',
              controller: _current,
              obscure: true,
              prefixIcon: Icons.lock_outline,
            ),
            const SizedBox(height: 12),
            LabeledField(
              label: 'كلمة السر الجديدة',
              controller: _next,
              obscure: true,
              prefixIcon: Icons.lock_reset_outlined,
            ),
            const SizedBox(height: 12),
            LabeledField(
              label: 'تأكيد كلمة السر الجديدة',
              controller: _confirm,
              obscure: true,
              prefixIcon: Icons.lock_reset_outlined,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _loading ? null : () => Navigator.of(context).pop(),
          child: const Text('إلغاء'),
        ),
        LoadingButton(
          label: 'تغيير',
          loading: _loading,
          onPressed: _submit,
        ),
      ],
    );
  }
}

// ═══════════════════════════ عناصر مساعدة ═══════════════════════════
class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 6),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          color: AppColors.muted,
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.icon,
    required this.tint,
    required this.title,
    this.trailing,
    this.chevron = false,
    this.onTap,
  });

  final IconData icon;
  final Color tint;
  final String title;
  final Widget? trailing;
  final bool chevron;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: tint.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 20, color: tint),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (trailing != null) trailing!,
          if (chevron) ...[
            const SizedBox(width: 6),
            const Icon(Icons.chevron_left, color: AppColors.muted),
          ],
        ],
      ),
    );
  }
}
