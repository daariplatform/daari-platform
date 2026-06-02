import 'package:dio/dio.dart';

import '../auth/token_storage.dart';
import '../config/env.dart';
import 'auth_interceptor.dart';
import 'cache_interceptor.dart';
import 'demo_interceptor.dart';
import 'response_cache.dart';

/// ينشئ ويهيّئ Dio: baseUrl + المهلة + interceptor المصادقة (single-flight refresh).
/// مكافئ `lib/api.ts` (إنشاء axios + الـ interceptors).
class ApiClient {
  ApiClient({
    required TokenStorage tokens,
    ResponseCache? cache,
    Future<void> Function()? onAuthFailure,
  }) {
    dio = Dio(
      BaseOptions(
        baseUrl: Env.apiBaseUrl,
        connectTimeout: Env.httpTimeout,
        receiveTimeout: Env.httpTimeout,
        headers: {'Content-Type': 'application/json'},
        // لا ترمِ تلقائياً قبل أن يعمل interceptor التجديد على 401
        validateStatus: (status) => status != null && status < 400,
      ),
    );
    // في وضع العرض نركّب اعتراض الـ fixtures أوّلاً فيقصر كل طلب قبل الشبكة.
    if (Env.demoMode) {
      dio.interceptors.add(DemoInterceptor());
    }
    dio.interceptors.add(
      AuthInterceptor(
        dio: dio,
        tokens: tokens,
        onAuthFailure: onAuthFailure,
      ),
    );
    // كاش الإقلاع البارد — بعد المصادقة كي تُجدَّد التوكنات أوّلاً.
    // في وضع العرض لا داعي له (DemoInterceptor يقصر كل شيء قبل الشبكة).
    if (cache != null && !Env.demoMode) {
      dio.interceptors.add(
        CacheInterceptor(cache: cache, ttl: Env.cacheTtl),
      );
    }
  }

  late final Dio dio;
}
