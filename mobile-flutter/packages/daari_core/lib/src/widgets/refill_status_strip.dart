import 'package:flutter/material.dart';

import '../format/format.dart';
import '../theme/app_colors.dart';

/// شريط حالة دورة التعبئة — بديل `RefillStatusStrip.tsx`.
///
/// يحسب الأيام المتبقية حتى الموعد الإلزامي (٣٠ يوماً من آخر تعبئة) ويُظهر للزبون
/// موقعه في الدورة بدل التخمين. أربع حالات: جيد (≥١٤ متبقي) · تنبيه (٥–١٣) ·
/// عاجل (<٥ أو متأخر) · زبون جديد (لا تعبئة بعد). مُكيَّف للعرض على خلفية بيضاء
/// (بطاقة ملوّنة خفيفة بدل النص الأبيض داخل الهيدر).
class RefillStatusStrip extends StatelessWidget {
  const RefillStatusStrip({super.key, required this.lastRefillAt});

  /// آخر تعبئة. null = زبون جديد.
  final DateTime? lastRefillAt;

  static const _cycleDays = 30;
  static const _warnThreshold = 14;
  static const _urgentThreshold = 5;

  @override
  Widget build(BuildContext context) {
    final last = lastRefillAt;
    if (last == null) {
      return _shell(
        color: AppColors.turquoise500,
        label: 'زبون جديد',
        icon: Icons.water_drop,
        child: const Text(
          'مرحباً بك — اطلب تعبئتك الأولى',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
        ),
      );
    }

    final daysSince = DateTime.now().difference(last).inDays;
    final daysUntilDue = _cycleDays - daysSince;
    final dueDate = last.add(const Duration(days: _cycleDays));
    final progress = (daysSince / _cycleDays).clamp(0.0, 1.0);

    final Color color;
    final String label;
    final IconData icon;
    if (daysUntilDue >= _warnThreshold) {
      color = AppColors.success;
      label = 'بحالة جيدة';
      icon = Icons.check_circle_outline;
    } else if (daysUntilDue >= _urgentThreshold) {
      color = AppColors.warn500;
      label = 'تنبيه';
      icon = Icons.schedule;
    } else {
      color = AppColors.danger;
      label = 'عاجل';
      icon = Icons.warning_amber_rounded;
    }

    final overdue = daysUntilDue < 0;
    return _shell(
      color: color,
      label: label,
      icon: icon,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            textBaseline: TextBaseline.alphabetic,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            children: [
              Text(
                overdue ? '−${daysUntilDue.abs()}' : '$daysUntilDue',
                style: TextStyle(
                    color: color, fontWeight: FontWeight.w900, fontSize: 30,),
              ),
              const SizedBox(width: 6),
              Text(
                overdue
                    ? 'أيام تأخير'
                    : (daysUntilDue == 1
                        ? 'يوم متبقٍّ'
                        : 'أيام متبقية قبل الموعد'),
                style: const TextStyle(color: AppColors.slate, fontSize: 12.5),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: progress),
              duration: const Duration(milliseconds: 900),
              curve: Curves.easeOutCubic,
              builder: (_, value, __) => LinearProgressIndicator(
                value: value,
                minHeight: 6,
                backgroundColor: color.withValues(alpha: 0.15),
                valueColor: AlwaysStoppedAnimation(color),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('آخر تعبئة: قبل $daysSince يوم',
                  style:
                      const TextStyle(color: AppColors.muted, fontSize: 10.5),),
              Text(
                overdue
                    ? 'تخطّيت الموعد ${Fmt.arabicDate(dueDate)}'
                    : 'الموعد: ${Fmt.arabicDate(dueDate)}',
                style: const TextStyle(color: AppColors.muted, fontSize: 10.5),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _shell({
    required Color color,
    required String label,
    required IconData icon,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.history, size: 16, color: AppColors.slate),
                  const SizedBox(width: 6),
                  const Text('حالتك مع المعمل',
                      style: TextStyle(
                          color: AppColors.slate,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,),),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  children: [
                    Icon(icon, size: 12, color: color),
                    const SizedBox(width: 3),
                    Text(label,
                        style: TextStyle(
                            color: color,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,),),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}
