import 'package:dio/dio.dart';

/// خطأ API موحّد — يستخرج رسالة الباك إند العربية (NestJS يرجع
/// `{ statusCode, message, error }` حيث message قد تكون نصّاً أو مصفوفة).
class ApiException implements Exception {
  ApiException({required this.statusCode, required this.message, this.raw});

  /// null = خطأ شبكة (لا استجابة).
  final int? statusCode;
  final String message;
  final Object? raw;

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isConflict => statusCode == 409; // سباق claim: طلب أخذه سائق آخر
  bool get isRateLimited => statusCode == 429;
  bool get isNetwork => statusCode == null;

  factory ApiException.fromDio(DioException e) {
    final res = e.response;
    final status = res?.statusCode;
    final extracted = _extractMessage(res?.data);
    final message = extracted ??
        (status != null ? _statusMessage(status) : _networkMessage(e));
    return ApiException(statusCode: status, message: message, raw: e);
  }

  static String? _extractMessage(Object? data) {
    if (data is Map) {
      final m = data['message'];
      if (m is String && m.isNotEmpty) return m;
      if (m is List && m.isNotEmpty) return m.first.toString();
      final err = data['error'];
      if (err is String && err.isNotEmpty) return err;
    }
    return null;
  }

  static String _statusMessage(int status) {
    switch (status) {
      case 400:
        return 'بيانات غير صحيحة.';
      case 401:
        return 'انتهت الجلسة. سجّل الدخول من جديد.';
      case 403:
        return 'ليست لديك صلاحية لهذا الإجراء.';
      case 404:
        return 'العنصر غير موجود.';
      case 409:
        return 'تعذّر إتمام العملية (تعارض).';
      case 429:
        return 'محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.';
      default:
        return status >= 500
            ? 'خطأ في الخادم. حاول لاحقاً.'
            : 'فشل الطلب. حاول مجدداً.';
    }
  }

  static String _networkMessage(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'انتهت مهلة الاتصال. تحقّق من الإنترنت.';
      case DioExceptionType.connectionError:
        return 'تعذّر الاتصال بالخادم. تحقّق من الإنترنت.';
      default:
        return 'حدث خطأ غير متوقّع. حاول مجدداً.';
    }
  }

  @override
  String toString() => 'ApiException($statusCode): $message';
}
