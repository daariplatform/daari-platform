import { ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMyOrders } from '@/lib/queries';
import { iqd, fmtArabicDate } from '@/lib/format';
import type { RefillOrderStatus, RefillOrderKind } from '@/lib/types';

const statusLabel: Record<RefillOrderStatus, string> = {
  PENDING: 'بانتظار التأكيد',
  ASSIGNED: 'مُسنَد لسائق',
  EN_ROUTE: 'في الطريق',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغى',
  FAILED: 'فشل',
};
const statusColor: Record<RefillOrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  EN_ROUTE: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
  FAILED: 'bg-red-100 text-red-700',
};
const kindLabel: Record<RefillOrderKind, string> = {
  REFILL: 'تعبئة خزان',
  TANK_DELIVERY: 'توصيل خزان جديد',
  TANK_RECLAIM: 'سحب الخزان',
  WALKIN_SALE: 'بيع فوري',
};

export default function Orders() {
  const { data, isLoading } = useMyOrders();
  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="px-4 pt-4 pb-3">
        <Text className="text-xl font-bold">طلباتي</Text>
      </View>
      {isLoading ? (
        <ActivityIndicator color="#0891b2" />
      ) : (
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 24 }}>
          {data?.map((o) => (
            <View key={o.id} className="bg-white rounded-2xl shadow-sm p-4 mb-2.5">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="font-bold text-slate-900">{kindLabel[o.kind]}</Text>
                <View className={`px-2 py-0.5 rounded-full ${statusColor[o.status].split(' ')[0]}`}>
                  <Text className={`text-[10px] font-bold ${statusColor[o.status].split(' ')[1]}`}>
                    {statusLabel[o.status]}
                  </Text>
                </View>
              </View>
              <Text className="text-xs text-slate-500">{fmtArabicDate(o.requestedAt)}</Text>
              <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <Text className="text-xs text-slate-500">
                  {o.driver ? `السائق: ${o.driver.user.fullName}` : 'لم يُسنَد بعد'}
                </Text>
                <Text className="font-bold text-aqua-700">
                  {o.priceIqd > 0 ? iqd(o.priceIqd) : 'مجاناً'}
                </Text>
              </View>
            </View>
          ))}
          {data?.length === 0 && (
            <Text className="text-center text-slate-400 py-12">لا توجد طلبات بعد</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
