import 'parse.dart';

/// مغلّف نتائج مرقّمة عام — مطابق لـ `PaginatedResult<T>` في الباك إند.
/// تستعمله نقاط الإدارة التي تدعم الترقيم (مثل `GET /plant/audit-log?page=`).
class PagedResult<T> {
  const PagedResult({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
    required this.totalPages,
  });

  final List<T> items;
  final int total;
  final int page;
  final int pageSize;
  final int totalPages;

  bool get hasNextPage => page < totalPages;

  factory PagedResult.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromItem,
  ) {
    return PagedResult<T>(
      items: P.list(json['items'], fromItem),
      total: P.intv(json['total']),
      page: P.intv(json['page'], 1),
      pageSize: P.intv(json['pageSize']),
      totalPages: P.intv(json['totalPages']),
    );
  }
}
