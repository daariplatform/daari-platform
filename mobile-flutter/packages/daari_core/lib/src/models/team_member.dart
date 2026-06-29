import 'parse.dart';

/// دور المستخدم — مطابق لـ Prisma `UserRole`.
enum UserRole {
  owner('OWNER', 'المالك'),
  manager('MANAGER', 'مدير'),
  accountant('ACCOUNTANT', 'محاسب'),
  driver('DRIVER', 'سائق'),
  customer('CUSTOMER', 'زبون'),
  vendor('VENDOR', 'مورّد'),
  platformAdmin('PLATFORM_ADMIN', 'مشرف المنصّة');

  const UserRole(this.value, this.label);
  final String value;
  final String label;

  static UserRole fromValue(String? v) {
    for (final e in values) {
      if (e.value == v) return e;
    }
    return UserRole.manager;
  }

  /// أدوار فريق المعمل (القابلة للإدارة عبر `/plant/team`).
  bool get isPlantStaff =>
      this == UserRole.owner ||
      this == UserRole.manager ||
      this == UserRole.accountant;
}

/// عضو في فريق المعمل — `GET /plant/team` و `PATCH /plant/team/:userId`.
class TeamMember {
  const TeamMember({
    required this.id,
    required this.phone,
    required this.fullName,
    required this.role,
    required this.isActive,
    this.lastLoginAt,
    this.createdAt,
    this.isFoundingOwner = false,
  });

  final String id;
  final String phone;
  final String fullName;
  final UserRole role;
  final bool isActive;
  final DateTime? lastLoginAt;
  final DateTime? createdAt;

  /// المالك المؤسِّس (لا يُخفَّض دوره ولا يُحذَف).
  final bool isFoundingOwner;

  factory TeamMember.fromJson(Map<String, dynamic> json) {
    return TeamMember(
      id: P.str(json['id']),
      phone: P.str(json['phone']),
      fullName: P.str(json['fullName']),
      role: UserRole.fromValue(json['role'] as String?),
      isActive: json['isActive'] == true,
      lastLoginAt: P.date(json['lastLoginAt']),
      createdAt: P.date(json['createdAt']),
      isFoundingOwner: json['isFoundingOwner'] == true,
    );
  }
}

/// نتيجة دعوة عضو جديد — `POST /plant/team`.
/// تتضمّن كلمة مرور مؤقّتة لمرّة واحدة (تُعرَض ثم لا تُسترجَع).
class TeamInviteResult {
  const TeamInviteResult({
    required this.id,
    required this.phone,
    required this.fullName,
    required this.role,
    required this.isActive,
    this.createdAt,
    required this.tempPassword,
  });

  final String id;
  final String phone;
  final String fullName;
  final UserRole role;
  final bool isActive;
  final DateTime? createdAt;

  /// كلمة المرور المؤقّتة (تُعرَض مرّة واحدة فقط).
  final String tempPassword;

  factory TeamInviteResult.fromJson(Map<String, dynamic> json) {
    return TeamInviteResult(
      id: P.str(json['id']),
      phone: P.str(json['phone']),
      fullName: P.str(json['fullName']),
      role: UserRole.fromValue(json['role'] as String?),
      isActive: json['isActive'] == true,
      createdAt: P.date(json['createdAt']),
      tempPassword: P.str(json['tempPassword']),
    );
  }
}
