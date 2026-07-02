import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// تخزين آمن للتوكنات (بديل expo-secure-store: iOS Keychain / Android Keystore).
/// نفس المفاتيح المستعملة في تطبيقات Expo للاستمرارية.
class TokenStorage {
  TokenStorage([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _storage;

  static const _kAccess = 'maa.access';
  static const _kRefresh = 'maa.refresh';

  Future<String?> getAccessToken() => _storage.read(key: _kAccess);
  Future<String?> getRefreshToken() => _storage.read(key: _kRefresh);

  Future<void> setTokens({
    required String access,
    required String refresh,
  }) async {
    await _storage.write(key: _kAccess, value: access);
    await _storage.write(key: _kRefresh, value: refresh);
  }

  Future<void> clear() async {
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
  }

  Future<bool> hasSession() async => (await getAccessToken()) != null;
}
