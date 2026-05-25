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

import { View, Text, Pressable, ScrollView, Linking, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    mutationFn: async () => (await api.post(`/orders/${id}/cancel`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['customer', 'orders'] });
      Alert.alert('تم الإلغاء', 'تم إلغاء طلبك بنجاح');
    },
    onError: () => Alert.alert('خطأ', 'فشل إلغاء الطلب — حاول مرة ثانية'),
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

          {/* Cancel button */}
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
