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
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-store';
import { hap } from '@/lib/haptics';
import { AnimatedLogo } from '@/components/AnimatedLogo';
import { RainBackground } from '@/components/RainBackground';

/**
 * Login screen — sky-blue gradient + animated water drop logo + rain bg + haptics.
 */
export default function LoginScreen() {
  const router = useRouter();
  const { login, loginAsDemo, loading } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phoneFocus, setPhoneFocus] = useState(false);
  const [passFocus, setPassFocus] = useState(false);

  // زر "تجربة بدون تسجيل" يظهر في dev builds فقط — لكن submit() يستعمل
  // login() الحقيقي **دائماً**. الفصل مهم: لو خلطنا الزرّين، الزبون ما
  // يقدر يدخل بحسابه الحقيقي في Debug build.
  const showDemoButton = process.env.EXPO_PUBLIC_DEMO_MODE === 'true' || __DEV__;
  const canSubmit = /^07\d{9}$/.test(phone) && password.length >= 6;

  async function submit() {
    if (!canSubmit) {
      hap.error();
      Alert.alert('بيانات ناقصة', 'أدخل رقم هاتفك (11 رقم) وكلمة المرور (6 أحرف على الأقل)');
      return;
    }
    hap.press();
    try {
      await login(phone, password);
      hap.success();
      router.replace('/(tabs)/home');
    } catch (err: any) {
      hap.error();
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      if (status === 429) {
        Alert.alert('محاولات كثيرة', 'تجاوزت الحد، حاول بعد ١٥ دقيقة.');
      } else if (status === 401) {
        Alert.alert('بيانات غير صحيحة', 'تواصل مع معمل المياه لإعادة تعيين كلمة المرور');
      } else {
        Alert.alert('فشل تسجيل الدخول', msg ?? 'حاول مرة أخرى');
      }
    }
  }

  return (
    <LinearGradient
      // ألوان فاتحة (sky bright)، ٣ ستوبات بدل ٤، توحّد مع الـ home
      colors={['#7dd3fc', '#38bdf8', '#0ea5e9']}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* Rain animation behind content */}
      <RainBackground density="medium" />

      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <View className="flex-1 px-6 pt-6 pb-8 justify-center">
            {/* Animated Hero */}
            <MotiView
              from={{ opacity: 0, translateY: -20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 700 }}
              style={{ alignItems: 'center', marginBottom: 36 }}
            >
              <AnimatedLogo size={100} showText={true} textColor="#ffffff" />
              <Text className="text-sky-100 text-sm mt-2">خدمات منزلك بضغطة زر</Text>
            </MotiView>

            {/* Glass card */}
            <MotiView
              from={{ opacity: 0, translateY: 30 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 700, delay: 300 }}
              style={{
                backgroundColor: 'rgba(255,255,255,0.97)',
                borderRadius: 32,
                padding: 26,
                shadowColor: '#001233',
                shadowOffset: { width: 0, height: 16 },
                shadowOpacity: 0.35,
                shadowRadius: 28,
                elevation: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.6)',
              }}
            >
              <Text className="text-slate-900 text-2xl font-bold mb-1 text-right" style={{ letterSpacing: -0.5 }}>
                تسجيل الدخول
              </Text>
              <Text className="text-slate-500 text-xs mb-5 text-right leading-5">
                استخدم رقم الهاتف وكلمة المرور التي زوّدك بها معمل المياه
              </Text>

              {/* Phone field */}
              <Text className="text-slate-700 text-sm mb-2 text-right">رقم الهاتف</Text>
              <MotiView
                animate={{
                  borderColor: phoneFocus ? '#0284c7' : '#e2e8f0',
                  backgroundColor: phoneFocus ? '#ffffff' : '#f8fafc',
                }}
                transition={{ type: 'timing', duration: 180 }}
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  borderWidth: 2,
                  borderRadius: 16,
                  marginBottom: 14,
                  paddingHorizontal: 12,
                }}
              >
                <MaterialIcons
                  name="phone-iphone"
                  size={22}
                  color={phoneFocus ? '#0284c7' : '#94a3b8'}
                />
                <TextInput
                  value={phone}
                  onChangeText={(v) => {
                    setPhone(v);
                    if (v.length === 11) hap.tap();
                  }}
                  onFocus={() => {
                    setPhoneFocus(true);
                    hap.tap();
                  }}
                  onBlur={() => setPhoneFocus(false)}
                  placeholder="07XXXXXXXXX"
                  keyboardType="phone-pad"
                  maxLength={11}
                  autoComplete="tel"
                  className="flex-1 px-3 py-3.5 text-base text-right"
                  placeholderTextColor="#cbd5e1"
                />
              </MotiView>

              {/* Password field */}
              <Text className="text-slate-700 text-sm mb-2 text-right">كلمة المرور</Text>
              <MotiView
                animate={{
                  borderColor: passFocus ? '#0284c7' : '#e2e8f0',
                  backgroundColor: passFocus ? '#ffffff' : '#f8fafc',
                }}
                transition={{ type: 'timing', duration: 180 }}
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  borderWidth: 2,
                  borderRadius: 16,
                  paddingHorizontal: 12,
                }}
              >
                <MaterialIcons name="lock-outline" size={22} color={passFocus ? '#0284c7' : '#94a3b8'} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => {
                    setPassFocus(true);
                    hap.tap();
                  }}
                  onBlur={() => setPassFocus(false)}
                  placeholder="••••••"
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  className="flex-1 px-3 py-3.5 text-base text-right"
                  placeholderTextColor="#cbd5e1"
                />
                <Pressable
                  onPress={() => {
                    setShowPassword((v) => !v);
                    hap.tap();
                  }}
                  hitSlop={10}
                  style={{ padding: 6 }}
                >
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={22}
                    color={showPassword ? '#0284c7' : '#94a3b8'}
                  />
                </Pressable>
              </MotiView>

              {/* Login button with scale animation */}
              <PressableScale
                onPress={submit}
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
                    <Text className="text-white font-bold text-base" style={{ letterSpacing: 0.5 }}>دخول</Text>
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
              </PressableScale>

              <Pressable
                onPress={() => router.push('/(auth)/forgot' as any)}
                className="mt-4 items-center"
              >
                <Text className="text-sky-700 text-[12px] font-bold">
                  نسيت كلمة المرور؟
                </Text>
              </Pressable>

              <View className="mt-3 pt-3 border-t border-slate-100">
                <Text className="text-slate-500 text-[11px] text-center leading-5">
                  ليس عندك حساب؟ تواصل مع معمل المياه التابع لك ليُنشئ لك حساباً.
                </Text>
              </View>
            </MotiView>

            {showDemoButton && (
              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'timing', delay: 700 }}
              >
                <Pressable
                  onPress={() => {
                    hap.press();
                    loginAsDemo();
                    router.replace('/(tabs)/home');
                  }}
                  className="mt-5 bg-white/10 rounded-2xl py-3 items-center border border-white/30"
                >
                  <Text className="text-white font-bold text-sm">تجربة بدون تسجيل</Text>
                </Pressable>
              </MotiView>
            )}

            <Text className="text-sky-100 text-[11px] text-center mt-6 leading-5">
              باستخدامك التطبيق توافق على{' '}
              <Text className="underline">الشروط والأحكام</Text> و{' '}
              <Text className="underline">سياسة الخصوصية</Text>
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function PressableScale({
  onPress,
  disabled,
  style,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  style?: any;
  children: React.ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <MotiView
      animate={{ scale: pressed ? 0.96 : 1 }}
      transition={{ type: 'timing', duration: 120 }}
      style={style}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        disabled={disabled}
      >
        {children}
      </Pressable>
    </MotiView>
  );
}
