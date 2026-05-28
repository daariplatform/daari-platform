/**
 * AI Insights — a dedicated screen that surfaces all four predictive
 * signals at once so a manager can quickly answer "what's happening, who
 * should I call, who should I dispatch?":
 *
 *   1. Demand forecast — when's the next peak window?
 *   2. Churn risk — which customers haven't refilled on schedule?
 *   3. Order clusters — which pending orders can a single driver batch?
 *   4. Driver scorecard — who's performing well, who needs a chat?
 *
 * Each section can be expanded for detail, or tapped to navigate to the
 * relevant entity (customer detail, order detail, drivers list with the
 * suggested driver highlighted).
 */
import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import {
  AppBar,
  Card,
  IconBadge,
  SectionHeader,
  Screen,
  StatusChip,
} from '@/components/ui';
import { theme } from '@/lib/theme';
import {
  useDemandForecast,
  useChurnRisk,
  useOrderClusters,
  useDriverScorecard,
  type ChurnRiskItem,
  type OrderCluster,
  type DriverScorecardItem,
  type PeakWindow,
} from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { safeBack } from '@/lib/nav';

export default function AiInsightsScreen() {
  const router = useRouter();
  const forecast = useDemandForecast();
  const churn = useChurnRisk();
  const clusters = useOrderClusters();
  const scorecard = useDriverScorecard();

  const anyLoading =
    (forecast.isLoading && !forecast.data) ||
    (churn.isLoading && !churn.data) ||
    (clusters.isLoading && !clusters.data) ||
    (scorecard.isLoading && !scorecard.data);

  const refreshing =
    forecast.isFetching || churn.isFetching || clusters.isFetching || scorecard.isFetching;

  const onRefresh = () => {
    forecast.refetch();
    churn.refetch();
    clusters.refetch();
    scorecard.refetch();
  };

  return (
    <Screen
      header={
        <AppBar
          title="رؤى ذكية"
          subtitle="تحليلات تنبؤيّة لمعملك"
          onBack={() => safeBack(router)}
        />
      }
      refreshing={refreshing && !anyLoading}
      onRefresh={onRefresh}
    >
      {anyLoading ? (
        <>
          <Skeleton height={140} borderRadius={16} style={{ marginBottom: 12 }} />
          <Skeleton height={200} borderRadius={16} style={{ marginBottom: 12 }} />
          <Skeleton height={160} borderRadius={16} style={{ marginBottom: 12 }} />
          <Skeleton height={200} borderRadius={16} />
        </>
      ) : (
        <>
          <DemandForecastSection windows={forecast.data?.peakWindows ?? []} trendFactor={forecast.data?.trendFactor ?? 1} />
          <ChurnRiskSection
            items={churn.data?.items ?? []}
            estimatedLossIqd={churn.data?.estimatedRevenueAtRiskIqd ?? 0}
            onTapCustomer={(id) => router.push(`/customer/${id}` as any)}
          />
          <OrderClustersSection
            clusters={clusters.data?.clusters ?? []}
            unclusterable={clusters.data?.unclusterableOrders ?? 0}
            onTapCluster={() => router.push('/(tabs)/orders' as any)}
          />
          <DriverScorecardSection
            items={scorecard.data?.items ?? []}
            tenantAvgMin={scorecard.data?.tenantAverageMinutesPerOrder ?? 0}
            onTapDriver={(id) => router.push(`/drivers/${id}` as any)}
          />
        </>
      )}
    </Screen>
  );
}

// ─── Sections ──────────────────────────────────────────────────────

