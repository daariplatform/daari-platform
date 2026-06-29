import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'screens/advanced_reports_screen.dart';
import 'screens/fleet_map_screen.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/more_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/promos_screen.dart';
import 'screens/reports_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/stock_screen.dart';
import 'screens/team_screen.dart';
import 'widgets/home_shell.dart';

const _authRoutes = {'/login'};

/// راوتر تطبيق الإدارة — go_router مع حارس مصادقة (نفس نمط customer/driver).
final adminRouterProvider = Provider<GoRouter>((ref) {
  // جسر بين Riverpod و go_router: نُعلِم الراوتر عند تغيّر حالة المصادقة.
  final refresh = ValueNotifier<int>(0);
  ref.listen(authControllerProvider, (_, __) => refresh.value++);
  ref.onDispose(refresh.dispose);

  final shellKey = GlobalKey<NavigatorState>();

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    observers: Analytics.navigatorObservers,
    redirect: (context, state) {
      final loc = state.matchedLocation;
      if (loc == '/') return null; // شاشة الإقلاع تقرّر الوجهة

      final auth = ref.read(authControllerProvider);
      if (auth.status == AuthStatus.unknown ||
          auth.status == AuthStatus.hydrating) {
        return null;
      }

      final loggedIn = auth.isAuthenticated;
      if (!loggedIn) {
        return _authRoutes.contains(loc) ? null : '/login';
      }
      // مسجّل الدخول: لا يبقى على شاشة الدخول
      if (_authRoutes.contains(loc)) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),

      // قشرة التبويبات (الرئيسية / التقارير / الفريق / المزيد)
      ShellRoute(
        navigatorKey: shellKey,
        builder: (_, __, child) => HomeShell(child: child),
        routes: [
          GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
          GoRoute(path: '/reports', builder: (_, __) => const ReportsScreen()),
          GoRoute(path: '/team', builder: (_, __) => const TeamScreen()),
          GoRoute(path: '/more', builder: (_, __) => const MoreScreen()),
        ],
      ),

      // شاشات مستقلّة فوق التبويبات (تُفتح من «المزيد» أو من شاشاتها)
      GoRoute(path: '/stock', builder: (_, __) => const StockScreen()),
      GoRoute(path: '/fleet', builder: (_, __) => const FleetMapScreen()),
      GoRoute(path: '/promos', builder: (_, __) => const PromosScreen()),
      GoRoute(
        path: '/reports/advanced',
        builder: (_, __) => const AdvancedReportsScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (_, __) => const OnboardingScreen(),
      ),
    ],
  );
});
