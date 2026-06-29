import 'package:dio/dio.dart';

import '../models/plant_reports.dart';
import 'api_exception.dart';

/// نقاط نهاية التقارير `/plant/reports/*` — الإيراد، المتصدّرون، التحليلات،
/// ساعات الذروة، الأفواج، الخريطة الحرارية، استغلال الخزّانات، والتصدير.
/// كل النقاط تتطلّب دور OWNER/MANAGER/ACCOUNTANT (يُفرَض على الخادم).
/// كل طريقة ترمي [ApiException] عند الفشل.
class ReportsRepository {
  ReportsRepository(this._dio);

  final Dio _dio;

  /// يبني خريطة استعلام التاريخ (from/to بصيغة ISO) متجاهلاً الفارغ.
  Map<String, dynamic> _window({String? from, String? to, int? limit}) {
    final q = <String, dynamic>{};
    if (from != null && from.isNotEmpty) q['from'] = from;
    if (to != null && to.isNotEmpty) q['to'] = to;
    if (limit != null) q['limit'] = limit;
    return q;
  }

  Future<List<T>> _getList<T>(
    String path,
    T Function(Map<String, dynamic>) fromJson, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final res = await _dio.get<List<dynamic>>(path, queryParameters: query);
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// إيراد يومي + عدد طلبات (افتراضي آخر ٧ أيام، فجوات مملوءة بصفر).
  Future<List<RevenueDay>> revenue7d({String? from, String? to}) => _getList(
        '/plant/reports/revenue-7d',
        RevenueDay.fromJson,
        query: _window(from: from, to: to),
      );

  /// الزبائن الأعلى إنفاقاً (افتراضي الشهر الحالي، limit ٥، أقصى ٥٠).
  Future<List<TopCustomer>> topCustomers({
    int limit = 5,
    String? from,
    String? to,
  }) =>
      _getList(
        '/plant/reports/top-customers',
        TopCustomer.fromJson,
        query: _window(from: from, to: to, limit: limit),
      );

  /// السائقون الأعلى أداءً (افتراضي الشهر الحالي، limit ٥، أقصى ٥٠).
  Future<List<TopDriver>> topDrivers({
    int limit = 5,
    String? from,
    String? to,
  }) =>
      _getList(
        '/plant/reports/top-drivers',
        TopDriver.fromJson,
        query: _window(from: from, to: to, limit: limit),
      );

  /// توزيع الطلبات حسب ساعة اليوم (٢٤ خانة، افتراضي آخر ٣٠ يوماً).
  Future<List<PeakHour>> peakHours({String? from, String? to}) => _getList(
        '/plant/reports/peak-hours',
        PeakHour.fromJson,
        query: _window(from: from, to: to),
      );

  /// لقطة سريعة للشاشة الرئيسية (أفضل سائق/زبون، ساعة الذروة، النموّ).
  Future<PlantInsights> insights() async {
    try {
      final res =
          await _dio.get<Map<String, dynamic>>('/plant/reports/insights');
      return PlantInsights.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// احتفاظ الأفواج حسب شهر التسجيل (آخر ١٢ شهراً أو النافذة المعطاة).
  Future<CohortReport> cohort({String? from, String? to}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/plant/reports/cohort',
        queryParameters: _window(from: from, to: to),
      );
      return CohortReport.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// الخريطة الحرارية لتوصيل السائقين حسب المناطق (افتراضي ٣٠ يوماً).
  Future<DriverHeatmap> driverHeatmap({String? from, String? to}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/plant/reports/driver-heatmap',
        queryParameters: _window(from: from, to: to),
      );
      return DriverHeatmap.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// استغلال الخزّانات (نشط/خفيف/خامل) + ملخّص العدّ.
  Future<TankUtilization> tankUtilization() async {
    try {
      final res = await _dio
          .get<Map<String, dynamic>>('/plant/reports/tank-utilization');
      return TankUtilization.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// توليد ملف قابل للتنزيل. [type] = `pdf`|`xlsx`؛
  /// [report] = `revenue`|`top-customers`|`top-drivers`|`cohort`. يرجع رابطاً صالحاً ٢٤ ساعة.
  Future<ReportExport> exportReport({
    required String type,
    required String report,
    String? from,
    String? to,
  }) async {
    try {
      final body = <String, dynamic>{'type': type, 'report': report};
      if (from != null && from.isNotEmpty) body['from'] = from;
      if (to != null && to.isNotEmpty) body['to'] = to;
      final res = await _dio.post<Map<String, dynamic>>(
        '/plant/reports/export',
        data: body,
      );
      return ReportExport.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
