import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { api } from '@/lib/api';
import { useNearestPlant } from '@/lib/queries';
import { iqd } from '@/lib/format';

/**
 * Four-step first-launch flow:
 *   1. Ask for location → detect nearest plant
 *   2. Show the (single) plant covering this address
 *   3. Explain what happens when the driver arrives
 *   4. Show terms of service and require explicit acceptance
 */
export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const nearest = useNearestPlant(coords?.lng ?? null, coords?.lat ?? null);

  async function requestLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'الموقع مطلوب',
        'نحتاج موقعك مرة واحدة فقط لمعرفة معملك. لن نتتبّعك بعد ذلك.',
      );
      return;
    }
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    setCoords({ lng: loc.coords.longitude, lat: loc.coords.latitude });
    setStep(2);
  }

  async function finishOnboarding() {
    if (!acceptedTerms || !coords) return;
    setSubmitting(true);
    try {
      await api.post('/customers/me/onboard', {
        locationLng: coords.lng,
        locationLat: coords.lat,
        plantId: nearest.data?.id,
      });
      router.replace('/(tabs)/home');
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="bg-aqua-600 pt-3 pb-8 px-5">
        <Text className="text-white text-2xl font-bold text-center">💧 أهلاً بك في ماء</Text>
        <Text className="text-aqua-100 text-xs text-center mt-1">إعداد سريع لمدة دقيقة</Text>
        <View className="flex-row justify-center gap-2 mt-5">
          {[1, 2, 3, 4].map((n) => (
            <View
              key={n}
              className={`w-2 h-2 rounded-full ${n <= step ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </View>
      </View>

      <ScrollView className="flex-1 px-4 -mt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {step === 1 && <Step1 onRequest={requestLocation} />}
        {step === 2 && (
          <Step2
            loading={nearest.isLoading}
            plant={nearest.data}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && <Step3 onNext={() => setStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && (
          <Step4
            accepted={acceptedTerms}
            setAccepted={setAcceptedTerms}
            submitting={submitting}
            onFinish={finishOnboarding}
            onBack={() => setStep(3)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Step1({ onRequest }: { onRequest: () => void }) {
  return (
    <View className="bg-white rounded-2xl p-5 shadow-sm">
      <Text className="text-5xl text-center mb-3">📍</Text>
      <Text className="text-lg font-bold text-center">أين تسكن؟</Text>
      <Text className="text-sm text-slate-500 text-center mt-1 leading-6">
        نحتاج موقعك لنعرف أي معمل يخدم منطقتك. ستظهر لك المعامل المتاحة في حيك فقط.
      </Text>
      <View className="bg-slate-50 rounded-xl p-3 mt-4">
        <Text className="font-bold text-slate-700 text-xs mb-1 text-right">
          لماذا الموقع مرة واحدة؟
        </Text>
        <Text className="text-xs text-slate-600 leading-6 text-right">
          • يحفظ موقع بيتك للتوصيل لاحقاً{'\n'}• لا يُستخدم لتتبعك{'\n'}• يُحدَّث فقط لو
          انتقلت لبيت جديد
        </Text>
      </View>
      <Pressable onPress={onRequest} className="bg-aqua-600 rounded-xl py-4 mt-5">
        <Text className="text-white font-bold text-center">السماح بالوصول للموقع</Text>
      </Pressable>
    </View>
  );
}

function Step2({ loading, plant, onNext, onBack }: any) {
  if (loading) {
    return (
      <View className="bg-white rounded-2xl p-8 items-center">
        <ActivityIndicator color="#0891b2" size="large" />
        <Text className="text-slate-500 mt-3">نبحث عن أقرب معمل…</Text>
      </View>
    );
  }
  if (!plant) {
    return (
      <View className="bg-white rounded-2xl p-6">
        <Text className="text-4xl text-center mb-2">😕</Text>
        <Text className="text-base font-bold text-center">لا يوجد معمل في منطقتك بعد</Text>
        <Text className="text-xs text-slate-500 text-center mt-1">
          نحن نتوسّع باستمرار — سنبلغك عند توفر معمل قريب
        </Text>
        <Pressable onPress={onBack} className="bg-slate-100 rounded-xl py-3 mt-5">
          <Text className="text-slate-700 font-bold text-center">رجوع</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View className="bg-white rounded-2xl p-5 shadow-sm">
      <Text className="text-3xl text-center mb-2">🏭</Text>
      <Text className="text-lg font-bold text-center">المعمل الذي يخدم منطقتك</Text>
      <Text className="text-xs text-slate-500 text-center mt-1">{plant.city} — اخترنا الأقرب لك</Text>

      <View className="bg-aqua-50 border-2 border-aqua-300 rounded-2xl p-4 mt-4">
        <View className="flex-row items-center gap-3">
          <View className="w-14 h-14 rounded-2xl bg-aqua-600 items-center justify-center">
            <Text className="text-white text-2xl">💧</Text>
          </View>
          <View className="flex-1">
            <Text className="font-bold text-aqua-900">{plant.name}</Text>
            <Text className="text-[11px] text-aqua-700">
              {plant.distanceKm.toFixed(1)} كم • يخدم منطقتك ✓
            </Text>
          </View>
        </View>
        <View className="flex-row gap-2 mt-3 pt-3 border-t border-aqua-200">
          <Stat label="تعبئة" value={iqd(1000)} />
          <Stat label="خزان" value="٥٠٠ لتر" />
          <Stat label="مجاناً" value="عند التركيب" />
        </View>
      </View>

      <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
        <Text className="text-[11px] text-amber-800 leading-5 text-right">
          ℹ️ بسبب اتفاقية المعامل، يُسمح لك بالتسجيل في المعمل الذي يخدم منطقتك فقط.
        </Text>
      </View>

      <Pressable onPress={onNext} className="bg-aqua-600 rounded-xl py-4 mt-5">
        <Text className="text-white font-bold text-center">اطلب خزاناً من هذا المعمل</Text>
      </Pressable>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-[10px] text-slate-500">{label}</Text>
      <Text className="font-bold text-aqua-700 text-xs mt-0.5">{value}</Text>
    </View>
  );
}

function Step3({ onNext, onBack }: any) {
  return (
    <View className="bg-white rounded-2xl p-5 shadow-sm">
      <Text className="text-5xl text-center mb-3">🚛</Text>
      <Text className="text-lg font-bold text-center">السائق في الطريق</Text>
      <Text className="text-sm text-slate-500 text-center mt-1 leading-6">
        سيصل إلى بيتك خلال ساعة ليُسلّمك خزاناً جديداً ويملأه مجاناً.
      </Text>
      <View className="bg-slate-50 rounded-xl p-4 mt-4">
        <Text className="font-bold text-slate-700 text-xs mb-2 text-right">
          ماذا سيحدث عند وصوله:
        </Text>
        {[
          'يضع الخزان في المكان المناسب لك',
          'يساعدك في تسجيل الدخول للتطبيق',
          'يشرح لك كيف تطلب التعبئة في المستقبل',
          'يملأ الخزان مجاناً في أول مرة',
        ].map((line) => (
          <View key={line} className="flex-row gap-2 mb-1">
            <Text className="text-leaf-500">✓</Text>
            <Text className="text-xs text-slate-600 flex-1 text-right">{line}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row gap-2 mt-5">
        <Pressable onPress={onBack} className="flex-1 bg-slate-100 rounded-xl py-3">
          <Text className="text-slate-700 font-bold text-center">رجوع</Text>
        </Pressable>
        <Pressable onPress={onNext} className="flex-1 bg-aqua-600 rounded-xl py-3">
          <Text className="text-white font-bold text-center">فهمت، تابع</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Step4({ accepted, setAccepted, submitting, onFinish, onBack }: any) {
  return (
    <View className="bg-white rounded-2xl p-5 shadow-sm">
      <Text className="text-3xl text-center mb-2">📜</Text>
      <Text className="text-lg font-bold text-center">شروط استلام الخزان</Text>
      <Text className="text-xs text-slate-500 text-center mt-1">اقرأها بعناية ثم اضغط موافق</Text>

      <View className="bg-slate-50 rounded-xl p-4 mt-4 max-h-60">
        <ScrollView>
          {[
            { title: '١. ملكية الخزان', body: 'الخزان يبقى ملكاً للمعمل. أنت مسؤول عن المحافظة عليه ووضعه في مكان آمن.' },
            { title: '٢. التعبئة الشهرية', body: 'يجب تعبئة الخزان مرة واحدة على الأقل كل شهر. التعبئة بسعر ١٠٠٠ د.ع تُدفع عند الوصول.' },
            { title: '٣. سحب الخزان', body: 'إذا تأخرت في التعبئة أكثر من ٤٥ يوماً دون عذر، للمعمل الحق في سحب الخزان.' },
            { title: '٤. الانتقال', body: 'عند الانتقال لبيت جديد، يجب إبلاغ المعمل عبر التطبيق ليتم نقل الخزان.' },
            { title: '٥. الإلغاء', body: 'يمكنك إلغاء الاشتراك في أي وقت بإعادة الخزان بحالته السليمة.' },
          ].map((c) => (
            <View key={c.title} className="mb-3">
              <Text className="font-bold text-slate-900 text-xs text-right">{c.title}</Text>
              <Text className="text-xs text-slate-600 leading-6 text-right mt-0.5">{c.body}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <Pressable
        onPress={() => setAccepted(!accepted)}
        className="flex-row items-start gap-2 mt-4"
      >
        <View
          className={`w-6 h-6 rounded-md border-2 items-center justify-center ${
            accepted ? 'border-aqua-500 bg-aqua-500' : 'border-slate-300'
          }`}
        >
          {accepted && <Text className="text-white text-xs">✓</Text>}
        </View>
        <Text className="text-xs text-slate-700 leading-6 flex-1 text-right">
          أوافق على الشروط أعلاه وأقرّ باستلام خزان <Text className="font-bold">٥٠٠ لتر</Text> في
          عهدتي
        </Text>
      </Pressable>

      <View className="flex-row gap-2 mt-5">
        <Pressable onPress={onBack} className="flex-1 bg-slate-100 rounded-xl py-3">
          <Text className="text-slate-700 font-bold text-center">رجوع</Text>
        </Pressable>
        <Pressable
          onPress={onFinish}
          disabled={!accepted || submitting}
          className={`flex-1 rounded-xl py-3 ${
            !accepted || submitting ? 'bg-slate-300' : 'bg-aqua-600'
          }`}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-center">✓ موافق — فعّل حسابي</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
