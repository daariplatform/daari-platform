/**
 * طلباتي — full order history, grouped by month, with reorder + a quick
 * receipt peek for completed orders. Each row is tappable to the full order
 * detail (timeline / tracking / receipt).
 */
import { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useMyOrders, useMyProfile, useCreateRefillOrder } from '@/lib/queries';
import { iqd, fmtArabicDate } from '@/lib/format';
import { hap } from '@/lib/haptics';
import { SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import type { RefillOrder, RefillOrderStatus, RefillOrderKind } from '@/lib/types';

const statusLabel: Record<RefillOrderStatus, string> = {
  PENDING: 'بانتظار التأكيد',
  ASSIGNED: 'مُسنَد لسائق',
  EN_ROUTE: 'في الطريق',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغى',
  FAILED: 'فشل',
};
const statusGradient: Record<RefillOrderStatus, [string, string]> = {
  PENDING: ['#fbbf24', '#d97706'],
  ASSIGNED: ['#7dd3fc', '#0284c7'],
  EN_ROUTE: ['#fb923c', '#ea580c'],
  COMPLETED: ['#34d399', '#059669'],
  CANCELLED: ['#fca5a5', '#dc2626'],
  FAILED: ['#fca5a5', '#dc2626'],
};
const statusIcon: Record<RefillOrderStatus, keyof typeof Ionicons.glyphMap> = {
  PENDING: 'time',
  ASSIGNED: 'person',
  EN_ROUTE: 'car',
  COMPLETED: 'checkmark-circle',
  CANCELLED: 'close-circle',
  FAILED: 'alert-circle',
};
const kindLabel: Record<RefillOrderKind, string> = {
  REFILL: 'تعبئة خزان',
  TANK_DELIVERY: 'توصيل خزان جديد',
  TANK_RECLAIM: 'سحب الخزان',
  WALKIN_SALE: 'بيع فوري',
};

/** Group orders into month buckets ("مايو ٢٠٢٦") for a clean history list. */
function groupByMonth(orders: RefillOrder[]) {
  const groups: { label: string; items: RefillOrder[] }[] = [];
  const fmt = new Intl.DateTimeFormat('ar-IQ', { month: 'long', year: 'numeric' });
  for (const o of orders) {
    const label = fmt.format(new Date(o.requestedAt));
    let g = groups.find((x) => x.label === label);
    if (!g) {
      g = { label, items: [] };
      groups.push(g);
    }
    g.items.push(o);
  }
  return groups;
}

export default function Orders() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useMyOrders();
  const { data: profile } = useMyProfile();
  const createOrder = useCreateRefillOrder();
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo(() => groupByMonth(data ?? []), [data]);

  // Block reorder when a refill is already in flight (matches home guard).
  const activeOrder = (data ?? []).find(
    (o) => o.kind === 'REFILL' && ['PENDING', 'ASSIGNED', 'EN_ROUTE'].includes(o.status),
  );

  async function reorder() {
    if (!profile) return;
    if (activeOrder) {
      router.push(`/order/${activeOrder.id}` as any);
      return;
    }
    hap.press();
    try {
      const res: any = await createOrder.mutateAsync(profile.id);
      hap.success();
      Alert.alert('تم إرسال الطلب', 'سيتولّى سائق طلبك. يمكنك متابعته الآن.');
      if (res?.id) router.push(`/order/${res.id}` as any);
    } catch (err: any) {
      hap.error();
      Alert.alert('خطأ', err?.response?.data?.message ?? 'حاول مرة أخرى');
    }
  }

  return (
    <View className="flex-1 bg-slate-50">
      <SafeAreaView edges={['top']}>
        <View className="px-5 pt-4 pb-3 flex-row-reverse items-center justify-between">
          <Text className="text-2xl font-bold" style={{ letterSpacing: -0.3 }}>طلباتي</Text>
          <View style={{ backgroundColor: '#ecfeff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text className="text-aqua-700 text-xs font-bold">{data ? `${data.length} طلب` : '...'}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0891b2" colors={['#0891b2']} />}
      >
        {isLoading ? (
          <>
            <SkeletonCard height={110} />
            <SkeletonCard height={110} />
            <SkeletonCard height={110} />
          </>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon="local-shipping"
            title="لا توجد طلبات بعد"
            subtitle="اضغط على زر «اطلب تعبئة الآن» في الشاشة الرئيسية لأول طلب"
            actionLabel="اطلب تعبئتك الأولى"
            onAction={() => router.push('/(tabs)/home')}
          />
        ) : (
          groups.map((group, gi) => (
            <View key={group.label}>
              {/* Month header */}
              <MotiView
                from={{ opacity: 0, translateX: 10 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', delay: gi * 60, duration: 300 }}
                className="flex-row-reverse items-center gap-2 mt-3 mb-2"
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#0891b2' }} />
                <Text className="text-xs font-bold text-slate-400">{group.label}</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
              </MotiView>

              {group.items.map((o, idx) => {
                const isOpen = expanded === o.id;
                return (
                  <MotiView
                    key={o.id}
                    from={{ opacity: 0, translateY: 14 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', delay: idx * 40, duration: 300 }}
                  >
                    <Pressable
                      onPress={() => router.push(`/order/${o.id}` as any)}
                      style={{ backgroundColor: 'white', borderRadius: 18, padding: 14, marginBottom: 10, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 }}
                    >
                      <View className="flex-row-reverse items-center mb-2">
                        <LinearGradient colors={statusGradient[o.status]} style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}>
                          <Ionicons name={statusIcon[o.status]} size={22} color="white" />
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                          <Text className="font-bold text-base text-right">{kindLabel[o.kind]}</Text>
                          <Text className="text-[11px] text-slate-500 text-right mt-0.5">{fmtArabicDate(o.requestedAt)}</Text>
                        </View>
                        <Ionicons name="chevron-back" size={20} color="#cbd5e1" />
                      </View>

                      <View className="flex-row-reverse items-center justify-between pt-2 border-t border-slate-100">
                        <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, backgroundColor: `${statusGradient[o.status][1]}15` }}>
                          <Text className="text-[10px] font-bold" style={{ color: statusGradient[o.status][1] }}>{statusLabel[o.status]}</Text>
                        </View>
                        <Text className="font-bold text-aqua-700">{o.priceIqd > 0 ? iqd(o.priceIqd) : 'مجاناً'}</Text>
                      </View>

                      {/* Actions for completed orders: receipt peek + reorder */}
                      {o.status === 'COMPLETED' && (
                        <View className="flex-row-reverse items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                          <Pressable
                            onPress={() => { hap.tap(); setExpanded(isOpen ? null : o.id); }}
                            className="flex-row-reverse items-center gap-1.5 bg-slate-100 px-3 py-2 rounded-full"
                          >
                            <Ionicons name={isOpen ? 'chevron-up' : 'receipt-outline'} size={14} color="#475569" />
                            <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700' }}>الإيصال</Text>
                          </Pressable>
                          {o.kind === 'REFILL' && (
                            <Pressable
                              onPress={reorder}
                              disabled={createOrder.isPending}
                              className="flex-row-reverse items-center gap-1.5 px-3 py-2 rounded-full"
                              style={{ backgroundColor: '#ecfeff' }}
                            >
                              <Ionicons name="refresh" size={14} color="#0891b2" />
                              <Text style={{ color: '#0891b2', fontSize: 11, fontWeight: '800' }}>
                                {createOrder.isPending ? 'جارٍ…' : 'أعد الطلب'}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      )}

                      {/* Inline receipt */}
                      {isOpen && o.status === 'COMPLETED' && (
                        <MotiView
                          from={{ opacity: 0, translateY: -6 }}
                          animate={{ opacity: 1, translateY: 0 }}
                          transition={{ type: 'timing', duration: 250 }}
                          style={{ marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 14, padding: 12 }}
                        >
                          <ReceiptRow label="رقم الطلب" value={`#${o.id.slice(-6).toUpperCase()}`} />
                          <ReceiptRow label="المبلغ" value={o.priceIqd > 0 ? iqd(o.priceIqd) : 'مجاناً'} />
                          <ReceiptRow label="المدفوع" value={iqd(o.paidAmountIqd ?? 0)} />
                          <ReceiptRow label="طريقة الدفع" value="نقداً عند الاستلام" />
                          {o.driver?.user?.fullName && <ReceiptRow label="السائق" value={o.driver.user.fullName} />}
                          <ReceiptRow label="تاريخ التسليم" value={fmtArabicDate(o.completedAt ?? o.requestedAt)} last />
                        </MotiView>
                      )}
                    </Pressable>
                  </MotiView>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ReceiptRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        paddingVertical: 7,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: '#e2e8f0',
      }}
    >
      <Text style={{ color: '#64748b', fontSize: 12 }}>{label}</Text>
      <Text style={{ color: '#0f172a', fontSize: 12, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}
