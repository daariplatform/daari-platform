/**
 * Order detail + driver tracking screen.
 *
 * يفتح من الـ Orders list (بضغطة على بطاقة طلب).
 * يعرض:
 *   - Timeline متحرّك (طلب → مقبول → توصيل → وصل)
 *   - معلومات السائق + زر اتصال
 *   - مكان التوصيل + ETA
 *   - تفاصيل السعر + طريقة الدفع
 *   - زر إلغاء (إذا الحالة pending/assigned)
 */

import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Linking, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MapView, { Marker, type Region } from 'react-native-maps';
import { api } from '@/lib/api';
import { iqd, fmtArabicDate } from '@/lib/format';
import { hap } from '@/lib/haptics';
import { useRateOrder, type OrderRating } from '@/lib/features/ratings';
import { StarRating } from '@/components/StarRating';
import { Burst } from '@/components/Burst';
import type { RefillOrder, RefillOrderStatus } from '@/lib/types';

const STAGES: { key: RefillOrderStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'PENDING', label: 'تم استلام طلبك', icon: 'document-text' },
  { key: 'ASSIGNED', label: 'تم تعيين سائق', icon: 'person' },
  { key: 'EN_ROUTE', label: 'السائق في الطريق إليك', icon: 'car' },
  { key: 'COMPLETED', label: 'تم التسليم', icon: 'checkmark-circle' },
];

/** Haversine distance in km between two lat/lng points. */
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Honest, distance-based ETA — NOT a hardcoded "within an hour". Returns a
 * minutes estimate computed from the driver's live position to the customer
 * at an assumed ~22 km/h Baghdad city speed, with a 3-min handling floor.
 * Returns null when we can't compute it (no driver coords yet), so the UI
 * shows nothing rather than a fake number.
 */
