import 'package:flutter/services.dart';

/// غلاف الاهتزاز اللمسي — منقول من `lib/haptics.ts` في Expo.
///
/// دوال `HapticFeedback` تصمت بأمان على الأجهزة/المنصّات غير الداعمة، فلا حاجة
/// لفحص المنصّة. لا ننتظر الـ Future (إطلاق وننسى).
class Hap {
  Hap._();

  /// ضغطة عادية (تحديد/تنقّل).
  static void tap() => HapticFeedback.selectionClick();

  /// ضغطة مهمة (تأكيد، تنفيذ إجراء).
  static void press() => HapticFeedback.mediumImpact();

  /// نجاح حدث (طلب أُرسل، حفظ ناجح). Flutter بلا نوع «نجاح» مخصّص → نبضة متوسطة.
  static void success() => HapticFeedback.mediumImpact();

  /// خطأ — نبضة قويّة.
  static void error() => HapticFeedback.heavyImpact();

  /// تحذير — اهتزاز قصير.
  static void warning() => HapticFeedback.vibrate();
}
