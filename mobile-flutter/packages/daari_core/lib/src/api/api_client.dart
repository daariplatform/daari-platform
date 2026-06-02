import 'package:dio/dio.dart';

import '../auth/token_storage.dart';
import '../config/env.dart';
import 'auth_interceptor.dart';
import 'demo_interceptor.dart';

/// ينشئ ويهيّئ Dio: baseUrl + المهلة + interceptor المصادقة (single-flight refresh).
/// مكافئ `lib/api.ts` (إنشاء axios + الـ interceptors).
class ApiClient {
  ApiClient({
    required TokenStorage tokens,
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
  }

  late final Dio dio;
}
