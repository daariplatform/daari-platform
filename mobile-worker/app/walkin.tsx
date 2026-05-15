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
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  useCustomerSearch,
  useWalkinRefill,
  useRegisterCustomerByDriver,
} from '@/lib/queries';
import { getCurrentCoords } from '@/lib/location';
import { enqueue } from '@/lib/offline-queue';
import { iqd } from '@/lib/format';

type Mode = 'pick' | 'lookup' | 'register';

export default function WalkinScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('pick');

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="bg-white px-4 py-3 border-b border-slate-200 flex-row items-center justify-between">
        <Pressable onPress={() => router.back()}>
          <Text className="text-aqua-700">→ رجوع</Text>
        </Pressable>
        <Text className="font-bold">
          {mode === 'pick' && 'الحالة'}
          {mode === 'lookup' && 'بيع فوري'}
          {mode === 'register' && 'تسجيل زبون جديد'}
        </Text>
        <View className="w-12" />
      </View>

      {mode === 'pick' && <Picker onPick={setMode} />}
      {mode === 'lookup' && <Lookup onBack={() => setMode('pick')} />}
      {mode === 'register' && <Register onBack={() => setMode('pick')} />}
    </SafeAreaView>
  );
}

function Picker({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <View className="p-5">
      <Text className="font-bold text-lg text-center mb-1">ما هي الحالة؟</Text>
      <Text className="text-xs text-slate-500 text-center mb-6">
        اختر النوع المناسب لإكمال العملية
      </Text>

      <Pressable
        onPress={() => onPick('lookup')}
        className="bg-aqua-50 border-2 border-aqua-300 rounded-2xl p-4 mb-3 flex-row items-center gap-3"
      >
        <View className="w-12 h-12 bg-aqua-600 rounded-2xl items-center justify-center">
          <Text className="text-2xl">💧</Text>
        </View>
        <View className="flex-1">
          <Text className="font-bold">بيع فوري — تعبئة زبون مسجّل</Text>
          <Text className="text-[11px] text-slate-600">
            مسجّل عندنا لكنه لم يطلب من التطبيق
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => onPick('register')}
        className="bg-leaf-50 border-2 border-leaf-300 rounded-2xl p-4 flex-row items-center gap-3"
      >
        <View className="w-12 h-12 bg-leaf-500 rounded-2xl items-center justify-center">
          <Text className="text-2xl">👤</Text>
        </View>
        <View className="flex-1">
          <Text className="font-bold">تسجيل زبون جديد</Text>
          <Text className="text-[11px] text-slate-600">
            شخص غير مسجّل عندنا، يريد خزاناً
          </Text>
          <Text className="text-[10px] text-leaf-700 font-bold mt-0.5">
            مكافأة ٥,٠٠٠ د.ع عند الموافقة
          </Text>
        </View>
      </Pressable>
    </View>
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
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('لا يوجد إذن', 'فعّل الكاميرا لإثبات التعبئة');
        return;
      }
      const photo = await ImagePicker.launchCameraAsync({ quality: 0.6 });
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
        <Text className="text-center text-slate-400 py-8 text-sm">
          لا يوجد زبون بهذا الاسم{'\n'}جرّب "تسجيل زبون جديد" بدلاً منه
        </Text>
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
