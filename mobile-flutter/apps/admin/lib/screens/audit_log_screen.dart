import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../widgets/common.dart';

/// سجلّ التدقيق — قائمة مرقّمة («تحميل المزيد») مع فلاتر أفعال.
/// يقرأ `GET /plant/audit-log?page=&pageSize=&action=` (تصفية `contains`).
/// متاح لدور OWNER/MANAGER (403 يظهر كرسالة «لا تملك صلاحية» عبر [EmptyState]).
class AuditLogScreen extends ConsumerStatefulWidget {
  const AuditLogScreen({super.key});

  @override
  ConsumerState<AuditLogScreen> createState() => _AuditLogScreenState();
}

/// فلاتر مبنية على مطابقة `contains` للبادئة (الخادم يطابق جزئياً).
const _filters = {
  'الكل': null,
  'المخزون': 'stock',
  'العروض': 'promo',
  'الفريق': 'team',
  'التهيئة': 'onboarding',
};

/// رموز الأفعال الفعلية → تسميات عربية (مطابقة لـ backend/plant).
const _actionLabels = {
  'stock.update': 'تحديث المخزون',
  'promo.send': 'بثّ إشعار',
  'promo.queue': 'جدولة واتساب',
  'team.invite': 'دعوة عضو',
  'team.update': 'تعديل عضو',
  'team.delete': 'حذف عضو',
  'onboarding.skip': 'تخطّي التهيئة',
};

class _AuditLogScreenState extends ConsumerState<AuditLogScreen> {
  final List<AuditLogEntry> _items = [];
  String? _filter;
  int _page = 1;
  bool _loading = false;
  bool _hasMore = true;
  Object? _error; // غير فارغ فقط عند فشل الصفحة الأولى (قائمة فارغة).

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    setState(() {
      _items.clear();
      _page = 1;
      _hasMore = true;
      _error = null;
    });
    await _loadMore();
  }

  Future<void> _loadMore() async {
    if (_loading || !_hasMore) return;
    setState(() => _loading = true);
    try {
      final res = await ref.read(plantRepositoryProvider).auditLogPaged(
            page: _page,
            pageSize: 20,
            action: _filter,
          );
      if (!mounted) return;
      setState(() {
        _items.addAll(res.items);
        _hasMore = res.hasNextPage;
        _page++;
        _error = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = _items.isEmpty ? e : null);
      if (_items.isNotEmpty) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _selectFilter(String? value) {
    if (_filter == value) return;
    setState(() => _filter = value);
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('سجلّ التدقيق')),
      body: Column(
        children: [
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: [
                for (final f in _filters.entries) ...[
                  ChoiceChip(
                    label: Text(f.key),
                    selected: _filter == f.value,
                    onSelected: (_) => _selectFilter(f.value),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_error != null) {
      final e = _error!;
      final forbidden = e is ApiException && e.isForbidden;
      return EmptyState(
        icon: forbidden ? Icons.lock_outline : Icons.cloud_off,
        title: forbidden ? 'لا تملك صلاحية' : 'تعذّر التحميل',
        message: e is ApiException ? e.message : 'حدث خطأ. حاول مجدداً.',
        actionLabel: 'إعادة المحاولة',
        onAction: _reload,
      );
    }
    if (_items.isEmpty && _loading) {
      return const SkeletonList();
    }
    if (_items.isEmpty) {
      return RefreshIndicator(
        onRefresh: _reload,
        child: ListView(
          children: const [
            SizedBox(height: 80),
            EmptyState(
              icon: Icons.history,
              title: 'لا قيود',
              message: 'لا عمليات مسجّلة ضمن هذا الفلتر.',
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _reload,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _items.length + 1,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, i) {
          if (i == _items.length) return _buildFooter();
          return _AuditTile(entry: _items[i]);
        },
      ),
    );
  }

  Widget _buildFooter() {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(
          child: SizedBox(
            height: 24,
            width: 24,
            child: CircularProgressIndicator(strokeWidth: 2.4),
          ),
        ),
      );
    }
    if (_hasMore) {
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: OutlinedButton(
          onPressed: _loadMore,
          child: const Text('تحميل المزيد'),
        ),
      );
    }
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 16),
      child: Center(
        child: Text('انتهى السجلّ',
            style: TextStyle(color: AppColors.muted, fontSize: 12)),
      ),
    );
  }
}

class _AuditTile extends StatelessWidget {
  const _AuditTile({required this.entry});
  final AuditLogEntry entry;

  @override
  Widget build(BuildContext context) {
    final e = entry;
    final label = _actionLabels[e.action] ?? e.action;
    return SectionCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: AppColors.navy100,
            child: Icon(_iconFor(e.action),
                size: 18, color: AppColors.navy700),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text(
                  '${e.actorName} · ${Fmt.arabicDateTime(e.createdAt)}',
                  style:
                      const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData _iconFor(String action) {
    if (action.startsWith('stock')) return Icons.water_drop_outlined;
    if (action.startsWith('promo')) return Icons.campaign_outlined;
    if (action.startsWith('team')) return Icons.group_outlined;
    if (action.startsWith('onboarding')) return Icons.checklist_outlined;
    return Icons.history;
  }
}
