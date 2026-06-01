import 'package:dio/dio.dart';

import '../models/driver_task.dart';
import '../models/order_inputs.dart';
import '../models/order_rating.dart';
import '../models/refill_order.dart';
import 'api_exception.dart';

/// نقاط نهاية الطلبات — يستعملها تطبيق الزبون (طلب/تتبّع/تقييم) وتطبيق السائق
/// (بركة العروض/claim/البدء/الإكمال). كل طريقة ترمي [ApiException] عند الفشل.
class OrdersRepository {
  OrdersRepository(this._dio);

  final Dio _dio;

  // ── الزبون ──────────────────────────────────────────────────────────────

  /// طلبات الزبون الحالي.
  Future<List<RefillOrder>> listMine() async {
    try {
      final res = await _dio.get<List<dynamic>>('/orders/me');
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(RefillOrder.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// تفاصيل طلب واحد (مع التقييم إن وُجد).
  Future<RefillOrder> getOne(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/orders/$id');
      return RefillOrder.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// إنشاء طلب تعبئة. addressId اختياري (الباك إند يرجع للعنوان الافتراضي).
  Future<RefillOrder> createRefill({
    required String customerId,
    String? addressId,
  }) async {
    try {
      final body = <String, dynamic>{'customerId': customerId};
      if (addressId != null) body['addressId'] = addressId;
      final res = await _dio.post<Map<String, dynamic>>('/orders', data: body);
      return RefillOrder.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// إلغاء الطلب من الزبون (سبب افتراضي عربي للسجلّ).
  Future<void> cancel(String id, {String reason = 'إلغاء من الزبون'}) async {
    try {
      await _dio.post<void>('/orders/$id/cancel', data: {'reason': reason});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// تأكيد الزبون استلام التعبئة.
  Future<void> confirm(String id) async {
    try {
      await _dio.post<void>('/orders/$id/confirm');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// فتح نزاع/شكوى على طلب.
  Future<void> dispute(String id, String reason) async {
    try {
      await _dio.post<void>('/orders/$id/dispute', data: {'reason': reason});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// تقييم نجمي بعد التوصيل.
  Future<OrderRating> rate(String id, {required int stars, String? comment}) async {
    try {
      final body = <String, dynamic>{'stars': stars};
      if (comment != null && comment.isNotEmpty) body['comment'] = comment;
      final res = await _dio.post<Map<String, dynamic>>('/orders/$id/rate', data: body);
      return OrderRating.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // ── السائق ──────────────────────────────────────────────────────────────

  /// مهام السائق اليوم (ASSIGNED / EN_ROUTE).
  Future<List<DriverTask>> todayTasks() => _tasks('/orders/me/today');

  /// بركة الطلبات المتاحة للقبول (PENDING غير مُسنَدة).
  Future<List<DriverTask>> availableOrders() => _tasks('/orders/me/available');

  Future<List<DriverTask>> _tasks(String path) async {
    try {
      final res = await _dio.get<List<dynamic>>(path);
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DriverTask.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// تاريخ طلبات السائق المكتملة.
  Future<List<RefillOrder>> history({int limit = 100}) async {
    try {
      final res = await _dio.get<List<dynamic>>(
        '/orders/me/history',
        queryParameters: {'limit': limit},
      );
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(RefillOrder.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// قبول طلب من البركة (أول من يضغط يفوز). 409 = سبقه سائق آخر.
  Future<void> claim(String id) async {
    try {
      await _dio.post<void>('/orders/$id/claim');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// بدء الجولة: ASSIGNED → EN_ROUTE.
  Future<void> start(String id) async {
    try {
      await _dio.post<void>('/orders/$id/start');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// إكمال الطلب مع تحصيل النقد وإحداثيات الإكمال.
  Future<void> complete(String id, CompleteOrderInput input) async {
    try {
      await _dio.post<void>('/orders/$id/complete', data: input.toJson());
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// استرجاع خزان (نفس مسار الإكمال مع سبب الاسترجاع).
  Future<void> reclaim(String id, ReclaimInput input) async {
    try {
      await _dio.post<void>('/orders/$id/complete', data: input.toJson());
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// بيع فوري (walk-in) خارج دورة الطلب.
  Future<void> walkinRefill(WalkinRefillInput input) async {
    try {
      await _dio.post<void>('/orders/walkin-refill', data: input.toJson());
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
