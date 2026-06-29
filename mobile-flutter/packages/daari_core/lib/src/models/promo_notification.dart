import 'parse.dart';

/// قناة البثّ الترويجي — مطابق لـ Prisma `PromoChannel`.
enum PromoChannel {
  push('PUSH', 'إشعار'),
  whatsapp('WHATSAPP', 'واتساب');

  const PromoChannel(this.value, this.label);
  final String value;
  final String label;

  static PromoChannel fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return PromoChannel.push;
  }
}

/// حالة البثّ الترويجي — مطابق لـ Prisma `PromoStatus`.
enum PromoStatus {
  queued('QUEUED', 'في الطابور'),
  sent('SENT', 'أُرسِل'),
  failed('FAILED', 'فشل');

  const PromoStatus(this.value, this.label);
  final String value;
  final String label;

  static PromoStatus fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return PromoStatus.queued;
  }
}

/// بثّ ترويجي (إشعار/واتساب) لزبائن المعمل النشطين.
/// `POST /plant/promo-blast` · `GET /plant/promo-history` · `GET /plant/promo-blast/:id/status`.
/// PUSH يُرسَل فوراً (status=SENT)؛ WHATSAPP يُجدوَل (status=QUEUED) ويُحدِّثه العامل الخلفي.
class PromoNotification {
  const PromoNotification({
    required this.id,
    required this.tenantId,
    required this.channel,
    required this.title,
    required this.body,
    required this.audienceCount,
    required this.sentCount,
    required this.failedCount,
    required this.priceIqd,
    required this.status,
    this.scheduledFor,
    this.sentAt,
    required this.createdById,
    this.createdAt,
  });

  final String id;
  final String tenantId;
  final PromoChannel channel;
  final String title;
  final String body;

  /// حجم الجمهور المستهدف.
  final int audienceCount;
  final int sentCount;
  final int failedCount;

  /// التكلفة (٥٠٠٠ للإشعار؛ ١٠٠٠٠ + ١٠×الجمهور للواتساب).
  final int priceIqd;

  final PromoStatus status;
  final DateTime? scheduledFor;
  final DateTime? sentAt;
  final String createdById;
  final DateTime? createdAt;

  factory PromoNotification.fromJson(Map<String, dynamic> json) {
    return PromoNotification(
      id: P.str(json['id']),
      tenantId: P.str(json['tenantId']),
      channel: PromoChannel.fromValue(json['channel'] as String?),
      title: P.str(json['title']),
      body: P.str(json['body']),
      audienceCount: P.intv(json['audienceCount']),
      sentCount: P.intv(json['sentCount']),
      failedCount: P.intv(json['failedCount']),
      priceIqd: P.intv(json['priceIqd']),
      status: PromoStatus.fromValue(json['status'] as String?),
      scheduledFor: P.date(json['scheduledFor']),
      sentAt: P.date(json['sentAt']),
      createdById: P.str(json['createdById']),
      createdAt: P.date(json['createdAt']),
    );
  }
}
