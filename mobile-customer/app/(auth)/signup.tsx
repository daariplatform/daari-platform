import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/api';
import { usePostHog } from 'posthog-react-native';
import { track } from '@/lib/posthog';
import { OtpCodeField } from '@/components/OtpCodeField';

/**
 * 4-step self-signup wizard for prospects:
 *   1. Request GPS → fetch nearby plants
 *   2. Pick a plant from the list
 *   3. Enter name + phone + district + address, request OTP
 *   4. Enter OTP → submit lead → "waiting for plant approval" screen
 *
 * Each step is rendered inline (no separate routes) — easier to manage
 * state in a single component, and back-button always returns to Welcome
 * instead of stepping through.
 */
type Plant = {
  id: string;
  name: string;
  city: string;
  contactPhone: string;
  refillPriceIqd: number;
  deliveryFeeIqd: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  distanceKm: number;
  servesYourArea: boolean;
};

type Step = 'locating' | 'pick-plant' | 'enter-info' | 'verify-otp' | 'submitted';

export default function Signup() {
  const router = useRouter();
  const ph = usePostHog();
  // map-picker returns to us via router.replace() with these params.
  const pickerParams = useLocalSearchParams<{
    pickedLat?: string;
    pickedLng?: string;
    pickedAddress?: string;
  }>();
  const [step, setStep] = useState<Step>('locating');
  const [loading, setLoading] = useState(false);

  // Step 1 → 2 data
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [picked, setPicked] = useState<Plant | null>(null);

  // Step 3 form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('');
  const [addressLine, setAddressLine] = useState('');

  // Step 4 OTP
  const [otp, setOtp] = useState('');
  // الإطار الأحمر يظهر فقط بعد فشل التحقّق — يُمسح فور تعديل الكود.
  const [otpError, setOtpError] = useState(false);

  // signup_started — fire once when this screen first mounts.
  useEffect(() => {
    track(ph, 'signup_started');
  }, [ph]);

  // Pick up a freshly-confirmed map pin and override the GPS-derived coords +
  // prefill the address field. Once we've consumed the params, jump straight
  // to the enter-info step so the user keeps editing where they left off.
  useEffect(() => {
    if (pickerParams.pickedLat && pickerParams.pickedLng) {
      const lat = Number(pickerParams.pickedLat);
      const lng = Number(pickerParams.pickedLng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setCoords({ lat, lng });
        if (pickerParams.pickedAddress && !addressLine) {
          setAddressLine(pickerParams.pickedAddress);
        }
        setStep('enter-info');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerParams.pickedLat, pickerParams.pickedLng]);

  // Step 1: fetch GPS + plants
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          Alert.alert(
            'الموقع مطلوب',
            'نحتاج موقعك لإيجاد أقرب المعامل لك',
            [{ text: 'حسناً', onPress: () => router.back() }],
          );
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const c = { lng: loc.coords.longitude, lat: loc.coords.latitude };
        setCoords(c);
        const res = await api.get<Plant[]>('/tenants/discover', {
          params: { lng: c.lng, lat: c.lat },
        });
        setPlants(res.data);
        setStep('pick-plant');
      } catch (e: any) {
        Alert.alert('خطأ', e?.message ?? 'فشل تحديد الموقع');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function requestOtp() {
    if (!fullName || !/^07\d{9}$/.test(phone) || !district || !addressLine) {
      Alert.alert('بيانات ناقصة', 'اكمل كل الحقول والتأكد من رقم الهاتف (07XXXXXXXXX)');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/signup/request-otp', { phone });
      setStep('verify-otp');
    } catch (e: any) {
      Alert.alert('تعذّر إرسال الكود', e?.response?.data?.message ?? 'حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndSubmit(codeOverride?: string) {
    const code = codeOverride ?? otp;
    if (!/^\d{6}$/.test(code)) {
      Alert.alert('كود غير صحيح', 'الكود 6 أرقام');
      return;
    }
    if (!picked || !coords) return;
    setLoading(true);
    setOtpError(false);
    try {
      await api.post('/auth/signup/verify-otp', { phone, otp: code });
      await api.post('/customers/lead', {
        tenantId: picked.id,
        fullName,
        phone,
        district,
        addressLine,
        locationLng: coords.lng,
        locationLat: coords.lat,
      });
      track(ph, 'signup_completed', { tenantId: picked.id });
      setStep('submitted');
    } catch (e: any) {
      setOtpError(true);
      Alert.alert('فشل', e?.response?.data?.message ?? 'حاول مرة أخرى');
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
          <Pressable
            onPress={() =>
              step === 'submitted' ? router.replace('/(auth)/welcome' as any) : router.back()
            }
            hitSlop={10}
            className="flex-row-reverse items-center gap-1 m-4 self-start"
          >
            <MaterialIcons name="arrow-forward-ios" size={16} color="#fff" />
            <Text className="text-white text-sm">رجوع</Text>
          </Pressable>

          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: 0 }}>
            {step === 'locating' && (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#fff" />
                <Text className="text-white mt-4 text-base">جارٍ تحديد موقعك...</Text>
              </View>
            )}

            {step === 'pick-plant' && (
              <View>
                <View className="items-center mb-5">
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 20,
                      backgroundColor: 'rgba(255,255,255,0.22)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <MaterialIcons name="store" size={36} color="#fff" />
                  </View>
                  <Text className="text-white text-xl font-bold">اختر معمل المياه</Text>
                  <Text className="text-sky-100 text-xs mt-1 text-center px-4">
                    وجدنا {plants.length} معمل قريب من موقعك
                  </Text>
                </View>

                {plants.length === 0 ? (
                  <View
                    className="rounded-2xl p-5 items-center"
                    style={{ backgroundColor: 'rgba(255,255,255,0.97)' }}
                  >
                    <MaterialIcons name="sentiment-dissatisfied" size={40} color="#94a3b8" />
                    <Text className="text-slate-700 text-sm mt-2 text-center">
                      للأسف لا يوجد معامل تخدم منطقتك حالياً.
                      {'\n'}سنخبرك حال توفّر معمل جديد.
                    </Text>
                  </View>
                ) : (
                  plants.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        setPicked(p);
                        setStep('enter-info');
                      }}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.97)',
                        borderRadius: 16,
                        padding: 14,
                        marginBottom: 10,
                        flexDirection: 'row-reverse',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          backgroundColor: p.servesYourArea ? '#ecfdf5' : '#f1f5f9',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MaterialIcons
                          name="water-drop"
                          size={24}
                          color={p.servesYourArea ? '#059669' : '#64748b'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text className="font-bold text-slate-900 text-sm text-right">
                          {p.name}
                        </Text>
                        <View className="flex-row-reverse items-center gap-2 mt-0.5">
                          <Text className="text-[11px] text-slate-500">
                            {p.distanceKm} كم
                          </Text>
                          <Text className="text-[11px] text-slate-300">·</Text>
                          <Text className="text-[11px] text-slate-500">
                            {p.refillPriceIqd.toLocaleString('ar-IQ')} د.ع للتعبئة
                          </Text>
                        </View>
                        {p.servesYourArea && (
                          <Text className="text-[10px] text-emerald-700 font-bold mt-1">
                            ✓ يخدم منطقتك
                          </Text>
                        )}
                      </View>
                      <MaterialIcons name="arrow-back-ios" size={16} color="#94a3b8" />
                    </Pressable>
                  ))
                )}
              </View>
            )}

            {step === 'enter-info' && picked && (
              <View>
                <View className="items-center mb-5">
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 20,
                      backgroundColor: 'rgba(255,255,255,0.22)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <MaterialIcons name="person-add" size={36} color="#fff" />
                  </View>
                  <Text className="text-white text-xl font-bold">معلوماتك</Text>
                  <Text className="text-sky-100 text-xs mt-1 text-center px-4">
                    سيراجع معمل <Text className="font-bold">{picked.name}</Text> طلبك ويتواصل معك
                  </Text>
                </View>

                <View
                  className="rounded-2xl p-5"
                  style={{ backgroundColor: 'rgba(255,255,255,0.97)' }}
                >
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="الاسم الكامل"
                    className="border border-slate-200 rounded-xl px-4 py-3 mb-3 text-right text-base bg-slate-50"
                    placeholderTextColor="#94a3b8"
                  />
                  <TextInput
                    value={phone}
                    onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
                    placeholder="07XXXXXXXXX"
                    keyboardType="phone-pad"
                    maxLength={11}
                    autoComplete="tel"
                    className="border border-slate-200 rounded-xl px-4 py-3 mb-3 text-right text-base bg-slate-50"
                    placeholderTextColor="#94a3b8"
                  />
                  <TextInput
                    value={district}
                    onChangeText={setDistrict}
                    placeholder="المنطقة / الحي"
                    className="border border-slate-200 rounded-xl px-4 py-3 mb-3 text-right text-base bg-slate-50"
                    placeholderTextColor="#94a3b8"
                  />
                  <TextInput
                    value={addressLine}
                    onChangeText={setAddressLine}
                    placeholder="العنوان التفصيلي (شارع، عمارة، علامة بارزة)"
                    multiline
                    className="border border-slate-200 rounded-xl px-4 py-3 mb-4 text-right text-base bg-slate-50"
                    placeholderTextColor="#94a3b8"
                  />

                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/(auth)/map-picker',
                        params: coords
                          ? { lat: String(coords.lat), lng: String(coords.lng) }
                          : {},
                      } as any)
                    }
                    className="mb-3 rounded-xl p-3 flex-row-reverse items-center gap-2 border-2 border-sky-300 bg-sky-50"
                  >
                    <MaterialIcons name="map" size={20} color="#0284c7" />
                    <Text className="text-sm font-bold text-sky-700 flex-1 text-right">
                      حدّد موقعك على الخريطة
                    </Text>
                    <MaterialIcons name="arrow-back-ios" size={14} color="#0284c7" />
                  </Pressable>

                  <View className="bg-sky-50 rounded-xl p-2.5 mb-4 flex-row-reverse items-center gap-2">
                    <MaterialIcons name="location-on" size={16} color="#0284c7" />
                    <Text className="text-[10px] text-slate-600 flex-1 text-right">
                      موقعك مُحدّد {coords ? '✓' : 'بالـ GPS'} وسيُحفظ كعنوان البيت
                    </Text>
                  </View>

                  <Pressable
                    onPress={requestOtp}
                    disabled={loading}
                    className={`rounded-xl py-4 items-center ${
                      loading ? 'bg-slate-300' : 'bg-sky-600'
                    }`}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-bold">أرسل كود التحقق</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {step === 'verify-otp' && (
              <View>
                <View className="items-center mb-5">
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 20,
                      backgroundColor: 'rgba(255,255,255,0.22)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <MaterialIcons name="sms" size={36} color="#fff" />
                  </View>
                  <Text className="text-white text-xl font-bold">أدخل الكود</Text>
                  <Text className="text-sky-100 text-xs mt-1 text-center px-4">
                    أُرسل كود من 6 أرقام إلى {phone} عبر WhatsApp / SMS
                  </Text>
                </View>

                <View
                  className="rounded-2xl p-5"
                  style={{ backgroundColor: 'rgba(255,255,255,0.97)' }}
                >
                  <OtpCodeField
                    value={otp}
                    onChange={(t) => {
                      setOtp(t);
                      if (otpError) setOtpError(false);
                    }}
                    onFilled={(code) => verifyAndSubmit(code)}
                    error={otpError}
                  />
                  <Pressable
                    onPress={() => verifyAndSubmit()}
                    disabled={loading}
                    className={`rounded-xl py-4 items-center ${
                      loading ? 'bg-slate-300' : 'bg-emerald-600'
                    }`}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-bold">تأكيد + إرسال الطلب</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setStep('enter-info');
                      setOtp('');
                      setOtpError(false);
                    }}
                    className="mt-3 items-center"
                  >
                    <Text className="text-slate-500 text-xs">↺ تعديل المعلومات</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {step === 'submitted' && picked && (
              <View className="flex-1 items-center justify-center px-4">
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 28,
                    backgroundColor: 'rgba(255,255,255,0.22)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <MaterialIcons name="check-circle" size={64} color="#fff" />
                </View>
                <Text className="text-white text-2xl font-bold text-center">
                  تم إرسال طلبك
                </Text>
                <Text className="text-sky-100 text-sm mt-3 text-center leading-6">
                  معمل <Text className="font-bold">{picked.name}</Text> سيراجع طلبك
                  {'\n'}ويتواصل معك على {phone}
                  {'\n'}عبر WhatsApp خلال 24 ساعة
                </Text>

                <View
                  className="rounded-2xl p-4 mt-6 w-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
                >
                  <Text className="text-white text-xs leading-6 text-right">
                    📝 ماذا يحدث الآن؟{'\n'}
                    1. صاحب المعمل يراجع بياناتك{'\n'}
                    2. يُوافق ويُجدوَل توصيل خزان لك{'\n'}
                    3. السائق يصل بالخزان + كلمة المرور{'\n'}
                    4. بعدها تستطيع طلب التعبئات من التطبيق
                  </Text>
                </View>

                <Pressable
                  onPress={() => router.replace('/(auth)/welcome' as any)}
                  className="mt-6 bg-white rounded-xl py-3 px-6"
                >
                  <Text className="text-sky-700 font-bold">رجوع للشاشة الرئيسية</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
