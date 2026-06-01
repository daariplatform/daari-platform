import 'parse.dart';

/// نوع الإشعار — يحدّد أيقونة/لون البطاقة.
enum NotificationType {
  order('order'),
  payment('payment'),
  system('system'),
  promo('promo');

  const NotificationType(this.value);
  final String value;

  static NotificationType fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return NotificationType.system;
  }
}

/// عنصر إشعار — مطابق لـ `Notif` في notifications.tsx.
/// يأتي من `GET /notifications/me` ضمن `{ items, unreadCount }`.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.read,
    required this.type,
    this.createdAt,
  });

  final String id;
  final String title;
  final String body;
  final bool read;
  final NotificationType type;
  final DateTime? createdAt;

  /// العنوان بعد إزالة رموز/إيموجي البداية (مثل "✅ تمّت تعبئة").
  String get cleanTitle =>
      title.replaceAll(RegExp(r'^[\s\p{P}\p{S}]+', unicode: true), '').trim();

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: P.str(json['id']),
      title: P.str(json['title']),
      body: P.str(json['body']),
      read: json['read'] == true,
      type: NotificationType.fromValue(json['type'] as String?),
      createdAt: P.date(json['createdAt']),
    );
  }
}

/// صفحة الإشعارات — العناصر + عدد غير المقروء.
class NotificationsPage {
  const NotificationsPage({required this.items, required this.unreadCount});

  final List<AppNotification> items;
  final int unreadCount;

  factory NotificationsPage.fromJson(Map<String, dynamic> json) {
    return NotificationsPage(
      items: P.list(json['items'], AppNotification.fromJson),
      unreadCount: P.intv(json['unreadCount']),
    );
  }
}
