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
import { useAuth } from '@/lib/auth-store';

/**
 * Phone + password login. Plant admin provisions the account from the
 * dashboard and gives the customer the temp password (verbally or via
 * WhatsApp). Customer can change it later from settings.
 *
 * Future: OTP self-signup will appear behind a "إنشاء حساب جديد" link
 * once we wire a real SMS provider and flip OTP_SELF_SIGNUP_ENABLED on
 * the backend.
 */
export default function LoginScreen() {
  const router = useRouter();
  const { login, loginAsDemo, loading } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
  const canSubmit = /^07\d{9}$/.test(phone) && password.length >= 6;

  async function submit() {
    if (!canSubmit) {
      Alert.alert(
        'بيانات ناقصة',
        'أدخل رقم هاتفك (يبدأ بـ 07 ويتكون من 11 رقماً) وكلمة المرور (6 خانات أو أكثر)',
      );
      return;
    }

    // Demo / no-backend mode: any phone with a non-empty password drops
    // into the seeded session. Lets us test on BlueStacks without a server.
    if (isDemoMode) {
      loginAsDemo();
      router.replace('/(tabs)/home');
      return;
    }

    try {
      await login(phone, password);
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      if (status === 429) {
        Alert.alert(
          'محاولات كثيرة',
          'تم تجاوز الحد المسموح به من المحاولات. حاول بعد 15 دقيقة، أو تواصل مع معمل المياه لإعادة تعيين كلمة المرور.',
        );
      } else if (status === 401) {
        Alert.alert(
          'بيانات غير صحيحة',
          'رقم الهاتف أو كلمة المرور خاطئة. إذا نسيت كلمة المرور تواصل مع معمل المياه التابع لك ليرسلها لك.',
        );
      } else {
        Alert.alert('فشل تسجيل الدخول', msg ?? 'حاول مرة أخرى');
      }
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-aqua-600">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-12 pb-8">
          <View className="items-center mb-10">
            <Text className="text-7xl mb-2">🏠</Text>
            <Text className="text-white text-3xl font-bold">داري</Text>
            <Text className="text-aqua-100 text-sm mt-1">خدمات منزلك بضغطة زر</Text>
          </View>

          <View className="bg-white rounded-3xl p-6 shadow-2xl">
            <Text className="text-slate-900 text-xl font-bold mb-1 text-right">
              تسجيل الدخول
            </Text>
            <Text className="text-slate-500 text-xs mb-5 text-right leading-5">
              استخدم رقم الهاتف وكلمة المرور التي زوّدك بها معمل المياه التابع لك
            </Text>

            <Text className="text-slate-700 text-sm mb-2 text-right">رقم الهاتف</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="07XXXXXXXXX"
              keyboardType="phone-pad"
              maxLength={11}
              autoComplete="tel"
              className="border border-slate-200 rounded-xl px-4 py-3 text-base bg-slate-50 text-right mb-4"
            />

            <Text className="text-slate-700 text-sm mb-2 text-right">كلمة المرور</Text>
            <View className="flex-row-reverse items-center border border-slate-200 rounded-xl bg-slate-50">
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••"
                secureTextEntry={!showPassword}
                autoComplete="password"
                className="flex-1 px-4 py-3 text-base text-right"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} className="px-3 py-3">
                <Text className="text-aqua-700 text-xs">
                  {showPassword ? 'إخفاء' : 'إظهار'}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={submit}
              disabled={loading || !canSubmit}
              className={`mt-5 rounded-xl py-4 items-center ${
                loading || !canSubmit ? 'bg-slate-300' : 'bg-aqua-600'
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">دخول</Text>
              )}
            </Pressable>

            <View className="mt-5 pt-4 border-t border-slate-100">
              <Text className="text-slate-500 text-[11px] text-center leading-5">
                ليس عندك حساب؟ تواصل مع معمل المياه التابع لك ليُنشئ لك حساباً.
                {'\n'}إذا نسيت كلمة المرور اطلب من المعمل إعادة تعيينها.
              </Text>
            </View>
          </View>

          {/* Demo bypass — hidden in production builds via EAS env var.
              Only visible in dev/preview channels (EXPO_PUBLIC_DEMO_MODE=true). */}
          {isDemoMode && (
            <Pressable
              onPress={() => {
                loginAsDemo();
                router.replace('/(tabs)/home');
              }}
              className="mt-5 bg-white/10 rounded-xl py-3 items-center border border-white/30"
            >
              <Text className="text-white font-bold text-sm">
                🎬 تجربة بدون تسجيل (وضع العرض)
              </Text>
              <Text className="text-aqua-100 text-[10px] mt-0.5">
                يدخل بحساب وهمي لتشاهد الشاشات
              </Text>
            </Pressable>
          )}

          <Text className="text-aqua-100 text-[11px] text-center mt-6 leading-5">
            باستخدامك التطبيق توافق على{' '}
            <Text className="underline">الشروط والأحكام</Text> و{' '}
            <Text className="underline">سياسة الخصوصية</Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
