import 'parse.dart';

/// تقييم طلب — مطابق لـ `OrderRating` في features/ratings.ts.
/// `POST /orders/:id/rate` ويأتي مضمَّناً في `GET /orders/:id`.
class OrderRating {
  const OrderRating({
    required this.id,
    required this.stars,
    this.comment,
    this.createdAt,
  });

  final String id;
  final int stars;
  final String? comment;
  final DateTime? createdAt;

  factory OrderRating.fromJson(Map<String, dynamic> json) {
    return OrderRating(
      id: P.str(json['id']),
      stars: P.intv(json['stars']),
      comment: json['comment'] as String?,
      createdAt: P.date(json['createdAt']),
    );
  }
}
