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
import { api } from '@/lib/api';

/**
 * Two-step OTP login. Step 1 captures the phone, step 2 captures the
 * code. In dev the backend accepts the last 6 digits of the phone as
 * the OTP — wire to a real SMS provider before launch.
 */
export default function LoginScreen() {
  const router = useRouter();
  const { loginWithOtp, loginAsDemo, loading } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp' | 'name'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [sending, setSending] = useState(false);

  async function requestOtp() {
    if (!/^07\d{9}$/.test(phone)) {
      Alert.alert('رقم غير صحيح', 'الرقم يجب أن يبدأ بـ 07 ويتكون من 11 رقماً');
      return;
    }
    setSending(true);
    try {
      // Server will send OTP via SMS in production. In dev it's a no-op
      // and we just move to the next step.
      await api.post('/auth/otp/request', { phone }).catch(() => {});
      setStep('otp');
    } finally {
      setSending(false);
    }
  }

  async function verifyOtp() {
    if (otp.length < 4) return;
    try {
      await loginWithOtp(phone, otp, fullName || undefined);
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (msg === 'fullName required for first login') {
        setStep('name');
      } else {
        Alert.alert('فشل التسجيل', msg || 'رمز التحقق غير صحيح');
      }
    }
  }

  async function completeFirstLogin() {
    if (!fullName.trim()) return;
    try {
      await loginWithOtp(phone, otp, fullName.trim());
      router.replace('/onboarding');
    } catch (err: any) {
      Alert.alert('فشل التسجيل', err?.response?.data?.message ?? 'حاول مرة أخرى');
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
            <Text className="text-7xl mb-2">💧</Text>
            <Text className="text-white text-3xl font-bold">ماء</Text>
            <Text className="text-aqua-100 text-sm mt-1">منصة توصيل المياه المنزلية</Text>
          </View>

          <View className="bg-white rounded-3xl p-6 shadow-2xl">
            {step === 'phone' && (
              <>
                <Text className="text-slate-900 text-xl font-bold mb-1 text-right">
                  تسجيل الدخول
                </Text>
                <Text className="text-slate-500 text-xs mb-5 text-right">
                  أدخل رقم هاتفك وسنرسل لك رمز تحقق برسالة
                </Text>
                <Text className="text-slate-700 text-sm mb-2 text-right">رقم الهاتف</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="07XXXXXXXXX"
                  keyboardType="phone-pad"
                  maxLength={11}
                  className="border border-slate-200 rounded-xl px-4 py-3 text-base bg-slate-50 text-right"
                />
                <Pressable
                  onPress={requestOtp}
                  disabled={sending || phone.length < 11}
                  className={`mt-5 rounded-xl py-4 items-center ${
                    sending || phone.length < 11 ? 'bg-slate-300' : 'bg-aqua-600'
                  }`}
                >
                  {sending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-base">إرسال الرمز</Text>
                  )}
                </Pressable>
              </>
            )}

            {step === 'otp' && (
              <>
                <Text className="text-slate-900 text-xl font-bold mb-1 text-right">
                  رمز التحقق
                </Text>
                <Text className="text-slate-500 text-xs mb-5 text-right">
                  أرسلنا رمزاً إلى {phone}
                </Text>
                <TextInput
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                  className="border border-slate-200 rounded-xl px-4 py-3 text-2xl bg-slate-50 text-center font-bold tracking-widest"
                />
                <Pressable
                  onPress={verifyOtp}
                  disabled={loading || otp.length < 4}
                  className={`mt-5 rounded-xl py-4 items-center ${
                    loading || otp.length < 4 ? 'bg-slate-300' : 'bg-aqua-600'
                  }`}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-base">تحقق ودخول</Text>
                  )}
                </Pressable>
                <Pressable onPress={() => setStep('phone')} className="mt-3 items-center">
                  <Text className="text-aqua-700 text-xs">تعديل رقم الهاتف</Text>
                </Pressable>
              </>
            )}

            {step === 'name' && (
              <>
                <Text className="text-slate-900 text-xl font-bold mb-1 text-right">
                  أهلاً بك! ما اسمك؟
                </Text>
                <Text className="text-slate-500 text-xs mb-5 text-right">
                  لإكمال إنشاء حسابك
                </Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="الاسم الكامل"
                  className="border border-slate-200 rounded-xl px-4 py-3 text-base bg-slate-50 text-right"
                />
                <Pressable
                  onPress={completeFirstLogin}
                  disabled={loading || !fullName.trim()}
                  className={`mt-5 rounded-xl py-4 items-center ${
                    loading || !fullName.trim() ? 'bg-slate-300' : 'bg-aqua-600'
                  }`}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-base">إنشاء الحساب</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>

          {/* Demo bypass — hidden in production builds via EAS env var.
              Only visible in dev/preview channels (EXPO_PUBLIC_DEMO_MODE=true). */}
          {process.env.EXPO_PUBLIC_DEMO_MODE === 'true' && (
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
