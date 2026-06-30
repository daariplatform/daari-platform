import 'package:daari_core/daari_core.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // تهيئة تنسيق التواريخ العربية (intl).
  await initializeDateFormatting('ar');

  // Firebase (FCM) — best-effort: التطبيق يعمل حتى لو لم تُضبط الإعدادات بعد.
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // لم تُضبط google-services بعد — الإشعارات معطّلة فقط.
  }

  // التحليلات (best-effort — صامتة إن لم يُضبط POSTHOG_KEY).
  await Analytics.init(appId: 'daari-customer');

  await runWithCrashReporting(
    const ProviderScope(child: DaariCustomerApp()),
    appId: 'daari-customer',
  );
}

class DaariCustomerApp extends ConsumerWidget {
  const DaariCustomerApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(customerRouterProvider);
    return MaterialApp.router(
      title: 'داري',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      routerConfig: router,
      // تعريب + RTL
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: _OfflineWrapper(child: child ?? const SizedBox.shrink()),
      ),
    );
  }
}

/// يضع شريطاً أحمر أعلى التطبيق (فوق كل الشاشات) عند انقطاع الاتصال.
class _OfflineWrapper extends ConsumerWidget {
  const _OfflineWrapper({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(isOnlineProvider).valueOrNull ?? true;
    return Column(
      children: [
        if (!online)
          Material(
            color: const Color(0xFFDC2626),
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Icon(Icons.wifi_off, color: Colors.white, size: 16),
                    SizedBox(width: 8),
                    Text('أنت غير متصل بالإنترنت — تُعرض بيانات محفوظة',
                        style: TextStyle(color: Colors.white, fontSize: 12.5)),
                  ],
                ),
              ),
            ),
          ),
        Expanded(child: child),
      ],
    );
  }
}
