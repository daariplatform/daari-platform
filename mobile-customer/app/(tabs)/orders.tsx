import { ScrollView, View, Text, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useMyOrders } from '@/lib/queries';
import { iqd, fmtArabicDate } from '@/lib/format';
import { SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import type { RefillOrderStatus, RefillOrderKind } from '@/lib/types';

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

export default function Orders() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useMyOrders();

  return (
    <View className="flex-1 bg-slate-50">
      <SafeAreaView edges={['top']}>
        <View className="px-5 pt-4 pb-3 flex-row-reverse items-center justify-between">
          <Text className="text-2xl font-bold" style={{ letterSpacing: -0.3 }}>
            طلباتي
          </Text>
          <View
            style={{
              backgroundColor: '#ecfeff',
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text className="text-aqua-700 text-xs font-bold">
              {data ? `${data.length} طلب` : '...'}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#0891b2"
            colors={['#0891b2']}
          />
        }
      >
        {isLoading ? (
          <>
            <SkeletonCard height={110} />
            <SkeletonCard height={110} />
            <SkeletonCard height={110} />
          </>
        ) : data?.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="لا توجد طلبات بعد"
            subtitle="اضغط على زر «اطلب تعبئة الآن» في الشاشة الرئيسية لأول طلب"
          />
        ) : (
          data?.map((o, idx) => (
            <MotiView
              key={o.id}
              from={{ opacity: 0, translateY: 14 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', delay: idx * 50, duration: 350 }}
            >
              <Pressable
                onPress={() => router.push(`/order/${o.id}` as any)}
                style={{
                  backgroundColor: 'white',
                  borderRadius: 18,
                  padding: 14,
                  marginBottom: 10,
                  shadowColor: '#0f172a',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 6,
                }}
              >
                <View className="flex-row-reverse items-center mb-2">
                  <LinearGradient
                    colors={statusGradient[o.status]}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 12,
                    }}
                  >
                    <Ionicons name={statusIcon[o.status]} size={22} color="white" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text className="font-bold text-base text-right">{kindLabel[o.kind]}</Text>
                    <Text className="text-[11px] text-slate-500 text-right mt-0.5">
                      {fmtArabicDate(o.requestedAt)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-back" size={20} color="#cbd5e1" />
                </View>
                <View className="flex-row-reverse items-center justify-between pt-2 border-t border-slate-100">
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 8,
                      backgroundColor: `${statusGradient[o.status][1]}15`,
                    }}
                  >
                    <Text
                      className="text-[10px] font-bold"
                      style={{ color: statusGradient[o.status][1] }}
                    >
                      {statusLabel[o.status]}
                    </Text>
                  </View>
                  <Text className="font-bold text-aqua-700">
                    {o.priceIqd > 0 ? iqd(o.priceIqd) : 'مجاناً'}
                  </Text>
                </View>
              </Pressable>
            </MotiView>
          ))
        )}
      </ScrollView>
    </View>
  );
}
