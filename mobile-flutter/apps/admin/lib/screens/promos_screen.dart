import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets/common.dart';

/// شاشة العروض — تبويبان: حملات التخفيض (مموّلة من المحفظة) + البثّ الترويجي (إشعار/واتساب).
class PromosScreen extends StatelessWidget {
  const PromosScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('العروض'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'الحملات'),
              Tab(text: 'البثّ'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [_CampaignsTab(), _BlastsTab()],
        ),
      ),
    );
  }
}

// ── الحملات ─────────────────────────────────────────────────────────────────

class _CampaignsTab extends ConsumerWidget {
  const _CampaignsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(campaignsProvider);
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _createDialog(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('حملة جديدة'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(campaignsProvider),
        child: AsyncView<PromoCampaignList>(
          value: value,
          onRetry: () => ref.invalidate(campaignsProvider),
          data: (list) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              SectionCard(
                child: Row(
                  children: [
                    const Icon(Icons.account_balance_wallet_outlined,
                        color: AppColors.navy600),
                    const SizedBox(width: 10),
                    const Text('رصيد المحفظة',
                        style: TextStyle(color: AppColors.slate)),
                    const Spacer(),
                    Text(Fmt.iqd(list.walletBalanceIqd),
                        style: const TextStyle(
                            fontWeight: FontWeight.w900, fontSize: 16)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              if (list.campaigns.isEmpty)
                const EmptyState(
                  icon: Icons.local_offer_outlined,
                  title: 'لا حملات بعد',
                  message: 'أنشئ حملة تخفيض لجذب الطلبات.',
                )
              else
                for (final c in list.campaigns) ...[
                  _CampaignCard(campaign: c),
                  const SizedBox(height: 10),
                ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _createDialog(BuildContext context, WidgetRef ref) async {
    final price = TextEditingController();
    final hours = TextEditingController(text: '24');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('حملة تخفيض جديدة'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            LabeledField(
                label: 'سعر العرض (د.ع)',
                controller: price,
                keyboardType: TextInputType.number),
            const SizedBox(height: 10),
            LabeledField(
                label: 'المدّة (ساعات، أقصى 48)',
                controller: hours,
                keyboardType: TextInputType.number),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('إلغاء')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('إنشاء وبثّ')),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    final p = int.tryParse(price.text.trim());
    final h = int.tryParse(hours.text.trim());
    if (p == null || p <= 0 || h == null || h <= 0) {
      showSnack(context, 'أدخل سعراً ومدّة صحيحين', error: true);
      return;
    }
    try {
      await ref
          .read(promoRepositoryProvider)
          .createCampaign(promoPriceIqd: p, durationHours: h);
      ref.invalidate(campaignsProvider);
      if (context.mounted) showSnack(context, 'تم إنشاء الحملة وبثّها');
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    }
  }
}

class _CampaignCard extends ConsumerWidget {
  const _CampaignCard({required this.campaign});
  final PromoCampaign campaign;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = campaign;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('${c.promoPriceIqd} د.ع',
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w900)),
              const SizedBox(width: 8),
              Text('بدل ${c.originalPriceIqd}',
                  style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                      decoration: TextDecoration.lineThrough)),
              const Spacer(),
              _StatusChip(status: c.status),
            ],
          ),
          const SizedBox(height: 8),
          Text(
              'الطلبات: ${c.orderCount} · أُرسِل: ${c.pushSentCount} · الإيراد: ${Fmt.iqd(c.totalRevenueIqd)}',
              style: const TextStyle(color: AppColors.slate, fontSize: 12)),
          Text('ينتهي: ${Fmt.arabicDateTime(c.endAt)}',
              style: const TextStyle(color: AppColors.muted, fontSize: 12)),
          if (c.status.isRunning) ...[
            const SizedBox(height: 8),
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: TextButton.icon(
                onPressed: () => _pause(context, ref),
                icon: const Icon(Icons.pause_circle_outline,
                    color: AppColors.danger),
                label: const Text('إيقاف',
                    style: TextStyle(color: AppColors.danger)),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _pause(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('إيقاف الحملة'),
        content: const Text('إيقاف مبكّر للحملة؟ لا يوجد استرداد للرصيد.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('تراجع')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('إيقاف')),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      await ref.read(promoRepositoryProvider).pauseCampaign(campaign.id);
      ref.invalidate(campaignsProvider);
      if (context.mounted) showSnack(context, 'أُوقِفت الحملة');
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    }
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final PromoCampaignStatus status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      PromoCampaignStatus.active => AppColors.water600,
      PromoCampaignStatus.pausedByOwner => AppColors.muted,
      PromoCampaignStatus.expired => AppColors.slate,
      PromoCampaignStatus.outOfBudget => AppColors.danger,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(status.label,
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w800)),
    );
  }
}

// ── البثّ الترويجي ────────────────────────────────────────────────────────

class _BlastsTab extends ConsumerWidget {
  const _BlastsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(blastHistoryProvider);
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _sendDialog(context, ref),
        icon: const Icon(Icons.campaign_outlined),
        label: const Text('بثّ جديد'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(blastHistoryProvider),
        child: AsyncView<List<PromoNotification>>(
          value: value,
          onRetry: () => ref.invalidate(blastHistoryProvider),
          data: (items) {
            if (items.isEmpty) {
              return const EmptyState(
                icon: Icons.campaign_outlined,
                title: 'لا عمليات بثّ بعد',
                message: 'أرسل إشعاراً أو رسالة واتساب لزبائنك.',
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _BlastCard(blast: items[i]),
            );
          },
        ),
      ),
    );
  }

  Future<void> _sendDialog(BuildContext context, WidgetRef ref) async {
    final title = TextEditingController();
    final body = TextEditingController();
    var channel = PromoChannel.push;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('بثّ ترويجي'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              LabeledField(label: 'العنوان', controller: title),
              const SizedBox(height: 10),
              LabeledField(label: 'النصّ', controller: body),
              const SizedBox(height: 10),
              DropdownButtonFormField<PromoChannel>(
                initialValue: channel,
                decoration: const InputDecoration(labelText: 'القناة'),
                items: PromoChannel.values
                    .map(
                        (c) => DropdownMenuItem(value: c, child: Text(c.label)))
                    .toList(),
                onChanged: (v) => setState(() => channel = v ?? channel),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('إلغاء')),
            TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('إرسال')),
          ],
        ),
      ),
    );
    if (ok != true || !context.mounted) return;
    if (title.text.trim().isEmpty || body.text.trim().isEmpty) {
      showSnack(context, 'أدخل العنوان والنصّ', error: true);
      return;
    }
    try {
      await ref.read(promoRepositoryProvider).sendBlast(
            title: title.text.trim(),
            body: body.text.trim(),
            channel: channel,
          );
      ref.invalidate(blastHistoryProvider);
      if (context.mounted) showSnack(context, 'بدأ البثّ');
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    }
  }
}

