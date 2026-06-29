import 'package:dio/dio.dart';

import '../models/team_member.dart';
import 'api_exception.dart';

/// نقاط نهاية إدارة الفريق `/plant/team/*` — عرض/دعوة/تعديل/حذف أعضاء المعمل.
/// القراءة: OWNER/MANAGER؛ الكتابة: OWNER فقط (يُفرَض على الخادم).
/// كل طريقة ترمي [ApiException] عند الفشل.
class TeamRepository {
  TeamRepository(this._dio);

  final Dio _dio;

  /// كل أعضاء الفريق (OWNER/MANAGER/ACCOUNTANT) مع علامة المالك المؤسِّس.
  Future<List<TeamMember>> list() async {
    try {
      final res = await _dio.get<List<dynamic>>('/plant/team');
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(TeamMember.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// دعوة عضو جديد (MANAGER أو ACCOUNTANT). يرجع العضو + كلمة مرور مؤقّتة لمرّة واحدة.
  /// [phone] بصيغة `07XXXXXXXXX`.
  Future<TeamInviteResult> invite({
    required String phone,
    required String fullName,
    required UserRole role,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/plant/team',
        data: {'phone': phone, 'fullName': fullName, 'role': role.value},
      );
      return TeamInviteResult.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// تعديل دور عضو أو حالته. يمنع الخادم خفض/تعطيل المالك المؤسِّس.
  Future<TeamMember> update(
    String userId, {
    UserRole? role,
    bool? isActive,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (role != null) body['role'] = role.value;
      if (isActive != null) body['isActive'] = isActive;
      final res = await _dio.patch<Map<String, dynamic>>(
        '/plant/team/$userId',
        data: body,
      );
      return TeamMember.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// حذف ناعم (تعطيل) لعضو وإبطال رموز تحديثه. يمنع الخادم حذف المالك أو حذف الذات.
  Future<void> remove(String userId) async {
    try {
      await _dio.delete<void>('/plant/team/$userId');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
