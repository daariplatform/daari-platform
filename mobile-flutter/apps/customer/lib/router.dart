import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'screens/addresses_screen.dart';
import 'screens/forgot_screen.dart';
import 'screens/home_screen.dart';
import 'screens/intro_screen.dart';
import 'screens/login_screen.dart';
import 'screens/map_picker_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/order_detail_screen.dart';
import 'screens/orders_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/schedules_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/support_screen.dart';
import 'screens/wallet_screen.dart';
import 'screens/welcome_screen.dart';
import 'widgets/home_shell.dart';

const _authRoutes = {'/welcome', '/login', '/signup', '/forgot', '/intro'};

/// راوتر تطبيق الزبون — go_router مع حارس مصادقة.
final customerRouterProvider = Provider<GoRouter>((ref) {
  // جسر بين Riverpod و go_router: نُعلِم الراوتر عند تغيّر حالة المصادقة.
  final refresh = ValueNotifier<int>(0);
  ref.listen(authControllerProvider, (_, __) => refresh.value++);
  ref.onDispose(refresh.dispose);

  final shellKey = GlobalKey<NavigatorState>();

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final loc = state.matchedLocation;
      if (loc == '/') return null; // شاشة الإقلاع تقرّر الوجهة

      final auth = ref.read(authControllerProvider);
      if (auth.status == AuthStatus.unknown || auth.status == AuthStatus.hydrating) {
        return null;
      }

      final loggedIn = auth.isAuthenticated;
      if (!loggedIn) {
        return _authRoutes.contains(loc) ? null : '/welcome';
      }
      // مسجّل الدخول: لا يبقى على شاشات المصادقة
      if (_authRoutes.contains(loc)) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/intro', builder: (_, __) => const IntroScreen()),
      GoRoute(path: '/welcome', builder: (_, __) => const WelcomeScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/signup', builder: (_, __) => const SignupScreen()),
      GoRoute(path: '/forgot', builder: (_, __) => const ForgotScreen()),
      GoRoute(
        path: '/map-picker',
        builder: (_, state) => MapPickerScreen(
          initial: state.extra is MapPickerArgs ? state.extra as MapPickerArgs : null,
        ),
      ),

      // قشرة التبويبات (الرئيسية/الطلبات/الملف)
      ShellRoute(
        navigatorKey: shellKey,
        builder: (_, __, child) => HomeShell(child: child),
        routes: [
          GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
          GoRoute(path: '/orders', builder: (_, __) => const OrdersScreen()),
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
        ],
      ),

      // شاشات مستقلّة فوق التبويبات
      GoRoute(
        path: '/order/:id',
        builder: (_, state) => OrderDetailScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/addresses', builder: (_, __) => const AddressesScreen()),
      GoRoute(path: '/schedules', builder: (_, __) => const SchedulesScreen()),
      GoRoute(path: '/wallet', builder: (_, __) => const WalletScreen()),
      GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
      GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
      GoRoute(path: '/support', builder: (_, __) => const SupportScreen()),
    ],
  );
});