class _BlastCard extends StatelessWidget {
  const _BlastCard({required this.blast});
  final PromoNotification blast;

  @override
  Widget build(BuildContext context) {
    final b = blast;
    return InkWell(
      borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      onTap: () => showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        builder: (_) => _BlastStatusSheet(initial: b),
      ),
      child: SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                    b.channel == PromoChannel.whatsapp
                        ? Icons.chat
                        : Icons.notifications_active_outlined,
                    size: 18,
                    color: AppColors.navy600),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(b.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
                _BlastStatusChip(status: b.status),
              ],
            ),
            const SizedBox(height: 6),
            Text(b.body,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.slate, fontSize: 13)),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: Text(
                      'الجمهور: ${b.audienceCount} · أُرسِل: ${b.sentCount} · فشل: ${b.failedCount} · ${Fmt.arabicDate(b.createdAt)}',
                      style: const TextStyle(
                          color: AppColors.muted, fontSize: 11)),
                ),
                const Icon(Icons.chevron_left,
                    size: 18, color: AppColors.muted),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// شريحة حالة البثّ بلون دلالي.
class _BlastStatusChip extends StatelessWidget {
  const _BlastStatusChip({required this.status});
  final PromoStatus status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      PromoStatus.sent => AppColors.water600,
      PromoStatus.queued => AppColors.warning,
      PromoStatus.failed => AppColors.danger,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(status.label,
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w800)),
    );
  }
}

/// ورقة سفلية لمتابعة حالة بثّ حيّة — تستقصي تلقائياً ما دام في الطابور.
class _BlastStatusSheet extends ConsumerWidget {
  const _BlastStatusSheet({required this.initial});
  final PromoNotification initial;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(blastStatusProvider(initial.id));
    // اعرض البيانات المعروفة فوراً، ثم استبدلها بالحيّة عند وصولها.
    final b = value.asData?.value ?? initial;
    final processed = b.sentCount + b.failedCount;
    final fraction = b.audienceCount > 0
        ? (processed / b.audienceCount).clamp(0.0, 1.0)
        : (b.status == PromoStatus.sent ? 1.0 : 0.0);
    final live = b.status == PromoStatus.queued;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                  b.channel == PromoChannel.whatsapp
                      ? Icons.chat
                      : Icons.notifications_active_outlined,
                  color: AppColors.navy600),
              const SizedBox(width: 10),
              Expanded(
                child: Text(b.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w900)),
              ),
              _BlastStatusChip(status: b.status),
            ],
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 10,
              backgroundColor: AppColors.line,
              valueColor: AlwaysStoppedAnimation<Color>(
                b.failedCount > 0 && b.sentCount == 0
                    ? AppColors.danger
                    : AppColors.water600,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text('$processed من ${b.audienceCount} عولِجوا',
              style: const TextStyle(color: AppColors.slate, fontSize: 12)),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _StatCell(
                  label: 'الجمهور',
                  value: '${b.audienceCount}',
                  color: AppColors.navy600),
              _StatCell(
                  label: 'أُرسِل',
                  value: '${b.sentCount}',
                  color: AppColors.water600),
              _StatCell(
                  label: 'فشل',
                  value: '${b.failedCount}',
                  color: AppColors.danger),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Icon(live ? Icons.sync : Icons.check_circle_outline,
                  size: 16, color: AppColors.muted),
              const SizedBox(width: 6),
              Text(
                live ? 'يُحدَّث تلقائياً…' : 'اكتمل · ${Fmt.arabicDateTime(b.createdAt)}',
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              const Spacer(),
              TextButton(
                onPressed: () => ref.invalidate(blastStatusProvider(initial.id)),
                child: const Text('تحديث'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell(
      {required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value,
            style: TextStyle(
                fontSize: 22, fontWeight: FontWeight.w900, color: color)),
        const SizedBox(height: 2),
        Text(label,
            style: const TextStyle(color: AppColors.slate, fontSize: 12)),
      ],
    );
  }
}
