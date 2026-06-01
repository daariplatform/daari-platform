import 'parse.dart';

/// حملة تخفيض نشطة لمعمل الزبون — مطابق لـ `ActivePromo` في queries.ts.
/// `GET /customers/me/active-promo` (قد يرجع null = لا حملة).
class ActivePromo {
  const ActivePromo({
    required this.id,
    required this.originalPriceIqd,
    required this.promoPriceIqd,
    required this.secondsRemaining,
    this.endAt,
  });

  final String id;
  final int originalPriceIqd;
  final int promoPriceIqd;
  final int secondsRemaining;
  final DateTime? endAt;

  int get savingIqd => originalPriceIqd - promoPriceIqd;

  int get discountPercent =>
      originalPriceIqd <= 0 ? 0 : (savingIqd * 100 / originalPriceIqd).round();

  factory ActivePromo.fromJson(Map<String, dynamic> json) {
    return ActivePromo(
      id: P.str(json['id']),
      originalPriceIqd: P.intv(json['originalPriceIqd']),
      promoPriceIqd: P.intv(json['promoPriceIqd']),
      secondsRemaining: P.intv(json['secondsRemaining']),
      endAt: P.date(json['endAt']),
    );
  }
}
