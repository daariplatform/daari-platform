import 'dart:async';

import 'package:daari_core/daari_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// مزوّدات الاستعلام لتطبيق السائق — مكافئة لـ hooks الـ react-query في Expo.
void _poll(Ref ref, Duration every) {
  final timer = Timer(every, ref.invalidateSelf);
  ref.onDispose(timer.cancel);
}

/// ملفّ السائق (الراتب/العمولة/الحالة/جرد الفان).
final driverProfileProvider = FutureProvider.autoDispose<DriverProfile>((ref) {
  return ref.watch(driverRepositoryProvider).me();
});

/// مهام اليوم (ASSIGNED / EN_ROUTE) — استقصاء كل 60 ثانية.
final todayTasksProvider = FutureProvider.autoDispose<List<DriverTask>>((ref) async {
  final tasks = await ref.watch(ordersRepositoryProvider).todayTasks();
  _poll(ref, const Duration(seconds: 60));
  return tasks;
});

/// بركة الطلبات المتاحة للقبول — استقصاء كل 20 ثانية.
final availableOrdersProvider = FutureProvider.autoDispose<List<DriverTask>>((ref) async {
  final orders = await ref.watch(ordersRepositoryProvider).availableOrders();
  _poll(ref, const Duration(seconds: 20));
  return orders;
});

/// تاريخ الطلبات المكتملة.
final historyProvider = FutureProvider.autoDispose<List<RefillOrder>>((ref) {
  return ref.watch(ordersRepositoryProvider).history(limit: 100);
});

/// أداء السائق للفترة.
final perfProvider =
    FutureProvider.autoDispose.family<DriverPerf, String>((ref, period) {
  return ref.watch(driverRepositoryProvider).perf(period: period);
});

/// ملخّص نقد اليوم.
final cashSummaryProvider = FutureProvider.autoDispose<CashSummary>((ref) {
  return ref.watch(driverRepositoryProvider).cashSummary();
});

/// سجلّ تسليمات النقد.
final cashHandoversProvider = FutureProvider.autoDispose<List<CashHandover>>((ref) {
  return ref.watch(driverRepositoryProvider).cashHandovers();
});

/// سلسلة الأرباح اليومية.
final earningsProvider =
    FutureProvider.autoDispose.family<List<EarningsDay>, String>((ref, period) {
  return ref.watch(driverRepositoryProvider).earnings(period: period);
});

/// ملخّص الوردية.
final shiftSummaryProvider = FutureProvider.autoDispose<ShiftSummary>((ref) {
  return ref.watch(driverRepositoryProvider).shiftSummary();
});

/// بحث الزبائن (للبيع الفوري) — يتطلّب حرفين على الأقل.
final customerSearchProvider =
    FutureProvider.autoDispose.family<List<CustomerProfile>, String>((ref, q) async {
  if (q.trim().length < 2) return const [];
  return ref.watch(customerRepositoryProvider).search(q.trim());
});

/// حالة الوردية (هل التتبّع يعمل) — يتحكّم بها السائق من الرئيسية.
final onShiftProvider = StateProvider<bool>((ref) => false);
