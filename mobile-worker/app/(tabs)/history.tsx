import { ScrollView, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMyHistory } from '@/lib/queries';
import { fmtArabicDate, iqd } from '@/lib/format';
import { SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

interface HistoryRow {
  id: string;
  kind: 'REFILL' | 'TANK_DELIVERY' | 'TANK_RECLAIM' | 'WALKIN_SALE';
  customer: { fullName: string } | null;
  completedAt: string;
  paidAmountIqd: number;
}

export default function History() {
  const { data, isLoading } = useMyHistory() as { data: HistoryRow[] | undefined; isLoading: boolean };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="bg-slate-900 px-4 py-4">
        <Text className="text-white font-bold text-lg">سجلي</Text>
        <Text className="text-slate-400 text-xs">كل ما أنجزته</Text>
      </View>
      {isLoading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <SkeletonCard height={70} />
          <SkeletonCard height={70} />
          <SkeletonCard height={70} />
          <SkeletonCard height={70} />
          <SkeletonCard height={70} />
        </View>
      ) : data?.length === 0 ? (
        <EmptyState
          icon="history"
          title="سجلك فارغ حالياً"
          subtitle="عند إكمال أول مهمة، ستظهر هنا مع كل التفاصيل"
        />
      ) : (
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}>
          {data?.map((h) => (
            <View key={h.id} className="bg-white rounded-xl shadow-sm p-3 mb-2 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-lg bg-aqua-50 items-center justify-center">
                <Text className="text-lg">
                  {h.kind === 'REFILL' ? '💧' : h.kind === 'TANK_DELIVERY' ? '📦' : h.kind === 'TANK_RECLAIM' ? '↩️' : '💵'}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="font-bold text-sm">{h.customer?.fullName ?? '— مجهول —'}</Text>
                <Text className="text-[11px] text-slate-500">{fmtArabicDate(h.completedAt)}</Text>
              </View>
              <Text className="font-bold text-aqua-700">
                {h.paidAmountIqd > 0 ? iqd(h.paidAmountIqd) : 'مجاناً'}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
