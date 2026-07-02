import 'package:intl/intl.dart';

/// أدوات التنسيق — منقولة حرفياً من `lib/format.ts` لضمان تطابق العرض.
///
/// ملاحظة: استدعِ `initializeDateFormatting('ar')` مرّة عند إقلاع التطبيق
/// (من حزمة intl) قبل استخدام [arabicDate].
class Fmt {
  Fmt._();

  // أرقام لاتينية (en_US) + لاحقة «د.ع» — مطابق لـ Intl.NumberFormat('en-US').
  static final NumberFormat _grouped = NumberFormat('#,##0', 'en_US');

  /// «1,500 د.ع»
  static String iqd(num amount) => '${_grouped.format(amount)} د.ع';

  /// نسخة مختصرة: «1.5م د.ع» / «12ك د.ع».
  static String iqdShort(num amount) {
    if (amount >= 1000000) {
      final v = (amount / 1000000)
          .toStringAsFixed(1)
          .replaceAll(RegExp(r'\.0$'), '');
      return '${v}م د.ع'; // ignore: unnecessary_brace_in_string_interps
    }
    if (amount >= 1000) {
      return '${(amount / 1000).toStringAsFixed(0)}ك د.ع';
    }
    return '${_grouped.format(amount)} د.ع';
  }

  /// تاريخ عربي متوسّط («٢٣ أيار ٢٠٢٦»). يقبل DateTime أو String ISO أو null.
  static String arabicDate(Object? d) {
    final date = _parse(d);
    if (date == null) return '—';
    return DateFormat.yMMMd('ar').format(date.toLocal());
  }

  /// تاريخ + وقت عربي.
  static String arabicDateTime(Object? d) {
    final date = _parse(d);
    if (date == null) return '—';
    return DateFormat.yMMMd('ar').add_jm().format(date.toLocal());
  }

  /// شهر + سنة عربيان («حزيران ٢٠٢٦») — لترويسات تجميع القوائم.
  static String arabicMonthYear(Object? d) {
    final date = _parse(d);
    if (date == null) return '—';
    return DateFormat.yMMMM('ar').format(date.toLocal());
  }

  static DateTime? _parse(Object? d) {
    if (d == null) return null;
    if (d is DateTime) return d;
    return DateTime.tryParse(d.toString());
  }
}
