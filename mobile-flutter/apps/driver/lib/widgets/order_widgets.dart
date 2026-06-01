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
