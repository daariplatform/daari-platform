import 'package:dio/dio.dart';

import '../models/promo_campaign.dart';
import '../models/promo_notification.dart';
import 'api_exception.dart';

/// نقاط نهاية العروض للإدارة — تضمّ مفهومين منفصلين:
/// • **البثّ الترويجي** (`/plant/promo-blast*` · `/plant/promo-history`): إشعار/واتساب
///   لمرّة واحدة → [PromoNotification].
/// • **حملات التخفيض** (`/plant/promos*`): خصم سعري مموّل من المحفظة → [PromoCampaign].
/// كل طريقة ترمي [ApiException] عند الفشل.
class PromoRepository {
  PromoRepository(this._dio);

  final Dio _dio;

  // ── البثّ الترويجي (PromoNotification) ───────────────────────────────────

  /// إرسال بثّ ترويجي. PUSH يرجع فوراً (SENT)؛ WHATSAPP يُجدوَل (QUEUED).
  Future<PromoNotification> sendBlast({
    required String title,
    required String body,
    required PromoChannel channel,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/plant/promo-blast',
        data: {'title': title, 'body': body, 'channel': channel.value},
      );
      return PromoNotification.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// سجلّ عمليات البثّ السابقة (الأحدث أوّلاً). افتراضي ٥٠، أقصى ٢٠٠.
  Future<List<PromoNotification>> blastHistory({int limit = 50}) async {
    try {
      final res = await _dio.get<List<dynamic>>(
        '/plant/promo-history',
        queryParameters: {'limit': limit},
      );
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(PromoNotification.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// متابعة تقدّم بثّ قيد التنفيذ (sentCount/failedCount حيّ). 404 إن لم يوجد.
  Future<PromoNotification> blastStatus(String id) async {
    try {
      final res =
          await _dio.get<Map<String, dynamic>>('/plant/promo-blast/$id/status');
      return PromoNotification.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // ── حملات التخفيض (PromoCampaign) ─────────────────────────────────────────

  /// كل الحملات (السابقة + النشطة) مع رصيد المحفظة الحالي.
  Future<PromoCampaignList> listCampaigns() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/plant/promos');
      return PromoCampaignList.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// إنشاء حملة جديدة وبثّها فوراً (أقصى ٤٨ ساعة، يتطلّب رصيداً ≥ ١٠٠٠ د.ع).
  Future<PromoCampaign> createCampaign({
    required int promoPriceIqd,
    required int durationHours,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/plant/promos',
        data: {'promoPriceIqd': promoPriceIqd, 'durationHours': durationHours},
      );
      return PromoCampaign.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// إيقاف مبكّر من المالك (PAUSED_BY_OWNER). لا استرداد للرصيد.
  Future<PromoCampaign> pauseCampaign(String id) async {
    try {
      final res =
          await _dio.post<Map<String, dynamic>>('/plant/promos/$id/pause');
      return PromoCampaign.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
