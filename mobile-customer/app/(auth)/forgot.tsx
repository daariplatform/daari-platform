import { useState } from 'react';
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
import { api } from '@/lib/api';
import { setTokens } from '@/lib/tokens';
import { useAuth } from '@/lib/auth-store';
import { OtpCodeField } from '@/components/OtpCodeField';

/**
 * Two-step self-service password reset.
 *   Step 1: phone → backend sends 6-digit OTP via otpiq (WhatsApp first).
 *   Step 2: OTP + new password → backend verifies, sets new password,
 *           returns fresh tokens. We auto-sign-in the user.
 *
 * The login-once guard lives in the backend, so the "raجع المعمل" message
 * surfaces here when the user hasn't claimed their account yet.
 */
export default function ForgotPassword() {
  const router = useRouter();
  const { hydrate } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    if (!/^07\d{9}$/.test(phone)) {
      Alert.alert('رقم غير صحيح', 'أدخل رقم بصيغة 07XXXXXXXXX');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { phone });
      Alert.alert(
        'تم إرسال الكود',
        'استلم الكود عبر WhatsApp أو رسالة. صالح لمدة 10 دقائق.',
      );
      setStep(2);
    } catch (e: any) {
      Alert.alert('تعذّر إرسال الكود', e?.response?.data?.message ?? 'حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndReset(codeOverride?: string) {
    const code = codeOverride ?? otp;
    if (!/^\d{6}$/.test(code)) {
      Alert.alert('كود غير صحيح', 'الكود يتكوّن من 6 أرقام');
      return;
    }
    // Note: لا نطلب كلمة المرور في الـ onFilled — auto-submit يحدث فقط عند
    // اكتمال الكود ووجود كلمة مرور صالحة. خلاف ذلك يضغط المستخدم الزر يدوياً.
    if (newPassword.length < 6) {
      // إذا كان من auto-fill خلال onFilled، لا نُظهر alert (يبدو مزعجاً) —
      // فقط نضع تركيز التحقق على الزر اليدوي.
      if (!codeOverride) {
        Alert.alert('كلمة المرور قصيرة', '6 أحرف على الأقل');
      }
      return;
    }
    setLoading(true);
    setOtpError(false);
    try {
      const res = await api.post('/auth/verify-otp', { phone, otp: code, newPassword });
      // Auto-login with new tokens
      await setTokens(res.data.accessToken, res.data.refreshToken);
      await hydrate();
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setOtpError(true);
      Alert.alert('فشل', e?.response?.data?.message ?? 'الكود غير صحيح أو منتهي');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={['#38bdf8', '#0ea5e9', '#0284c7']} style={{ flex: 1 }}>
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              className="flex-row-reverse items-center gap-1 self-start mb-6"
            >
              <MaterialIcons name="arrow-forward-ios" size={16} color="#fff" />
              <Text className="text-white text-sm">رجوع للدخول</Text>
            </Pressable>

            <View className="items-center mb-6">
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <MaterialIcons
                  name={step === 1 ? 'lock-reset' : 'sms'}
                  size={40}
                  color="#fff"
                />
              </View>
              <Text className="text-white text-xl font-bold">
                {step === 1 ? 'استعادة كلمة المرور' : 'تأكيد الكود'}
              </Text>
              <Text className="text-sky-100 text-xs mt-1 text-center px-6">
                {step === 1
                  ? 'سنرسل لك كوداً عبر WhatsApp / رسالة لإعادة تعيين كلمة المرور'
                  : `الكود أُرسل إلى ${phone}`}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.97)',
                borderRadius: 24,
                padding: 22,
              }}
            >
              {step === 1 ? (
                <>
                  <Text className="text-slate-700 text-sm mb-2 text-right">رقم الهاتف</Text>
                  <TextInput
                    value={phone}
                    onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
                    placeholder="07XXXXXXXXX"
                    keyboardType="phone-pad"
                    maxLength={11}
                    autoComplete="tel"
                    className="border-2 border-slate-200 rounded-xl px-4 py-3.5 mb-5 text-right text-base bg-slate-50"
                    placeholderTextColor="#cbd5e1"
                  />
                  <Pressable
                    onPress={sendCode}
                    disabled={loading}
                    className={`rounded-xl py-4 items-center ${
                      loading ? 'bg-slate-300' : 'bg-sky-600'
                    }`}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-bold">أرسل الكود</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <Text className="text-slate-700 text-sm mb-2 text-right">الكود (6 أرقام)</Text>
                  <OtpCodeField
                    value={otp}
                    onChange={(t) => {
                      setOtp(t);
                      if (otpError) setOtpError(false);
                    }}
                    onFilled={(code) => verifyAndReset(code)}
                    error={otpError}
                  />
                  <Text className="text-slate-700 text-sm mb-2 text-right">كلمة المرور الجديدة</Text>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="6 أحرف على الأقل"
                    secureTextEntry
                    className="border-2 border-slate-200 rounded-xl px-4 py-3.5 mb-5 text-right text-base bg-slate-50"
                    placeholderTextColor="#cbd5e1"
                  />
                  <Pressable
                    onPress={() => verifyAndReset()}
                    disabled={loading}
                    className={`rounded-xl py-4 items-center ${
                      loading ? 'bg-slate-300' : 'bg-emerald-600'
                    }`}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-bold">تأكيد + دخول</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setStep(1);
                      setOtp('');
                      setOtpError(false);
                      setNewPassword('');
                    }}
                    className="mt-3 items-center"
                  >
                    <Text className="text-slate-500 text-xs">↺ إعادة إرسال الكود</Text>
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
