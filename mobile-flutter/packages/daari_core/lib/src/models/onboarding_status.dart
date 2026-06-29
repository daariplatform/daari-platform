import 'parse.dart';

/// حالة قائمة تهيئة المعمل (onboarding) — `GET /plant/onboarding/status`.
/// تُشتقّ القيم من صفوف المستأجِر/الزبون/السائق الموجودة (لا جدول حالة مخصّص).
class OnboardingStatus {
  const OnboardingStatus({
    required this.plantInfoComplete,
    required this.firstCustomerAdded,
    required this.firstDriverHired,
    required this.refillPriceSet,
    required this.workingHoursSet,
    required this.allComplete,
    required this.skipped,
    this.skippedAt,
  });

  final bool plantInfoComplete;
  final bool firstCustomerAdded;
  final bool firstDriverHired;
  final bool refillPriceSet;
  final bool workingHoursSet;

  /// اكتملت كل خطوات التهيئة.
  final bool allComplete;

  /// تخطّى المالك التهيئة.
  final bool skipped;
  final DateTime? skippedAt;

  factory OnboardingStatus.fromJson(Map<String, dynamic> json) {
    return OnboardingStatus(
      plantInfoComplete: json['plantInfoComplete'] == true,
      firstCustomerAdded: json['firstCustomerAdded'] == true,
      firstDriverHired: json['firstDriverHired'] == true,
      refillPriceSet: json['refillPriceSet'] == true,
      workingHoursSet: json['workingHoursSet'] == true,
      allComplete: json['allComplete'] == true,
      skipped: json['skipped'] == true,
      skippedAt: P.date(json['skippedAt']),
    );
  }
}
