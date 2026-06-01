import 'package:dio/dio.dart';

import '../models/nearest_plant.dart';
import 'api_exception.dart';

/// نقاط نهاية المعامل: أقرب معمل + اكتشاف المعامل + إنشاء lead عند التسجيل.
class TenantsRepository {
  TenantsRepository(this._dio);

  final Dio _dio;

  /// أقرب معمل للإحداثيات (شاشة التسجيل/الرئيسية).
  Future<NearestPlant?> nearest({required double lng, required double lat}) async {
    try {
      final res = await _dio.get<dynamic>(
        '/tenants/nearest',
        queryParameters: {'lng': lng, 'lat': lat},
      );
      final data = res.data;
      if (data is Map<String, dynamic> && data.isNotEmpty) {
        return NearestPlant.fromJson(data);
      }
      return null;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// كل المعامل ضمن النطاق (شاشة اختيار المعمل في التسجيل).
  Future<List<NearestPlant>> discover({required double lng, required double lat}) async {
    try {
      final res = await _dio.get<List<dynamic>>(
        '/tenants/discover',
        queryParameters: {'lng': lng, 'lat': lat},
      );
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(NearestPlant.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// إنشاء طلب انضمام (lead) — ينتظر موافقة المعمل.
  Future<void> createLead({
    required String tenantId,
    required String fullName,
    required String phone,
    required String district,
    required String addressLine,
    required double locationLng,
    required double locationLat,
  }) async {
    try {
      await _dio.post<void>(
        '/customers/lead',
        data: {
          'tenantId': tenantId,
          'fullName': fullName,
          'phone': phone,
          'district': district,
          'addressLine': addressLine,
          'locationLng': locationLng,
          'locationLat': locationLat,
        },
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
