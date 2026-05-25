import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-store';
import { startShiftTracking } from '@/lib/location';

export default function DriverLogin() {
  const router = useRouter();
  const { loginWithPassword, loginAsDemo, loading } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [hidden, setHidden] = useState(true);
  const [phoneFocus, setPhoneFocus] = useState(false);
  const [passFocus, setPassFocus] = useState(false);

  // زر التجربة الديمو يظهر في dev builds + لو الـ env متهيّأ.
  const showDemoButton = process.env.EXPO_PUBLIC_DEMO_MODE === 'true' || __DEV__;
  const canSubmit = /^07\d{9}$/.test(phone) && password.length >= 6;

  async function onSubmit() {
    if (!canSubmit) {
      Alert.alert('بيانات ناقصة', 'أدخل رقم هاتفك (11 رقم) وكلمة المرور (6 أحرف على الأقل)');
      return;
    }
    try {
      await loginWithPassword(phone, password);
      // ابدأ background GPS tracking — كل ٣٠ ثانية يُرسل الموقع للـ backend.
      // يفشل بصمت لو رفض الزبون إذن الموقع — الـ logs تذكره لاحقاً.
      startShiftTracking().catch(() => {});
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      if (status === 429) {
        Alert.alert('محاولات كثيرة', 'تجاوزت الحد، حاول بعد ١٥ دقيقة.');
      } else if (status === 401) {
        Alert.alert('بيانات غير صحيحة', 'تواصل مع المعمل لإعادة تعيين كلمة المرور');
      } else {
        Alert.alert('فشل تسجيل الدخول', msg ?? 'تحقق من بياناتك');
      }
    }
  }

  return (
    <LinearGradient
      colors={['#7dd3fc', '#38bdf8', '#0ea5e9']}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <View className="flex-1 px-6 pt-10 pb-8">
            {/* بعد إزالة role picker، الشاشة دي هي الأولى — لا نحتاج زر رجوع */}

            {/* Animated Hero */}
            <View className="items-center mb-6">
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.35)',
                  marginBottom: 12,
                }}
              >
                <MaterialIcons name="local-shipping" size={44} color="#fff" />
              </View>
              <Text className="text-white text-2xl font-bold">سائق معمل</Text>
              <Text className="text-sky-100 text-xs mt-1">دخول بالبيانات من المعمل</Text>
            </View>

            {/* Glass card */}
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.97)',
                borderRadius: 28,
                padding: 22,
                shadowColor: '#001233',
                shadowOffset: { width: 0, height: 14 },
                shadowOpacity: 0.3,
                shadowRadius: 24,
                elevation: 14,
              }}
            >
              <Text className="text-slate-900 text-xl font-bold mb-1 text-right">
                تسجيل الدخول
              </Text>
              <Text className="text-slate-500 text-xs mb-5 text-right leading-5">
                استخدم رقم الهاتف وكلمة المرور التي زوّدك بها معمل المياه
              </Text>

              {/* Phone */}
              <Text className="text-slate-700 text-sm mb-2 text-right">رقم الهاتف</Text>
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  borderWidth: 2,
                  borderColor: phoneFocus ? '#0284c7' : '#e2e8f0',
                  borderRadius: 16,
                  marginBottom: 14,
                  paddingHorizontal: 12,
                  backgroundColor: phoneFocus ? '#ffffff' : '#f8fafc',
                }}
              >
                <MaterialIcons
                  name="phone-iphone"
                  size={22}
                  color={phoneFocus ? '#0284c7' : '#94a3b8'}
                />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  onFocus={() => setPhoneFocus(true)}
                  onBlur={() => setPhoneFocus(false)}
                  placeholder="07XXXXXXXXX"
                  keyboardType="phone-pad"
                  maxLength={11}
                  autoComplete="tel"
                  className="flex-1 px-3 py-3.5 text-base text-right"
                  placeholderTextColor="#cbd5e1"
                />
              </View>

              {/* Password */}
              <Text className="text-slate-700 text-sm mb-2 text-right">كلمة المرور</Text>
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  borderWidth: 2,
                  borderColor: passFocus ? '#0284c7' : '#e2e8f0',
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  backgroundColor: passFocus ? '#ffffff' : '#f8fafc',
                }}
              >
                <MaterialIcons
                  name="lock-outline"
                  size={22}
                  color={passFocus ? '#0284c7' : '#94a3b8'}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPassFocus(true)}
                  onBlur={() => setPassFocus(false)}
                  placeholder="••••••"
                  secureTextEntry={hidden}
                  autoComplete="password"
                  className="flex-1 px-3 py-3.5 text-base text-right"
                  placeholderTextColor="#cbd5e1"
                />
                <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} style={{ padding: 6 }}>
                  <MaterialIcons
                    name={hidden ? 'visibility' : 'visibility-off'}
                    size={22}
                    color={!hidden ? '#0284c7' : '#94a3b8'}
                  />
                </Pressable>
              </View>

              {/* Submit */}
              <Pressable
                onPress={onSubmit}
                disabled={loading || !canSubmit}
                style={{ marginTop: 22 }}
              >
                {canSubmit && !loading ? (
                  <LinearGradient
                    colors={['#38bdf8', '#0ea5e9', '#0284c7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 16,
                      paddingVertical: 16,
                      alignItems: 'center',
                      shadowColor: '#0ea5e9',
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.35,
                      shadowRadius: 16,
                    }}
                  >
                    <Text className="text-white font-bold text-base">دخول</Text>
                  </LinearGradient>
                ) : (
                  <View
                    style={{
                      borderRadius: 16,
                      paddingVertical: 16,
                      alignItems: 'center',
                      backgroundColor: '#cbd5e1',
                    }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-bold text-base">دخول</Text>
                    )}
                  </View>
                )}
              </Pressable>

              <Pressable
                onPress={() => router.push('/(auth)/forgot' as any)}
                className="mt-4 items-center"
              >
                <Text className="text-sky-700 text-[12px] font-bold">
                  نسيت كلمة المرور؟
                </Text>
              </Pressable>

              <View className="mt-3 pt-3 border-t border-slate-100 flex-row items-start gap-2">
                <MaterialIcons name="info-outline" size={16} color="#0284c7" />
                <Text className="flex-1 text-slate-500 text-[11px] text-right leading-5">
                  لم تستلم بيانات الدخول؟ تواصل مع صاحب معملك ليفتح لك حساباً من اللوحة.
                </Text>
              </View>
            </View>

            {showDemoButton && (
              <Pressable
                onPress={() => {
                  loginAsDemo();
                  router.replace('/(tabs)/home');
                }}
                className="mt-4 bg-white/15 rounded-xl py-3 items-center border border-white/40"
              >
                <Text className="text-white font-bold text-sm">تجربة بدون تسجيل</Text>
                <Text className="text-sky-100 text-[10px] mt-0.5">
                  وضع العرض — بيانات وهمية بدون اتصال بالمعمل
                </Text>
              </Pressable>
            )}

            {/* Quick-login for dev/simulator testing — types into the form
                fields are flaky on iOS Simulator with Arabic input mode, so
                this button lets us hit the production API as كريم with one
                tap. Visible only in __DEV__ builds (stripped from prod). */}
            {__DEV__ && (
              <Pressable
                onPress={async () => {
                  try {
                    await loginWithPassword('07700000002', 'password123');
                    startShiftTracking().catch(() => {});
                    router.replace('/(tabs)/home');
                  } catch (err: any) {
                    Alert.alert(
                      'فشل الدخول السريع',
                      err?.response?.data?.message ?? 'تحقق من الاتصال بـ api.phi-bit.com',
                    );
                  }
                }}
                className="mt-2 bg-emerald-500/30 rounded-xl py-3 items-center border border-emerald-300/50"
              >
                <Text className="text-white font-bold text-sm">⚡️ دخول سريع — كريم السائق</Text>
                <Text className="text-emerald-50 text-[10px] mt-0.5">
                  للتطوير فقط — يستخدم بيانات الإنتاج الحقيقية
                </Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
