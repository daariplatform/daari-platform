import 'package:dio/dio.dart';

import '../models/active_promo.dart';
import '../models/customer_profile.dart';
import '../models/order_inputs.dart';
import '../models/refill_schedule.dart';
import '../models/saved_address.dart';
import 'api_exception.dart';

/// نقاط نهاية الزبون: الملفّ، الحملة النشطة، العناوين، الجدولة، البحث،
/// والنقل (move) وتسجيل زبون بواسطة السائق.
class CustomerRepository {
  CustomerRepository(this._dio);

  final Dio _dio;

  /// ملفّ الزبون الحالي (مع نقاط الولاء والرصيد).
  Future<CustomerProfile> me() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/customers/me');
      return CustomerProfile.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// حملة التخفيض النشطة لمعمل الزبون (null = لا حملة).
  Future<ActivePromo?> activePromo() async {
    try {
      final res = await _dio.get<dynamic>('/customers/me/active-promo');
      final data = res.data;
      if (data is Map<String, dynamic> && data.isNotEmpty) {
        return ActivePromo.fromJson(data);
      }
      return null;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // ── العناوين المحفوظة ─────────────────────────────────────────────────────

  Future<List<SavedAddress>> addresses() async {
    try {
      final res = await _dio.get<List<dynamic>>('/customers/me/addresses');
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(SavedAddress.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<SavedAddress> createAddress(AddressInput input) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/customers/me/addresses',
        data: input.toJson(),
      );
      return SavedAddress.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<SavedAddress> updateAddress(String id, AddressInput input) async {
    try {
      final res = await _dio.patch<Map<String, dynamic>>(
        '/customers/me/addresses/$id',
        data: input.toJson(),
      );
      return SavedAddress.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> deleteAddress(String id) async {
    try {
      await _dio.delete<void>('/customers/me/addresses/$id');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> makeDefaultAddress(String id) async {
    try {
      await _dio.post<void>('/customers/me/addresses/$id/make-default');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // ── الجدولة التلقائية ─────────────────────────────────────────────────────

  Future<List<RefillSchedule>> schedules() async {
    try {
      final res = await _dio.get<List<dynamic>>('/customers/me/schedules');
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(RefillSchedule.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<RefillSchedule> createSchedule(ScheduleInput input) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/customers/me/schedules',
        data: input.toJson(),
      );
      return RefillSchedule.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// تعديل جدولة (تبديل التفعيل أو الحقول).
  Future<RefillSchedule> updateSchedule(
      String id, Map<String, dynamic> patch) async {
    try {
      final res = await _dio.patch<Map<String, dynamic>>(
        '/customers/me/schedules/$id',
        data: patch,
      );
      return RefillSchedule.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> deleteSchedule(String id) async {
    try {
      await _dio.delete<void>('/customers/me/schedules/$id');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // ── السائق: البحث + تسجيل زبون ────────────────────────────────────────────

  /// بحث الزبائن (للسائق — للبيع الفوري). يرجع صفوفاً خام (CustomerProfile).
  ///
  /// الباك إند يرجع غلافاً مُصفَّحاً `{ items: [...], total, page, ... }`؛ كان
  /// الكود يطلب `List` فيفشل القَسر وتعود القائمة فارغة دائماً. نقرأ `items`
  /// (وندعم المصفوفة العارية احتياطاً لو تغيّر الشكل مستقبلاً).
  Future<List<CustomerProfile>> search(String query) async {
    try {
      final res = await _dio.get<dynamic>(
        '/customers',
        queryParameters: {'search': query},
      );
      final data = res.data;
      final rows = data is Map<String, dynamic>
          ? (data['items'] as List<dynamic>? ?? const [])
          : (data is List ? data : const <dynamic>[]);
      return rows
          .whereType<Map<String, dynamic>>()
          .map(CustomerProfile.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// تسجيل زبون جديد بواسطة السائق في الميدان.
  Future<void> registerByDriver(RegisterCustomerInput input) async {
    try {
      await _dio.post<void>('/customers/register-by-driver',
          data: input.toJson());
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// «انتقلت لبيت جديد»: يحدّث إحداثيات منزل الزبون. الباك إند يقصر العملية على
  /// سجلّ الزبون نفسه (يمنع IDOR). يطابق `POST /customers/:id/move` في Expo.
  Future<void> move(String customerId,
      {required double lng, required double lat}) async {
    try {
      await _dio.post<void>(
        '/customers/$customerId/move',
        data: {'newLng': lng, 'newLat': lat},
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
