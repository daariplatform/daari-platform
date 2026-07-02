import 'package:app_settings/app_settings.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../api/notifications_repository.dart';

/// معالِج رسائل الخلفية (data-only) — يجب أن يكون دالّة علوية المستوى ومعلَّمة
/// `vm:entry-point` كي يستدعيها محرّك Flutter في عزلة منفصلة. النظام يعرض
/// الإشعار تلقائياً؛ والتنقّل عند النقر يُعالَج عبر onMessageOpenedApp/getInitialMessage.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // لا عمل إضافي مطلوب هنا حالياً.
}

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
  // FCM stream listeners must be bound only once — register() is re-invoked on
  // every tab visit / re-login, and re-subscribing leaked duplicate listeners
  // (and stale-context close handlers).
  bool _listenersBound = false;
  // Latest deep-link callback, refreshed on each register() so background/opened
  // notifications route to the current app instance.
  void Function(String? orderId, String? type)? _onOpen;

  /// تهيئة كاملة: صلاحية + قناة أندرويد + جلب التوكن + المستمعات.
  /// تُستدعى بعد تسجيل الدخول. الفشل صامت (الإشعارات best-effort).
  /// [onOpenNotification] يُستدعى حين يفتح المستخدم التطبيق بالنقر على إشعار
  /// (سواء كان في الخلفية أو مغلقاً تماماً) — يمرّر `orderId` و`type` من حمولة
  /// البيانات كي يوجّه التطبيق المستخدم لشاشة الطلب/المهمة المناسبة (deep-link).
  Future<void> register({
    void Function(String? orderId, String? type)? onOpenNotification,
  }) async {
    try {
      final fcm = _fcm;
      if (fcm == null) return;
      final settings = await fcm.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;

      // احفظ أحدث دالّة فتح كي توجّه الإشعارات المفتوحة للنسخة الحالية من التطبيق.
      _onOpen = onOpenNotification;

      await _initLocal();

      // أرسِل التوكن دائماً — عند إعادة الدخول يربطه الخادم بالمستخدم الحالي.
      final token = await fcm.getToken();
      if (token != null) {
        await _sendToken(token);
      }

      // اربط المستمعات مرّة واحدة فقط. register() تُستدعى من HomeScreen.initState
      // (كل زيارة تبويب/إعادة دخول)؛ إعادة الاشتراك كانت تُراكم مستمعات مكرّرة.
      if (!_listenersBound) {
        _listenersBound = true;
        fcm.onTokenRefresh.listen(_sendToken);
        FirebaseMessaging.onMessage.listen(_showForeground);
        // فتح التطبيق بالنقر على إشعار والتطبيق في الخلفية.
        FirebaseMessaging.onMessageOpenedApp
            .listen((m) => _handleOpen(m, _onOpen));
        // رسائل الخلفية (data-only).
        FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      }

      // فتح التطبيق من إشعار وهو مغلق تماماً (cold start) — يُفحَص كل مرّة.
      final initial = await fcm.getInitialMessage();
      if (initial != null) _handleOpen(initial, _onOpen);

      _initialised = true;
    } catch (_) {
      // best effort — الإشعارات لا تعطّل التطبيق
    }
  }

  void _handleOpen(
    RemoteMessage message,
    void Function(String? orderId, String? type)? cb,
  ) {
    if (cb == null) return;
    final data = message.data;
    final orderId = data['orderId'] as String?;
    final type = (data['type'] ?? data['kind']) as String?;
    cb(orderId, type);
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
