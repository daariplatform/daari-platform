/**
 * Reports — visual insights on revenue trend, top performers, and peak hours.
 *
 * Four sections (each independently loading + emptying):
 *   1. Revenue trend (7-day sparkline) — total, average, peak labels inline.
 *      Tap any day to highlight that point on the line (no nav drill-down —
 *      this is a "feel the shape" screen, not a transactional one).
 *   2. Top 5 customers this month — ranked badges, spend, order count.
 *   3. Top 5 drivers this month — same pattern as customers.
 *   4. Peak hours — 24 vertical bars with the peak hour highlighted darker.
 *      A sub-caption ("الذروة عند الساعة 8 صباحاً") restates the peak in
 *      Arabic so the owner doesn't have to read the chart.
 *
 * Pull-to-refresh refreshes ALL four queries in parallel (cheap because each
 * one is small and the user is signaling they want fresh data).
 */

import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  useRevenue7d,
  useTopCustomers,
  useTopDrivers,
  usePeakHours,
  type RevenueDay,
  type TopCustomer,
  type TopDriver,
  type PeakHourBucket,
} from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { Sparkline } from '@/components/charts/Sparkline';
import { Bar } from '@/components/charts/Bar';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

// Arabic short day-of-week names. Keyed by JS Date.getDay() (0 = Sunday).
const DOW_AR = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

function n(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('en-US');
}

function iqdShort(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}م`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}ك`;
  return n(v);
}

/**
 * Arabic AM/PM label for a 24-hour hour value (0..23).
 *   0..3   → "ليلاً"
 *   4..11  → "صباحاً"
 *   12..17 → "ظهراً" / "عصراً"
 *   18..23 → "مساءً"
 *
 * Then we display the 12-hour clock number. Keeps the caption readable for
 * Iraqi users who rarely think in 24h ("الذروة عند الساعة 8 صباحاً" reads
 * naturally; "عند الساعة 8" alone is ambiguous AM/PM).
 */
function describeHourAr(h: number): string {
  const clock12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  let suffix: string;
  if (h >= 4 && h < 12) suffix = 'صباحاً';
  else if (h >= 12 && h < 16) suffix = 'ظهراً';
  else if (h >= 16 && h < 18) suffix = 'عصراً';
  else if (h >= 18 && h < 22) suffix = 'مساءً';
  else suffix = 'ليلاً';
  return `${clock12} ${suffix}`;
}

