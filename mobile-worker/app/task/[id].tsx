import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker, type Region } from 'react-native-maps';
import { usePostHog } from 'posthog-react-native';
import {
  useMyTodayTasks,
  useCompleteOrder,
  useReclaimTank,
  useUploadProofPhoto,
  useStartOrder,
} from '@/lib/queries';
import { getCurrentCoords, distanceMetres } from '@/lib/location';
import { enqueue } from '@/lib/offline-queue';
import { iqd } from '@/lib/format';
import { track } from '@/lib/posthog';

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
  const ph = usePostHog();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: tasks } = useMyTodayTasks();
  const completeOrder = useCompleteOrder();
  const reclaim = useReclaimTank();
  const uploadProof = useUploadProofPhoto();
  const startOrder = useStartOrder();
  const [reclaimReason, setReclaimReason] =
    useState<typeof RECLAIM_REASONS[number]['id'] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Local-only driver position for the in-screen map. Refreshes every 10s
  // while this screen is open. The OS-level background tracker in
  // lib/location.ts is the one that actually reports to the server — this
  // is purely for the local map preview.
  const [driverCoord, setDriverCoord] = useState<{ lat: number; lng: number } | null>(null);
  const watchSub = useRef<Location.LocationSubscription | null>(null);

  // Track ride start time for completion duration. Captured at first mount.
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const r = await Location.requestForegroundPermissionsAsync();
          if (r.status !== 'granted') return;
        }
        const fix = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setDriverCoord({ lat: fix.coords.latitude, lng: fix.coords.longitude });
        // Subscribe to position updates while this screen is open. We use a
        // 10s/50m throttle — anything finer wastes battery without changing
        // a UI marker the user is glancing at.
        watchSub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 10_000, distanceInterval: 50 },
          (loc) => setDriverCoord({ lat: loc.coords.latitude, lng: loc.coords.longitude }),
        );
      } catch {
        // No location — map just shows the customer pin alone.
      }
    })();
    return () => {
      watchSub.current?.remove();
      watchSub.current = null;
    };
  }, []);

  const task = tasks?.find((t) => t.id === id);
  if (!task) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
        <Text className="text-slate-400">المهمة غير موجودة</Text>
      </SafeAreaView>
    );
  }

  async function captureProofPhoto(): Promise<string | null> {
    // Production path: real device camera. Falls back to the photo library
    // when (a) the iOS Simulator throws "Camera not available", or (b) the
    // user denies the camera permission. Letting them pick from the library
    // is better than blocking the whole flow.
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        throw new Error('camera-permission-denied');
      }
      const r = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: false });
      if (r.canceled) return null;
      return r.assets[0].uri;
    } catch (cameraErr: any) {
      console.warn('[task] camera unavailable, falling back to library:', cameraErr?.message);
      const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (libPerm.status !== 'granted') {
        Alert.alert('لا يوجد إذن', 'فعّل الكاميرا أو معرض الصور لإثبات التعبئة');
        return null;
      }
      const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, base64: false });
      if (r.canceled) return null;
      return r.assets[0].uri;
    }
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

  /**
   * يرفع الصورة من المحاكي/الجهاز للـ backend عبر /uploads/proof،
   * ويرجع URL دائم يصلح ليُحفَظ على الطلب. لو الإنترنت فشل، نرجع URI
   * المحلي كـ fallback (الـ offline queue سيُعيد المحاولة لاحقاً).
   */
  async function captureAndUploadProof(): Promise<string | null> {
    const localUri = await captureProofPhoto();
    if (!localUri) return null;
    try {
      const remoteUrl = await uploadProof.mutateAsync(localUri);
      return remoteUrl;
    } catch (err) {
      // Offline أو خطأ سيرفر — نحتفظ بالـ URI المحلي ونعتمد على الـ
      // offline queue إعادة الإرسال لاحقاً (متى ما يتصل بالإنترنت).
      return localUri;
    }
  }

  async function onCompleteRefill() {
    setSubmitting(true);
    try {
      const coords = await verifyArrivalGPS();
      if (!coords) return setSubmitting(false);
      const photo = await captureAndUploadProof();
      if (!photo) return setSubmitting(false);

      const body = {
        paymentMethod: 'CASH' as const,
        paidAmountIqd: task!.priceIqd,
        proofPhotoUrl: photo,
        completionLng: coords.lng,
        completionLat: coords.lat,
      };

      try {
        await completeOrder.mutateAsync({ orderId: task!.id, body });
        track(ph, 'order_completed', {
          orderId: task!.id,
          kind: task!.kind,
          priceIqd: task!.priceIqd,
          durationSec: Math.round((Date.now() - startedAtRef.current) / 1000),
        });
        router.back();
      } catch (e: any) {
        // Distinguish offline vs. a real backend rejection. If we got an
        // HTTP status the server is reachable and the order really cannot
        // be completed as-is — show the message so the driver can fix it
        // (e.g. wrong status, missing tank). Only true network failures
        // should fall through to the offline queue.
        const status = e?.response?.status;
        const msg = e?.response?.data?.message;
        if (status) {
          Alert.alert(
            'تعذّر إتمام الطلب',
            typeof msg === 'string'
              ? msg
              : `الخادم رفض الطلب (${status}). راجع المعمل.`,
          );
        } else {
          await enqueue('POST', `/orders/${task!.id}/complete`, body);
          Alert.alert('محفوظ محلياً', 'سيُزامَن مع المعمل عند عودة الإنترنت');
          router.back();
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * "ابدأ الجولة" — ASSIGNED → EN_ROUTE. Optional step that lets the customer
   * see "السائق متجه إليك" in their app. If the driver skips it and goes
   * straight to "أكّد التعبئة", the backend's complete() will gracefully
   * accept (it doesn't require EN_ROUTE first).
   */
  async function onStartTrip() {
    if (!task) return;
    setSubmitting(true);
    try {
      await startOrder.mutateAsync(task.id);
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      Alert.alert(
        'تعذّر بدء الجولة',
        typeof msg === 'string' ? msg : 'حاول مرة أخرى',
      );
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
      const photo = await captureAndUploadProof();
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
        await reclaim.mutateAsync({ orderId: task!.id, body });
        router.back();
      } catch (e: any) {
        const status = e?.response?.status;
        const msg = e?.response?.data?.message;
        if (status) {
          Alert.alert(
            'تعذّر إتمام السحب',
            typeof msg === 'string'
              ? msg
              : `الخادم رفض الطلب (${status}). راجع المعمل.`,
          );
        } else {
          await enqueue('POST', `/orders/${task!.id}/complete`, body);
          Alert.alert('محفوظ محلياً', 'سيُزامَن مع المعمل عند عودة الإنترنت');
          router.back();
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * يفتح Google Maps (أو Apple Maps على iOS) للملاحة لعنوان الزبون.
   * يفضّل GPS الدقيق إن وُجد، وإلا يستعمل العنوان كنص.
   */
  function openNavigation() {
    const c = task!.customer;
    let url: string;
    if (c.locationLat && c.locationLng) {
      // عنوان GPS دقيق — أفضل خيار للملاحة
      url = Platform.select({
        ios: `maps://?daddr=${c.locationLat},${c.locationLng}&dirflg=d`,
        default: `https://www.google.com/maps/dir/?api=1&destination=${c.locationLat},${c.locationLng}&travelmode=driving`,
      }) as string;
    } else {
      // نُستعمل العنوان كنص (less accurate)
      const q = encodeURIComponent(`${c.addressLine}, ${c.district}, بغداد`);
      url = `https://www.google.com/maps/search/?api=1&query=${q}`;
    }
    Linking.openURL(url).catch(() =>
      Alert.alert('تعذّر فتح الخرائط', 'تأكد من تثبيت Google Maps'),
    );
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
          {/* In-app map preview — customer pin + driver's current location.
              Tappable, but the big navigation button below does the real
              work via Apple/Google Maps. */}
          {(task.customer.locationLat != null && task.customer.locationLng != null) && (
            <View style={{ height: 180, borderRadius: 14, overflow: 'hidden', marginTop: 12 }}>
              <TaskMap
                customer={{ lat: task.customer.locationLat, lng: task.customer.locationLng }}
                driver={driverCoord}
              />
            </View>
          )}

          {/* زر الملاحة — يفتح Google Maps / Apple Maps بالـ GPS الدقيق إن وُجد */}
          <Pressable
            onPress={openNavigation}
            className="mt-3 bg-aqua-600 rounded-xl py-4 px-3 flex-row-reverse items-center justify-between"
          >
            <View className="flex-row-reverse items-center gap-2">
              <Text className="text-lg">🗺️</Text>
              <Text className="text-white font-bold text-base">افتح الخرائط للملاحة</Text>
            </View>
            <Text className="text-white text-xs">›</Text>
          </Pressable>
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
            {/* Status badge — يعرض المرحلة الحالية للسائق + للزبون
                (الزبون يستلم نفس الحالة عبر تحديث الـ polling) */}
            <View
              className="rounded-xl p-3 mb-3 flex-row-reverse items-center gap-2"
              style={{
                backgroundColor: task.status === 'EN_ROUTE' ? '#ecfeff' : '#f1f5f9',
                borderWidth: 1,
                borderColor: task.status === 'EN_ROUTE' ? '#67e8f9' : '#e2e8f0',
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: task.status === 'EN_ROUTE' ? '#0891b2' : '#94a3b8',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text className="text-white text-xs">
                  {task.status === 'EN_ROUTE' ? '🚐' : '📋'}
                </Text>
              </View>
              <Text className="flex-1 text-xs font-bold text-slate-800 text-right">
                {task.status === 'EN_ROUTE'
                  ? 'أنت في الطريق — الزبون يرى موقعك'
                  : task.status === 'ASSIGNED'
                    ? 'الطلب مُسند لك — ابدأ الجولة لإخبار الزبون'
                    : 'حالة الطلب: ' + task.status}
              </Text>
            </View>

            {/* Step 1: ابدأ الجولة (visible only when ASSIGNED) */}
            {task.status === 'ASSIGNED' && (
              <Pressable
                onPress={onStartTrip}
                disabled={submitting}
                className={`rounded-xl py-4 items-center mb-3 ${
                  submitting ? 'bg-slate-300' : 'bg-sky-600'
                }`}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold">
                    🚐 ابدأ الجولة (إخبار الزبون)
                  </Text>
                )}
              </Pressable>
            )}

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

/**
 * Inline map: customer pin + (optional) driver pin. Pure presentational
 * — the parent owns the location subscription so unmounting the screen
 * stops the GPS watcher.
 */
function TaskMap({
  customer,
  driver,
}: {
  customer: { lat: number; lng: number };
  driver: { lat: number; lng: number } | null;
}) {
  let region: Region;
  if (driver) {
    const midLat = (customer.lat + driver.lat) / 2;
    const midLng = (customer.lng + driver.lng) / 2;
    region = {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: Math.abs(customer.lat - driver.lat) * 2.4 + 0.005,
      longitudeDelta: Math.abs(customer.lng - driver.lng) * 2.4 + 0.005,
    };
  } else {
    region = {
      latitude: customer.lat,
      longitude: customer.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }

  return (
    <MapView style={{ flex: 1 }} initialRegion={region} pointerEvents="none">
      <Marker
        coordinate={{ latitude: customer.lat, longitude: customer.lng }}
        title="الزبون"
        pinColor="#0891b2"
      />
      {driver && (
        <Marker
          coordinate={{ latitude: driver.lat, longitude: driver.lng }}
          title="موقعي"
          pinColor="#16a34a"
        />
      )}
    </MapView>
  );
}
