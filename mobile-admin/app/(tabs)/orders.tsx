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
import { SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { Card, StatusChip, type ChipTone } from '@/components/ui';
import { theme } from '@/lib/theme';

type StatusFilter = RefillOrderStatus | 'ALL';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'الكل' },
  { key: 'PENDING', label: 'جديد' },
  { key: 'ASSIGNED', label: 'مكلّف' },
  { key: 'EN_ROUTE', label: 'في الطريق' },
  { key: 'COMPLETED', label: 'مكتمل' },
];

// Status → semantic tone (mapped to StatusChip) + Arabic label.
// PENDING (new) reads as a warning, ASSIGNED+EN_ROUTE as info,
// COMPLETED as success, anything terminal-bad as danger.
const STATUS_META: Record<
  RefillOrderStatus,
  { label: string; tone: ChipTone }
> = {
  PENDING: { label: 'جديد', tone: 'warning' },
  ASSIGNED: { label: 'مكلّف', tone: 'info' },
  EN_ROUTE: { label: 'في الطريق', tone: 'warning' },
  COMPLETED: { label: 'مكتمل', tone: 'success' },
  CANCELLED: { label: 'ملغى', tone: 'danger' },
  FAILED: { label: 'فشل', tone: 'danger' },
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
    <View style={{ flex: 1, backgroundColor: theme.color.surface.page }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.color.surface.card }}>
        <View
          style={{
            paddingHorizontal: theme.space.lg,
            paddingTop: theme.space.sm + 2,
            paddingBottom: theme.space.xs,
            backgroundColor: theme.color.surface.card,
          }}
        >
          <Text
            style={{
              ...theme.font.displaySm,
              color: theme.color.text.primary,
              textAlign: 'right',
            }}
          >
            الطلبات
          </Text>
        </View>
        <FilterBar value={filter} onChange={onChangeFilter} />
      </SafeAreaView>

      {query.isLoading && (
        <View style={{ paddingHorizontal: theme.space.md + 2, paddingTop: theme.space.md + 2 }}>
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

      {/* Empty state is mutually exclusive with the error state. If the
          query errored, query.data is undefined → items === [] → this
          would also evaluate true, rendering BOTH the error AND empty
          cards on the same screen. Gate on !isError so only one shows. */}
      {!query.isLoading && !query.isError && items.length === 0 && (
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
          contentContainerStyle={{
            padding: theme.space.md + 2,
            paddingBottom: 100,
          }}
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

      {/* Walk-in FAB — teal gradient water-drop, bottom-right (visual right in
          LTR but feels natural on mobile regardless of script direction). */}
      <Pressable
        onPress={() => router.push('/walkin' as any)}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: theme.space.xl,
          right: theme.space.xl,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <LinearGradient
          colors={[theme.color.raw.teal[500], theme.color.accent.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.shadow.lg,
            shadowColor: theme.color.accent.primary,
          }}
        >
          <MaterialIcons name="water-drop" size={28} color={theme.color.text.onAccent} />
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
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.sm + 2,
        gap: theme.space.sm,
        flexDirection: 'row-reverse',
      }}
      style={{
        backgroundColor: theme.color.surface.card,
        borderBottomWidth: 1,
        borderBottomColor: theme.color.border.subtle,
      }}
    >
      {FILTERS.map((f) => {
        const active = f.key === value;
        return (
          <Pressable
            key={f.key}
            onPress={() => onChange(f.key)}
            style={({ pressed }) => ({
              paddingHorizontal: theme.space.md + 2,
              paddingVertical: theme.space.sm,
              borderRadius: theme.radius.pill,
              backgroundColor: active
                ? theme.color.accent.primary
                : theme.color.raw.slate[100],
              borderWidth: 1,
              borderColor: active
                ? theme.color.accent.primary
                : theme.color.border.subtle,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                color: active ? theme.color.text.onAccent : theme.color.raw.slate[600],
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
    <Card
      variant="flat"
      padding="sm"
      onPress={onPress}
      style={{ marginBottom: 10 }}
    >
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.space.sm,
        }}
      >
        <StatusChip label={meta.label} tone={meta.tone} size="sm" />
        <Text style={{ fontSize: 10, color: theme.color.text.disabled }}>{when}</Text>
      </View>
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '800',
              color: theme.color.text.primary,
            }}
          >
            {kindLabel}
          </Text>
          {driverName && (
            <Text
              style={{
                ...theme.font.labelLg,
                fontSize: 11,
                fontWeight: '500',
                color: theme.color.text.secondary,
                marginTop: 2,
              }}
            >
              السائق: {driverName}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-start' }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '900',
              color: theme.color.accent.primary,
            }}
          >
            {(order.priceIqd ?? 0).toLocaleString('en-US')}{' '}
            <Text style={{ fontSize: 10, color: theme.color.text.secondary }}>د.ع</Text>
          </Text>
          {order.paidAmountIqd !== order.priceIqd && (
            <Text
              style={{
                fontSize: 10,
                color: theme.color.state.danger.solid,
                marginTop: 1,
              }}
            >
              مدفوع: {(order.paidAmountIqd ?? 0).toLocaleString('en-US')}
            </Text>
          )}
        </View>
      </View>
    </Card>
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
        paddingVertical: theme.space.md + 2,
        paddingHorizontal: 6,
      }}
    >
      <Pressable
        onPress={onPrev}
        disabled={prevDisabled}
        style={({ pressed }) => ({
          padding: 10,
          borderRadius: theme.radius.md,
          backgroundColor: prevDisabled
            ? theme.color.raw.slate[100]
            : theme.color.surface.card,
          borderWidth: 1,
          borderColor: theme.color.border.subtle,
          opacity: pressed ? 0.7 : prevDisabled ? 0.5 : 1,
        })}
      >
        <MaterialIcons
          name="chevron-right"
          size={22}
          color={prevDisabled ? theme.color.border.default : theme.color.accent.primary}
        />
      </Pressable>
      <Text
        style={{ fontWeight: '700', color: theme.color.raw.slate[600], fontSize: 13 }}
      >
        صفحة {(page ?? 1).toLocaleString('en-US')} من{' '}
        {(totalPages ?? 1).toLocaleString('en-US')}
      </Text>
      <Pressable
        onPress={onNext}
        disabled={nextDisabled}
        style={({ pressed }) => ({
          padding: 10,
          borderRadius: theme.radius.md,
          backgroundColor: nextDisabled
            ? theme.color.raw.slate[100]
            : theme.color.surface.card,
          borderWidth: 1,
          borderColor: theme.color.border.subtle,
          opacity: pressed ? 0.7 : nextDisabled ? 0.5 : 1,
        })}
      >
        <MaterialIcons
          name="chevron-left"
          size={22}
          color={nextDisabled ? theme.color.border.default : theme.color.accent.primary}
        />
      </Pressable>
    </View>
  );
}
