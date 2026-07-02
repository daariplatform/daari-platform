import 'package:flutter/widgets.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

import '../config/env.dart';

/// تحليلات PostHog — بديل `lib/posthog.ts`. يُهيّأ مرّة واحدة عند الإقلاع إن وُجد
/// المفتاح؛ وإلا تبقى كل الدوال صامتة (مريح للتطوير دون إغراق PostHog).
///
/// نسجّل خاصية `app` المميِّزة (daari-customer / daari-worker) لتصفية الأحداث
/// لكل تطبيق داخل مشروع PostHog واحد — مكافئ super-property في Expo.
class Analytics {
  Analytics._();

  static bool _enabled = false;

  static Future<void> init({required String appId}) async {
    if (Env.posthogKey.isEmpty) return;
    final config = PostHogConfig(Env.posthogKey)
      ..host = Env.posthogHost
      ..captureApplicationLifecycleEvents = true
      ..debug = false;
    await Posthog().setup(config);
    await Posthog().register('app', appId);
    _enabled = true;
  }

  /// بعد تسجيل الدخول.
  static Future<void> identify(String userId,
      {Map<String, Object>? properties,}) async {
    if (!_enabled) return;
    await Posthog().identify(userId: userId, userProperties: properties);
  }

  /// بعد تسجيل الخروج.
  static Future<void> reset() async {
    if (!_enabled) return;
    await Posthog().reset();
  }

  /// حدث صريح.
  static Future<void> capture(String event,
      {Map<String, Object>? properties,}) async {
    if (!_enabled) return;
    await Posthog().capture(eventName: event, properties: properties);
  }

  /// مراقبو التنقّل لتتبّع الشاشات تلقائياً — يُمرَّرون إلى `GoRouter.observers`.
  /// فارغة عند تعطيل PostHog كي لا نركّب مراقباً بلا فائدة.
  static List<NavigatorObserver> get navigatorObservers =>
      Env.posthogKey.isEmpty ? const [] : [PosthogObserver()];
}
