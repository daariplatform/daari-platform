import 'package:dio/dio.dart';

import '../auth/token_storage.dart';

/// interceptor المصادقة — ينقل سلوك `lib/api.ts` حرفياً:
///
/// 1. يُلحِق `Authorization: Bearer <access>` بكل طلب.
/// 2. عند 401 يجدّد التوكن **مرّة واحدة فقط** مهما تزامن من طلبات (single-flight)،
///    لأن refresh token في الباك إند يُستعمل مرّة واحدة (rotating). تجديدان
///    متزامنان = أحدهما يُبطِل الآخر = خروج المستخدم. هذه أهمّ نقطة دقيقة.
/// 3. يعيد الطلب الأصلي بالتوكن الجديد، ومرّة واحدة فقط (علم `__retried`).
/// 4. إن فشل التجديد ينادي [onAuthFailure] (تسجيل خروج).
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required Dio dio,
    required TokenStorage tokens,
    this.onAuthFailure,
  })  : _dio = dio,
        _tokens = tokens;

  final Dio _dio;
  final TokenStorage _tokens;
  final Future<void> Function()? onAuthFailure;

  /// التجديد الجاري حالياً (null = لا تجديد). يدمج 401 المتزامنة.
  Future<String?>? _refreshing;

  static bool _isAuthPath(String path) =>
      path.contains('/auth/login') ||
      path.contains('/auth/refresh') ||
      path.contains('/auth/logout');

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.headers['Authorization'] == null &&
        !_isAuthPath(options.path)) {
      final token = await _tokens.getAccessToken();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final req = err.requestOptions;
    final alreadyRetried = req.extra['__retried'] == true;
    final shouldRefresh = err.response?.statusCode == 401 &&
        !_isAuthPath(req.path) &&
        !alreadyRetried;

    if (!shouldRefresh) {
      return handler.next(err);
    }

    String? newToken;
    try {
      newToken = await _refreshSingleFlight();
    } catch (_) {
      // التجديد نفسه فشل → فشل مصادقة حقيقي.
      await onAuthFailure?.call();
      return handler.next(err);
    }
    if (newToken == null) {
      await onAuthFailure?.call();
      return handler.next(err);
    }

    req.extra['__retried'] = true;
    req.headers['Authorization'] = 'Bearer $newToken';
    try {
      final clone = await _dio.fetch<dynamic>(req);
      return handler.resolve(clone);
    } catch (_) {
      // نجح التجديد لكن فشلت إعادة الطلب (مهلة/5xx/انقطاع اتصال على شبكة
      // متذبذبة). هذا ليس فشل مصادقة — لا تُسجِّل الخروج، فقط مرّر الخطأ الأصلي.
      return handler.next(err);
    }
  }

  /// يضمن تجديداً واحداً فقط. الطلبات المتزامنة تنتظر نفس الـ Future.
  Future<String?> _refreshSingleFlight() {
    final inflight = _refreshing;
    if (inflight != null) return inflight;
    final future = _performRefresh();
    _refreshing = future;
    future.whenComplete(() => _refreshing = null);
    return future;
  }

  Future<String?> _performRefresh() async {
    final refreshToken = await _tokens.getRefreshToken();
    if (refreshToken == null) return null;

    // Dio نظيف بلا interceptors — وإلا 401 التجديد يستدعي نفسه بلا نهاية.
    final bare = Dio(
      BaseOptions(
        baseUrl: _dio.options.baseUrl,
        connectTimeout: _dio.options.connectTimeout,
        receiveTimeout: _dio.options.receiveTimeout,
        headers: {'Content-Type': 'application/json'},
      ),
    );
    try {
      final res = await bare.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final data = res.data ?? const <String, dynamic>{};
      final access = data['accessToken'] as String?;
      final newRefresh = data['refreshToken'] as String?;
      if (access == null) return null;
      await _tokens.setTokens(
        access: access,
        refresh: newRefresh ?? refreshToken,
      );
      return access;
    } on DioException {
      return null;
    } finally {
      bare.close();
    }
  }
}
