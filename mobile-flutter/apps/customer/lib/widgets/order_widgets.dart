import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';

/// لون حالة الطلب (متّسق مع نظام الألوان).
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

/// شارة حالة الطلب.
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
      child: Text(
        status.label,
        style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12.5),
      ),
    );
  }
}

/// أيقونة تمثّل حالة الطلب (للمؤشّر البصري الملوّن في بطاقة الطلب).
IconData orderStatusIcon(RefillOrderStatus s) {
  switch (s) {
    case RefillOrderStatus.pending:
      return Icons.schedule;
    case RefillOrderStatus.assigned:
      return Icons.person_outline;
    case RefillOrderStatus.enRoute:
      return Icons.local_shipping;
    case RefillOrderStatus.completed:
      return Icons.check_circle;
    case RefillOrderStatus.cancelled:
      return Icons.cancel_outlined;
    case RefillOrderStatus.failed:
      return Icons.error_outline;
  }
}
