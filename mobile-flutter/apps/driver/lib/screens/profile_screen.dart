import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';
import '../widgets/common.dart';
import '../widgets/gradient_header.dart';

/// تبويب «حسابي» للسائق: ملفّ السائق + بطاقة أداء الشهر + روابط
/// (النقد / الأرباح / جرد الفان) + تغيير كلمة السر + تسجيل الخروج.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(driverProfileProvider);

    return Scaffold(
      body: AsyncView<DriverProfile>(
        value: profileAsync,
        onRetry: () => ref.invalidate(driverProfileProvider),
        data: (profile) => _ProfileBody(profile: profile),
      ),
    );
  }
}

class _ProfileBody extends ConsumerWidget {
  const _ProfileBody({required this.profile});

  final DriverProfile profile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perfAsync = ref.watch(perfProvider('month'));
    final name = profile.fullName?.trim().isNotEmpty == true
        ? profile.fullName!.trim()
        : (ref.watch(currentUserProvider)?.phone ?? 'سائق');

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        GradientHeader(
          title: name,
          child: Row(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.22),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.35),
                    width: 2,
                  ),
                ),
                child: const Icon(Icons.local_shipping,
                    color: Colors.white, size: 34),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _HeaderChip(
                      icon: Icons.verified_user,
                      label: profile.status.label,
                    ),
                    if (profile.vehiclePlate != null &&
                        profile.vehiclePlate!.isNotEmpty)
                      _HeaderChip(
                        icon: Icons.directions_car,
                        label: profile.vehiclePlate!,
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── بطاقة أداء الشهر ──
              SectionCard(
                child: AsyncView<DriverPerf>(
                  value: perfAsync,
                  onRetry: () => ref.invalidate(perfProvider('month')),
                  // داخل بطاقة لها حشوتها — هيكل مدمج بلا حشوة مكرّرة.
                  skeleton: const SkeletonList(
                    count: 2,
                    itemHeight: 60,
                    padding: EdgeInsets.zero,
                  ),
                  data: (perf) => Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const _CardTitle(
                        icon: Icons.insights,
                        title: 'أداء هذا الشهر',
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: _StatTile(
                              icon: Icons.check_circle,
                              color: AppColors.navy600,
                              bg: AppColors.navy50,
                              label: 'طلبات مكتملة',
                              value: '${perf.completedOrders}',
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _StatTile(
                              icon: Icons.payments,
                              color: AppColors.water600,
                              bg: AppColors.water100,
                              label: 'الإيراد',
                              value: Fmt.iqdShort(perf.revenueIqd),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: _StatTile(
                              icon: Icons.emoji_events,
                              color: AppColors.warn600,
                              bg: const Color(0xFFFEF3C7),
                              label: 'المكافأة',
                              value: Fmt.iqdShort(perf.bonusIqd),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _StatTile(
                              icon: Icons.star,
                              color: AppColors.warn500,
                              bg: const Color(0xFFFEF3C7),
                              label: 'تقييم الزبائن',
                              value: perf.customerRating == null
                                  ? '—'
                                  : perf.customerRating!.toStringAsFixed(1),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ── تعويضاتك المعتمدة ──
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _CardTitle(
                      icon: Icons.account_balance_wallet,
                      title: 'تعويضاتك المعتمدة',
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'القيم معتمدة من قِبَل المعمل.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                    const SizedBox(height: 12),
                    _CompRow(
                      label: 'الراتب الأساسي',
                      value: profile.baseSalaryIqd == null
                          ? '—'
                          : Fmt.iqd(profile.baseSalaryIqd!),
                    ),
                    const Divider(height: 18),
                    _CompRow(
                      label: 'عمولة كل تعبئة',
                      value: profile.commissionPerRefillIqd == null
                          ? '—'
                          : Fmt.iqd(profile.commissionPerRefillIqd!),
                      valueColor: AppColors.water700,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // ── روابط الخدمة الذاتية ──
              _ActionRow(
                icon: Icons.payments,
                iconBg: AppColors.turquoise100,
                iconFg: AppColors.turquoise700,
                label: 'تسوية النقد وتسليمه',
                onTap: () => context.push('/cash'),
              ),
              const SizedBox(height: 10),
              _ActionRow(
                icon: Icons.show_chart,
                iconBg: AppColors.water100,
                iconFg: AppColors.water600,
                label: 'أرباحي عبر الوقت',
                onTap: () => context.push('/earnings'),
              ),
              const SizedBox(height: 10),
              _ActionRow(
                icon: Icons.local_shipping,
                iconBg: AppColors.navy50,
                iconFg: AppColors.navy600,
                label: 'جرد خزانات الفان',
                onTap: () => context.push('/van-inventory'),
              ),
              const SizedBox(height: 10),
              const _NotificationsRow(),
              const SizedBox(height: 10),
              _ActionRow(
                icon: Icons.lock_outline,
                iconBg: AppColors.navy100,
                iconFg: AppColors.navy700,
                label: 'تغيير كلمة السر',
                onTap: () => _showChangePasswordDialog(context, ref),
              ),
              const SizedBox(height: 10),
              _ActionRow(
                icon: Icons.logout,
                iconBg: const Color(0xFFFEE2E2),
                iconFg: AppColors.danger,
                label: 'تسجيل الخروج',
                danger: true,
                onTap: () => _confirmLogout(context, ref),
              ),
              const SizedBox(height: 10),
              _ActionRow(
                icon: Icons.delete_forever,
                iconBg: const Color(0xFFFEE2E2),
                iconFg: AppColors.danger,
                label: 'حذف الحساب نهائياً',
                danger: true,
                onTap: () => _confirmDelete(context, ref),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── حذف الحساب نهائياً (شرط متجر Apple/Google): إيقاف التتبّع ثم الحذف ──
  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('حذف الحساب'),
        content: const Text(
          'سيُحذف حسابك وبياناتك نهائياً ولا يمكن استرجاعها. متابعة؟',
          style: TextStyle(height: 1.6),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('إلغاء'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('حذف نهائي'),
          ),
        ],
      ),
    );
    if (ok != true) return;

    try {
      await ref.read(locationServiceProvider).stopShift();
      await ref.read(authRepositoryProvider).deleteAccount();
      await ref.read(authControllerProvider.notifier).logout();
      // الراوتر يعيد التوجيه لشاشة الدخول تلقائياً عند تبدّل حالة المصادقة.
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    }
  }

  // ── تسجيل الخروج: إيقاف التتبّع ثم تسجيل الخروج ──
  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تسجيل الخروج'),
        content: const Text('سيتم إنهاء وردية التتبّع وتسجيل خروجك. متابعة؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('إلغاء'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('خروج'),
          ),
        ],
      ),
    );
    if (ok != true) return;

    try {
      await ref.read(locationServiceProvider).stopShift();
      await ref.read(authControllerProvider.notifier).logout();
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    }
  }

  Future<void> _showChangePasswordDialog(
      BuildContext context, WidgetRef ref) async {
    await showDialog<void>(
      context: context,
      builder: (_) => const _ChangePasswordDialog(),
    );
  }
}

// ── حوار تغيير كلمة السر ──
class _ChangePasswordDialog extends ConsumerStatefulWidget {
  const _ChangePasswordDialog();

  @override
  ConsumerState<_ChangePasswordDialog> createState() =>
      _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends ConsumerState<_ChangePasswordDialog> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _submitting = false;
  String? _error;

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

    if (current.isEmpty) {
      setState(() => _error = 'أدخل كلمة السر الحالية.');
      return;
    }
    if (!Validators.isPassword(next)) {
      setState(() => _error = 'كلمة السر الجديدة 6 محارف على الأقل.');
      return;
    }
    if (next != confirm) {
      setState(() => _error = 'كلمة السر الجديدة وتأكيدها غير متطابقين.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref
          .read(authRepositoryProvider)
          .changePassword(currentPassword: current, newPassword: next);
      if (!mounted) return;
      Navigator.pop(context);
      showSnack(context, 'تم تغيير كلمة السر بنجاح.');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('تغيير كلمة السر'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'ستحتاج لإعادة تسجيل الدخول في الأجهزة الأخرى.',
              style: TextStyle(color: AppColors.slate, fontSize: 12.5),
            ),
            const SizedBox(height: 16),
            LabeledField(
              label: 'كلمة السر الحالية',
              controller: _current,
              hint: '••••••',
              obscure: true,
              prefixIcon: Icons.lock_outline,
            ),
            const SizedBox(height: 12),
            LabeledField(
              label: 'كلمة السر الجديدة',
              controller: _next,
              hint: '6 محارف على الأقل',
              obscure: true,
              prefixIcon: Icons.lock_reset,
            ),
            const SizedBox(height: 12),
            LabeledField(
              label: 'تأكيد كلمة السر الجديدة',
              controller: _confirm,
              hint: '••••••',
              obscure: true,
              prefixIcon: Icons.lock_reset,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submitting ? null : _submit(),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: const TextStyle(color: AppColors.danger, fontSize: 12.5),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context),
          child: const Text('إلغاء'),
        ),
        SizedBox(
          width: 110,
          child: LoadingButton(
            label: 'حفظ',
            loading: _submitting,
            onPressed: _submitting ? null : _submit,
          ),
        ),
      ],
    );
  }
}

// ── عناصر العرض المساعدة ──
class _HeaderChip extends StatelessWidget {
  const _HeaderChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: Colors.white),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _CardTitle extends StatelessWidget {
  const _CardTitle({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.navy600),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
        ),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.color,
    required this.bg,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color color;
  final Color bg;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.bg,
        borderRadius: BorderRadius.circular(AppTheme.radiusInput),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: color),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(color: AppColors.slate, fontSize: 11.5),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.ink,
            ),
          ),
        ],
      ),
    );
  }
}

