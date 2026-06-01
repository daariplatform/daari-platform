import 'package:shared_preferences/shared_preferences.dart';

/// أعلام محلية بسيطة (بديل AsyncStorage) — مثل «شوهدت شاشة التعريف».
class LocalFlags {
  LocalFlags._();

  static const _introSeen = 'daari-intro-seen-v1';

  /// هل شوهدت شاشة التعريف؟ عند فشل التخزين نعدّها «شوهدت» لئلا نحبس المستخدم.
  static Future<bool> hasSeenIntro() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(_introSeen) ?? false;
    } catch (_) {
      return true;
    }
  }

  static Future<void> markIntroSeen() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_introSeen, true);
    } catch (_) {
      // best effort
    }
  }
}
