import 'package:flutter/widgets.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import '../config/env.dart';

/// تهيئة Sentry ثم تشغيل التطبيق — منقول من `lib/sentry.ts` في تطبيقَي Expo.
///
/// إن لم يُضبط `SENTRY_DSN` (عبر `--dart-define`) نشغّل التطبيق مباشرةً دون Sentry،
/// تماماً كسلوك Expo (يستورد الـ SDK لكن لا يرسل) — مريح للتطوير دون إغراق Sentry.
///
/// نطابق إعداد Expo: عيّنة آثار 10%، بلا PII افتراضي، والبيئة من رابط الـ API.
/// نضيف وسماً `app` (daari-customer / daari-worker) لتصفية الأحداث لكل تطبيق
/// داخل مشروع Sentry واحد — مكافئ super-property في PostHog.
Future<void> runWithCrashReporting(
  Widget app, {
  required String appId,
}) async {
  final dsn = Env.sentryDsn;
  if (dsn.isEmpty) {
    runApp(app);
    return;
  }
  await SentryFlutter.init(
    (options) {
      options.dsn = dsn;
      options.tracesSampleRate = 0.1;
      options.sendDefaultPii = false;
      options.environment = Env.isProduction ? 'production' : 'development';
    },
    appRunner: () {
      Sentry.configureScope((scope) => scope.setTag('app', appId));
      runApp(app);
    },
  );
}
