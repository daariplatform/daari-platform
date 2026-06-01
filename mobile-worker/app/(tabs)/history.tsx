import { useMemo } from 'react';
import { View, Text, SectionList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMyHistory } from '@/lib/queries';
import { fmtArabicDate, iqd } from '@/lib/format';
import { SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

interface HistoryRow {
  id: string;
  kind: 'REFILL' | 'TANK_DELIVERY' | 'TANK_RECLAIM' | 'WALKIN_SALE';
  customer: { fullName: string } | null;
  // Backend sometimes omits completedAt (cancelled / pending rows leaked
  // into a historical query); fall back to requestedAt so the date isn't
  // "Invalid Date".
  completedAt: string | null;
  requestedAt: string | null;
  paidAmountIqd: number;
}

const KIND_EMOJI: Record<HistoryRow['kind'], string> = {
  REFILL: '💧',
  TANK_DELIVERY: '📦',
  TANK_RECLAIM: '↩️',
  WALKIN_SALE: '💵',
};

/**
 * Bucket a date into a human section label so the list reads as
 * "اليوم / أمس / <weekday> / <date>" instead of one long undifferentiated
 * column. Keeps recent days obvious and older ones grouped by day.
 */
function sectionLabel(d: Date): string {
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayMs = 86_400_000;
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / dayMs);
  if (diffDays <= 0) return 'اليوم';
  if (diffDays === 1) return 'أمس';
  if (diffDays < 7) return d.toLocaleDateString('ar-IQ', { weekday: 'long' });
  return d.toLocaleDateString('ar-IQ', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function History() {
  const { data, isLoading, refetch, isRefetching } = useMyHistory() as {
    data: HistoryRow[] | undefined;
    isLoading: boolean;
    refetch: () => void;
    isRefetching: boolean;
  };

  // Group rows into date sections + compute a summary (count + total cash).
  const { sections, totalCount, totalCash } = useMemo(() => {
    const rows = data ?? [];
    const buckets = new Map<string, { order: number; rows: HistoryRow[] }>();
    let total = 0;
    for (const r of rows) {
      const whenStr = r.completedAt ?? r.requestedAt;
      const when = whenStr ? new Date(whenStr) : null;
      const label = when ? sectionLabel(when) : 'غير مؤرّخ';
      const order = when ? when.getTime() : 0;
      if (!buckets.has(label)) buckets.set(label, { order, rows: [] });
      buckets.get(label)!.rows.push(r);
      total += r.paidAmountIqd > 0 ? r.paidAmountIqd : 0;
    }
    const sectionsArr = Array.from(buckets.entries())
      .map(([title, v]) => ({ title, order: v.order, data: v.rows }))
      .sort((a, b) => b.order - a.order);
    return { sections: sectionsArr, totalCount: rows.length, totalCash: total };
  }, [data]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="bg-slate-900 px-4 py-4">
        <Text className="text-white font-bold text-lg">سجلي</Text>
        <Text className="text-slate-400 text-xs">كل ما أنجزته</Text>
      </View>

      {/* Summary strip — gives the driver totals at a glance instead of
          forcing them to scroll the whole list. */}
      {!isLoading && totalCount > 0 && (
        <View className="flex-row gap-2 px-4 pt-3">
          <View className="flex-1 bg-white rounded-xl p-3 border border-slate-100">
            <Text className="text-[11px] text-slate-500 text-right">إجمالي المهام</Text>
            <Text className="text-lg font-bold text-slate-900 text-right mt-0.5">
              {totalCount.toLocaleString('ar-IQ')}
            </Text>
          </View>
          <View className="flex-1 bg-white rounded-xl p-3 border border-slate-100">
            <Text className="text-[11px] text-slate-500 text-right">إجمالي التحصيل</Text>
            <Text className="text-lg font-bold text-aqua-700 text-right mt-0.5">
              {iqd(totalCash)}
            </Text>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <SkeletonCard height={70} />
          <SkeletonCard height={70} />
          <SkeletonCard height={70} />
          <SkeletonCard height={70} />
        </View>
      ) : totalCount === 0 ? (
        <EmptyState
          icon="history"
          title="سجلك فارغ حالياً"
          subtitle="عند إكمال أول مهمة، ستظهر هنا مع كل التفاصيل"
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0284c7" />
          }
          renderSectionHeader={({ section }) => (
            <View className="bg-slate-50 py-2 flex-row-reverse items-center justify-between">
              <Text className="text-xs font-bold text-slate-500">{section.title}</Text>
              <Text className="text-[10px] text-slate-400">
                {section.data.length.toLocaleString('ar-IQ')} مهمة
              </Text>
            </View>
          )}
          renderItem={({ item: h }) => {
            const when = h.completedAt ?? h.requestedAt;
            return (
              <View className="bg-white rounded-xl shadow-sm p-3 mb-2 flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg bg-aqua-50 items-center justify-center">
                  <Text className="text-lg">{KIND_EMOJI[h.kind] ?? '💧'}</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-sm">
                    {h.customer?.fullName ?? '— مجهول —'}
                  </Text>
                  <Text className="text-[11px] text-slate-500">
                    {when ? fmtArabicDate(when) : '—'}
                  </Text>
                </View>
                <Text className="font-bold text-aqua-700">
                  {h.paidAmountIqd > 0 ? iqd(h.paidAmountIqd) : 'مجاناً'}
                </Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
