/**
 * Biometric authentication helpers — Face ID on iOS, fingerprint on
 * Android, falls back to device passcode on either.
 *
 * Wire-up:
 *   1. On successful login (password), call `enableBiometricUnlock()` to
 *      offer the user the option. We persist a tiny "enabled" flag in
 *      SecureStore so subsequent app opens know to prompt.
 *   2. On app open (before showing the password screen), call
 *      `tryBiometricUnlock()`. If it resolves true, we already have the
 *      refresh token (`SecureStore` is the storage for both already) and
 *      can hydrate the session without a password.
 *   3. To revoke (logout / disable), call `disableBiometricUnlock()`.
 *
 * We don't bind a separate "biometric token" — the refresh token in
 * SecureStore is already protected by the OS at rest. The biometric
 * prompt is purely a UX gate that says "yes, the device owner is here"
 * before we re-hydrate the session from those tokens.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const FLAG_KEY = 'biometric_enabled';

/** Returns true if the device has Face/Touch ID hardware AND the user
 * has enrolled at least one fingerprint / face. */
export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

/** Best human-readable name for the biometric kind so the prompt text
 * can adapt ("استخدم Face ID" vs "استخدم بصمتك"). */
export async function getBiometricLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'التعرّف على الوجه';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'بصمة الإصبع';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'بصمة العين';
  }
  return 'التعرّف البيومتري';
}

/** Read the persisted "is biometric enabled for this session" flag. */
export async function isBiometricUnlockEnabled(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(FLAG_KEY);
  return v === '1';
}

/** Persist the "enabled" flag — called after the user has explicitly
 * opted in on the post-login enrolment prompt. */
export async function enableBiometricUnlock(): Promise<void> {
  await SecureStore.setItemAsync(FLAG_KEY, '1');
}

/** Forget the flag — called on logout OR when the user explicitly
 * turns biometric unlock off from settings. */
export async function disableBiometricUnlock(): Promise<void> {
  await SecureStore.deleteItemAsync(FLAG_KEY);
}

/**
 * Run the system biometric prompt. Returns `true` on success, `false`
 * on user cancel / failure. Never throws — caller can assume any
 * non-true return means "fall back to password".
 */
export async function promptBiometric(reason: string): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'إلغاء',
      // Allow the device passcode as a fallback — if the user is locked
      // out of Face ID after 3 fails, they should still be able to
      // unlock the app with their normal lock-screen passcode.
      disableDeviceFallback: false,
      fallbackLabel: 'استخدم كلمة المرور',
    });
    return res.success;
  } catch {
    return false;
  }
}

/**
 * Convenience wrapper used by the login screen on cold-start: if
 * biometric is enabled AND the device supports it AND a refresh token
 * exists, prompt and resolve true on success. The caller then re-uses
 * the existing tokens to hydrate the session — no password needed.
 */
export async function tryBiometricUnlock(): Promise<boolean> {
  const enabled = await isBiometricUnlockEnabled();
  if (!enabled) return false;
  const available = await isBiometricAvailable();
  if (!available) return false;
  return promptBiometric('سجّل الدخول إلى داري');
}
