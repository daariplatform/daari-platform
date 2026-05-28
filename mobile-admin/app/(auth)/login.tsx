import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, WrongRoleError } from '@/lib/auth-store';
import {
  enableBiometricUnlock,
  getBiometricLabel,
  isBiometricAvailable,
  isBiometricUnlockEnabled,
  tryBiometricUnlock,
} from '@/lib/biometric';
import { getRefreshToken } from '@/lib/tokens';

/**
 * Plant-admin login. Same backend endpoint as the customer + driver apps —
 * the auth-store rejects non-admin roles after a successful login, so an
 * end customer (or driver) trying this app gets a clear "you're in the
 * wrong app" message instead of an empty dashboard.
 */
export default function AdminLogin() {
  const router = useRouter();
  const { loginWithPassword, loginAsDemo, loading, hydrate } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Biometric tracks: do we offer a "use Face ID" button at the top of
  // the screen on cold-start? (Yes if the user opted in last session.)
  const [biometricLabel, setBiometricLabel] = useState<string | null>(null);

  // Cold-start biometric attempt — if the user previously enabled it,
  // run the prompt automatically. Success = re-hydrate the session
  // from the SecureStore tokens and let the root layout route us into
  // (tabs)/home, no password needed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enabled = await isBiometricUnlockEnabled();
      const hasToken = !!(await getRefreshToken());
      const available = await isBiometricAvailable();
      if (!enabled || !hasToken || !available) return;
      const label = await getBiometricLabel();
      if (cancelled) return;
      setBiometricLabel(label);
      // Auto-prompt on cold open. If the user cancels, they can still
      // hit the explicit button — `setBiometricLabel` keeps the UI.
      const ok = await tryBiometricUnlock();
      if (ok && !cancelled) {
        await hydrate();
      }
    })();
    return () => {
      cancelled = true;
    };
    // hydrate is stable; we only want this on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reAttemptBiometric() {
    const ok = await tryBiometricUnlock();
    if (ok) await hydrate();
  }

  async function offerBiometricEnrolment(name: string) {
    const available = await isBiometricAvailable();
    if (!available) return;
    const label = await getBiometricLabel();
    Alert.alert(
      `تفعيل ${label}؟`,
      `بعد التفعيل، تقدر تدخل ${name} بدون كلمة المرور في المرة الجاية.`,
      [
        { text: 'لاحقاً', style: 'cancel' },
        {
          text: 'تفعيل',
          onPress: async () => {
            // Confirm by asking for one biometric scan now — this
            // ensures the device's biometric is working AND the user
            // is the one enabling it.
            const { promptBiometric } = await import('@/lib/biometric');
            const ok = await promptBiometric('أكّد بصمتك لتفعيل الدخول السريع');
            if (ok) await enableBiometricUnlock();
          },
        },
      ],
    );
  }

  async function onSubmit() {
    setError(null);
    if (!/^07\d{9}$/.test(phone)) {
      setError('أدخل رقم بصيغة 07XXXXXXXXX');
      return;
    }
    if (password.length < 6) {
      setError('كلمة المرور قصيرة جداً');
      return;
    }
    try {
      await loginWithPassword(phone, password);
      // Routing back to (tabs)/home is handled by the root layout effect
      // once `user` changes, so no manual router.push here.

      // First-time enrolment — offer biometric only if NOT already
      // enabled and the device supports it. The prompt won't show on
      // every login, just the first.
      const alreadyEnabled = await isBiometricUnlockEnabled();
      if (!alreadyEnabled) {
        offerBiometricEnrolment('داري للمعمل').catch(() => {});
      }
    } catch (err: any) {
      if (err instanceof WrongRoleError) {
        setError(
          'هذا الحساب ليس لمالك معمل. حمّل تطبيق "داري" للزبون أو تطبيق السائق حسب دورك.',
        );
        return;
      }
      const msg =
        err?.response?.data?.message ??
        (err?.response?.status === 401
          ? 'رقم الهاتف أو كلمة المرور غير صحيحة'
          : 'تعذّر تسجيل الدخول. تحقّق من اتصالك بالإنترنت.');
      setError(msg);
    }
  }

  const showDemo = __DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

  return (
    <LinearGradient
      colors={['#14b8a6', '#0e9384', '#0c7a6e']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Brand */}
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.35)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <MaterialIcons name="business" size={42} color="#fff" />
              </View>
              <Text className="text-white text-3xl font-bold">داري للمعمل</Text>
              <Text className="text-teal-50 text-sm mt-2 text-center" style={{ opacity: 0.92 }}>
                لوحة معلومات معملك في جيبك
              </Text>
            </View>

            {/* Card */}
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 24,
                padding: 24,
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.18,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <Text className="text-slate-900 text-lg font-bold mb-1 text-right">
                تسجيل دخول المالك
              </Text>
              <Text className="text-slate-500 text-xs mb-5 text-right">
                استخدم نفس بيانات تسجيلك في لوحة الويب
              </Text>

              {/* Phone */}
              <Text className="text-slate-700 text-sm mb-1.5 text-right">رقم الهاتف</Text>
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: '#e2e8f0',
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  marginBottom: 14,
                  backgroundColor: '#f8fafc',
                }}
              >
                <MaterialIcons name="phone-iphone" size={18} color="#64748b" />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="07XXXXXXXXX"
                  placeholderTextColor="#cbd5e1"
                  keyboardType="phone-pad"
                  maxLength={11}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    marginEnd: 10,
                    textAlign: 'right',
                    fontSize: 16,
                    color: '#0f172a',
                  }}
                />
              </View>

              {/* Password */}
              <Text className="text-slate-700 text-sm mb-1.5 text-right">كلمة المرور</Text>
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: '#e2e8f0',
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  marginBottom: 8,
                  backgroundColor: '#f8fafc',
                }}
              >
                <MaterialIcons name="lock-outline" size={18} color="#64748b" />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#cbd5e1"
                  secureTextEntry={!showPassword}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    marginEnd: 10,
                    textAlign: 'right',
                    fontSize: 16,
                    color: '#0f172a',
                  }}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color="#94a3b8"
                  />
                </Pressable>
              </View>

              {/* Forgot link */}
              <Pressable
                onPress={() => router.push('/(auth)/forgot' as any)}
                style={{ alignSelf: 'flex-start', marginBottom: 14 }}
                hitSlop={6}
              >
                <Text className="text-teal-700 text-xs underline">نسيت كلمة المرور؟</Text>
              </Pressable>

              {/* Error */}
              {error && (
                <View
                  style={{
                    backgroundColor: '#fef2f2',
                    borderColor: '#fecaca',
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 14,
                  }}
                >
                  <Text className="text-red-700 text-xs text-right" style={{ lineHeight: 18 }}>
                    {error}
                  </Text>
                </View>
              )}

              {/* Biometric quick-unlock — only renders when the user
                  opted in last session AND the device supports it. */}
              {biometricLabel && (
                <Pressable
                  onPress={reAttemptBiometric}
                  style={({ pressed }) => ({
                    marginBottom: 12,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.4)',
                    paddingVertical: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row-reverse',
                    gap: 8,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <MaterialIcons name="fingerprint" size={22} color="#fff" />
                  <Text className="text-white text-base font-bold">
                    {`الدخول بـ ${biometricLabel}`}
                  </Text>
                </Pressable>
              )}

              {/* Submit */}
              <Pressable
                onPress={onSubmit}
                disabled={loading}
                style={({ pressed }) => ({
                  borderRadius: 14,
                  overflow: 'hidden',
                  opacity: loading ? 0.6 : pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <LinearGradient
                  colors={['#0e9384', '#0c7a6e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    paddingVertical: 15,
                    alignItems: 'center',
                    flexDirection: 'row-reverse',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="login" size={18} color="#fff" />
                      <Text className="text-white text-base font-bold">دخول</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              {showDemo && (
                <Pressable
                  onPress={() => loginAsDemo()}
                  style={{
                    marginTop: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    alignItems: 'center',
                  }}
                >
                  <Text className="text-slate-500 text-xs">دخول وضع التجربة (Dev)</Text>
                </Pressable>
              )}
            </View>

            {/* Footer */}
            <View style={{ alignItems: 'center', marginTop: 28 }}>
              <Text className="text-teal-50 text-[11px]" style={{ opacity: 0.85 }}>
                من فاي‑بِت · إصدار 0.1
              </Text>
              <Text className="text-teal-50 text-[10px] mt-1" style={{ opacity: 0.7 }}>
                هذا التطبيق لأصحاب معامل المياه فقط
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
