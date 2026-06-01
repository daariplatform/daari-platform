import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers.dart';
import '../widgets/common.dart';

/// شاشة الإشعارات — تعرض كل الإشعارات المخزّنة للزبون.
class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  IconData _iconFor(NotificationType type) {
    switch (type) {
      case NotificationType.order:
        return Icons.local_shipping;
      case NotificationType.payment:
        return Icons.payments;
      case NotificationType.promo:
        return Icons.local_offer;
      case NotificationType.system:
        return Icons.info;
    }
  }

  Color _colorFor(NotificationType type) {
    switch (type) {
      case NotificationType.order:
        return AppColors.water600;
      case NotificationType.payment:
        return AppColors.success;
      case NotificationType.promo:
        return AppColors.warn600;
      case NotificationType.system:
        return AppColors.slate;
    }
  }

  Future<void> _markRead(BuildContext context, WidgetRef ref, String id) async {
    try {
      await ref.read(notificationsRepositoryProvider).markRead(id);
      ref.invalidate(notificationsProvider);
    } on ApiException catch (e) {
      if (!context.mounted) return;
      showSnack(context, e.message, error: true);
    }
  }

  Future<void> _markAllRead(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(notificationsRepositoryProvider).markAllRead();
      ref.invalidate(notificationsProvider);
      if (!context.mounted) return;
      showSnack(context, 'تم تحديد الكل كمقروء');
    } on ApiException catch (e) {
      if (!context.mounted) return;
      showSnack(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('الإشعارات'),
        actions: [
          TextButton.icon(
            onPressed: () => _markAllRead(context, ref),
            icon: const Icon(Icons.checklist_rtl, size: 18),
            label: const Text('تعليم الكل مقروء'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(notificationsProvider),
        child: AsyncView<NotificationsPage>(
          value: value,
          onRetry: () => ref.invalidate(notificationsProvider),
          data: (page) {
            final items = page.items;
            if (items.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 120),
                  EmptyState(
                    icon: Icons.notifications_off_outlined,
                    title: 'لا توجد إشعارات',
                    message:
                        'سنخطرك فور تحديث حالة طلبك أو وصول عرض جديد من معملك.',
                  ),
                ],
              );
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final n = items[index];
                final color = _colorFor(n.type);
                final unread = !n.read;
                return Material(
                  color: unread ? AppColors.navy50 : Colors.white,
                  borderRadius: BorderRadius.circular(AppTheme.radiusCard),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(AppTheme.radiusCard),
                    onTap: unread ? () => _markRead(context, ref, n.id) : null,
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        borderRadius:
                            BorderRadius.circular(AppTheme.radiusCard),
                        border: Border.all(
                          color: unread
                              ? color.withValues(alpha: 0.3)
                              : AppColors.line,
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Icon(_iconFor(n.type), color: color, size: 22),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  n.cleanTitle,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14,
                                    color: AppColors.ink,
                                    height: 1.4,
                                  ),
                                ),
                                if (n.body.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    n.body,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      color: AppColors.slate,
                                      height: 1.5,
                                    ),
                                  ),
                                ],
                                if (n.createdAt != null) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    Fmt.arabicDateTime(n.createdAt),
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.muted,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          if (unread) ...[
                            const SizedBox(width: 8),
                            Container(
                              width: 10,
                              height: 10,
                              margin: const EdgeInsets.only(top: 4),
                              decoration: BoxDecoration(
                                color: color,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
