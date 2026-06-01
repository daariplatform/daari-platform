import 'package:dio/dio.dart';

import '../models/app_notification.dart';
import 'api_exception.dart';

/// نقاط نهاية الإشعارات: القائمة + تعليم مقروء + تسجيل توكن الدفع.
class NotificationsRepository {
  NotificationsRepository(this._dio);

  final Dio _dio;

  Future<NotificationsPage> mine() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/notifications/me');
      return NotificationsPage.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _dio.post<void>('/notifications/me/$id/mark-read');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> markAllRead() async {
    try {
      await _dio.post<void>('/notifications/me/mark-all-read');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// تسجيل توكن FCM في الخادم (platform: ios | android).
  Future<void> registerPushToken({
    required String token,
    required String platform,
  }) async {
    try {
      await _dio.post<void>(
        '/notifications/push-token',
        data: {'token': token, 'platform': platform},
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