function DemandForecastSection({
  windows,
  trendFactor,
}: {
  windows: PeakWindow[];
  trendFactor: number;
}) {
  const top = windows.slice(0, 3);
  const trendPct = Math.round((trendFactor - 1) * 100);
  return (
    <>
      <SectionHeader title="توقّع ذروة الطلب" subtitle="الأيام السبعة القادمة" />
      <Card variant="raised" padding="md">
        {top.length === 0 ? (
          <EmptyState
            icon="trending-up"
            title="لا توجد بيانات كافية بعد"
            subtitle="نحتاج لطلبات أكثر لتقدير ذروة معملك."
          />
        ) : (
          <>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: theme.space.sm, marginBottom: theme.space.md }}>
              <StatusChip
                label={trendPct > 0 ? `+${trendPct}% عن الأسبوع الماضي` : trendPct < 0 ? `${trendPct}%` : 'مستقر'}
                tone={trendPct > 0 ? 'success' : trendPct < 0 ? 'danger' : 'neutral'}
                icon={trendPct > 0 ? 'trending-up' : trendPct < 0 ? 'trending-down' : 'trending-flat'}
              />
              <Text style={{ ...theme.font.bodySm, color: theme.color.text.secondary }}>
                الاتجاه الأسبوعي
              </Text>
            </View>
            {top.map((w, idx) => (
              <View
                key={`${w.dayOfWeek}-${w.hourStart}`}
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: theme.space.md,
                  paddingVertical: theme.space.sm,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: theme.color.border.subtle,
                }}
              >
                <IconBadge icon="schedule" tone={idx === 0 ? 'amber' : 'teal'} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ ...theme.font.headingMd, color: theme.color.text.primary }}>
                    {w.label}
                  </Text>
                  <Text style={{ ...theme.font.bodySm, color: theme.color.text.secondary, marginTop: 2 }}>
                    {`${Math.round(w.expectedOrders)} طلب متوقّع · استعدّ بـ ${w.recommendedDrivers} ${w.recommendedDrivers === 1 ? 'سائق' : 'سائقين'}`}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </Card>
    </>
  );
}

function ChurnRiskSection({
  items,
  estimatedLossIqd,
  onTapCustomer,
}: {
  items: ChurnRiskItem[];
  estimatedLossIqd: number;
  onTapCustomer: (id: string) => void;
}) {
  const highCount = items.filter((i) => i.risk === 'HIGH').length;
  return (
    <>
      <SectionHeader title="زبائن في خطر" subtitle="انقطعوا عن النمط المعتاد" count={items.length} />
      {items.length === 0 ? (
        <Card variant="raised" padding="md">
          <EmptyState
            icon="thumb-up"
            title="كل الزبائن منتظمون"
            subtitle="لا يوجد زبون متأخّر عن دورة الطلب المعتاد."
          />
        </Card>
      ) : (
        <Card variant="raised" padding="md">
          <View
            style={{
              flexDirection: 'row-reverse',
              gap: theme.space.sm,
              marginBottom: theme.space.md,
              flexWrap: 'wrap',
            }}
          >
            <StatusChip
              label={`${highCount} عالي`}
              tone="danger"
              icon="warning"
            />
            <StatusChip
              label={`${(estimatedLossIqd ?? 0).toLocaleString('en-US')} د.ع متوقّع خسارتها`}
              tone="warning"
              icon="trending-down"
            />
          </View>
          {items.slice(0, 5).map((item, idx) => (
            <Pressable
              key={item.customerId}
              onPress={() => onTapCustomer(item.customerId)}
              style={({ pressed }) => ({
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: theme.space.md,
                paddingVertical: theme.space.sm,
                borderTopWidth: idx === 0 ? 0 : 1,
                borderTopColor: theme.color.border.subtle,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <IconBadge
                icon={item.risk === 'HIGH' ? 'priority-high' : 'schedule'}
                tone={item.risk === 'HIGH' ? 'rose' : item.risk === 'MEDIUM' ? 'amber' : 'sky'}
              />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ ...theme.font.headingMd, color: theme.color.text.primary }}>
                  {item.fullName}
                </Text>
                <Text style={{ ...theme.font.bodySm, color: theme.color.text.secondary, marginTop: 2 }}>
                  {`${item.district} · ${item.daysSinceLastOrder} يوم منذ آخر طلب (المعتاد ${item.typicalCadenceDays})`}
                </Text>
              </View>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  Linking.openURL(`https://wa.me/${item.phone.replace(/^0/, '964')}`).catch(() => {});
                }}
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.color.state.success.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialIcons name="chat" size={18} color={theme.color.state.success.fg} />
              </Pressable>
            </Pressable>
          ))}
        </Card>
      )}
    </>
  );
}

