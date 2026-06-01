import 'package:dio/dio.dart';

import '../api/api_exception.dart';
import '../models/auth_response.dart';
import '../models/me_response.dart';
import 'token_storage.dart';

/// يغلّف نقاط نهاية المصادقة. كل طريقة ترمي [ApiException] عند الفشل.
class AuthRepository {
  AuthRepository({required this.dio, required this.tokens});

  final Dio dio;
  final TokenStorage tokens;

  /// تسجيل دخول بالهاتف + كلمة السر → يخزّن التوكنات ويرجع الهوية.
  Future<MeResponse> login({
    required String phone,
    required String password,
  }) async {
    try {
      final res = await dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'phone': phone, 'password': password},
      );
      final auth = AuthResponse.fromJson(res.data ?? const {});
      await tokens.setTokens(
        access: auth.accessToken,
        refresh: auth.refreshToken,
      );
      return me();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// تسجيل دخول/تسجيل ذاتي بـ OTP (خلف OTP_SELF_SIGNUP_ENABLED في الباك إند).
  Future<MeResponse> loginWithOtp({
    required String phone,
    required String otp,
    String? fullName,
  }) async {
    try {
      final body = <String, dynamic>{'phone': phone, 'otp': otp};
      if (fullName != null && fullName.isNotEmpty) body['fullName'] = fullName;
      final res = await dio.post<Map<String, dynamic>>('/auth/login/otp', data: body);
      final auth = AuthResponse.fromJson(res.data ?? const {});
      await tokens.setTokens(access: auth.accessToken, refresh: auth.refreshToken);
      return me();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// طلب رمز OTP للتسجيل الذاتي (الزبون الجديد).
  Future<void> requestSignupOtp(String phone) async {
    try {
      await dio.post<void>('/auth/signup/request-otp', data: {'phone': phone});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// التحقّق من رمز OTP للتسجيل (قبل إنشاء الـ lead).
  Future<void> verifySignupOtp({required String phone, required String otp}) async {
    try {
      await dio.post<void>('/auth/signup/verify-otp', data: {'phone': phone, 'otp': otp});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// استعادة كلمة السر — الخطوة 1: إرسال رمز عبر otpiq (واتساب أولاً).
  Future<void> forgotPassword(String phone) async {
    try {
      await dio.post<void>('/auth/forgot-password', data: {'phone': phone});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// استعادة كلمة السر — الخطوة 2: التحقّق من الرمز وتعيين كلمة سر جديدة.
  Future<void> resetPassword({
    required String phone,
    required String otp,
    required String newPassword,
  }) async {
    try {
      await dio.post<void>(
        '/auth/verify-otp',
        data: {'phone': phone, 'otp': otp, 'newPassword': newPassword},
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// هوية المستخدم الحالي.
  Future<MeResponse> me() async {
    try {
      final res = await dio.get<Map<String, dynamic>>('/auth/me');
      return MeResponse.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      await dio.post<void>(
        '/auth/change-password',
        data: {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
        },
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// حذف الحساب نهائياً (DELETE /auth/me) ثم مسح التوكنات محلياً.
  Future<void> deleteAccount() async {
    try {
      await dio.delete<void>('/auth/me');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    } finally {
      await tokens.clear();
    }
  }

  /// تسجيل خروج: يُبطِل refresh token في الخادم ثم يمسح محلياً.
  Future<void> logout() async {
    final refresh = await tokens.getRefreshToken();
    if (refresh != null) {
      try {
        await dio.post<void>('/auth/logout', data: {'refreshToken': refresh});
      } on DioException {
        // تجاهل أخطاء الشبكة — نمسح محلياً على أي حال
      }
    }
    await tokens.clear();
  }
}