function computeEtaMinutes(order: any): number | null {
  const custLat = order?.deliveryLat ?? order?.customer?.locationLat;
  const custLng = order?.deliveryLng ?? order?.customer?.locationLng;
  const drvLat = order?.driver?.currentLat ?? order?.driver?.lastLat ?? null;
  const drvLng = order?.driver?.currentLng ?? order?.driver?.lastLng ?? null;
  if (custLat == null || custLng == null || drvLat == null || drvLng == null) return null;
  const km = distanceKm(drvLat, drvLng, custLat, custLng);
  const AVG_KMH = 22;
  const minutes = Math.round((km / AVG_KMH) * 60) + 3;
  return Math.max(3, minutes);
}

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showBurst, setShowBurst] = useState(false);

  const { data: order, isLoading } = useQuery<any>({
    queryKey: ['order', id],
    queryFn: async () => (await api.get(`/orders/${id}`)).data,
    refetchInterval: 15_000,
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    // The backend now scopes cancel by ownership + status; sending an
    // empty body is OK (reason becomes "ألغاه الزبون" by default), but
    // we pass an explicit Arabic reason so the manager-side audit log
    // reads clearly.
    mutationFn: async () =>
      (await api.post(`/orders/${id}/cancel`, { reason: 'إلغاء من الزبون' })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['customer', 'orders'] });
      Alert.alert('تم الإلغاء', 'تم إلغاء طلبك بنجاح');
    },
    onError: (err: any) => {
      // Backend returns 400/403 with an Arabic message for the cases
      // we deliberately block (already-assigned, not yours, etc.) —
      // surface that instead of a generic "try again".
      const msg =
        err?.response?.data?.message ?? 'فشل إلغاء الطلب — حاول مرة ثانية';
      Alert.alert('خطأ', msg);
    },
  });

  // Customer-side confirmation: after a refill is marked COMPLETED by
  // the driver, the customer taps to acknowledge they received it. The
  // plant dashboard watches this signal to chase un-confirmed refills
  // (which often indicate a delivery dispute).
  const confirmMutation = useMutation({
    mutationFn: async () => (await api.post(`/orders/${id}/confirm`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      Alert.alert('شكراً', 'تأكّد استلامك بنجاح. نسعد بخدمتك دائماً 💧');
    },
    onError: (err: any) => {
      Alert.alert(
        'خطأ',
        err?.response?.data?.message ?? 'تعذّر تأكيد التسليم. حاول لاحقاً.',
      );
    },
  });

  // Dispute: customer says "I didn't get this refill" / "tank was
  // wrong" / "driver overcharged". Opens an Alert.prompt — RN's
  // built-in prompt is iOS-only, but we use a simple multi-line
  // confirmation since most disputes need a written reason anyway.
  const disputeMutation = useMutation({
    mutationFn: async (reason: string) =>
      (await api.post(`/orders/${id}/dispute`, { reason })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      Alert.alert(
        'تم إرسال الشكوى',
        'سيتواصل معك المعمل خلال أربع وعشرين ساعة لحلّ المشكلة.',
      );
    },
    onError: (err: any) => {
      Alert.alert(
        'خطأ',
        err?.response?.data?.message ?? 'تعذّر إرسال الشكوى. حاول لاحقاً.',
      );
    },
  });

  if (isLoading || !order) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator color="#0891b2" size="large" />
      </SafeAreaView>
    );
  }

  const currentStageIdx = STAGES.findIndex((s) => s.key === order.status);
  const isCancellable = order.status === 'PENDING' || order.status === 'ASSIGNED';
  const isCancelled = order.status === 'CANCELLED' || order.status === 'FAILED';
  // Real ETA only while the driver is actually en route AND we have their
  // live coordinates — otherwise we deliberately show nothing.
  const etaMinutes = order.status === 'EN_ROUTE' ? computeEtaMinutes(order) : null;

  return (
    <View className="flex-1 bg-slate-50">
      {/* Hero */}
      <LinearGradient
        colors={isCancelled ? ['#dc2626', '#991b1b'] : ['#0e7490', '#0891b2']}
        style={{ paddingBottom: 36, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
      >
        <SafeAreaView edges={['top']}>
          <View className="px-5 pt-2 flex-row-reverse items-center justify-between">
            <Pressable
              onPress={() => router.back()}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="arrow-forward" size={22} color="white" />
            </Pressable>
            <View style={{ alignItems: 'flex-end' }}>
              <Text className="text-cyan-100 text-xs">طلب رقم</Text>
              <Text className="text-white font-bold text-xl">#{order.id.slice(-6).toUpperCase()}</Text>
            </View>
          </View>

          <View className="px-5 mt-6 flex-row-reverse items-center justify-between">
            <View>
              <Text className="text-cyan-100 text-[11px]">المبلغ</Text>
              <Text className="text-white text-2xl font-bold">{iqd(order.priceIqd ?? 0)}</Text>
            </View>
            <View style={{ alignItems: 'flex-start' }}>
              <Text className="text-cyan-100 text-[11px]">التاريخ</Text>
              <Text className="text-white text-sm">{fmtArabicDate(order.requestedAt)}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View className="px-4 -mt-5">
          {/* Timeline */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500 }}
            style={{ backgroundColor: 'white', borderRadius: 22, padding: 18, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }}
          >
            <Text className="text-base font-bold mb-3 text-right">حالة الطلب</Text>
            {isCancelled ? (
              <View className="bg-red-50 rounded-xl p-3 flex-row-reverse items-center">
                <Ionicons name="close-circle" size={28} color="#dc2626" />
                <Text className="text-red-700 font-bold mr-3 flex-1 text-right">تم إلغاء هذا الطلب</Text>
              </View>
            ) : (
              <View>
                {STAGES.map((stage, idx) => {
                  const isDone = idx < currentStageIdx;
                  const isCurrent = idx === currentStageIdx;
                  return (
                    <View key={stage.key} className="flex-row-reverse items-start mb-3">
                      <MotiView
                        animate={{
                          scale: isCurrent ? 1.1 : 1,
                          backgroundColor: isDone || isCurrent ? '#0891b2' : '#e2e8f0',
                        }}
                        transition={{ type: 'spring' }}
                        style={{
                          width: 36, height: 36, borderRadius: 18,
                          alignItems: 'center', justifyContent: 'center',
                          marginLeft: 12,
                        }}
                      >
                        <Ionicons
                          name={stage.icon}
                          size={18}
                          color={isDone || isCurrent ? 'white' : '#94a3b8'}
                        />
                      </MotiView>
                      <View style={{ flex: 1, paddingTop: 6 }}>
                        <Text
                          className={`text-sm font-bold text-right ${
                            isDone || isCurrent ? 'text-aqua-700' : 'text-slate-400'
                          }`}
                        >
                          {stage.label}
                        </Text>
                        {isCurrent && (
                          <Text className="text-xs text-slate-500 mt-0.5 text-right">جارٍ التحديث...</Text>
                        )}
                      </View>
                      {idx < STAGES.length - 1 && (
                        <View
                          style={{
                            position: 'absolute',
                            right: 17,
                            top: 36,
                            width: 2,
                            height: 24,
                            backgroundColor: isDone ? '#0891b2' : '#e2e8f0',
                          }}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Honest ETA — distance-based, only while the driver is en route
                and we have their live coords. No fake "within an hour". */}
            {etaMinutes != null && (
              <MotiView
                from={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring' }}
                style={{
                  marginTop: 12,
                  backgroundColor: '#ecfeff',
                  borderColor: '#a5f3fc',
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 12,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Ionicons name="time" size={22} color="#0891b2" />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ color: '#0e7490', fontWeight: '800', fontSize: 14 }}>
                    يصل خلال ~{etaMinutes} دقيقة تقريباً
                  </Text>
                  <Text style={{ color: '#0891b2', fontSize: 10, marginTop: 2 }}>
                    تقدير حسب موقع السائق الحالي — يتحدّث تلقائياً
                  </Text>
                </View>
              </MotiView>
            )}
          </MotiView>

          {/* Driver info */}
          {order.driver && (
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', delay: 200, duration: 500 }}
              style={{ backgroundColor: 'white', borderRadius: 22, padding: 16, marginTop: 12, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }}
            >
              <Text className="text-base font-bold mb-3 text-right">السائق</Text>
              <View className="flex-row-reverse items-center">
                <View
                  style={{
                    width: 52, height: 52, borderRadius: 26,
                    backgroundColor: '#0891b2',
                    alignItems: 'center', justifyContent: 'center',
                    marginLeft: 12,
                  }}
                >
                  <Ionicons name="person" size={28} color="white" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="font-bold text-base text-right">{order.driver.user.fullName}</Text>
                  {order.driver.vehiclePlate && (
                    <Text className="text-xs text-slate-500 text-right">المركبة: {order.driver.vehiclePlate}</Text>
                  )}
                </View>
                <Pressable
                  onPress={() => Linking.openURL(`tel:${order.driver?.user.phone}`)}
                  style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: '#ecfeff',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="call" size={20} color="#0891b2" />
                </Pressable>
              </View>
            </MotiView>
          )}

          {/* Map — customer pin + driver pin (if live). The data comes
              from the same order payload above; backend includes
              `deliveryLat/Lng` and `driver.lastLat/lastLng` when present. */}
          {(order.deliveryLat ?? order.customer?.locationLat) != null && (
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', delay: 250, duration: 500 }}
              style={{ backgroundColor: 'white', borderRadius: 22, padding: 12, marginTop: 12, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }}
            >
              <Text className="text-base font-bold mb-3 text-right px-2">الموقع</Text>
              <OrderMap order={order} />
              <Pressable
                onPress={() => {
                  const lat = order.deliveryLat ?? order.customer?.locationLat;
                  const lng = order.deliveryLng ?? order.customer?.locationLng;
                  if (lat == null || lng == null) return;
                  const url = Platform.select({
                    ios: `maps://?daddr=${lat},${lng}&dirflg=d`,
                    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
                  }) as string;
                  Linking.openURL(url).catch(() =>
                    Alert.alert('تعذّر فتح الخرائط', 'تأكد من تثبيت خرائط Google'),
                  );
                }}
                className="mt-2 mx-2 bg-cyan-50 border border-cyan-200 rounded-xl py-3 flex-row-reverse items-center justify-center gap-2"
              >
                <Ionicons name="navigate" size={18} color="#0891b2" />
                <Text className="text-cyan-700 font-bold text-sm">افتح في خرائط Google</Text>
              </Pressable>
            </MotiView>
          )}

          {/* Price + payment */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', delay: 300, duration: 500 }}
            style={{ backgroundColor: 'white', borderRadius: 22, padding: 16, marginTop: 12, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }}
          >
            <Text className="text-base font-bold mb-3 text-right">تفاصيل الدفع</Text>
            <Row label="سعر التعبئة" value={iqd(order.priceIqd ?? 0)} />
            <Row label="طريقة الدفع" value={order.paymentMethod ?? 'نقداً عند الاستلام'} />
            {order.notes && <Row label="ملاحظات" value={order.notes} />}
          </MotiView>

          {/* Cancel button — only while order is still PENDING */}
          {isCancellable && (
            <Pressable
              onPress={() =>
                Alert.alert('إلغاء الطلب', 'متأكد من الإلغاء؟', [
                  { text: 'لا', style: 'cancel' },
                  { text: 'نعم، إلغاء', style: 'destructive', onPress: () => cancelMutation.mutate() },
                ])
              }
              disabled={cancelMutation.isPending}
              style={{
                marginTop: 16,
                paddingVertical: 14,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: '#ef4444',
                backgroundColor: 'white',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#dc2626', fontWeight: '700' }}>
                {cancelMutation.isPending ? 'جارٍ الإلغاء...' : 'إلغاء الطلب'}
              </Text>
            </Pressable>
          )}

          {/* Confirm + Dispute — only after refill is COMPLETED but the
              customer hasn't acknowledged yet. `customerConfirmedAt` is
              the backend's signal that this loop is closed. */}
          {order.status === 'COMPLETED' && !order.customerConfirmedAt && (
            <View style={{ marginTop: 16, gap: 10 }}>
              <Pressable
                onPress={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                style={{
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: '#0e9384',
                  alignItems: 'center',
                  flexDirection: 'row-reverse',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="checkmark-circle" size={20} color="white" />
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>
                  {confirmMutation.isPending ? 'جارٍ التأكيد...' : 'أكّد استلام التعبئة'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  // Cross-platform compatible: native prompt only works
                  // on iOS, so on Android we fall back to a fixed
                  // generic reason. The manager-side dashboard surfaces
                  // the dispute row regardless, and the manager calls
                  // the customer for details.
                  if (typeof Alert.prompt === 'function') {
                    Alert.prompt(
                      'إبلاغ عن مشكلة',
                      'صف المشكلة باختصار:',
                      [
                        { text: 'إلغاء', style: 'cancel' },
                        {
                          text: 'إرسال',
                          onPress: (val?: string) =>
                            disputeMutation.mutate(
                              (val ?? '').trim() || 'مشكلة في الطلب',
                            ),
                        },
                      ],
                      'plain-text',
                    );
                  } else {
                    Alert.alert(
                      'إبلاغ عن مشكلة',
                      'سيتواصل المعمل معك خلال ٢٤ ساعة. هل تريد المتابعة؟',
                      [
                        { text: 'إلغاء', style: 'cancel' },
                        {
                          text: 'متابعة',
                          style: 'destructive',
                          onPress: () =>
                            disputeMutation.mutate('مشكلة في الطلب'),
                        },
                      ],
                    );
                  }
                }}
                disabled={disputeMutation.isPending}
                style={{
                  paddingVertical: 14,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: '#f59e0b',
                  backgroundColor: 'white',
                  alignItems: 'center',
                  flexDirection: 'row-reverse',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="alert-circle" size={20} color="#d97706" />
                <Text style={{ color: '#b45309', fontWeight: '700' }}>
                  {disputeMutation.isPending ? 'جارٍ الإرسال...' : 'أبلغ عن مشكلة'}
                </Text>
              </Pressable>
            </View>
          )}

          {order.status === 'COMPLETED' && order.customerConfirmedAt && (
            <View
              style={{
                marginTop: 16,
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: '#ecfdf5',
                borderWidth: 1,
                borderColor: '#a7f3d0',
                alignItems: 'center',
                flexDirection: 'row-reverse',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="checkmark-done" size={18} color="#047857" />
              <Text style={{ color: '#047857', fontWeight: '700' }}>
                تأكّد استلام التعبئة. شكراً!
              </Text>
            </View>
          )}

          {/* Ratings — only for completed orders. Shows the prompt when no
              rating exists yet, otherwise the submitted rating. */}
          {order.status === 'COMPLETED' && (
            <RatingSection
              orderId={order.id}
              rating={order.rating ?? null}
              onCelebrate={() => {
                hap.success();
                setShowBurst(true);
              }}
            />
          )}
        </View>
      </ScrollView>

      {/* Celebratory burst overlay — fires once after a rating is submitted. */}
      {showBurst && <Burst onDone={() => setShowBurst(false)} />}
    </View>
  );
}

/**
 * Star-rating prompt (when `rating` is null) OR a read-only display of the
 * already-submitted rating. Spring-pop stars, optional comment, and a
 * celebratory burst (via `onCelebrate`) on a successful submit.
 */
function RatingSection({
  orderId,
  rating,
  onCelebrate,
}: {
  orderId: string;
  rating: OrderRating | null;
  onCelebrate: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const rate = useRateOrder(orderId);

  // Already rated — show it nicely.
  if (rating) {
    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', delay: 200, duration: 500 }}
        style={{
          backgroundColor: 'white',
          borderRadius: 22,
          padding: 18,
          marginTop: 16,
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        }}
      >
        <Text className="text-base font-bold mb-3 text-right">تقييمك</Text>
        <StarRating value={rating.stars} editable={false} size={32} />
        {rating.comment ? (
          <View
            style={{
              backgroundColor: '#f8fafc',
              borderRadius: 14,
              padding: 12,
              marginTop: 12,
            }}
          >
            <Text style={{ color: '#475569', fontSize: 13, textAlign: 'right', lineHeight: 20 }}>
              {rating.comment}
            </Text>
          </View>
        ) : null}
        <Text style={{ color: '#94a3b8', fontSize: 10, textAlign: 'center', marginTop: 10 }}>
          شكراً لمساعدتنا على تحسين الخدمة 💧
        </Text>
      </MotiView>
    );
  }

  async function submit() {
    if (stars === 0 || rate.isPending) return;
    try {
      await rate.mutateAsync({ stars, comment: comment.trim() || undefined });
      onCelebrate();
    } catch (err: any) {
      hap.error();
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر إرسال التقييم. حاول لاحقاً.');
    }
  }

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20, scale: 0.97 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: 'spring', delay: 200, damping: 15 }}
      style={{
        borderRadius: 22,
        marginTop: 16,
        overflow: 'hidden',
        shadowColor: '#0891b2',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
      <LinearGradient
        colors={['#ecfeff', '#ffffff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ padding: 18, borderWidth: 1, borderColor: '#a5f3fc', borderRadius: 22 }}
      >
        {/* Pulsing heading icon */}
        <View style={{ alignItems: 'center', marginBottom: 6 }}>
          <MotiView
            from={{ scale: 0.9 }}
            animate={{ scale: 1.06 }}
            transition={{ loop: true, type: 'timing', duration: 1300 }}
          >
            <LinearGradient
              colors={['#22d3ee', '#0891b2']}
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="sparkles" size={28} color="#fff" />
            </LinearGradient>
          </MotiView>
        </View>
        <Text className="text-base font-bold text-center" style={{ color: '#0e7490' }}>
          كيف كانت تجربتك؟
        </Text>
        <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 2, marginBottom: 14 }}>
          قيّم تعبئتك ليصلك خدمة أفضل في المرة القادمة
        </Text>

        <StarRating value={stars} onChange={setStars} size={42} />

        {stars > 0 && (
          <MotiView
            from={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 90 }}
            transition={{ type: 'timing', duration: 300 }}
            style={{ overflow: 'hidden', marginTop: 14 }}
          >
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="أضف تعليقاً (اختياري)…"
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={300}
              textAlign="right"
              style={{
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: '#cbd5e1',
                borderRadius: 14,
                padding: 12,
                minHeight: 70,
                fontSize: 13,
                color: '#0f172a',
                textAlignVertical: 'top',
              }}
            />
          </MotiView>
        )}

        <Pressable onPress={submit} disabled={stars === 0 || rate.isPending} style={{ marginTop: 14 }}>
          <LinearGradient
            colors={stars === 0 ? ['#cbd5e1', '#94a3b8'] : ['#06b6d4', '#0891b2', '#0e7490']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingVertical: 14,
              borderRadius: 14,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {rate.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>إرسال التقييم</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </LinearGradient>
    </MotiView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row-reverse justify-between py-2 border-b border-slate-100">
      <Text className="text-sm text-slate-500">{label}</Text>
      <Text className="text-sm font-bold text-slate-900">{value}</Text>
    </View>
  );
}

/**
 * Static-ish map preview for the order. Centers on the customer's address;
 * adds a driver pin if the backend has reported a `driver.lastLat/lastLng`.
 * We avoid panning to follow the driver — the live tracking polls every
 * 15s elsewhere; a hard re-center would feel jarring during a scroll.
 */
function OrderMap({ order }: { order: any }) {
  // MapKit's setRegion: raises an (uncatchable) NSException — which crashes
  // the whole app — if it receives a non-finite coordinate or a span wider
  // than its valid range (lat>180 / lng>360). So we (1) require finite
  // customer coords, (2) accept the driver pin ONLY when it's finite AND
  // plausibly near the customer (< ~1.5° ≈ 160 km — a far/garbage fix such as
  // a simulator's default GPS is ignored), and (3) clamp the region span.
  const fin = (n: any): n is number => typeof n === 'number' && Number.isFinite(n);
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

  const custLat = order.deliveryLat ?? order.customer?.locationLat;
  const custLng = order.deliveryLng ?? order.customer?.locationLng;
  if (!fin(custLat) || !fin(custLng)) return null;

  const dvLat = order.driver?.currentLat ?? order.driver?.lastLat ?? order.driver?.locationLat;
  const dvLng = order.driver?.currentLng ?? order.driver?.lastLng ?? order.driver?.locationLng;
  const hasDriver =
    fin(dvLat) && fin(dvLng) &&
    Math.abs(custLat - dvLat) < 1.5 && Math.abs(custLng - dvLng) < 1.5;
  const driverLat = hasDriver ? dvLat : null;
  const driverLng = hasDriver ? dvLng : null;

  // Default zoom shows ~1km around the customer. If we have a (near) driver
  // pin, widen until both are in frame — but never beyond a safe 1.5° span.
  let region: Region = {
    latitude: custLat,
    longitude: custLng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
  if (driverLat != null && driverLng != null) {
    region = {
      latitude: (custLat + driverLat) / 2,
      longitude: (custLng + driverLng) / 2,
      latitudeDelta: clamp(Math.abs(custLat - driverLat) * 2.4 + 0.01, 0.005, 1.5),
      longitudeDelta: clamp(Math.abs(custLng - driverLng) * 2.4 + 0.01, 0.005, 1.5),
    };
  }

  return (
    <View style={{ height: 200, borderRadius: 14, overflow: 'hidden', marginHorizontal: 8 }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={region}
        pointerEvents="none"
      >
        <Marker
          coordinate={{ latitude: custLat, longitude: custLng }}
          title="عنوان التوصيل"
          pinColor="#0891b2"
        />
        {driverLat != null && driverLng != null && (
          <Marker
            coordinate={{ latitude: driverLat, longitude: driverLng }}
            title="السائق"
            pinColor="#f59e0b"
          />
        )}
      </MapView>
    </View>
  );
}
