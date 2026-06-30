import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';
import '../widgets/common.dart';

/// شاشة «المزيد» — هوية المستخدم + استهلاك الباقة + تسجيل الخروج.
class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تسجيل الخروج'),
        content: const Text('هل تريد تسجيل الخروج من لوحة المعمل؟'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('إلغاء')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('خروج')),
        ],
      ),
    );
    if (ok != true) return;
    // امسح علَم قفل البصمة كي لا يُطالَب المستخدم التالي على نفس الجهاز.
    await LocalFlags.setBiometricEnabled(false);
    await ref.read(authControllerProvider.notifier).logout();
    if (context.mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final usage = ref.watch(adminUsageProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('المزيد')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionCard(
            child: Row(
              children: [
                const CircleAvatar(
                  radius: 26,
                  backgroundColor: AppColors.navy100,
                  child: Icon(Icons.person, color: AppColors.navy700, size: 28),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user?.fullName ?? 'مستخدم',
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 2),
                      Text(user?.phone ?? '—',
                          style: const TextStyle(
                              color: AppColors.slate, fontSize: 13)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text('الاشتراك',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          AsyncView<PlantUsage>(
            value: usage,
            onRetry: () => ref.invalidate(adminUsageProvider),
            skeleton: const SizedBox(height: 80, child: SkeletonList()),
            data: (u) => SectionCard(
              child: Column(
                children: [
                  _Row(label: 'الباقة', value: u.plan.label),
                  const Divider(height: 18),
                  _Row(label: 'الحالة', value: u.status.label),
                  const Divider(height: 18),
                  _Row(
                      label: 'العمليات هذا الشهر',
                      value: '${u.opsThisMonth} / ${u.opsLimit}'),
                  const Divider(height: 18),
                  _Row(
                      label: 'السعر الشهري', value: Fmt.iqd(u.monthlyPriceIqd)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Text('الأمان',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          const SectionCard(
            padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
            child: _BiometricLockTile(),
          ),
          const SizedBox(height: 20),
          const Text('الإدارة',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          SectionCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: const [
                _NavTile(
                    icon: Icons.water_drop_outlined,
                    label: 'المخزون',
                    route: '/stock'),
                Divider(height: 1),
                _NavTile(
                    icon: Icons.local_offer_outlined,
                    label: 'العروض',
                    route: '/promos'),
                Divider(height: 1),
                _NavTile(
                    icon: Icons.map_outlined,
                    label: 'خريطة الأسطول',
                    route: '/fleet'),
                Divider(height: 1),
                _NavTile(
                    icon: Icons.leaderboard_outlined,
                    label: 'أداء السائقين',
                    route: '/drivers/performance'),
                Divider(height: 1),
                _NavTile(
                    icon: Icons.local_fire_department_outlined,
                    label: 'الخريطة الحرارية',
                    route: '/reports/heatmap'),
                Divider(height: 1),
                _NavTile(
                    icon: Icons.insights_outlined,
                    label: 'تقارير متقدّمة',
                    route: '/reports/advanced'),
                Divider(height: 1),
                _NavTile(
                    icon: Icons.history,
                    label: 'سجلّ التدقيق',
                    route: '/audit'),
                Divider(height: 1),
                _NavTile(
                    icon: Icons.checklist_outlined,
                    label: 'تهيئة المعمل',
                    route: '/onboarding'),
              ],
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () => _logout(context, ref),
            icon: const Icon(Icons.logout, color: AppColors.danger),
            label: const Text('تسجيل الخروج',
                style: TextStyle(color: AppColors.danger)),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: AppColors.danger),
              minimumSize: const Size.fromHeight(50),
            ),
          ),
          const SizedBox(height: 24),
          const Center(
            child: Text('داري — لوحة الإدارة · إصدار 1.0.0',
                style: TextStyle(color: AppColors.muted, fontSize: 12)),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child: Text(label,
                style: const TextStyle(color: AppColors.slate, fontSize: 13))),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
      ],
    );
  }
}

/// مفتاح تفعيل/إلغاء قفل الدخول بالبصمة (يُؤكَّد بمسحةٍ عند التفعيل).
class _BiometricLockTile extends ConsumerStatefulWidget {
  const _BiometricLockTile();

  @override
  ConsumerState<_BiometricLockTile> createState() => _BiometricLockTileState();
}

class _BiometricLockTileState extends ConsumerState<_BiometricLockTile> {
  bool _available = false;
  bool _enabled = false;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final available = await BiometricService.isAvailable();
    final enabled = await LocalFlags.biometricEnabled();
    if (!mounted) return;
    setState(() {
      _available = available;
      _enabled = enabled;
      _loading = false;
    });
  }

  Future<void> _toggle(bool value) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      if (value) {
        final ok =
            await BiometricService.authenticate('أكّد هويتك لتفعيل القفل');
        if (!ok) return;
        await LocalFlags.setBiometricEnabled(true);
        if (mounted) setState(() => _enabled = true);
      } else {
        await LocalFlags.setBiometricEnabled(false);
        if (mounted) setState(() => _enabled = false);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const ListTile(
        leading: Icon(Icons.fingerprint, color: AppColors.navy600),
        title: Text('قفل بالبصمة'),
        trailing: SizedBox(
          height: 20,
          width: 20,
          child: CircularProgressIndicator(strokeWidth: 2.2),
        ),
      );
    }
    return SwitchListTile(
      secondary: const Icon(Icons.fingerprint, color: AppColors.navy600),
      title: const Text('قفل بالبصمة',
          style: TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text(
        _available
            ? 'اطلب البصمة عند فتح التطبيق'
            : 'غير متوفّر على هذا الجهاز',
        style: const TextStyle(color: AppColors.slate, fontSize: 12),
      ),
      value: _enabled && _available,
      onChanged: (_available && !_busy) ? _toggle : null,
    );
  }
}

class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.icon,
    required this.label,
    required this.route,
  });

  final IconData icon;
  final String label;
  final String route;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: AppColors.navy600),
      title: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
      trailing: const Icon(Icons.chevron_left, color: AppColors.muted),
      onTap: () => context.push(route),
    );
  }
}
