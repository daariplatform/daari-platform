import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import {
  useCustomerSearch,
  useWalkinRefill,
  useRegisterCustomerByDriver,
} from '@/lib/queries';
import { getCurrentCoords } from '@/lib/location';
import { enqueue } from '@/lib/offline-queue';
import { iqd } from '@/lib/format';
import { EmptyState } from '@/components/EmptyState';

type Mode = 'pick' | 'lookup' | 'register';

export default function WalkinScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('pick');

  const headerTitle =
    mode === 'pick'
      ? 'خدمات السائق'
      : mode === 'lookup'
        ? 'بيع فوري'
        : 'تسجيل زبون جديد';

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Hero header — gradient sky-blue، يطابق باقي شاشات السائق */}
      <LinearGradient
        colors={['#7dd3fc', '#38bdf8', '#0ea5e9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 18,
        }}
      >
        <View className="flex-row items-center justify-between mb-1">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="flex-row items-center gap-1"
          >
            <MaterialIcons name="arrow-forward-ios" size={16} color="#fff" />
            <Text className="text-white text-sm font-medium">رجوع</Text>
          </Pressable>
          <Text className="text-white font-bold text-base">{headerTitle}</Text>
          <View className="w-12" />
        </View>
      </LinearGradient>

      {mode === 'pick' && <Picker onPick={setMode} />}
      {mode === 'lookup' && <Lookup onBack={() => setMode('pick')} />}
      {mode === 'register' && <Register onBack={() => setMode('pick')} />}
    </SafeAreaView>
  );
}

