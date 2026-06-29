import 'package:local_auth/local_auth.dart';

/// مصادقة بيومترية (بصمة/وجه) — غلاف رقيق حول `local_auth`
/// (مكافئ `mobile-admin/lib/biometric.ts`).
///
/// إنها **بوّابة UX** تؤكّد حضور صاحب الجهاز قبل فتح جلسةٍ محفوظة؛ التوكنات
/// نفسها محميّة أصلاً في التخزين الآمن (Keychain/Keystore). لا ترمي أبداً —
/// أي فشل يعني «استعمل كلمة السر».
class BiometricService {
  BiometricService._();

  static final LocalAuthentication _auth = LocalAuthentication();

  /// هل الجهاز يدعم البصمة/الوجه وللمستخدم بصمة مُسجَّلة فعلاً؟
  static Future<bool> isAvailable() async {
    try {
      if (!await _auth.isDeviceSupported()) return false;
      final types = await _auth.getAvailableBiometrics();
      return types.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /// اسم عربي لنوع البصمة المتاح (لنصّ الأزرار والعروض).
  static Future<String> label() async {
    try {
      final types = await _auth.getAvailableBiometrics();
      if (types.contains(BiometricType.face)) return 'التعرّف على الوجه';
      if (types.contains(BiometricType.fingerprint)) return 'بصمة الإصبع';
      if (types.contains(BiometricType.iris)) return 'بصمة العين';
    } catch (_) {
      // تجاهل — نُرجِع التسمية العامة أدناه.
    }
    return 'التعرّف البيومتري';
  }

  /// يشغّل مُطالبة النظام. يرجّع `true` عند النجاح و`false` عند الإلغاء/الفشل.
  /// `biometricOnly: false` يسمح ببديل قفل الجهاز (PIN) إن تعذّرت البصمة.
  static Future<bool> authenticate(String reason) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false,
        ),
      );
    } catch (_) {
      return false;
    }
  }
}
