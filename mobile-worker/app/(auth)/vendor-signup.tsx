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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-store';
import { api } from '@/lib/api';

const VEHICLES: { id: 'STOOTA' | 'TUKTUK' | 'SMALL_PICKUP'; label: string; emoji: string }[] = [
  { id: 'STOOTA', label: 'ستوتة', emoji: '🛵' },
  { id: 'TUKTUK', label: 'تكتك', emoji: '🛺' },
  { id: 'SMALL_PICKUP', label: 'بيك أب صغير', emoji: '🚐' },
];

export default function VendorSignup() {
  const router = useRouter();
  const { loginWithOtp, loading } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp' | 'vehicle'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [vehicle, setVehicle] = useState<typeof VEHICLES[number]['id']>('STOOTA');
  const [maxLiters, setMaxLiters] = useState('25');
  const [submitting, setSubmitting] = useState(false);

  async function verifyOtp() {
    try {
      await loginWithOtp(phone, otp, fullName || undefined);
      setStep('vehicle');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (msg === 'fullName required for first login') {
        Alert.alert('اسم مطلوب', 'أدخل اسمك الكامل ثم أعد المحاولة');
      } else {
        Alert.alert('فشل التحقق', msg || 'رمز غير صحيح');
      }
    }
  }

  async function registerVendor() {
    setSubmitting(true);
    try {
      await api.post('/vendors/me/register', {
        vehicleType: vehicle,
        maxCapacityLiters: Number(maxLiters),
      });
      Alert.alert(
        'تم إرسال طلبك ✓',
        'سيراجع فريقنا بياناتك ويُفعّل حسابك خلال ساعات. ستستلم إشعاراً عند الموافقة.',
        [{ text: 'حسناً', onPress: () => router.replace('/(tabs)/home') }],
      );
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-6 pt-10 pb-8">
          <Pressable onPress={() => router.back()} className="self-start mb-6">
            <Text className="text-slate-300">→ رجوع</Text>
          </Pressable>

          <View className="items-center mb-6">
            <Text className="text-5xl mb-2">🛺</Text>
            <Text className="text-white text-2xl font-bold">تسجيل بائع مستقل</Text>
            <Text className="text-slate-400 text-xs mt-1">
              {step === 'phone' && '٣ خطوات سريعة'}
              {step === 'otp' && 'رمز التحقق'}
              {step === 'vehicle' && 'بيانات المركبة'}
            </Text>
          </View>

          <View className="bg-white rounded-3xl p-6">
            {step === 'phone' && (
              <>
                <Text className="text-slate-700 text-sm mb-2 text-right">رقم الهاتف</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="07XXXXXXXXX"
                  keyboardType="phone-pad"
                  maxLength={11}
                  className="border border-slate-200 rounded-xl px-4 py-3 text-base bg-slate-50 text-right mb-3"
                />
                <Text className="text-slate-700 text-sm mb-2 text-right">الاسم الكامل</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="مثال: علي عبد الله"
                  className="border border-slate-200 rounded-xl px-4 py-3 text-base bg-slate-50 text-right"
                />
                <Pressable
                  onPress={() => setStep('otp')}
                  disabled={!phone || !fullName}
                  className={`mt-5 rounded-xl py-4 items-center ${
                    !phone || !fullName ? 'bg-slate-300' : 'bg-warn-500'
                  }`}
                >
                  <Text className="text-white font-bold">إرسال رمز التحقق</Text>
                </Pressable>
              </>
            )}

            {step === 'otp' && (
              <>
                <Text className="text-slate-500 text-xs mb-4 text-right">
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
                    loading || otp.length < 4 ? 'bg-slate-300' : 'bg-warn-500'
                  }`}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold">تحقق</Text>
                  )}
                </Pressable>
              </>
            )}

            {step === 'vehicle' && (
              <>
                <Text className="text-slate-700 text-sm mb-2 text-right">نوع المركبة</Text>
                <View className="flex-row gap-2 mb-4">
                  {VEHICLES.map((v) => (
                    <Pressable
                      key={v.id}
                      onPress={() => setVehicle(v.id)}
                      className={`flex-1 rounded-xl p-3 items-center border-2 ${
                        vehicle === v.id
                          ? 'border-warn-500 bg-amber-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <Text className="text-2xl mb-1">{v.emoji}</Text>
                      <Text className="text-xs font-bold">{v.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text className="text-slate-700 text-sm mb-2 text-right">
                  السعة القصوى (لتر)
                </Text>
                <TextInput
                  value={maxLiters}
                  onChangeText={setMaxLiters}
                  keyboardType="number-pad"
                  className="border border-slate-200 rounded-xl px-4 py-3 text-base bg-slate-50 text-right"
                />

                <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4">
                  <Text className="text-[11px] text-amber-800 leading-5 text-right">
                    سيراجع فريقنا طلبك ويفعّل حسابك خلال ساعات. ستستلم إشعاراً.
                  </Text>
                </View>

                <Pressable
                  onPress={registerVendor}
                  disabled={submitting}
                  className={`mt-5 rounded-xl py-4 items-center ${
                    submitting ? 'bg-slate-300' : 'bg-warn-500'
                  }`}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold">إرسال الطلب</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