export default function ReportsScreen() {
  const router = useRouter();
  const revenue = useRevenue7d();
  const customers = useTopCustomers(5);
  const drivers = useTopDrivers(5);
  const peak = usePeakHours();

  const anyFetching =
    (revenue.isFetching && !revenue.isLoading) ||
    (customers.isFetching && !customers.isLoading) ||
    (drivers.isFetching && !drivers.isLoading) ||
    (peak.isFetching && !peak.isLoading);

  function refreshAll() {
    revenue.refetch();
    customers.refetch();
    drivers.refetch();
    peak.refetch();
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <LinearGradient
        colors={['#14b8a6', '#0e9384']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
      >
        <SafeAreaView edges={['top']}>
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 4,
              paddingBottom: 18,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={({ pressed }) => ({
                padding: 8,
                borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.18)',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <MaterialIcons name="arrow-forward" size={22} color="#fff" />
            </Pressable>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>
              التقارير
            </Text>
            <View style={{ width: 38 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={anyFetching} onRefresh={refreshAll} />
        }
      >
        <RevenueSection
          isLoading={revenue.isLoading}
          isError={revenue.isError && !revenue.data}
          data={revenue.data}
          onRetry={() => revenue.refetch()}
        />

        <TopCustomersSection
          isLoading={customers.isLoading}
          isError={customers.isError && !customers.data}
          data={customers.data}
          onRetry={() => customers.refetch()}
        />

        <TopDriversSection
          isLoading={drivers.isLoading}
          isError={drivers.isError && !drivers.data}
          data={drivers.data}
          onRetry={() => drivers.refetch()}
        />

        <PeakHoursSection
          isLoading={peak.isLoading}
          isError={peak.isError && !peak.data}
          data={peak.data}
          onRetry={() => peak.refetch()}
        />
      </ScrollView>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Section card — shared container for each report block
// ────────────────────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 22,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: '900',
          color: '#0f172a',
          textAlign: 'right',
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            fontSize: 11,
            color: '#64748b',
            textAlign: 'right',
            marginTop: 3,
          }}
        >
          {subtitle}
        </Text>
      )}
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Revenue trend — 7-day sparkline + day labels + stats
// ────────────────────────────────────────────────────────────────────

function RevenueSection({
  isLoading,
  isError,
  data,
  onRetry,
}: {
  isLoading: boolean;
  isError: boolean;
  data: RevenueDay[] | undefined;
  onRetry: () => void;
}) {
  // Tap-to-highlight UX — we hold the active index here rather than in the
  // chart because the label row below the chart also needs to know which
  // day is "selected" to invert its colour.
  const [activeIdx, setActiveIdx] = useState<number | undefined>(undefined);

  const series = useMemo(() => (data ?? []).map((d) => d.revenueIqd), [data]);
  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const total = series.reduce((a, b) => a + b, 0);
    const avg = total / series.length;
    const peakVal = Math.max(...series);
    const peakIdx = series.indexOf(peakVal);
    return { total, avg, peakVal, peakIdx };
  }, [data, series]);

  if (isLoading) {
    return (
      <SectionCard title="اتجاه الإيرادات" subtitle="آخر 7 أيام">
        <Skeleton height={120} borderRadius={14} />
      </SectionCard>
    );
  }

  if (isError) {
    return (
      <SectionCard title="اتجاه الإيرادات" subtitle="آخر 7 أيام">
        <EmptyState
          icon="cloud-off"
          title="تعذّر تحميل البيانات"
          actionLabel="إعادة المحاولة"
          onAction={onRetry}
        />
      </SectionCard>
    );
  }

  if (!data || data.length === 0) {
    return (
      <SectionCard title="اتجاه الإيرادات" subtitle="آخر 7 أيام">
        <EmptyState
          icon="show-chart"
          title="لا توجد بيانات بعد"
          subtitle="ستظهر هنا الإيرادات اليومية بمجرد تسجيل أول طلب."
        />
      </SectionCard>
    );
  }

  const highlightIdx = activeIdx ?? stats?.peakIdx;

  return (
    <SectionCard title="اتجاه الإيرادات" subtitle="آخر 7 أيام">
      {/* Stats row — total / avg / peak inline */}
      <View
        style={{
          flexDirection: 'row-reverse',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <InlineStat label="الإجمالي" value={`${iqdShort(stats?.total ?? 0)} د.ع`} tint="#0e9384" />
        <InlineStat label="المتوسط" value={`${iqdShort(stats?.avg ?? 0)} د.ع`} tint="#14b8a6" />
        <InlineStat label="الذروة" value={`${iqdShort(stats?.peakVal ?? 0)} د.ع`} tint="#f59e0b" />
      </View>

      {/* Chart */}
      <Sparkline
        data={series}
        height={110}
        color="#0e9384"
        fillColor="#14b8a6"
        activeIndex={highlightIdx}
      />

      {/* Day-of-week labels — tap to highlight */}
      <View
        style={{
          flexDirection: 'row',
          marginTop: 10,
        }}
      >
        {data.map((d, i) => {
          const dow = DOW_AR[new Date(d.date).getDay()] ?? '';
          const active = i === highlightIdx;
          return (
            <Pressable
              key={d.date}
              onPress={() => setActiveIdx(activeIdx === i ? undefined : i)}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                paddingVertical: 6,
                borderRadius: 10,
                backgroundColor: active ? '#0e93841a' : 'transparent',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: active ? '#0e9384' : '#94a3b8',
                  fontWeight: active ? '900' : '700',
                }}
              >
                {dow}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color: active ? '#0e9384' : '#64748b',
                  fontWeight: '800',
                  marginTop: 2,
                }}
              >
                {iqdShort(d.revenueIqd)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SectionCard>
  );
}

function InlineStat({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tint + '12',
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 8,
        alignItems: 'flex-end',
      }}
    >
      <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '700' }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: tint,
          fontWeight: '900',
          marginTop: 2,
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Top customers
// ────────────────────────────────────────────────────────────────────

function TopCustomersSection({
  isLoading,
  isError,
  data,
  onRetry,
}: {
  isLoading: boolean;
  isError: boolean;
  data: TopCustomer[] | undefined;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <SectionCard title="أفضل 5 زبائن" subtitle="هذا الشهر">
        <Skeleton height={56} borderRadius={14} style={{ marginBottom: 8 }} />
        <Skeleton height={56} borderRadius={14} style={{ marginBottom: 8 }} />
        <Skeleton height={56} borderRadius={14} />
      </SectionCard>
    );
  }
  if (isError) {
    return (
      <SectionCard title="أفضل 5 زبائن" subtitle="هذا الشهر">
        <EmptyState icon="cloud-off" title="تعذّر التحميل" actionLabel="إعادة المحاولة" onAction={onRetry} />
      </SectionCard>
    );
  }
  if (!data || data.length === 0) {
    return (
      <SectionCard title="أفضل 5 زبائن" subtitle="هذا الشهر">
        <EmptyState icon="emoji-events" title="لا توجد بيانات بعد" subtitle="سيظهر هنا أعلى الزبائن إنفاقاً." />
      </SectionCard>
    );
  }
  return (
    <SectionCard title="أفضل 5 زبائن" subtitle="هذا الشهر">
      {data.map((c, i) => (
        <RankRow
          key={c.id}
          rank={i + 1}
          name={c.fullName}
          primary={`${n(c.totalSpendIqd)} د.ع`}
          secondary={`${n(c.orderCount)} طلب`}
        />
      ))}
    </SectionCard>
  );
}

// ────────────────────────────────────────────────────────────────────
// Top drivers
// ────────────────────────────────────────────────────────────────────

function TopDriversSection({
  isLoading,
  isError,
  data,
  onRetry,
}: {
  isLoading: boolean;
  isError: boolean;
  data: TopDriver[] | undefined;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <SectionCard title="أفضل 5 سائقين" subtitle="هذا الشهر">
        <Skeleton height={56} borderRadius={14} style={{ marginBottom: 8 }} />
        <Skeleton height={56} borderRadius={14} style={{ marginBottom: 8 }} />
        <Skeleton height={56} borderRadius={14} />
      </SectionCard>
    );
  }
  if (isError) {
    return (
      <SectionCard title="أفضل 5 سائقين" subtitle="هذا الشهر">
        <EmptyState icon="cloud-off" title="تعذّر التحميل" actionLabel="إعادة المحاولة" onAction={onRetry} />
      </SectionCard>
    );
  }
  if (!data || data.length === 0) {
    return (
      <SectionCard title="أفضل 5 سائقين" subtitle="هذا الشهر">
        <EmptyState icon="local-shipping" title="لا توجد بيانات بعد" subtitle="سيظهر هنا أكثر السائقين إنجازاً." />
      </SectionCard>
    );
  }
  return (
    <SectionCard title="أفضل 5 سائقين" subtitle="هذا الشهر">
      {data.map((d, i) => (
        <RankRow
          key={d.id}
          rank={i + 1}
          name={d.fullName}
          primary={`${n(d.completedOrders)} طلب`}
          secondary={`${iqdShort(d.revenueIqd)} د.ع`}
        />
      ))}
    </SectionCard>
  );
}

