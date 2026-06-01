import '../models/me_response.dart';

enum AuthStatus { unknown, hydrating, authenticated, unauthenticated }

/// حالة المصادقة في الذاكرة (يديرها AuthController عبر Riverpod).
class AuthState {
  const AuthState({this.user, this.status = AuthStatus.unknown});

  final MeResponse? user;
  final AuthStatus status;

  bool get isAuthenticated =>
      status == AuthStatus.authenticated && user != null;
  bool get isHydrating => status == AuthStatus.hydrating;

  AuthState copyWith({
    MeResponse? user,
    AuthStatus? status,
    bool clearUser = false,
  }) {
    return AuthState(
      user: clearUser ? null : (user ?? this.user),
      status: status ?? this.status,
    );
  }

  static const AuthState initial = AuthState();
}