function OrderClustersSection({
  clusters,
  unclusterable,
  onTapCluster,
}: {
  clusters: OrderCluster[];
  unclusterable: number;
  onTapCluster: () => void;
}) {
  return (
    <>
      <SectionHeader title="تجميع الطلبات" subtitle="طلبات قريبة جغرافيّاً يمكن إرسالها بسائق واحد" count={clusters.length} />
      {clusters.length === 0 ? (
        <Card variant="raised" padding="md">
          <EmptyState
            icon="hub"
            title="لا توجد طلبات معلّقة قابلة للتجميع"
            subtitle={unclusterable > 0 ? `${unclusterable} طلبات بدون موقع GPS` : 'كل الطلبات تم تعيين سائق لها أو لا يوجد طلبات معلّقة.'}
          />
        </Card>
      ) : (
        <Card variant="raised" padding="md" onPress={onTapCluster}>
          {clusters.slice(0, 4).map((c, idx) => (
            <View
              key={c.id}
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: theme.space.md,
                paddingVertical: theme.space.sm,
                borderTopWidth: idx === 0 ? 0 : 1,
                borderTopColor: theme.color.border.subtle,
              }}
            >
              <IconBadge icon="place" tone="violet" />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ ...theme.font.headingMd, color: theme.color.text.primary }}>
                  {c.district}
                </Text>
                <Text style={{ ...theme.font.bodySm, color: theme.color.text.secondary, marginTop: 2 }}>
                  {`${c.orderCount} طلب · ${c.totalLitersDelivered.toLocaleString('en-US')} لتر · ~${c.avgDistanceKm.toFixed(1)} كم`}
                </Text>
              </View>
              {c.recommendedDriverId && (
                <StatusChip label="سائق مقترح" tone="success" size="sm" />
              )}
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

function DriverScorecardSection({
  items,
  tenantAvgMin,
  onTapDriver,
}: {
  items: DriverScorecardItem[];
  tenantAvgMin: number;
  onTapDriver: (id: string) => void;
}) {
  const rankTone = useMemo(
    () => ({
      top: 'success' as const,
      good: 'info' as const,
      average: 'warning' as const,
      poor: 'danger' as const,
    }),
    [],
  );
  const rankLabel = useMemo(
    () => ({
      top: 'متميّز',
      good: 'جيّد',
      average: 'متوسّط',
      poor: 'يحتاج تطوير',
    }),
    [],
  );
  return (
    <>
      <SectionHeader
        title="بطاقات أداء السائقين"
        subtitle={`متوسّط الزمن لكل طلب: ${Math.round(tenantAvgMin)} دقيقة`}
        count={items.length}
      />
      {items.length === 0 ? (
        <Card variant="raised" padding="md">
          <EmptyState
            icon="local-shipping"
            title="لا توجد بيانات سائقين بعد"
            subtitle="نحتاج طلبات مكتملة لحساب الأداء."
          />
        </Card>
      ) : (
        <Card variant="raised" padding="md">
          {items.slice(0, 5).map((d, idx) => (
            <Pressable
              key={d.driverId}
              onPress={() => onTapDriver(d.driverId)}
              style={({ pressed }) => ({
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: theme.space.md,
                paddingVertical: theme.space.sm,
                borderTopWidth: idx === 0 ? 0 : 1,
                borderTopColor: theme.color.border.subtle,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.color.state[rankTone[d.rank]].bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ ...theme.font.headingMd, color: theme.color.state[rankTone[d.rank]].fg }}>
                  {d.score}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ ...theme.font.headingMd, color: theme.color.text.primary }}>
                  {d.fullName}
                </Text>
                <Text style={{ ...theme.font.bodySm, color: theme.color.text.secondary, marginTop: 2 }}>
                  {`${d.breakdown.completedOrders} طلب · ${Math.round(d.breakdown.avgMinutesPerOrder)} دقيقة/طلب`}
                </Text>
              </View>
              <StatusChip label={rankLabel[d.rank]} tone={rankTone[d.rank]} size="sm" />
            </Pressable>
          ))}
        </Card>
      )}
    </>
  );
}
