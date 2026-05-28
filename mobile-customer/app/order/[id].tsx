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

import { View, Text, Pressable, ScrollView, Linking, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MapView, { Marker, type Region } from 'react-native-maps';
import { api } from '@/lib/api';
import { iqd, fmtArabicDate } from '@/lib/format';
import type { RefillOrder, RefillOrderStatus } from '@/lib/types';

const STAGES: { key: RefillOrderStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'PENDING', label: 'تم استلام طلبك', icon: 'document-text' },
  { key: 'ASSIGNED', label: 'تم تعيين سائق', icon: 'person' },
  { key: 'EN_ROUTE', label: 'السائق في الطريق إليك', icon: 'car' },
  { key: 'COMPLETED', label: 'تم التسليم', icon: 'checkmark-circle' },
];

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

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
                          onPress: (val) =>
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
        </View>
      </ScrollView>
    </View>
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
  const custLat = order.deliveryLat ?? order.customer?.locationLat;
  const custLng = order.deliveryLng ?? order.customer?.locationLng;
  if (custLat == null || custLng == null) return null;
  const driverLat = order.driver?.lastLat ?? order.driver?.locationLat ?? null;
  const driverLng = order.driver?.lastLng ?? order.driver?.locationLng ?? null;

  // Default zoom shows ~1km around the customer. If we have a driver pin,
  // widen until both are comfortably in frame.
  let region: Region = {
    latitude: custLat,
    longitude: custLng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
  if (driverLat != null && driverLng != null) {
    const midLat = (custLat + driverLat) / 2;
    const midLng = (custLng + driverLng) / 2;
    const dLat = Math.abs(custLat - driverLat) * 2.4 + 0.005;
    const dLng = Math.abs(custLng - driverLng) * 2.4 + 0.005;
    region = { latitude: midLat, longitude: midLng, latitudeDelta: dLat, longitudeDelta: dLng };
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
