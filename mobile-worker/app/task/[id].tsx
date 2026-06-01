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
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import MapView, { Marker, type Region } from 'react-native-maps';
import { usePostHog } from 'posthog-react-native';
import {
  useMyTodayTasks,
  useCompleteOrder,
  useReclaimTank,
  useStartOrder,
} from '@/lib/queries';
import { getCurrentCoords, distanceMetres } from '@/lib/location';
import { enqueue } from '@/lib/offline-queue';
import { iqd } from '@/lib/format';
import { track } from '@/lib/posthog';
import { api } from '@/lib/api';

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
  const startOrder = useStartOrder();
  const [reclaimReason, setReclaimReason] =
    useState<typeof RECLAIM_REASONS[number]['id'] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Payment is cash-only by request — no picker. The completion body sends
  // paymentMethod:'CASH' directly.

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
      // Photo proof + payment-method picker were removed by request: every
      // sale is cash, and the tank photo was dropped to save device storage
      // and upload bandwidth. GPS arrival stays as the completion evidence.
      const body = {
        paymentMethod: 'CASH' as const,
        paidAmountIqd: task!.priceIqd,
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
   * Cancel the current task with a driver-side reason. Backend
   * /orders/:id/cancel accepts the driver capability and a `reason`
   * string; the service-layer ensures the driver can only cancel
   * their own ASSIGNED/EN_ROUTE order. Used for "no customer at door"
   * / "wrong address" / "customer refused" cases.
   */
  async function cancelWithReason(reason: string) {
    if (!task) return;
    setSubmitting(true);
    try {
      await api.post(`/orders/${task.id}/cancel`, { reason });
      track(ph, 'order_cancelled_by_driver', { orderId: task.id, reason });
      Alert.alert('تم', 'تم إلغاء الطلب. أبلغ المعمل بالتفاصيل إذا لزم.');
      router.back();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ?? 'تعذّر الإلغاء — حاول لاحقاً.';
      Alert.alert('خطأ', msg);
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
      // Photo proof removed (storage/bandwidth). Reclaim still records the
      // mandatory reason for the plant's audit trail.
      const body = {
        paymentMethod: 'CASH' as const,
        paidAmountIqd: 0,
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

  // ── Presentational derivations (pure JS, run during render only) ──────────
  const customer = task.customer ?? null;
  const status = task.status;
  const isAssigned = status === 'ASSIGNED';
  const isEnRoute = status === 'EN_ROUTE';
  const isArrivedLike = status === 'EN_ROUTE'; // driver has started; green "arrival" theme
  const isDone = status === 'COMPLETED';
  const isReclaim = task.kind === 'TANK_RECLAIM';
  const kindLabel =
    task.kind === 'REFILL'
      ? 'مهمة تعبئة'
      : task.kind === 'TANK_DELIVERY'
        ? 'مهمة توصيل'
        : 'سحب خزان';
  const completeVerb = task.kind === 'TANK_DELIVERY' ? 'التوصيل' : 'التعبئة';

  // Status pill text shown on the gradient header.
  const statusPill = isDone
    ? 'مكتمل'
    : isEnRoute
      ? 'في الطريق'
      : isAssigned
        ? 'مقبول'
        : status === 'CANCELLED'
          ? 'ملغي'
          : status === 'FAILED'
            ? 'فشل'
            : 'قيد الانتظار';

  // Green theme once the driver is en-route / arrived (or done), aqua otherwise.
  const greenTheme = isEnRoute || isDone;
  const headerColors: [string, string] = greenTheme
    ? ['#047857', '#10b981']
    : ['#0e7490', '#06b6d4'];

  // Avatar initial — guarded so a null/empty name never crashes.
  const avatarInitial = customer?.fullName?.[0] ?? '؟';

  // Real distance/ETA from the live driver fix + customer GPS. Only shown
  // when BOTH coordinates exist — otherwise we fall back to the address text,
  // never a fabricated number. distanceMetres is a plain JS helper invoked in
  // render (not inside any worklet).
  const hasCustomerCoord =
    customer?.locationLat != null && customer?.locationLng != null;
  let distanceText: string | null = null;
  let etaText: string | null = null;
  if (hasCustomerCoord && driverCoord) {
    const metres = distanceMetres(
      { lat: driverCoord.lat, lng: driverCoord.lng },
      { lat: customer!.locationLat!, lng: customer!.locationLng! },
    );
    const km = metres / 1000;
    distanceText = km >= 1 ? `${km.toFixed(1)} كم` : `${Math.round(metres)} م`;
    // ETA estimate from straight-line distance at ~22 km/h city driving.
    const mins = Math.max(1, Math.round((km / 22) * 60));
    etaText = `${mins} دقيقة`;
  }

  // Step tracker state. Pure presentational mapping from order status.
  // قبول → في الطريق → وصلت → تعبئة → تأكيد
  // ASSIGNED: step 0 done, step 1 current. EN_ROUTE: steps 0-1 done, step 2 current.
  const stepCurrentIndex = isDone ? 5 : isEnRoute ? 2 : 1;
  const steps = ['قبول', 'في الطريق', 'وصلت', 'تعبئة', 'تأكيد'];

  return (
    <View className="flex-1" style={{ backgroundColor: '#f6f8fa' }}>
      {/* ── Gradient header — back arrow, title, status pill, customer name + address + QR ── */}
      <LinearGradient
        colors={headerColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingHorizontal: 16,
          paddingBottom: 26,
          borderBottomLeftRadius: 26,
          borderBottomRightRadius: 26,
        }}
      >
        <SafeAreaView edges={['top']}>
          <View
            className="flex-row-reverse items-center justify-between"
            style={{ paddingTop: 4 }}
          >
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={{
                width: 38,
                height: 38,
                borderRadius: 13,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name="arrow-forward" size={20} color="#fff" />
            </Pressable>

            <Text className="text-white font-bold text-[17px]">{kindLabel}</Text>

            <View
              className="flex-row-reverse items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: '#fff',
                }}
              />
              <Text className="text-white text-[11.5px] font-bold">{statusPill}</Text>
            </View>
          </View>

          <View className="mt-3.5" style={{ alignItems: 'flex-end' }}>
            <Text className="text-white font-black text-[21px]">
              {customer?.fullName ?? '—'}
            </Text>
            <Text className="text-white text-[12.5px] mt-1" style={{ opacity: 0.9 }}>
              {(customer?.addressLine ?? '') +
                (customer?.district ? ` · ${customer.district}` : '') +
                (task.tank?.qrCode ? ` · QR ${task.tank.qrCode}` : '')}
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Map with floating glass overlay (distance + ETA or destination) + compact nav button ── */}
        <Animated.View
          entering={FadeInDown.duration(380)}
          style={{
            height: 168,
            borderRadius: 20,
            overflow: 'hidden',
            marginTop: -14,
            shadowColor: '#0f172a',
            shadowOpacity: 0.1,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 6,
            backgroundColor: '#eaf0f4',
          }}
        >
          {hasCustomerCoord ? (
            <TaskMap
              customer={{ lat: customer!.locationLat!, lng: customer!.locationLng! }}
              driver={driverCoord}
            />
          ) : (
            <View
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <MaterialIcons name="location-off" size={28} color="#94a3b8" />
              <Text className="text-slate-400 text-[12px] mt-1">
                لا يوجد موقع GPS — استعمل العنوان
              </Text>
            </View>
          )}

          {/* Glass overlay */}
          <View
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              bottom: 10,
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 9,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: '#0f172a',
              shadowOpacity: 0.12,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}
          >
            <View className="flex-row-reverse" style={{ gap: 16, flex: 1 }}>
              {distanceText ? (
                <>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text className="text-slate-600 text-[11px] font-bold">المسافة</Text>
                    <Text style={{ color: '#0f172a' }} className="text-[15px] font-black">
                      {distanceText}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text className="text-slate-600 text-[11px] font-bold">الوصول</Text>
                    <Text style={{ color: '#0f172a' }} className="text-[15px] font-black">
                      {etaText}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={{ alignItems: 'flex-end', flex: 1 }}>
                  <Text className="text-slate-600 text-[11px] font-bold">الوجهة</Text>
                  <Text
                    style={{ color: '#0f172a' }}
                    className="text-[13px] font-black"
                    numberOfLines={1}
                  >
                    {customer?.addressLine ?? customer?.district ?? '—'}
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={openNavigation}
              className="flex-row-reverse items-center gap-1.5"
              style={{
                backgroundColor: greenTheme ? '#059669' : '#0891b2',
                borderRadius: 11,
                paddingHorizontal: 12,
                paddingVertical: 9,
              }}
            >
              <MaterialIcons name="navigation" size={15} color="#fff" />
              <Text className="text-white text-[12.5px] font-bold">الملاحة</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* ── Customer card: avatar + name + phone + compact circular call/whatsapp buttons ── */}
        <Animated.View
          entering={FadeInDown.duration(380).delay(60)}
          className="bg-white"
          style={{
            borderRadius: 22,
            padding: 13,
            marginTop: 14,
            shadowColor: '#0f172a',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          <View className="flex-row-reverse items-center" style={{ gap: 11 }}>
            <LinearGradient
              colors={['#22d3ee', '#0e7490']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 46,
                height: 46,
                borderRadius: 15,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text className="text-white font-black text-[18px]">{avatarInitial}</Text>
            </LinearGradient>

            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text className="font-bold text-[15px] text-slate-900">
                {customer?.fullName ?? '—'}
              </Text>
              <Text className="text-[11.5px] text-slate-400 mt-0.5">
                {customer?.phone ?? 'لا يوجد رقم'}
              </Text>
            </View>

            {customer?.phone ? (
              <View className="flex-row-reverse" style={{ gap: 8 }}>
                <Pressable
                  onPress={() => Linking.openURL(`tel:${customer.phone}`)}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 15,
                    backgroundColor: '#10b981',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons name="call" size={20} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={() =>
                    Linking.openURL(
                      `https://wa.me/${customer.phone.replace(/^0/, '964')}`,
                    )
                  }
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 15,
                    backgroundColor: '#25D366',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons name="chat" size={20} color="#fff" />
                </Pressable>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {isReclaim ? (
          /* ── TANK_RECLAIM branch — unchanged logic, restyled container ── */
          <Animated.View entering={FadeInDown.duration(380).delay(120)} className="mt-4">
            <Text className="font-bold text-sm mb-2 text-right">اختر سبب السحب:</Text>
            {RECLAIM_REASONS.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setReclaimReason(r.id)}
                className={`bg-white rounded-2xl p-3 mb-2 flex-row-reverse items-center gap-3 border-2 ${
                  reclaimReason === r.id ? 'border-danger-500' : 'border-transparent'
                }`}
              >
                <Text className="text-xl">{r.emoji}</Text>
                <Text className="flex-1 font-bold text-sm text-right">{r.label}</Text>
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
              className={`rounded-2xl py-4 mt-3 items-center ${
                submitting || !reclaimReason ? 'bg-slate-300' : 'bg-danger-500'
              }`}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold">✓ أكّد السحب</Text>
              )}
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {/* ── Step tracker (horizontal): قبول ✓ → في الطريق → وصلت → تعبئة → تأكيد ── */}
            <Animated.View
              entering={FadeInDown.duration(380).delay(120)}
              className="flex-row-reverse items-start justify-between"
              style={{ marginTop: 16, marginBottom: 6, paddingHorizontal: 4 }}
            >
              {steps.map((label, i) => {
                const done = i < stepCurrentIndex;
                const current = i === stepCurrentIndex;
                const circleBg = done ? '#10b981' : current ? '#0891b2' : '#e2e8f0';
                const circleColor = done || current ? '#fff' : '#94a3b8';
                return (
                  <View key={label} style={{ flex: 1, alignItems: 'center' }}>
                    {/* connector line to the previous (visually right) step */}
                    {i < steps.length - 1 && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 14,
                          right: '-50%',
                          width: '100%',
                          height: 3,
                          backgroundColor: i < stepCurrentIndex ? '#34d399' : '#e2e8f0',
                        }}
                      />
                    )}
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: circleBg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                        ...(current
                          ? {
                              shadowColor: '#0891b2',
                              shadowOpacity: 0.4,
                              shadowRadius: 6,
                              shadowOffset: { width: 0, height: 0 },
                            }
                          : null),
                      }}
                    >
                      <Text style={{ color: circleColor }} className="text-[12px] font-bold">
                        {done ? '✓' : current ? '●' : String(i + 1)}
                      </Text>
                    </View>
                    <Text
                      className="text-[10px] font-bold mt-1.5 text-center"
                      style={{ color: done || current ? '#0f172a' : '#94a3b8' }}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
            </Animated.View>

            {/* ── Cash card (gradient): تُحصّل نقداً عند التسليم + big price ── */}
            <Animated.View entering={FadeInDown.duration(380).delay(180)}>
              <LinearGradient
                colors={['#0e7490', '#0891b2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 20,
                  padding: 16,
                  marginTop: 12,
                  marginBottom: 14,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  shadowColor: '#0891b2',
                  shadowOpacity: 0.28,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 12 },
                  elevation: 5,
                }}
              >
                <View style={{ alignItems: 'flex-end' }}>
                  <Text className="text-white text-[12px] font-bold" style={{ opacity: 0.9 }}>
                    تُحصّل نقداً عند التسليم
                  </Text>
                  <Text className="text-white font-black text-[26px] mt-0.5">
                    {iqd(task.priceIqd ?? 0)}
                  </Text>
                </View>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 15,
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons name="payments" size={24} color="#fff" />
                </View>
              </LinearGradient>
            </Animated.View>

            {/* checklist (kept from original — informational) */}
            <View
              className="bg-white rounded-2xl p-3 mb-3"
              style={{ borderWidth: 1, borderColor: '#e2e8f0' }}
            >
              <Text className="text-[11.5px] text-slate-600 leading-6 text-right">
                ✓ سيُؤخذ GPS تلقائياً للتحقق من وصولك للعنوان{'\n'}
                ✓ الدفع نقدي عند التسليم{'\n'}
                ✓ الزبون سيستلم تأكيد عبر WhatsApp تلقائياً
              </Text>
            </View>

            {/* ── ONE primary action button — changes with status, same handlers ── */}
            {isAssigned ? (
              <Pressable onPress={onStartTrip} disabled={submitting}>
                <LinearGradient
                  colors={submitting ? ['#cbd5e1', '#94a3b8'] : ['#06b6d4', '#0e7490']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 16,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#0891b2',
                    shadowOpacity: 0.3,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 5,
                  }}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-[16px]">▶ ابدأ التوصيل</Text>
                  )}
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable onPress={onCompleteRefill} disabled={submitting}>
                <LinearGradient
                  colors={submitting ? ['#cbd5e1', '#94a3b8'] : ['#10b981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 16,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#059669',
                    shadowOpacity: 0.3,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 5,
                  }}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-[16px]">
                      ✓ تأكيد {completeVerb} والتحصيل
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            )}

            {/* ── Subtle secondary: تعذّر التسليم (fail path) — unchanged handler ── */}
            {(isAssigned || isEnRoute) && (
              <Pressable
                onPress={() => {
                  Alert.alert(
                    'تعذّر التسليم',
                    'اختر السبب',
                    [
                      { text: 'إلغاء', style: 'cancel' },
                      {
                        text: 'الزبون غير متواجد',
                        onPress: () => cancelWithReason('الزبون غير متواجد'),
                      },
                      {
                        text: 'العنوان خاطئ',
                        onPress: () => cancelWithReason('العنوان خاطئ'),
                      },
                      {
                        text: 'رفض الزبون',
                        onPress: () => cancelWithReason('رفض الزبون'),
                      },
                    ],
                  );
                }}
                disabled={submitting}
                className="mt-2.5 rounded-2xl py-3 items-center bg-white"
                style={{ borderWidth: 1.5, borderColor: '#fecaca' }}
              >
                <Text className="text-danger-500 font-bold text-[13.5px]">
                  ✕ تعذّر التسليم
                </Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </View>
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
  // MapKit's setRegion: raises an uncatchable NSException (crashes the whole
  // app) on a non-finite coordinate or a span beyond its valid range. So we
  // require finite customer coords, only use the driver pin when it's finite
  // AND plausibly near (< ~1.5° ≈ 160 km — a far/garbage GPS fix is ignored),
  // and clamp the region span.
  const fin = (n: any): n is number => typeof n === 'number' && Number.isFinite(n);
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

  if (!fin(customer?.lat) || !fin(customer?.lng)) return null;
  const nearDriver =
    driver && fin(driver.lat) && fin(driver.lng) &&
    Math.abs(customer.lat - driver.lat) < 1.5 && Math.abs(customer.lng - driver.lng) < 1.5
      ? driver
      : null;

  let region: Region;
  if (nearDriver) {
    region = {
      latitude: (customer.lat + nearDriver.lat) / 2,
      longitude: (customer.lng + nearDriver.lng) / 2,
      latitudeDelta: clamp(Math.abs(customer.lat - nearDriver.lat) * 2.4 + 0.01, 0.005, 1.5),
      longitudeDelta: clamp(Math.abs(customer.lng - nearDriver.lng) * 2.4 + 0.01, 0.005, 1.5),
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
      {nearDriver && (
        <Marker
          coordinate={{ latitude: nearDriver.lat, longitude: nearDriver.lng }}
          title="موقعي"
          pinColor="#16a34a"
        />
      )}
    </MapView>
  );
}