class _CompRow extends StatelessWidget {
  const _CompRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(color: AppColors.slate, fontSize: 13),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: valueColor ?? AppColors.ink,
          ),
        ),
      ],
    );
  }
}

// ── بند الإشعارات: يعرض الحالة ويفتح إعدادات النظام عند الضغط ──
/// يُعيد فحص الحالة عند عودة التطبيق للمقدّمة كي تنعكس أيّ تغييرات فوراً.
class _NotificationsRow extends ConsumerStatefulWidget {
  const _NotificationsRow();

  @override
  ConsumerState<_NotificationsRow> createState() => _NotificationsRowState();
}

class _NotificationsRowState extends ConsumerState<_NotificationsRow>
    with WidgetsBindingObserver {
  bool? _enabled;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  Future<void> _refresh() async {
    final enabled = await ref.read(pushServiceProvider).areNotificationsEnabled();
    if (mounted) setState(() => _enabled = enabled);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = _enabled;
    final statusText =
        enabled == null ? '…' : (enabled ? 'مفعّلة' : 'معطّلة');
    final statusColor = enabled == true ? AppColors.success : AppColors.muted;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(AppTheme.radiusInput),
      child: InkWell(
        onTap: () => ref.read(pushServiceProvider).openNotificationSettings(),
        borderRadius: BorderRadius.circular(AppTheme.radiusInput),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusInput),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.water100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.notifications_outlined,
                    size: 20, color: AppColors.water600),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'الإشعارات',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
              ),
              Text(
                statusText,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  color: statusColor,
                ),
              ),
              const SizedBox(width: 6),
              const Icon(Icons.chevron_left, size: 22, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.iconBg,
    required this.iconFg,
    required this.label,
    required this.onTap,
    this.danger = false,
  });

  final IconData icon;
  final Color iconBg;
  final Color iconFg;
  final String label;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(AppTheme.radiusInput),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusInput),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusInput),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 20, color: iconFg),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: danger ? AppColors.danger : AppColors.ink,
                  ),
                ),
              ),
              const Icon(Icons.chevron_left, size: 22, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}
