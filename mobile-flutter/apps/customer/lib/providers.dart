import 'dart:async';

import 'package:daari_core/daari_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// مزوّدات الاستعلام لتطبيق الزبون — مكافئة لـ hooks الـ react-query في Expo.
///
/// نمط الاستقصاء (polling): بعد كل جلب ناجح نجدول مؤقّتاً يستدعي
/// `ref.invalidateSelf()` فيُعيد الجلب — بديل `refetchInterval`.
void _poll(Ref ref, Duration every) {
  final timer = Timer(every, ref.invalidateSelf);
  ref.onDispose(timer.cancel);
}

/// ملفّ الزبون الحالي (الرصيد + الخزانات + سعر التعبئة + نقاط الولاء).
final myProfileProvider = FutureProvider.autoDispose<CustomerProfile>((ref) {
  return ref.watch(customerRepositoryProvider).me();
});

/// طلبات الزبون — استقصاء كل 15 ثانية لرؤية انتقالات حالة السائق.
final myOrdersProvider = FutureProvider.autoDispose<List<RefillOrder>>((ref) async {
  final orders = await ref.watch(ordersRepositoryProvider).listMine();
  _poll(ref, const Duration(seconds: 15));
  return orders;
});

/// تفاصيل طلب واحد (مع التتبّع) — استقصاء كل 15 ثانية.
final orderProvider =
    FutureProvider.autoDispose.family<RefillOrder, String>((ref, id) async {
  final order = await ref.watch(ordersRepositoryProvider).getOne(id);
  if (order.status.isActive) _poll(ref, const Duration(seconds: 15));
  return order;
});

/// حملة التخفيض النشطة — استقصاء كل 60 ثانية.
final activePromoProvider = FutureProvider.autoDispose<ActivePromo?>((ref) async {
  final promo = await ref.watch(customerRepositoryProvider).activePromo();
  _poll(ref, const Duration(seconds: 60));
  return promo;
});

/// العناوين المحفوظة.
final myAddressesProvider = FutureProvider.autoDispose<List<SavedAddress>>((ref) {
  return ref.watch(customerRepositoryProvider).addresses();
});

/// الجدولة التلقائية.
final mySchedulesProvider = FutureProvider.autoDispose<List<RefillSchedule>>((ref) {
  return ref.watch(customerRepositoryProvider).schedules();
});

/// الإشعارات.
final notificationsProvider = FutureProvider.autoDispose<NotificationsPage>((ref) {
  return ref.watch(notificationsRepositoryProvider).mine();
});

/// أقرب معمل لإحداثيات (شاشة التسجيل/الرئيسية).
final nearestPlantProvider =
    FutureProvider.autoDispose.family<NearestPlant?, ({double lng, double lat})>(
  (ref, c) => ref.watch(tenantsRepositoryProvider).nearest(lng: c.lng, lat: c.lat),
);
