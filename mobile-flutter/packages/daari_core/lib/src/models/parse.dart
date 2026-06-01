/// أدوات تحويل JSON آمنة ضدّ القيم الناقصة أو المختلفة الأنواع.
/// الباك إند صارم لكن أفضل أن يكون العميل متسامحاً في القراءة.
class P {
  P._();

  static DateTime? date(Object? v) {
    if (v == null) return null;
    if (v is DateTime) return v;
    return DateTime.tryParse(v.toString());
  }

  static int intv(Object? v, [int fallback = 0]) {
    if (v is num) return v.toInt();
    return int.tryParse('${v ?? ''}') ?? fallback;
  }

  static double dbl(Object? v, [double fallback = 0]) {
    if (v is num) return v.toDouble();
    return double.tryParse('${v ?? ''}') ?? fallback;
  }

  static String str(Object? v, [String fallback = '']) =>
      v?.toString() ?? fallback;

  static Map<String, dynamic>? obj(Object? v) =>
      v is Map<String, dynamic> ? v : null;

  /// يحوّل مصفوفة JSON إلى قائمة كائنات (يتجاهل العناصر غير الصالحة).
  static List<T> list<T>(
    Object? v,
    T Function(Map<String, dynamic>) fromJson,
  ) {
    if (v is! List) return <T>[];
    final out = <T>[];
    for (final e in v) {
      if (e is Map<String, dynamic>) out.add(fromJson(e));
    }
    return out;
  }
}
