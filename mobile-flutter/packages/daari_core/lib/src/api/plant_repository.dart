import 'package:dio/dio.dart';

import '../models/activity_event.dart';
import '../models/audit_log.dart';
import '../models/driver_performance.dart';
import '../models/paged_result.dart';
import '../models/plant_kpis.dart';
import '../models/plant_usage.dart';
import '../models/water_stock.dart';
import 'api_exception.dart';

/// نقاط نهاية الإدارة الأساسية تحت `/plant/*` — تستعملها لوحة الإدارة بـ Flutter:
/// المؤشّرات، المخزون، الاستهلاك، سجلّ التدقيق، أداء السائقين، وخطّ النشاط.
/// كل طريقة ترمي [ApiException] عند الفشل. كل النقاط معزولة بـ tenant على الخادم.
class PlantRepository {
  PlantRepository(this._dio);

  final Dio _dio;

  /// مؤشّرات الشاشة الرئيسية (جولة واحدة).
  Future<PlantKpis> kpis() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/plant/kpis');
      return PlantKpis.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// مخزون المياه الحالي (يُنشأ افتراضياً عند أوّل قراءة).
  Future<WaterStock> getStock() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/plant/stock');
      return WaterStock.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// تحديث المخزون: تجاوز يدوي لـ [currentLiters] أو إضافة [topUpLiters]،
  /// مع تحديث السعة وحدّ التنبيه إن مُرِّرا. يُرجِع الصفّ بعد التحديث.
  Future<WaterStock> updateStock({
    int? currentLiters,
    int? capacityLiters,
    int? lowThresholdLiters,
    int? topUpLiters,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (currentLiters != null) body['currentLiters'] = currentLiters;
      if (capacityLiters != null) body['capacityLiters'] = capacityLiters;
      if (lowThresholdLiters != null) {
        body['lowThresholdLiters'] = lowThresholdLiters;
      }
      if (topUpLiters != null) body['topUpLiters'] = topUpLiters;
      final res =
          await _dio.post<Map<String, dynamic>>('/plant/stock', data: body);
      return WaterStock.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// استهلاك الاشتراك والباقة الحالية.
  Future<PlantUsage> usage() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/plant/usage');
      return PlantUsage.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// أداء السائقين خلال نافذة (افتراضي ٣٠ يوماً، أقصى ٩٠).
  Future<List<DriverPerformance>> driverPerformance({int days = 30}) async {
    try {
      final res = await _dio.get<List<dynamic>>(
        '/plant/driver-performance',
        queryParameters: {'days': days},
      );
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DriverPerformance.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// خطّ النشاط الموحّد (آخر ٧ أيام، افتراضي ٨ عناصر، أقصى ٥٠).
  Future<List<ActivityEvent>> activityFeed({int limit = 8}) async {
    try {
      final res = await _dio.get<List<dynamic>>(
        '/plant/activity-feed',
        queryParameters: {'limit': limit},
      );
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ActivityEvent.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// سجلّ التدقيق — مغلّف مرقّم (يُفعَّل بإرسال [page]). تصفية بـ [actor]/[action].
  Future<PagedResult<AuditLogEntry>> auditLogPaged({
    int page = 1,
    int pageSize = 20,
    String? actor,
    String? action,
  }) async {
    try {
      final query = <String, dynamic>{'page': page, 'pageSize': pageSize};
      if (actor != null && actor.isNotEmpty) query['actor'] = actor;
      if (action != null && action.isNotEmpty) query['action'] = action;
      final res = await _dio.get<Map<String, dynamic>>(
        '/plant/audit-log',
        queryParameters: query,
      );
      return PagedResult.fromJson(res.data ?? const {}, AuditLogEntry.fromJson);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
