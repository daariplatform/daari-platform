import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMyTodayTasks, useCompleteOrder, useReclaimTank } from '@/lib/queries';
import { getCurrentCoords, distanceMetres } from '@/lib/location';
import { enqueue } from '@/lib/offline-queue';
import { iqd } from '@/lib/format';

const RECLAIM_REASONS = [
  { id: 'NON_COMPLIANCE',     label: 'عدم التزام بتعليمات الشركة', emoji: '⚠️' },
  { id: 'MAINTENANCE',         label: 'خزان للصيانة',              emoji: '🔧' },
  { id: 'CUSTOMER_MOVED',      label: 'الزبون انتقل لمعمل آخر',     emoji: '📦' },
  { id: 'CUSTOMER_CANCELLED',  label: 'الزبون ألغى الاشتراك',       emoji: '❌' },
  { id: 'TANK_DAMAGED',        label: 'الخزان تالف',                emoji: '💔' },
  { id: 'OTHER',               label: 'سبب آخر',                    emoji: '•'  },
] as const;

const GPS_MAX_METRES = 50;

export default function TaskDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: tasks } = useMyTodayTasks();
  const completeOrder = useCompleteOrder();
  const reclaim = useReclaimTank();
  const [reclaimReason, setReclaimReason] =
    useState<typeof RECLAIM_REASONS[number]['id'] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const task = tasks?.find((t) => t.id === id);
  if (!task) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
        <Text className="text-slate-400">المهمة غير موجودة</Text>
      </SafeAreaView>
    );
  }

  async function captureProofPhoto(): Promise<string | null> {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('لا يوجد إذن', 'فعّل إذن الكاميرا لإثبات التعبئة');
      return null;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: false });
    if (r.canceled) return null;
    return r.assets[0].uri;
  }

  async function verifyArrivalGPS(): Promise<{ lng: number; lat: number } | null> {
    const coords = await getCurrentCoords();
    if (!coords) {
      Alert.alert('GPS غير متاح', 'فعّل خدمات الموقع وحاول مجدداً');
      return null;
    }
    if (task!.customer.locationLat && task!.customer.locationLng) {
      const d = distanceMetres(coords, {
        lat: task!.customer.locationLat,
        lng: task!.customer.locationLng,
      });
      if (d > GPS_MAX_METRES) {
        Alert.alert(
          'بعيد عن العنوان',
          `أنت على بُعد ${Math.round(d)}م من عنوان الزبون (حد ${GPS_MAX_METRES}م). تأكد أنك عند البيت الصحيح.`,
        );
        return null;
      }
    }
    return coords;
  }

  async function onCompleteRefill() {
    setSubmitting(true);
    try {
      const coords = await verifyArrivalGPS();
      if (!coords) return setSubmitting(false);
      const photo = await captureProofPhoto();
      if (!photo) return setSubmitting(false);

      const body = {
        paymentMethod: 'CASH' as const,
        paidAmountIqd: task.priceIqd,
        proofPhotoUrl: photo, // backend uploader will rewrite to S3 URL
        completionLng: coords.lng,
        completionLat: coords.lat,
      };

      try {
        await completeOrder.mutateAsync({ orderId: task.id, body });
      } catch (e: any) {
        // Connection failed — queue and tell the user.
        await enqueue('POST', `/orders/${task.id}/complete`, body);
        Alert.alert('محفوظ محلياً', 'سيُزامَن مع المعمل عند عودة الإنترنت');
      }
      router.back();
    } finally {
      setSubmitting(false);
    }
  }

  async function onCompleteReclaim() {
    if (!reclaimReason) {
      Alert.alert('اختر سبب السحب', 'يجب اختيار سبب قبل تأكيد السحب');
      return;
    }
    setSubmitting(true);
    try {
      const coords = await verifyArrivalGPS();
      if (!coords) return setSubmitting(false);
      const photo = await captureProofPhoto();
      if (!photo) return setSubmitting(false);

      const body = {
        paymentMethod: 'CASH' as const,
        paidAmountIqd: 0,
        proofPhotoUrl: photo,
        completionLng: coords.lng,
        completionLat: coords.lat,
        reclaimReason,
      };
      try {
        await reclaim.mutateAsync({ orderId: task.id, body });
      } catch {
        await enqueue('POST', `/orders/${task.id}/complete`, body);
        Alert.alert('محفوظ محلياً', 'سيُزامَن مع المعمل عند عودة الإنترنت');
      }
      router.back();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Pressable onPress={() => router.back()} className="self-start mb-3">
          <Text className="text-aqua-700">→ رجوع</Text>
        </Pressable>

        <View className="bg-white rounded-2xl shadow-sm p-4">
          <Text className="text-xs text-slate-500">
            {task.kind === 'REFILL' ? 'تعبئة' : task.kind === 'TANK_DELIVERY' ? 'توصيل خزان' : 'سحب خزان'}
          </Text>
          <Text className="font-bold text-lg mt-0.5">{task.customer.fullName}</Text>
          <Text className="text-xs text-slate-500 mt-1">{task.customer.addressLine}</Text>
          <Text className="text-xs text-slate-500">{task.customer.district}</Text>
          {task.tank && (
            <Text className="text-[11px] text-slate-400 mt-2 font-mono">
              QR: {task.tank.qrCode}
            </Text>
          )}
        </View>

        {task.kind === 'TANK_RECLAIM' ? (
          <View className="mt-4">
            <Text className="font-bold text-sm mb-2">اختر سبب السحب:</Text>
            {RECLAIM_REASONS.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setReclaimReason(r.id)}
                className={`bg-white rounded-xl p-3 mb-2 flex-row items-center gap-3 border-2 ${
                  reclaimReason === r.id ? 'border-danger-500' : 'border-transparent'
                }`}
              >
                <Text className="text-xl">{r.emoji}</Text>
                <Text className="flex-1 font-bold text-sm">{r.label}</Text>
                <View
                  className={`w-5 h-5 rounded-full border-2 ${
                    reclaimReason === r.id
                      ? 'border-danger-500 bg-danger-500'
                      : 'border-slate-300'
                  } items-center justify-center`}
                >
                  {reclaimReason === r.id && (
                    <Text className="text-white text-[10px]">✓</Text>
                  )}
                </View>
              </Pressable>
            ))}
            <Pressable
              onPress={onCompleteReclaim}
              disabled={submitting || !reclaimReason}
              className={`rounded-xl py-4 mt-3 items-center ${
                submitting || !reclaimReason ? 'bg-slate-300' : 'bg-danger-500'
              }`}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold">📷 صوّر وأكّد السحب</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View className="mt-4">
            <View className="bg-slate-50 rounded-xl p-3 mb-3">
              <Text className="text-[11px] text-slate-600 leading-5 text-right">
                ✓ سيُؤخذ GPS تلقائياً للتحقق من وصولك للعنوان{'\n'}
                ✓ صورة الخزان إلزامية كدليل{'\n'}
                ✓ الزبون سيستلم تأكيد عبر WhatsApp تلقائياً
              </Text>
            </View>
            <Pressable
              onPress={onCompleteRefill}
              disabled={submitting}
              className={`rounded-xl py-4 items-center ${
                submitting ? 'bg-slate-300' : 'bg-aqua-600'
              }`}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold">
                  ✓ تم {task.kind === 'TANK_DELIVERY' ? 'التوصيل' : 'التعبئة'} — أكّد الآن (
                  {iqd(task.priceIqd)})
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
