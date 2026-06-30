import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../models/me_response.dart';
import '../providers/core_providers.dart';
import '../services/analytics.dart';
import 'auth_state.dart';

/// متحكّم المصادقة — مكافئ `auth-store.ts` (Zustand) بـ Riverpod.
/// يدير: hydrate عند الإقلاع، login، logout، وانتهاء الجلسة.
class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() => AuthState.initial;

  /// يستعيد الجلسة عند إقلاع التطبيق: إن وُجد توكن، يجلب /auth/me.
  Future<void> hydrate() async {
    state = state.copyWith(status: AuthStatus.hydrating);
    final tokens = ref.read(tokenStorageProvider);
    if (!await tokens.hasSession()) {
      state = const AuthState(status: AuthStatus.unauthenticated);
      return;
    }
    try {
      final me = await ref.read(authRepositoryProvider).me();
      state = AuthState(user: me, status: AuthStatus.authenticated);
      Analytics.identify(me.id, properties: {'role': me.role});
    } on ApiException catch (e) {
      // أوفلاين + انتهى كاش /auth/me (>4 ساعات): لا تمسح جلسةً سارية. أبقِ
      // التوكنات كي تُستعاد الجلسة عند أوّل إقلاع بشبكة، بدل إجبار المستخدم
      // على تسجيل دخول جديد لمجرّد فتحه التطبيق دون إنترنت.
      if (e.isNetwork) {
        state = const AuthState(status: AuthStatus.unauthenticated);
        return;
      }
      await tokens.clear();
      state = const AuthState(status: AuthStatus.unauthenticated);
    } catch (_) {
      await tokens.clear();
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  /// تسجيل دخول — يرمي ApiException عند الفشل (تلتقطه الواجهة).
  Future<void> login({
    required String phone,
    required String password,
  }) async {
    // امسح كاش الإقلاع البارد لمستخدمٍ سابق على نفس الجهاز قبل بدء جلسة جديدة
    // — مفاتيح الكاش غير مرتبطة بالهوية (مثل GET /customers/me)، فلو لم يُسجّل
    // الأوّل خروجاً (إغلاق قسري) قد تُخدَم بياناته للجديد عند انقطاع الشبكة.
    await ref.read(responseCacheProvider).clear();
    final me = await ref
        .read(authRepositoryProvider)
        .login(phone: phone, password: password);
    state = AuthState(user: me, status: AuthStatus.authenticated);
    Analytics.identify(me.id, properties: {'role': me.role});
  }

  /// إعادة تعيين كلمة السر ثم دخول تلقائي (الخادم يُصدر توكنات). يرمي عند الفشل.
  Future<void> resetPasswordAndLogin({
    required String phone,
    required String otp,
    required String newPassword,
  }) async {
    // امسح كاش الإقلاع البارد لمستخدم سابق على نفس الجهاز (كما في login).
    await ref.read(responseCacheProvider).clear();
    final me = await ref.read(authRepositoryProvider).resetPassword(
          phone: phone,
          otp: otp,
          newPassword: newPassword,
        );
    state = AuthState(user: me, status: AuthStatus.authenticated);
    Analytics.identify(me.id, properties: {'role': me.role});
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    // امسح كاش الإقلاع البارد كي لا تتسرّب بيانات هذا المستخدم لمن يسجّل بعده.
    await ref.read(responseCacheProvider).clear();
    state = const AuthState(status: AuthStatus.unauthenticated);
    Analytics.reset();
  }

  /// يُستدعى من interceptor عند فشل تجديد التوكن (جلسة ميتة).
  Future<void> onSessionExpired() async {
    await ref.read(tokenStorageProvider).clear();
    await ref.read(responseCacheProvider).clear();
    state = const AuthState(status: AuthStatus.unauthenticated);
    Analytics.reset();
  }
}

/// الحالة الحيّة للمصادقة.
final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

/// اختصار للمستخدم الحالي (null إن لم يسجّل الدخول).
final currentUserProvider = Provider<MeResponse?>(
  (ref) => ref.watch(authControllerProvider).user,
);
