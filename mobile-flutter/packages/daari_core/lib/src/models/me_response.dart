import 'enums.dart';
import 'parse.dart';

/// هوية المستخدم الحالي — مطابق لـ `MeResponse` في types.ts.
/// يأتي من `GET /auth/me` بعد تسجيل الدخول وعند الإقلاع.
class MeResponse {
  const MeResponse({
    required this.id,
    required this.phone,
    required this.role,
    required this.tenantId,
    required this.capabilities,
    this.fullName,
  });

  final String id;
  final String phone;
  final String role;
  final String? tenantId;
  final List<Capability> capabilities;
  final String? fullName;

  bool hasCapability(Capability c) => capabilities.contains(c);
  bool get isCustomer => hasCapability(Capability.customer);
  bool get isDriver => hasCapability(Capability.driver);

  factory MeResponse.fromJson(Map<String, dynamic> json) {
    return MeResponse(
      id: P.str(json['id']),
      phone: P.str(json['phone']),
      role: P.str(json['role']),
      tenantId: json['tenantId'] as String?,
      capabilities: capabilitiesFromJson(json['capabilities']),
      fullName: json['fullName'] as String?,
    );
  }
}
