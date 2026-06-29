import 'parse.dart';

/// نوع حدث في خطّ النشاط.
enum ActivityEventKind {
  order('order', 'طلب'),
  lead('lead', 'عميل محتمل'),
  stock('stock', 'مخزون'),
  driver('driver', 'سائق');

  const ActivityEventKind(this.value, this.label);
  final String value;
  final String label;

  static ActivityEventKind fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return ActivityEventKind.order;
  }
}

/// حدث في الخطّ الزمني الموحّد — `GET /plant/activity-feed`.
/// مُهيّأ مسبقاً للعرض (عنوان/عنوان فرعي/رابط عميق).
class ActivityEvent {
  const ActivityEvent({
    required this.id,
    required this.kind,
    required this.title,
    required this.subtitle,
    this.createdAt,
    this.deeplink,
  });

  /// معرّف بصيغة `kind:id`.
  final String id;
  final ActivityEventKind kind;
  final String title;
  final String subtitle;
  final DateTime? createdAt;

  /// رابط عميق اختياري (مثل `/orders/<id>`).
  final String? deeplink;

  factory ActivityEvent.fromJson(Map<String, dynamic> json) {
    return ActivityEvent(
      id: P.str(json['id']),
      kind: ActivityEventKind.fromValue(json['kind'] as String?),
      title: P.str(json['title']),
      subtitle: P.str(json['subtitle']),
      createdAt: P.date(json['createdAt']),
      deeplink: json['deeplink'] as String?,
    );
  }
}
