import 'package:shared_preferences/shared_preferences.dart';

/// أعلام محلية بسيطة (بديل AsyncStorage) — مثل «شوهدت شاشة التعريف».
class LocalFlags {
  LocalFlags._();

  static const _introSeen = 'daari-intro-seen-v1';
  static const _onboardingSeen = 'daari-onboarding-seen-v1';
  static const _biometricEnabled = 'daari-biometric-enabled-v1';

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

  /// هل أكمل المستخدم تدفّق الإعداد الأول (onboarding)؟
  static Future<bool> hasSeenOnboarding() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(_onboardingSeen) ?? false;
    } catch (_) {
      return true;
    }
  }

  static Future<void> markOnboardingSeen() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_onboardingSeen, true);
    } catch (_) {
      // best effort
    }
  }

  /// هل فعّل المستخدم قفل الدخول بالبصمة؟ (الافتراضي «لا» — حتى لا نحبسه
  /// خارج جلسته بسبب علَمٍ تالف أو غياب التخزين.)
  static Future<bool> biometricEnabled() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(_biometricEnabled) ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<void> setBiometricEnabled(bool value) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_biometricEnabled, value);
    } catch (_) {
      // best effort
    }
  }
}
