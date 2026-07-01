import 'package:dio/dio.dart';

import 'response_cache.dart';

/// اعتراض يمنح التطبيق «إقلاعاً بارداً» مرناً: يخزّن استجابات GET الناجحة، وعند
/// فشل الشبكة (لا اتصال / مهلة) يردّ آخر نسخة مخزّنة ضمن مدّة [ttl] بدل رمي خطأ.
///
/// الاستراتيجية «الشبكة أولاً ثم الكاش» (network-first, cache-fallback): تبقى
/// البيانات طازجة عند توفّر الشبكة، وتظهر آخر بيانات معروفة عند انقطاعها — تماماً
/// كما كان `persist.ts` يفعل لكاش React-Query في Expo.
///
/// يُركَّب **بعد** `AuthInterceptor` كي يجدّد الأخير التوكن على 401 أوّلاً؛ ولا
/// نتدخّل إلا حين يكون العطل شبكياً صرفاً (لا استجابة من الخادم).
class CacheInterceptor extends Interceptor {
  CacheInterceptor({required ResponseCache cache, required this.ttl})
      : _cache = cache;

  final ResponseCache _cache;
  final Duration ttl;

  /// مفتاح فريد للطلب: الفعل + المسار + معاملات الاستعلام مرتّبة (كي لا يتأثّر
  /// المفتاح بترتيب المعاملات).
  static String keyFor(RequestOptions o) {
    final params = o.queryParameters.entries
        .map((e) => '${e.key}=${e.value}')
        .toList()
      ..sort();
    final query = params.isEmpty ? '' : '?${params.join('&')}';
    return '${o.method.toUpperCase()} ${o.path}$query';
  }

  bool _isGet(RequestOptions o) => o.method.toUpperCase() == 'GET';

  /// طلبات البحث الحرّ (مثل `GET /customers?search=...`) تولّد مفتاحاً لكلّ كلمة،
  /// فتتراكم بلا حدّ ولا قيمة لها في الإقلاع البارد — لا نخزّنها.
  bool _isCacheable(RequestOptions o) =>
      _isGet(o) &&
      !o.queryParameters.containsKey('search') &&
      !o.queryParameters.containsKey('q');

  /// نتدخّل فقط على أعطال الشبكة الصرفة (دون استجابة من الخادم).
  /// لا نُخفي خطأ 4xx/5xx حقيقياً خلف بيانات قديمة.
  bool _isNetworkError(DioException err) {
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.connectionError:
        return true;
      case DioExceptionType.unknown:
        return err.response == null;
      default:
        return false;
    }
  }

  @override
  void onResponse(
      Response<dynamic> response, ResponseInterceptorHandler handler,) {
    final code = response.statusCode ?? 0;
    if (_isCacheable(response.requestOptions) && code >= 200 && code < 300) {
      // حفظ دون انتظار — لا نؤخّر تسليم الاستجابة للواجهة.
      _cache.write(keyFor(response.requestOptions), response.data);
    }
    handler.next(response);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final options = err.requestOptions;
    if (_isCacheable(options) && _isNetworkError(err)) {
      final cached = await _cache.read(keyFor(options), ttl);
      if (cached != null) {
        handler.resolve(
          Response<dynamic>(
            requestOptions: options,
            statusCode: 200,
            statusMessage: 'OK (cache)',
            data: cached,
            extra: const {'fromCache': true},
          ),
        );
        return;
      }
    }
    handler.next(err);
  }
}
