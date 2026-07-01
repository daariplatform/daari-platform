import 'package:dio/dio.dart';

import '../models/cash.dart';
import '../models/driver_profile.dart';
import '../models/earnings.dart';
import '../models/live_driver.dart';
import 'api_exception.dart';

/// نقاط نهاية السائق: الملفّ، الأداء، النقد، الأرباح، الوردية، جرد الفان،
/// الموقع الحيّ، وتغيير الحالة. ويضمّ نقطة الإدارة للتتبّع الحيّ للأسطول.
class DriverRepository {
  DriverRepository(this._dio);

  final Dio _dio;

  /// كل سائقي المعمل مع آخر موقع (للوحة الإدارة) — `GET /drivers/live`.
  /// تتطلّب دور OWNER/MANAGER/ACCOUNTANT (يُفرَض على الخادم).
  Future<List<LiveDriver>> liveDrivers() async {
    try {
      final res = await _dio.get<List<dynamic>>('/drivers/live');
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(LiveDriver.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<DriverProfile> me() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/drivers/me');
      return DriverProfile.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<DriverPerf> perf({String period = 'month'}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/drivers/me/perf',
        queryParameters: {'period': period},
      );
      return DriverPerf.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<CashSummary> cashSummary() async {
    try {
      final res =
          await _dio.get<Map<String, dynamic>>('/drivers/me/cash-summary');
      return CashSummary.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<CashHandover>> cashHandovers() async {
    try {
      final res = await _dio.get<List<dynamic>>('/drivers/me/cash-handovers');
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(CashHandover.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> handoverCash({
    required int amountIqd,
    String? note,
    String? clientRequestId,
  }) async {
    try {
      final body = <String, dynamic>{'amountIqd': amountIqd};
      if (note != null && note.isNotEmpty) body['note'] = note;
      // مفتاح إزالة التكرار على الخادم — يمنع تسجيل التسليم مرّتين عند إعادة المحاولة.
      if (clientRequestId != null) body['clientRequestId'] = clientRequestId;
      await _dio.post<void>('/drivers/me/cash-handover', data: body);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<EarningsDay>> earnings({String period = 'week'}) async {
    try {
      final res = await _dio.get<List<dynamic>>(
        '/drivers/me/earnings',
        queryParameters: {'period': period},
      );
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(EarningsDay.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<ShiftSummary> shiftSummary() async {
    try {
      final res =
          await _dio.get<Map<String, dynamic>>('/drivers/me/shift-summary');
      return ShiftSummary.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> updateVanInventory({
    required int tanksFullOnVan,
    required int tanksEmptyOnVan,
  }) async {
    try {
      await _dio.post<void>(
        '/drivers/me/van-inventory',
        data: {
          'tanksFullOnVan': tanksFullOnVan,
          'tanksEmptyOnVan': tanksEmptyOnVan,
        },
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// بثّ الموقع الحيّ (كل ~30 ثانية أثناء الوردية).
  Future<void> pushLocation({required double lng, required double lat}) async {
    try {
      await _dio
          .post<void>('/drivers/me/location', data: {'lng': lng, 'lat': lat});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// تغيير حالة السائق (AVAILABLE عند بدء الوردية، OFFLINE عند إنهائها).
  Future<void> setStatus(DriverStatus status) async {
    try {
      await _dio
          .post<void>('/drivers/me/status', data: {'status': status.value});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
