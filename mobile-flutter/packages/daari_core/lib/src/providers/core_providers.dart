import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/customer_repository.dart';
import '../api/driver_repository.dart';
import '../api/notifications_repository.dart';
import '../api/orders_repository.dart';
import '../api/response_cache.dart';
import '../api/tenants_repository.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_repository.dart';
import '../auth/token_storage.dart';
import '../services/location_service.dart';
import '../services/offline_queue.dart';
import '../services/push_service.dart';

/// مزوّدات البنية التحتية المشتركة (Dio، التخزين، المصادقة).
///
/// كسر الحلقة: `apiClientProvider` يبني Dio مع onAuthFailure كـ **إغلاق**
/// لا يُنفَّذ وقت البناء، بل فقط لاحقاً عند فشل التجديد — حين يكون
/// `authControllerProvider` مبنيّاً أصلاً. فلا تعارض في رسم المزوّدات.

/// التخزين الآمن للتوكنات.
final tokenStorageProvider = Provider<TokenStorage>(
  (ref) => TokenStorage(),
);

/// كاش الإقلاع البارد (آخر استجابات GET) — يُحقَن في Dio ويُمسَح عند الخروج.
final responseCacheProvider = Provider<ResponseCache>(
  (ref) => ResponseCache(),
);

/// عميل الـ API (Dio + interceptors).
final apiClientProvider = Provider<ApiClient>((ref) {
  final tokens = ref.watch(tokenStorageProvider);
  return ApiClient(
    tokens: tokens,
    cache: ref.watch(responseCacheProvider),
    onAuthFailure: () async {
      // يُستدعى فقط وقت فشل تجديد التوكن
      await ref.read(authControllerProvider.notifier).onSessionExpired();
    },
  );
});

/// مثيل Dio المهيّأ — تستعمله كل الـ repositories.
final dioProvider = Provider<Dio>(
  (ref) => ref.watch(apiClientProvider).dio,
);

/// repository المصادقة.
final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(
    dio: ref.watch(dioProvider),
    tokens: ref.watch(tokenStorageProvider),
  ),
);

/// repositories الميزات — كلّها تشترك في نفس Dio المهيّأ.
final ordersRepositoryProvider = Provider<OrdersRepository>(
  (ref) => OrdersRepository(ref.watch(dioProvider)),
);

final customerRepositoryProvider = Provider<CustomerRepository>(
  (ref) => CustomerRepository(ref.watch(dioProvider)),
);

final driverRepositoryProvider = Provider<DriverRepository>(
  (ref) => DriverRepository(ref.watch(dioProvider)),
);

final tenantsRepositoryProvider = Provider<TenantsRepository>(
  (ref) => TenantsRepository(ref.watch(dioProvider)),
);

final notificationsRepositoryProvider = Provider<NotificationsRepository>(
  (ref) => NotificationsRepository(ref.watch(dioProvider)),
);

/// خدمة تتبّع الموقع (السائق).
final locationServiceProvider = Provider<LocationService>((ref) {
  final service = LocationService(ref.watch(driverRepositoryProvider));
  ref.onDispose(service.dispose);
  return service;
});

/// خدمة الإشعارات (FCM).
final pushServiceProvider = Provider<PushService>(
  (ref) => PushService(ref.watch(notificationsRepositoryProvider)),
);

/// طابور الطفرات الأوفلاين (السائق) — يشترك في نفس Dio المهيّأ.
final offlineQueueProvider = Provider<OfflineQueue>(
  (ref) => OfflineQueue(ref.watch(dioProvider)),
);

/// هل يوجد اتصال بالإنترنت؟ يبثّ القيمة الحالية ثم كل تغيّر.
/// (نُرجِع bool فقط كي لا تحتاج التطبيقات استيراد connectivity_plus.)
final isOnlineProvider = StreamProvider<bool>((ref) async* {
  final connectivity = Connectivity();
  bool online(List<ConnectivityResult> r) =>
      r.any((x) => x != ConnectivityResult.none);
  yield online(await connectivity.checkConnectivity());
  yield* connectivity.onConnectivityChanged.map(online);
});
