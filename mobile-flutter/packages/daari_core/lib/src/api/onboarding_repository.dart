import 'package:dio/dio.dart';

import '../models/onboarding_status.dart';
import '../models/parse.dart';
import 'api_exception.dart';

/// نقاط نهاية تهيئة المعمل `/plant/onboarding/*` — حالة قائمة التهيئة وتخطّيها.
/// كل طريقة ترمي [ApiException] عند الفشل.
class OnboardingRepository {
  OnboardingRepository(this._dio);

  final Dio _dio;

  /// حالة خطوات التهيئة (مُشتقّة من بيانات المعمل/الزبائن/السائقين).
  Future<OnboardingStatus> status() async {
    try {
      final res =
          await _dio.get<Map<String, dynamic>>('/plant/onboarding/status');
      return OnboardingStatus.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// تخطّي التهيئة (idempotent). يرجع وقت التخطّي.
  Future<DateTime?> skip() async {
    try {
      final res =
          await _dio.post<Map<String, dynamic>>('/plant/onboarding/skip');
      return P.date((res.data ?? const {})['onboardingSkippedAt']);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
