import 'package:url_launcher/url_launcher.dart';

/// روابط خارجية: اتصال هاتفي، واتساب، وملاحة خارجية (خرائط Google).
/// بديل `Linking` في React Native.
class Launchers {
  Launchers._();

  /// اتصال هاتفي. يُرجِع false إن تعذّر فتح التطبيق المناسب.
  static Future<bool> call(String phone) =>
      _open(Uri(scheme: 'tel', path: _clean(phone)));

  /// فتح محادثة واتساب. [phone] محلّي (07..) أو دولي.
  static Future<bool> whatsapp(String phone, {String? text}) {
    final intl = _toIntl(phone);
    final query = text != null ? '?text=${Uri.encodeComponent(text)}' : '';
    return _open(Uri.parse('https://wa.me/$intl$query'));
  }

  /// فتح بريد إلكتروني (mailto) مع موضوع/نصّ اختياريين.
  static Future<bool> email(String to, {String? subject, String? body}) {
    final params = <String>[];
    if (subject != null) params.add('subject=${Uri.encodeComponent(subject)}');
    if (body != null) params.add('body=${Uri.encodeComponent(body)}');
    final query = params.isEmpty ? '' : '?${params.join('&')}';
    return _open(Uri.parse('mailto:$to$query'));
  }

  /// فتح الملاحة الخارجية إلى وجهة (خرائط Google).
  static Future<bool> navigate({required double lat, required double lng}) {
    return _open(
      Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng'),
    );
  }

  /// فتح رابط خارجي عام (الشروط / الخصوصية / الأسئلة).
  static Future<bool> openUrl(String url) => _open(Uri.parse(url));

  static Future<bool> _open(Uri uri) async {
    if (await canLaunchUrl(uri)) {
      return launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    return false;
  }

  static String _clean(String phone) => phone.replaceAll(RegExp(r'[^\d+]'), '');

  /// 07XXXXXXXXX → 9647XXXXXXXXX (E.164 العراق).
  static String _toIntl(String phone) {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('07')) return '964${digits.substring(1)}';
    if (digits.startsWith('964')) return digits;
    return digits;
  }
}
