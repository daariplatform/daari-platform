import 'enums.dart';
import 'parse.dart';

/// ردّ تسجيل الدخول / التجديد — مطابق لـ `AuthResponse` في types.ts.
/// `POST /auth/login` و `POST /auth/refresh` يرجعان هذا الشكل.
class AuthResponse {
  const AuthResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    required this.capabilities,
  });

  final String accessToken;
  final String refreshToken;

  /// عمر توكن الوصول بالثواني (900 = 15 دقيقة).
  final int expiresIn;
  final List<Capability> capabilities;

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      accessToken: P.str(json['accessToken']),
      refreshToken: P.str(json['refreshToken']),
      expiresIn: P.intv(json['expiresIn']),
      capabilities: capabilitiesFromJson(json['capabilities']),
    );
  }
}
