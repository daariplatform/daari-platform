import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets/common.dart';

/// شاشة الفريق — عرض الأعضاء + دعوة/تعديل/حذف (`teamRepository`).
/// المالك المؤسِّس والذات محميّان على الخادم (نُعطّل أزرارهما هنا أيضاً).
class TeamScreen extends ConsumerWidget {
  const TeamScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final team = ref.watch(teamListProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('الفريق')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _inviteDialog(context, ref),
        icon: const Icon(Icons.person_add_alt),
        label: const Text('دعوة عضو'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(teamListProvider),
        child: AsyncView<List<TeamMember>>(
          value: team,
          onRetry: () => ref.invalidate(teamListProvider),
          data: (members) {
            if (members.isEmpty) {
              return const EmptyState(
                icon: Icons.groups_outlined,
                title: 'لا أعضاء بعد',
                message: 'أضِف مديراً أو محاسباً لإدارة المعمل.',
              );
            }
            final meId = ref.watch(currentUserProvider)?.id;
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: members.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _MemberCard(
                  member: members[i], isSelf: members[i].id == meId),
            );
          },
        ),
      ),
    );
  }

  Future<void> _inviteDialog(BuildContext context, WidgetRef ref) async {
    final phone = TextEditingController();
    final name = TextEditingController();
    var role = UserRole.manager;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('دعوة عضو جديد'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              LabeledField(
                  label: 'رقم الهاتف',
                  controller: phone,
                  hint: '07XXXXXXXXX',
                  keyboardType: TextInputType.phone,
                  maxLength: 11),
              const SizedBox(height: 10),
              LabeledField(label: 'الاسم الكامل', controller: name),
              const SizedBox(height: 10),
              DropdownButtonFormField<UserRole>(
                initialValue: role,
                decoration: const InputDecoration(labelText: 'الدور'),
                items: const [
                  DropdownMenuItem(
                      value: UserRole.manager, child: Text('مدير')),
                  DropdownMenuItem(
                      value: UserRole.accountant, child: Text('محاسب')),
                ],
                onChanged: (v) => setState(() => role = v ?? role),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('إلغاء')),
            TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('دعوة')),
          ],
        ),
      ),
    );
    if (ok != true || !context.mounted) return;
    if (!Validators.isPhone(phone.text.trim()) || name.text.trim().length < 2) {
      showSnack(context, 'أدخل رقماً صحيحاً واسماً (حرفين على الأقل)',
          error: true);
      return;
    }
    try {
      final res = await ref.read(teamRepositoryProvider).invite(
            phone: phone.text.trim(),
            fullName: name.text.trim(),
            role: role,
          );
      ref.invalidate(teamListProvider);
      if (context.mounted) _showTempPassword(context, res);
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    }
  }

  void _showTempPassword(BuildContext context, TeamInviteResult res) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تمّت الدعوة'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${res.fullName} · ${res.role.label}'),
            const SizedBox(height: 12),
            const Text('كلمة المرور المؤقّتة (تُعرَض مرّة واحدة):',
                style: TextStyle(color: AppColors.slate, fontSize: 13)),
            const SizedBox(height: 6),
            SelectableText(res.tempPassword,
                style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: AppColors.navy700)),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('تمّ')),
        ],
      ),
    );
  }
}

class _MemberCard extends ConsumerWidget {
  const _MemberCard({required this.member, required this.isSelf});
  final TeamMember member;
  final bool isSelf;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locked = member.isFoundingOwner || isSelf;
    return SectionCard(
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: AppColors.navy100,
            child: const Icon(Icons.person, color: AppColors.navy700),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(member.fullName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                    ),
                    if (member.isFoundingOwner) ...[
                      const SizedBox(width: 6),
                      const Icon(Icons.verified,
                          size: 16, color: AppColors.navy600),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(member.phone,
                    style:
                        const TextStyle(color: AppColors.slate, fontSize: 12)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              _Chip(text: member.role.label, color: AppColors.navy600),
              const SizedBox(height: 6),
              _Chip(
                text: member.isActive ? 'نشط' : 'موقوف',
                color: member.isActive ? AppColors.water600 : AppColors.muted,
              ),
            ],
          ),
          if (!locked)
            PopupMenuButton<String>(
              onSelected: (v) => _onAction(context, ref, v),
              itemBuilder: (_) => [
                PopupMenuItem(
                  value: 'toggle',
                  child: Text(member.isActive ? 'إيقاف' : 'تفعيل'),
                ),
                const PopupMenuItem(value: 'role', child: Text('تغيير الدور')),
                const PopupMenuItem(value: 'remove', child: Text('حذف')),
              ],
            ),
        ],
      ),
    );
  }

  Future<void> _onAction(
      BuildContext context, WidgetRef ref, String action) async {
    final repo = ref.read(teamRepositoryProvider);
    try {
      switch (action) {
        case 'toggle':
          await repo.update(member.id, isActive: !member.isActive);
        case 'role':
          final role = await _pickRole(context);
          if (role == null || !context.mounted) return;
          await repo.update(member.id, role: role);
        case 'remove':
          final ok = await _confirmRemove(context);
          if (ok != true || !context.mounted) return;
          await repo.remove(member.id);
      }
      ref.invalidate(teamListProvider);
      if (context.mounted) showSnack(context, 'تمّ التحديث');
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    }
  }

  Future<UserRole?> _pickRole(BuildContext context) {
    return showDialog<UserRole>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('تغيير الدور'),
        children: [
          for (final r in const [
            UserRole.manager,
            UserRole.accountant,
          ])
            SimpleDialogOption(
              onPressed: () => Navigator.pop(ctx, r),
              child: Text(r.label),
            ),
        ],
      ),
    );
  }

  Future<bool?> _confirmRemove(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('حذف العضو'),
        content: Text('حذف ${member.fullName} من الفريق؟'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('إلغاء')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('حذف')),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.text, required this.color});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(text,
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w800)),
    );
  }
}
