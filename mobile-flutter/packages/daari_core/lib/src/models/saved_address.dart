import 'parse.dart';

/// تسمية العنوان — البيت / العمل / مخصّص. يحدّد أيقونة العرض.
enum AddressLabel {
  home('HOME', 'البيت'),
  work('WORK', 'العمل'),
  custom('CUSTOM', 'مخصص');

  const AddressLabel(this.value, this.text);
  final String value;
  final String text;

  /// الباك إند يخزّن نصّاً حرّاً واحداً (`label`)؛ نشتقّ التعداد منه للأيقونة
  /// — مطابق لـ `deriveLabel` في features/addresses.ts.
  static AddressLabel derive(String raw) {
    final lower = raw.toLowerCase();
    if (raw.contains('بيت') || lower.contains('home')) return AddressLabel.home;
    if (raw.contains('عمل') || raw.contains('شغل') || lower.contains('work')) {
      return AddressLabel.work;
    }
    return AddressLabel.custom;
  }
}

/// عنوان محفوظ — مطابق لـ `SavedAddress` في features/addresses.ts.
///
/// الباك إند يخزّن `label` نصّياً واحداً؛ نترجم على هذه الحدود:
///  - قراءة: `label` (نص) → `title` + تعداد مشتقّ للأيقونة.
///  - كتابة: نطوي {enum,title} إلى نصّ `label` واحد ونحذف الإحداثيات null.
class SavedAddress {
  const SavedAddress({
    required this.id,
    required this.label,
    required this.title,
    required this.addressLine,
    required this.isDefault,
    this.district,
    this.lat,
    this.lng,
    this.createdAt,
  });

  final String id;
  final AddressLabel label;

  /// النص الحرّ الذي كتبه الزبون (هو `label` الخام في الباك إند).
  final String title;
  final String addressLine;
  final bool isDefault;
  final String? district;
  final double? lat;
  final double? lng;
  final DateTime? createdAt;

  bool get hasPin => lat != null && lng != null;

  factory SavedAddress.fromJson(Map<String, dynamic> json) {
    final rawLabel = P.str(json['label']);
    return SavedAddress(
      id: P.str(json['id']),
      label: AddressLabel.derive(rawLabel),
      title: rawLabel,
      addressLine: P.str(json['addressLine']),
      isDefault: json['isDefault'] == true,
      district: json['district'] as String?,
      lat: json['lat'] == null ? null : P.dbl(json['lat']),
      lng: json['lng'] == null ? null : P.dbl(json['lng']),
      createdAt: P.date(json['createdAt']),
    );
  }
}

/// مدخلات إنشاء/تعديل عنوان (بلا id — صالحة للحالتين).
class AddressInput {
  const AddressInput({
    required this.label,
    required this.title,
    required this.addressLine,
    this.district,
    this.lat,
    this.lng,
  });

  final AddressLabel label;
  final String title;
  final String addressLine;
  final String? district;
  final double? lat;
  final double? lng;

  /// يبني جسماً صالحاً للباك إند (label غير فارغ + district مطلوب + حذف
  /// الإحداثيات null لأن الباك إند يرفضها) — مطابق لـ `toBackend` في Expo.
  Map<String, dynamic> toJson() {
    final cleanTitle = title.trim();
    final body = <String, dynamic>{
      'label': cleanTitle.isNotEmpty ? cleanTitle : label.text,
      'addressLine': addressLine,
      'district': (district?.trim().isNotEmpty ?? false)
          ? district!.trim()
          : 'غير محدد',
    };
    if (lng != null) body['lng'] = lng;
    if (lat != null) body['lat'] = lat;
    return body;
  }
}
