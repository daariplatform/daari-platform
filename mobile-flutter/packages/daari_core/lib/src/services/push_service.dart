import 'package:app_settings/app_settings.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../api/notifications_repository.dart';

/// خدمة الإشعارات (FCM) — بديل `push.ts` (Expo Notifications).
///
/// تطلب الصلاحية، تجلب توكن FCM، ترسله للخادم عبر POST /notifications/push-token،
/// وتعرض الإشعارات أثناء عمل التطبيق في المقدّمة عبر flutter_local_notifications.
class PushService {
  PushService(this._notifications);

  final NotificationsRepository _notifications;
  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();

  /// وصول كسول محميّ لـ FCM: `FirebaseMessaging.instance` يرمي إن لم تُهيّأ
  /// Firebase (تهيئتها best-effort في main.dart — قد تفشل دون google-services).
  /// نلتقط الخطأ ونرجع null كي لا ينهار بناء الخدمة ولا قراءتها من شاشة الإعدادات.
  FirebaseMessaging? get _fcm {
    try {
      return FirebaseMessaging.instance;
    } catch (_) {
      return null;
    }
  }

  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'default',
    'إشعارات داري',
    description: 'تنبيهات الطلبات والتوصيل',
    importance: Importance.high,
  );

  bool _initialised = false;

  /// تهيئة كاملة: صلاحية + قناة أندرويد + جلب التوكن + المستمعات.
  /// تُستدعى بعد تسجيل الدخول. الفشل صامت (الإشعارات best-effort).
  Future<void> register() async {
    try {
      final fcm = _fcm;
      if (fcm == null) return;
      final settings = await fcm.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;

      await _initLocal();

      final token = await fcm.getToken();
      if (token != null) {
        await _sendToken(token);
      }
      fcm.onTokenRefresh.listen(_sendToken);

      FirebaseMessaging.onMessage.listen(_showForeground);
      _initialised = true;
    } catch (_) {
      // best effort — الإشعارات لا تعطّل التطبيق
    }
  }

  /// هل إذن الإشعارات مفعّل حالياً على مستوى النظام؟ (لعرض الحالة في الإعدادات).
  /// صامت عند الفشل — نعدّها «غير مفعّلة» كي لا نُظهر حالة كاذبة.
  Future<bool> areNotificationsEnabled() async {
    final fcm = _fcm;
    if (fcm == null) return false;
    try {
      final settings = await fcm.getNotificationSettings();
      switch (settings.authorizationStatus) {
        case AuthorizationStatus.authorized:
        case AuthorizationStatus.provisional:
          return true;
        case AuthorizationStatus.denied:
        case AuthorizationStatus.notDetermined:
          return false;
      }
    } catch (_) {
      return false;
    }
  }

  /// يفتح صفحة إعدادات إشعارات التطبيق في النظام كي يبدّل المستخدم الإذن.
  /// (لا يمكن للتطبيق منح/سحب الإذن برمجياً بعد الرفض — يجب فتح الإعدادات.)
  Future<void> openNotificationSettings() async {
    try {
      await AppSettings.openAppSettings(type: AppSettingsType.notification);
    } catch (_) {
      // best effort — قد لا تتوفّر صفحة الإعدادات على بعض الأجهزة
    }
  }

  Future<void> _initLocal() async {
    if (_initialised) return;
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings();
    await _local.initialize(
      const InitializationSettings(android: android, iOS: ios),
    );
    await _local
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);
  }

  Future<void> _sendToken(String token) async {
    try {
      final platform =
          defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';
      await _notifications.registerPushToken(token: token, platform: platform);
    } catch (_) {
      // best effort
    }
  }

  void _showForeground(RemoteMessage message) {
    final n = message.notification;
    if (n == null) return;
    _local.show(
      n.hashCode,
      n.title,
      n.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: const DarwinNotificationDetails(),
      ),
    );
  }
}