// Shared ranked-row used by both top-customers + top-drivers. Visually
// identical so the screen feels cohesive — only the labels differ.
function RankRow({
  rank,
  name,
  primary,
  secondary,
}: {
  rank: number;
  name: string;
  primary: string;
  secondary: string;
}) {
  // Gold/silver/bronze for the top 3; muted teal for 4–5.
  const badgeColor =
    rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : '#0e9384';
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: badgeColor + '22',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: badgeColor, fontWeight: '900', fontSize: 13 }}>
          {n(rank)}
        </Text>
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }} numberOfLines={1}>
          {name}
        </Text>
        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{secondary}</Text>
      </View>
      <Text style={{ fontSize: 13, fontWeight: '900', color: '#0e9384' }}>{primary}</Text>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Peak hours
// ────────────────────────────────────────────────────────────────────

function PeakHoursSection({
  isLoading,
  isError,
  data,
  onRetry,
}: {
  isLoading: boolean;
  isError: boolean;
  data: PeakHourBucket[] | undefined;
  onRetry: () => void;
}) {
  // Normalize to a 24-slot array — backend may omit hours with zero orders;
  // we fill those so the bar chart always has 24 bars and the X axis aligns
  // with hour-of-day even when most slots are zero.
  const series24 = useMemo(() => {
    const arr = new Array(24).fill(0);
    if (!data) return arr;
    for (const b of data) {
      if (b.hour >= 0 && b.hour < 24) arr[b.hour] = b.orderCount;
    }
    return arr;
  }, [data]);

  const peakHour = useMemo(() => {
    if (!data || data.length === 0) return null;
    const peakVal = Math.max(...series24);
    if (peakVal === 0) return null;
    return series24.indexOf(peakVal);
  }, [data, series24]);

  if (isLoading) {
    return (
      <SectionCard title="ساعات الذروة" subtitle="عدد الطلبات حسب الساعة">
        <Skeleton height={110} borderRadius={14} />
      </SectionCard>
    );
  }
  if (isError) {
    return (
      <SectionCard title="ساعات الذروة" subtitle="عدد الطلبات حسب الساعة">
        <EmptyState
          icon="cloud-off"
          title="تعذّر التحميل"
          actionLabel="إعادة المحاولة"
          onAction={onRetry}
        />
      </SectionCard>
    );
  }
  if (!data || data.length === 0 || peakHour === null) {
    return (
      <SectionCard title="ساعات الذروة" subtitle="عدد الطلبات حسب الساعة">
        <EmptyState
          icon="schedule"
          title="لا توجد طلبات بعد"
          subtitle="سيظهر هنا توزيع الطلبات على ساعات اليوم."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="ساعات الذروة" subtitle="عدد الطلبات حسب الساعة">
      <Bar
        data={series24}
        height={120}
        barColor="#5eead4"
        activeColor="#0e9384"
        activeIndex={peakHour}
      />
      {/* Sparse X-axis labels: every 6 hours so they don't crowd at small widths. */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 6,
          paddingHorizontal: 2,
        }}
      >
        {[0, 6, 12, 18, 23].map((h) => (
          <Text key={h} style={{ fontSize: 10, color: '#94a3b8', fontWeight: '700' }}>
            {n(h)}
          </Text>
        ))}
      </View>

      {/* Peak caption */}
      <View
        style={{
          marginTop: 12,
          backgroundColor: '#ecfdf5',
          borderRadius: 12,
          padding: 10,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <MaterialIcons name="trending-up" size={18} color="#0e9384" />
        <Text style={{ fontSize: 12, color: '#0e7c70', fontWeight: '800', flex: 1, textAlign: 'right' }}>
          الذروة عند الساعة {describeHourAr(peakHour)} ({n(series24[peakHour])} طلب)
        </Text>
      </View>
    </SectionCard>
  );
}
