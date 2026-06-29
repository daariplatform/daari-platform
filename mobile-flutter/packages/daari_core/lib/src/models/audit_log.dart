import 'parse.dart';

/// قيد في سجلّ التدقيق — `GET /plant/audit-log`.
/// يُرجَع كمصفوفة مسطّحة (الشكل القديم) أو ضمن مغلّف [PagedResult] عند الترقيم.
class AuditLogEntry {
  const AuditLogEntry({
    required this.id,
    required this.tenantId,
    required this.actorId,
    required this.actorName,
    required this.action,
    this.entityType,
    this.entityId,
    this.before,
    this.after,
    this.metadata,
    this.createdAt,
  });

  final String id;
  final String tenantId;
  final String actorId;
  final String actorName;

  /// رمز الفعل (مثل `STOCK_UPDATE` / `TEAM_INVITE`).
  final String action;

  final String? entityType;
  final String? entityId;

  /// لقطة قبل/بعد التغيير + بيانات إضافية (JSON حرّ).
  final Map<String, dynamic>? before;
  final Map<String, dynamic>? after;
  final Map<String, dynamic>? metadata;

  final DateTime? createdAt;

  factory AuditLogEntry.fromJson(Map<String, dynamic> json) {
    return AuditLogEntry(
      id: P.str(json['id']),
      tenantId: P.str(json['tenantId']),
      actorId: P.str(json['actorId']),
      actorName: P.str(json['actorName']),
      action: P.str(json['action']),
      entityType: json['entityType'] as String?,
      entityId: json['entityId'] as String?,
      before: P.obj(json['before']),
      after: P.obj(json['after']),
      metadata: P.obj(json['metadata']),
      createdAt: P.date(json['createdAt']),
    );
  }
}