function Picker({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 28 }}
    >
      {/* Title */}
      <View className="items-center mb-5">
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: '#e0f2fe',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 10,
          }}
        >
          <MaterialIcons name="local-shipping" size={36} color="#0284c7" />
        </View>
        <Text className="font-bold text-xl text-slate-900">ماذا تريد أن تعمل؟</Text>
        <Text className="text-xs text-slate-500 mt-1 text-center px-6">
          اختر الخدمة المناسبة وأكمل العملية في خطوات قليلة
        </Text>
      </View>

      {/* Card 1 — Walk-in refill for registered customer */}
      <Pressable
        onPress={() => onPick('lookup')}
        style={({ pressed }) => ({
          marginBottom: 12,
          borderRadius: 20,
          overflow: 'hidden',
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <LinearGradient
          colors={['#0ea5e9', '#0284c7', '#075985']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 18 }}
        >
          <View className="flex-row items-center gap-3">
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.22)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.35)',
              }}
            >
              <MaterialIcons name="water-drop" size={32} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-base">بيع فوري</Text>
              <Text className="text-sky-50 text-xs mt-0.5">
                تعبئة زبون مسجّل في المعمل
              </Text>
              <Text className="text-sky-100 text-[11px] mt-1.5">
                ابحث بالاسم • الهاتف • رقم الخزان
              </Text>
            </View>
            <MaterialIcons name="arrow-back-ios" size={18} color="#fff" />
          </View>
        </LinearGradient>
      </Pressable>

      {/* Card 2 — Register a new customer in the field */}
      <Pressable
        onPress={() => onPick('register')}
        style={({ pressed }) => ({
          borderRadius: 20,
          overflow: 'hidden',
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <LinearGradient
          colors={['#10b981', '#059669', '#065f46']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 18 }}
        >
          <View className="flex-row items-center gap-3">
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.22)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.35)',
              }}
            >
              <MaterialIcons name="person-add" size={32} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-base">تسجيل زبون جديد</Text>
              <Text className="text-emerald-50 text-xs mt-0.5">
                شخص يريد خزاناً ولم يسجّل بعد
              </Text>
              <Text className="text-emerald-100 text-[11px] mt-1.5">
                سيراجع المعمل البيانات ويوافق
              </Text>
            </View>
            <MaterialIcons name="arrow-back-ios" size={18} color="#fff" />
          </View>
        </LinearGradient>
      </Pressable>

      {/* Info footer */}
      <View
        className="mt-6 p-4 bg-white rounded-2xl border border-slate-200"
        style={{
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        }}
      >
        <View className="flex-row items-start gap-2">
          <MaterialIcons name="lightbulb-outline" size={18} color="#0284c7" />
          <View className="flex-1">
            <Text className="text-slate-900 text-[13px] font-bold text-right">
              نصيحة
            </Text>
            <Text className="text-slate-600 text-[11px] mt-1 leading-5 text-right">
              عند البيع الفوري، ابحث بـ <Text className="font-bold text-sky-700">رقم الخزان</Text> (مثل T-1001) لتجنّب الالتباس بين الزبائن الذين لهم نفس الاسم.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function Lookup({ onBack }: { onBack: () => void }) {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { data: results, isLoading } = useCustomerSearch(q);
  const walkin = useWalkinRefill();
  const router = useRouter();

  const selected = results?.find((r) => r.id === selectedId);

  async function confirm() {
    if (!selected) return;
    setSubmitting(true);
    try {
      // Try the camera first — that's the production path. On iOS Simulator
      // (no camera hardware) Apple throws "Camera not available on simulator"
      // so we fall back to the photo library, which the simulator DOES have.
      // Same fallback also covers users who tap "Don't Allow" on the perm
      // prompt: better to let them pick an existing photo than abort entirely.
      let photo: ImagePicker.ImagePickerResult;
      try {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') {
          throw new Error('camera-permission-denied');
        }
        photo = await ImagePicker.launchCameraAsync({ quality: 0.6 });
      } catch (cameraErr: any) {
        console.warn('[walkin] camera unavailable, falling back to library:', cameraErr?.message);
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (libPerm.status !== 'granted') {
          Alert.alert('لا يوجد إذن', 'فعّل الكاميرا أو معرض الصور لإثبات التعبئة');
          return;
        }
        photo = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
      }
      if (photo.canceled) return;
      const coords = await getCurrentCoords();
      if (!coords) {
        Alert.alert('GPS غير متاح', 'فعّل خدمات الموقع');
        return;
      }
      const body = {
        customerId: selected.id,
        paymentMethod: 'CASH' as const,
        paidAmountIqd: 1000,
        proofPhotoUrl: photo.assets[0].uri,
        completionLng: coords.lng,
        completionLat: coords.lat,
      };
      try {
        await walkin.mutateAsync(body);
      } catch {
        await enqueue('POST', '/orders/walkin-refill', body);
        Alert.alert('محفوظ محلياً', 'سيُزامَن عند عودة الإنترنت');
      }
      Alert.alert('تم ✓', `تعبئة ${selected.fullName}`);
      router.back();
    } finally {
      setSubmitting(false);
    }
  }

  if (selected) {
    return (
      <ScrollView className="flex-1 p-5">
        <View className="bg-aqua-50 border border-aqua-200 rounded-2xl p-4 mb-3">
          <Text className="font-bold text-lg">{selected.fullName}</Text>
          <Text
            className="text-xs text-slate-500 mt-0.5"
            style={{ writingDirection: 'ltr' }}
          >
            {selected.phone}
          </Text>
          <Text className="text-xs text-slate-500">{selected.addressLine}</Text>
          {selected.tanks?.[0] && (
            <Text className="text-[10px] text-slate-400 mt-2 font-mono">
              QR: {selected.tanks[0].qrCode}
            </Text>
          )}
          <View className="flex-row justify-between mt-3 pt-3 border-t border-aqua-200">
            <Text className="text-xs text-slate-500">آخر تعبئة</Text>
            <Text className="text-xs font-bold">
              {selected.lastRefillAt
                ? new Date(selected.lastRefillAt).toLocaleDateString('ar-IQ')
                : '—'}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setSelectedId(null)}
            className="flex-1 bg-slate-100 rounded-xl py-3"
          >
            <Text className="text-slate-700 font-bold text-center">رجوع</Text>
          </Pressable>
          <Pressable
            onPress={confirm}
            disabled={submitting}
            className={`flex-1 rounded-xl py-3 ${submitting ? 'bg-slate-300' : 'bg-aqua-600'}`}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-center">📷 صوّر وأكّد</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 p-5">
      <Text className="text-xs text-slate-500 mb-2 text-right">
        ابحث بالاسم، الهاتف، أو رقم الخزان
      </Text>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="مثال: أم محمد أو T-1024"
        className="bg-white rounded-xl px-4 py-3 border border-slate-200 mb-3 text-right"
        autoFocus
      />

      {isLoading && <ActivityIndicator color="#0891b2" />}

      {results?.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => setSelectedId(c.id)}
          className="bg-white rounded-xl p-3 mb-1.5 border border-slate-200 flex-row items-center gap-3"
        >
          <View className="w-9 h-9 bg-aqua-50 rounded-lg items-center justify-center">
            <Text className="font-bold text-aqua-700">{c.fullName[0]}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-bold text-sm">{c.fullName}</Text>
            <Text className="text-[11px] text-slate-500">
              {c.district} • {c.tanks?.[0]?.qrCode ?? '—'}
            </Text>
          </View>
        </Pressable>
      ))}

      {q.length >= 2 && results?.length === 0 && !isLoading && (
        <EmptyState
          icon="person-search"
          title="لا يوجد زبون بهذا الاسم"
          subtitle="جرّب البحث برقم الهاتف أو رقم الخزان، أو سجّل زبوناً جديداً"
        />
      )}

      <Pressable onPress={onBack} className="mt-4 bg-slate-100 rounded-xl py-3">
        <Text className="text-slate-700 font-bold text-center">رجوع</Text>
      </Pressable>
    </ScrollView>
  );
}

