import 'dart:async';

import 'package:daari_core/daari_core.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'providers.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ar');

  try {
    await Firebase.initializeApp();
  } catch (_) {
    // لم تُضبط google-services بعد — الإشعارات معطّلة فقط.
  }

  // التحليلات (best-effort — صامتة إن لم يُضبط POSTHOG_KEY).
  await Analytics.init(appId: 'daari-worker');

  await runWithCrashReporting(
    const ProviderScope(child: DaariDriverApp()),
    appId: 'daari-worker',
  );
}

class DaariDriverApp extends ConsumerWidget {
  const DaariDriverApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(driverRouterProvider);
    return MaterialApp.router(
      title: 'داري — السائق',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      routerConfig: router,
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: _AppChrome(child: child ?? const SizedBox.shrink()),
      ),
    );
  }
}

/// قشرة على مستوى التطبيق (فوق كل الشاشات):
/// 1) **شريط «غير متصل»** أحمر عند انقطاع الشبكة (كان في Expo على كل الشاشات،
///    وفي Flutter كان مقتصراً على الرئيسية).
/// 2) **تصريف طابور الطفرات الأوفلاين** دورياً (كل 60ث) + فور عودة الاتصال —
///    بدل أن يكون مقيّداً بتبويب الرئيسية (يطابق `worker/_layout.tsx`). هكذا
///    يُصرَّف الطابور حتى لو بقي السائق على شاشة المهمة/النقد/البيع الفوري.
class _AppChrome extends ConsumerStatefulWidget {
  const _AppChrome({required this.child});

  final Widget child;

  @override
  ConsumerState<_AppChrome> createState() => _AppChromeState();
}

class _AppChromeState extends ConsumerState<_AppChrome> {
  Timer? _flushTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _flushQueue());
    _flushTimer =
        Timer.periodic(const Duration(seconds: 60), (_) => _flushQueue());
  }

  @override
  void dispose() {
    _flushTimer?.cancel();
    super.dispose();
  }

  /// يصرّف الطفرات المعلّقة؛ عند نجاح أيٍّ منها يُعيد جلب البيانات المتأثّرة.
  Future<void> _flushQueue() async {
    try {
      final res = await ref.read(offlineQueueProvider).flush();
      if (res.ok > 0) {
        ref.invalidate(todayTasksProvider);
        ref.invalidate(historyProvider);
        ref.invalidate(cashSummaryProvider);
      }
    } catch (_) {
      // best-effort — نُعيد المحاولة في الدورة التالية أو عند عودة الاتصال.
    }
    if (mounted) ref.invalidate(pendingMutationsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final online = ref.watch(isOnlineProvider).valueOrNull ?? true;
    // صرّف الطابور فور عودة الاتصال (انتقال من غير-متصل إلى متصل).
    ref.listen<AsyncValue<bool>>(isOnlineProvider, (prev, next) {
      if (prev?.valueOrNull == false && next.valueOrNull == true) {
        _flushQueue();
      }
    });
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
        Expanded(child: widget.child),
      ],
    );
  }
}
