import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// تخزين دائم لآخر استجابات GET الناجحة (بديل `persist.ts` في Expo الذي كان
/// يحفظ كاش React-Query إلى AsyncStorage).
///
/// الهدف: عند فتح التطبيق **دون شبكة** تظهر آخر بيانات معروفة فوراً بدل شاشة
/// خطأ. لكلّ مدخل ختمٌ زمني، وتُهمَل المدخلات الأقدم من TTL.
///
/// نستعمل `shared_preferences` (المتوفّر أصلاً) لا حزمةً جديدة. القيم المحفوظة
/// هي JSON مفكوك (Map/List) أتت من الخادم، فهي قابلة لإعادة التسلسل دائماً.
class ResponseCache {
  ResponseCache({SharedPreferences? prefs}) : _prefs = prefs;

  /// بادئة مفاتيح الكاش — تميّزها عن أعلام `LocalFlags` وتسمح بمسحها دفعةً.
  static const _prefix = 'daari-cache:';

  SharedPreferences? _prefs;

  /// يتزايد عند كل `clear()`. الكتابة تلتقط قيمته عند بدئها، وإن تغيّر بعد
  /// `await` (أي حدث مسحٌ في الأثناء) تُلغى الكتابة — كي لا تُكتب بيانات مستخدمٍ
  /// خرج لتوّه بعد أن مسحنا كاشه (الكتابة في onResponse دون انتظار).
  int _epoch = 0;

  Future<SharedPreferences> get _instance async =>
      _prefs ??= await SharedPreferences.getInstance();

  String _k(String key) => '$_prefix$key';

  /// يحفظ بيانات استجابة تحت مفتاح (best-effort — الفشل صامت).
  Future<void> write(String key, Object? data) async {
    if (data == null) return;
    final epochAtStart = _epoch;
    try {
      final prefs = await _instance;
      if (_epoch != epochAtStart) return; // حدث مسحٌ بعد بدء الكتابة → ألغِها
      final envelope = jsonEncode({
        't': DateTime.now().millisecondsSinceEpoch,
        'd': data,
      });
      await prefs.setString(_k(key), envelope);
    } catch (_) {
      // best effort — الكاش لا يعطّل الطلب
    }
  }

  /// يقرأ بيانات مخزّنة إن وُجدت ولم تتجاوز [maxAge]؛ وإلا `null`.
  /// المدخلات منتهية الصلاحية تُحذف عند قراءتها.
  Future<Object?> read(String key, Duration maxAge) async {
    try {
      final prefs = await _instance;
      final raw = prefs.getString(_k(key));
      if (raw == null) return null;
      final envelope = jsonDecode(raw) as Map<String, dynamic>;
      final ts = envelope['t'] as int? ?? 0;
      final age = DateTime.now().millisecondsSinceEpoch - ts;
      if (age > maxAge.inMilliseconds) {
        await prefs.remove(_k(key));
        return null;
      }
      return envelope['d'];
    } catch (_) {
      return null;
    }
  }

  /// يمسح كلّ مدخلات الكاش — يُستدعى عند تسجيل الخروج كي لا تتسرّب بيانات
  /// مستخدم سابق إلى آخر على نفس الجهاز.
  Future<void> clear() async {
    // زِد العصر أوّلاً (متزامناً) كي تُلغى أيّ كتابة بدأت قبل المسح.
    _epoch++;
    try {
      final prefs = await _instance;
      final keys = prefs.getKeys().where((k) => k.startsWith(_prefix)).toList();
      for (final k in keys) {
        await prefs.remove(k);
      }
    } catch (_) {
      // best effort
    }
  }
}
