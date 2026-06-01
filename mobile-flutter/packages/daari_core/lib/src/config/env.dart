/// نقطة الحقيقة الوحيدة لإعدادات البيئة.
///
/// تُضبط وقت البناء عبر `--dart-define`، تماماً كما كانت `EXPO_PUBLIC_*` في Expo:
///
/// ```bash
/// flutter run --dart-define=API_URL=https://api.phi-bit.com/api/v1
/// ```
class Env {
  Env._();

  /// عنوان الـ backend NestJS. الافتراضي للتطوير المحلي.
  ///
  /// - محاكي Android → باك إند محلي: `http://10.0.2.2:3000/api/v1`
  /// - الإنتاج: `https://api.phi-bit.com/api/v1`
  static const String apiBaseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:3000/api/v1',
  );

  /// مفتاح PostHog (اختياري — إن تُرك فارغاً يُعطَّل التتبّع).
  static const String posthogKey = String.fromEnvironment('POSTHOG_KEY');

  /// Sentry DSN (اختياري).
  static const String sentryDsn = String.fromEnvironment('SENTRY_DSN');

  /// مهلة طلبات الشبكة (نفس قيمة axios الحالية: 12s).
  static const Duration httpTimeout = Duration(seconds: 12);

  /// هل نحن على خادم الإنتاج؟
  static bool get isProduction => apiBaseUrl.contains('api.phi-bit.com');
}
