import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';

/// لون حالة الطلب/المهمة.
Color orderStatusColor(RefillOrderStatus s) {
  switch (s) {
    case RefillOrderStatus.completed:
      return AppColors.water600;
    case RefillOrderStatus.enRoute:
    case RefillOrderStatus.assigned:
      return AppColors.warn600;
    case RefillOrderStatus.pending:
      return AppColors.navy600;
    case RefillOrderStatus.cancelled:
    case RefillOrderStatus.failed:
      return AppColors.danger;
  }
}

/// شارة حالة.
class OrderStatusPill extends StatelessWidget {
  const OrderStatusPill({super.key, required this.status});
  final RefillOrderStatus status;

  @override
  Widget build(BuildContext context) {
    final color = orderStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(status.label,
          style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12.5)),
    );
  }
}

/// تسمية مسافة بشرية بين السائق والزبون («X م» أو «X.X كم»)، أو null عند غياب
/// أيّ إحداثية (موقع السائق أو موقع الزبون). يطابق `distLabel` في worker/home.tsx.
String? distanceLabel(Coords? driver, double? lat, double? lng) {
  if (driver == null || lat == null || lng == null) return null;
  final m = LocationService.distanceMetres(driver, Coords(lng: lng, lat: lat));
  return m >= 1000 ? '${(m / 1000).toStringAsFixed(1)} كم' : '${m.round()} م';
}

/// شارة مسافة مدمجة (أيقونة + النصّ)؛ تختفي إن لم تتوفّر المسافة.
class DistanceChip extends StatelessWidget {
  const DistanceChip({super.key, required this.driver, required this.customer});

  final Coords? driver;
  final TaskCustomer customer;

  @override
  Widget build(BuildContext context) {
    final label = distanceLabel(driver, customer.locationLat, customer.locationLng);
    if (label == null) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.navy50,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.near_me, size: 12, color: AppColors.navy600),
          const SizedBox(width: 3),
          Text(label,
              style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navy600)),
        ],
      ),
    );
  }
}

/// أيقونة نوع الطلب.
IconData orderKindIcon(RefillOrderKind kind) {
  switch (kind) {
    case RefillOrderKind.refill:
      return Icons.water_drop;
    case RefillOrderKind.tankDelivery:
      return Icons.local_shipping;
    case RefillOrderKind.tankReclaim:
      return Icons.assignment_return;
    case RefillOrderKind.walkinSale:
      return Icons.point_of_sale;
  }
}