function Register({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const register = useRegisterCustomerByDriver();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!fullName || !phone || !district || !addressLine) {
      Alert.alert('بيانات ناقصة', 'املأ كل الحقول');
      return;
    }
    setSubmitting(true);
    try {
      const coords = await getCurrentCoords();
      if (!coords) {
        Alert.alert('GPS غير متاح', 'فعّل خدمات الموقع');
        return;
      }
      const body = {
        fullName,
        phone,
        district,
        addressLine,
        locationLng: coords.lng,
        locationLat: coords.lat,
      };
      try {
        await register.mutateAsync(body);
        Alert.alert('تم إرسال طلب التسجيل ✓', 'سيراجع المعمل بياناته ويوافق');
      } catch (err: any) {
        await enqueue('POST', '/customers/register-by-driver', body);
        Alert.alert('محفوظ محلياً', 'سيُرسَل للمعمل عند عودة الإنترنت');
      }
      router.back();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView className="flex-1 p-5">
      <TextInput
        value={fullName}
        onChangeText={setFullName}
        placeholder="الاسم الكامل"
        className="bg-white rounded-xl px-4 py-3 border border-slate-200 mb-2 text-right"
      />
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="رقم الهاتف 07XXXXXXXXX"
        keyboardType="phone-pad"
        maxLength={11}
        className="bg-white rounded-xl px-4 py-3 border border-slate-200 mb-2 text-right"
      />
      <TextInput
        value={district}
        onChangeText={setDistrict}
        placeholder="الحي / المنطقة"
        className="bg-white rounded-xl px-4 py-3 border border-slate-200 mb-2 text-right"
      />
      <TextInput
        value={addressLine}
        onChangeText={setAddressLine}
        placeholder="العنوان التفصيلي"
        multiline
        className="bg-white rounded-xl px-4 py-3 border border-slate-200 mb-3 text-right"
      />

      <View className="bg-slate-50 rounded-xl p-3 mb-4">
        <Text className="text-[11px] text-slate-600 leading-6 text-right">
          ✓ GPS سيُلتقط تلقائياً (سيكون عنوان البيت لاحقاً){'\n'}
          → المعمل سيستلم التنبيه ويوافق خلال ساعات{'\n'}
          → بعد الموافقة: يُجدوَل توصيل الخزان
        </Text>
      </View>

      <View className="flex-row gap-2">
        <Pressable onPress={onBack} className="flex-1 bg-slate-100 rounded-xl py-3">
          <Text className="text-slate-700 font-bold text-center">رجوع</Text>
        </Pressable>
        <Pressable
          onPress={submit}
          disabled={submitting}
          className={`flex-1 rounded-xl py-3 ${submitting ? 'bg-slate-300' : 'bg-leaf-500'}`}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-center">📤 أرسل للمعمل</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
