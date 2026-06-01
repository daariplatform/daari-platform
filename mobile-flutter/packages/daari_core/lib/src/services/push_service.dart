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
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();

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
      final settings = await _fcm.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;

      await _initLocal();

      final token = await _fcm.getToken();
      if (token != null) {
        await _sendToken(token);
      }
      _fcm.onTokenRefresh.listen(_sendToken);

      FirebaseMessaging.onMessage.listen(_showForeground);
      _initialised = true;
    } catch (_) {
      // best effort — الإشعارات لا تعطّل التطبيق
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
