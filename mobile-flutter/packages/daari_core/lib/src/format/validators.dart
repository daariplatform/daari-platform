/// تحقّقات إدخال مشتركة — موحّدة بين الزبون والسائق.
class Validators {
  Validators._();

  /// رقم عراقي: 07 يتبعه 9 أرقام (07XXXXXXXXX). يطابق DTO الباك إند.
  static final RegExp iraqiPhone = RegExp(r'^07\d{9}$');

  static bool isPhone(String v) => iraqiPhone.hasMatch(v.trim());

  /// كلمة سر: 6 محارف على الأقل (يطابق @MinLength(6) في الباك إند).
  static bool isPassword(String v) => v.length >= 6;

  static bool isOtp(String v) => RegExp(r'^\d{6}$').hasMatch(v.trim());
}
