import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  RefreshControl,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { arSA } from 'date-fns/locale';

import { useOrdersList } from '@/lib/queries';
import type { RefillOrder, RefillOrderStatus } from '@/lib/types';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

type StatusFilter = RefillOrderStatus | 'ALL';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'الكل' },
  { key: 'PENDING', label: 'جديد' },
  { key: 'ASSIGNED', label: 'مكلّف' },
  { key: 'EN_ROUTE', label: 'في الطريق' },
  { key: 'COMPLETED', label: 'مكتمل' },
];

// Status → display colour / Arabic label. Mirrors dashboard/orders STATUS map
// but with admin-mobile tone (vivid for in-flight, calm green for done).
const STATUS_META: Record<
  RefillOrderStatus,
  { label: string; bg: string; fg: string }
> = {
  PENDING: { label: 'جديد', bg: '#fef3c7', fg: '#92400e' },
  ASSIGNED: { label: 'مكلّف', bg: '#dbeafe', fg: '#1e40af' },
  EN_ROUTE: { label: 'في الطريق', bg: '#ffedd5', fg: '#9a3412' },
  COMPLETED: { label: 'مكتمل', bg: '#d1fae5', fg: '#065f46' },
  CANCELLED: { label: 'ملغى', bg: '#fee2e2', fg: '#991b1b' },
  FAILED: { label: 'فشل', bg: '#fee2e2', fg: '#991b1b' },
};

/**
 * Orders list — status-filtered, paginated, with a sticky filter bar and a
 * floating walk-in FAB. Mirrors the data shown on the web dashboard's
 * /dashboard/orders page but optimised for mobile (single column, big tap
 * targets, time-relative timestamps).
 */
export default function OrdersScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);

  const query = useOrdersList({
    status: filter === 'ALL' ? undefined : filter,
    page,
    pageSize: 50,
  });

  const items = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 0;

  const onChangeFilter = (next: StatusFilter) => {
    setFilter(next);
    setPage(1);
  };

  const renderItem: ListRenderItem<RefillOrder> = ({ item }) => (
    <OrderRow order={item} onPress={() => router.push(`/order/${item.id}` as any)} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 4,
            backgroundColor: '#fff',
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: '900',
              color: '#0f172a',
              textAlign: 'right',
            }}
          >
            الطلبات
          </Text>
        </View>
        <FilterBar value={filter} onChange={onChangeFilter} />
      </SafeAreaView>

      {query.isLoading && (
        <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
          <SkeletonCard height={86} />
          <SkeletonCard height={86} />
          <SkeletonCard height={86} />
          <SkeletonCard height={86} />
        </View>
      )}

      {query.isError && !query.data && (
        <EmptyState
          icon="cloud-off"
          title="تعذّر تحميل الطلبات"
          subtitle="جرّب السحب للتحديث أو راجع اتصالك"
          actionLabel="إعادة المحاولة"
          onAction={() => query.refetch()}
        />
      )}

      {!query.isLoading && items.length === 0 && (
        <EmptyState
          icon="receipt-long"
          title="لا توجد طلبات"
          subtitle={
            filter === 'ALL'
              ? 'لم يصل أي طلب بعد. سيظهر هنا فور وصوله.'
              : 'لا توجد طلبات بهذه الحالة حالياً'
          }
        />
      )}

      {items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(o) => o.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isLoading}
              onRefresh={() => query.refetch()}
            />
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            ) : null
          }
        />
      )}

      {/* Walk-in FAB — sky gradient water-drop, bottom-right (visual right in
          LTR but feels natural on mobile regardless of script direction). */}
      <Pressable
        onPress={() => router.push('/walkin' as any)}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: 20,
          right: 20,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <LinearGradient
          colors={['#0ea5e9', '#0284c7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#0284c7',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <MaterialIcons name="water-drop" size={28} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function FilterBar({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        flexDirection: 'row-reverse',
      }}
      style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}
    >
      {FILTERS.map((f) => {
        const active = f.key === value;
        return (
          <Pressable
            key={f.key}
            onPress={() => onChange(f.key)}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: active ? '#0284c7' : '#f1f5f9',
              borderWidth: 1,
              borderColor: active ? '#0284c7' : '#e2e8f0',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                color: active ? '#fff' : '#475569',
                fontWeight: active ? '800' : '600',
                fontSize: 12,
              }}
            >
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function OrderRow({ order, onPress }: { order: RefillOrder; onPress: () => void }) {
  const meta = STATUS_META[order.status];
  // Liters: backend doesn't expose liters on the RefillOrder type directly;
  // fall back to a kind-based label so we always show *something* meaningful.
  const kindLabel = useMemo(() => {
    switch (order.kind) {
      case 'WALKIN_SALE':
        return 'بيع مباشر';
      case 'TANK_DELIVERY':
        return 'تسليم خزّان';
      case 'TANK_RECLAIM':
        return 'استرجاع خزّان';
      default:
        return 'تعبئة';
    }
  }, [order.kind]);

  const driverName = order.driver?.user?.fullName ?? null;
  const when = formatDistanceToNow(new Date(order.requestedAt), {
    addSuffix: true,
    locale: arSA,
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        opacity: pressed ? 0.9 : 1,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
      })}
    >
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <View
          style={{
            backgroundColor: meta.bg,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: meta.fg, fontWeight: '800', fontSize: 11 }}>{meta.label}</Text>
        </View>
        <Text style={{ fontSize: 10, color: '#94a3b8' }}>{when}</Text>
      </View>
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>{kindLabel}</Text>
          {driverName && (
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              السائق: {driverName}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: '#0284c7' }}>
            {(order.priceIqd ?? 0).toLocaleString('ar-IQ')}{' '}
            <Text style={{ fontSize: 10, color: '#64748b' }}>د.ع</Text>
          </Text>
          {order.paidAmountIqd !== order.priceIqd && (
            <Text style={{ fontSize: 10, color: '#dc2626', marginTop: 1 }}>
              مدفوع: {(order.paidAmountIqd ?? 0).toLocaleString('ar-IQ')}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 6,
      }}
    >
      <Pressable
        onPress={onPrev}
        disabled={prevDisabled}
        style={({ pressed }) => ({
          padding: 10,
          borderRadius: 12,
          backgroundColor: prevDisabled ? '#f1f5f9' : '#fff',
          borderWidth: 1,
          borderColor: '#e2e8f0',
          opacity: pressed ? 0.7 : prevDisabled ? 0.5 : 1,
        })}
      >
        <MaterialIcons name="chevron-right" size={22} color={prevDisabled ? '#cbd5e1' : '#0284c7'} />
      </Pressable>
      <Text style={{ fontWeight: '700', color: '#475569', fontSize: 13 }}>
        صفحة {page.toLocaleString('ar-IQ')} من {totalPages.toLocaleString('ar-IQ')}
      </Text>
      <Pressable
        onPress={onNext}
        disabled={nextDisabled}
        style={({ pressed }) => ({
          padding: 10,
          borderRadius: 12,
          backgroundColor: nextDisabled ? '#f1f5f9' : '#fff',
          borderWidth: 1,
          borderColor: '#e2e8f0',
          opacity: pressed ? 0.7 : nextDisabled ? 0.5 : 1,
        })}
      >
        <MaterialIcons name="chevron-left" size={22} color={nextDisabled ? '#cbd5e1' : '#0284c7'} />
      </Pressable>
    </View>
  );
}
