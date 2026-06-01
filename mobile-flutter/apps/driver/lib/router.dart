import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'screens/cash_screen.dart';
import 'screens/earnings_screen.dart';
import 'screens/forgot_screen.dart';
import 'screens/history_screen.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/shift_summary_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/task_detail_screen.dart';
import 'screens/van_inventory_screen.dart';
import 'screens/walkin_screen.dart';
import 'widgets/home_shell.dart';

const _authRoutes = {'/login', '/forgot'};

/// راوتر تطبيق السائق — go_router مع حارس مصادقة.
final driverRouterProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen(authControllerProvider, (_, __) => refresh.value++);
  ref.onDispose(refresh.dispose);

  final shellKey = GlobalKey<NavigatorState>();

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final loc = state.matchedLocation;
      if (loc == '/') return null;

      final auth = ref.read(authControllerProvider);
      if (auth.status == AuthStatus.unknown || auth.status == AuthStatus.hydrating) {
        return null;
      }
      final loggedIn = auth.isAuthenticated;
      if (!loggedIn) return _authRoutes.contains(loc) ? null : '/login';
      if (_authRoutes.contains(loc)) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/forgot', builder: (_, __) => const ForgotScreen()),

      ShellRoute(
        navigatorKey: shellKey,
        builder: (_, __, child) => HomeShell(child: child),
        routes: [
          GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
          GoRoute(path: '/history', builder: (_, __) => const HistoryScreen()),
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
        ],
      ),

      GoRoute(
        path: '/task/:id',
        builder: (_, state) => TaskDetailScreen(taskId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/cash', builder: (_, __) => const CashScreen()),
      GoRoute(path: '/earnings', builder: (_, __) => const EarningsScreen()),
      GoRoute(path: '/shift-summary', builder: (_, __) => const ShiftSummaryScreen()),
      GoRoute(path: '/van-inventory', builder: (_, __) => const VanInventoryScreen()),
      GoRoute(path: '/walkin', builder: (_, __) => const WalkinScreen()),
    ],
  );
});
