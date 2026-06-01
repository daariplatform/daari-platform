/**
 * Earnings over time.
 *
 * Week / month toggle → GET /drivers/me/earnings?period=week|month returns a
 * daily series (continuous, zero-filled, ascending) of completed orders,
 * commission, and bonus. We render a custom animated bar chart (Views +
 * reanimated, NO chart dep) of daily commission+bonus plus totals with
 * animated counters.
 *
 * Endpoint may 404 until backend deploys — handled gracefully.
 */

import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useMyEarnings, type EarningsDay } from '@/lib/queries';
import { iqd } from '@/lib/format';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Skeleton } from '@/components/Skeleton';
import { ErrorCard } from './cash';

type Period = 'week' | 'month';

const WEEKDAY_AR = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];

export default function EarningsScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('week');
  const { data, isLoading, isError, refetch, isRefetching } = useMyEarnings(period);

  const { totalCommission, totalBonus, totalOrders, total, max, days } = useMemo(() => {
    const rows = data ?? [];
    let comm = 0;
    let bonus = 0;
    let orders = 0;
    let mx = 0;
    for (const d of rows) {
      comm += d.commissionIqd;
      bonus += d.bonusIqd;
      orders += d.completedOrders;
      mx = Math.max(mx, d.commissionIqd + d.bonusIqd);
    }
    return {
      totalCommission: comm,
      totalBonus: bonus,
      totalOrders: orders,
      total: comm + bonus,
      max: mx,
      days: rows,
    };
  }, [data]);

  return (
    <View className="flex-1 bg-slate-50">
      <LinearGradient
        colors={['#065f46', '#059669', '#10b981']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}
      >
        <SafeAreaView edges={['top']}>
          <View className="px-5 pt-3 pb-4 flex-row-reverse items-center justify-between">
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
            <View style={{ alignItems: 'flex-end' }}>
              <Text className="text-white text-2xl font-bold">أرباحي</Text>
              <Text className="text-emerald-100 text-xs mt-0.5">
                عمولاتك وبونصك يوماً بيوم
              </Text>
            </View>
          </View>

          {/* Period toggle */}
          <View className="px-5 pb-3 flex-row-reverse gap-2">
            {(['week', 'month'] as const).map((p) => {
              const active = period === p;
              return (
                <Pressable
                  key={p}
                  onPress={async () => {
                    if (p !== period)
                      await Haptics.selectionAsync().catch(() => {});
                    setPeriod(p);
                  }}
                  className={`flex-1 rounded-full py-2 ${
                    active ? 'bg-white' : 'bg-white/20'
                  }`}
                >
                  <Text
                    className={`text-center text-[12px] font-bold ${
                      active ? 'text-emerald-700' : 'text-white'
                    }`}
                  >
                    {p === 'week' ? 'آخر ٧ أيام' : 'آخر ٣٠ يوم'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#059669" />
        }
      >
        {isLoading ? (
          <>
            <Skeleton height={120} borderRadius={20} style={{ marginBottom: 12 }} />
            <Skeleton height={200} borderRadius={20} />
          </>
        ) : isError ? (
          <ErrorCard message="تعذّر جلب بيانات الأرباح." onRetry={refetch} />
        ) : (
          <>
            {/* Total hero */}
            <Animated.View entering={FadeInDown.duration(450)}>
              <LinearGradient
                colors={['#0e7490', '#0891b2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 20,
                  padding: 18,
                  marginBottom: 12,
                  shadowColor: '#0891b2',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.25,
                  shadowRadius: 14,
                  elevation: 6,
                }}
              >
                <Text className="text-cyan-100 text-xs font-bold text-right">
                  إجمالي الأرباح في الفترة
                </Text>
                <AnimatedNumber
                  value={total}
                  format={(n) => iqd(Math.round(n))}
                  style={{ color: '#fff', fontWeight: '800', fontSize: 32, marginTop: 4, textAlign: 'right' }}
                />
                <View className="flex-row-reverse gap-4 mt-3 pt-3 border-t border-white/20">
                  <MiniTotal label="عمولات" value={totalCommission} />
                  <MiniTotal label="بونص" value={totalBonus} />
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text className="text-cyan-100 text-[10px]">مهام</Text>
                    <AnimatedNumber
                      value={totalOrders}
                      format={(n) => Math.round(n).toLocaleString('en-US')}
                      style={{ color: '#fff', fontWeight: '800', fontSize: 15, marginTop: 2 }}
                    />
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Bar chart */}
            <Animated.View
              entering={FadeInDown.delay(150).duration(450)}
              style={{
                backgroundColor: '#fff',
                borderRadius: 20,
                padding: 16,
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View className="flex-row-reverse items-center gap-1.5 mb-3">
                <MaterialIcons name="bar-chart" size={18} color="#059669" />
                <Text className="text-sm font-bold text-slate-700">
                  العمولة + البونص اليومي
                </Text>
              </View>

              {total === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 28 }}>
                  <MaterialIcons name="insights" size={40} color="#cbd5e1" />
                  <Text className="text-slate-500 text-sm mt-2">
                    لا توجد أرباح مسجّلة في هذه الفترة
                  </Text>
                </View>
              ) : (
                <BarChart days={days} max={max} period={period} />
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function MiniTotal({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text className="text-cyan-100 text-[10px]">{label}</Text>
      <AnimatedNumber
        value={value}
        format={(n) => iqd(Math.round(n))}
        style={{ color: '#fff', fontWeight: '800', fontSize: 13, marginTop: 2 }}
      />
    </View>
  );
}

/**
 * Custom bar chart — one animated column per day. Bars grow from 0 to their
 * height via reanimated. For the month view (30 cols) we drop per-bar labels
 * to avoid crowding and let the row scroll horizontally.
 */
function BarChart({
  days,
  max,
  period,
}: {
  days: EarningsDay[];
  max: number;
  period: Period;
}) {
  const CHART_HEIGHT = 150;
  const isMonth = period === 'month';
  const barWidth = isMonth ? 14 : 28;
  const gap = isMonth ? 6 : 10;

  const body = (
    <View
      className="flex-row-reverse items-end"
      style={{ height: CHART_HEIGHT, gap }}
    >
      {days.map((d, i) => {
        const v = d.commissionIqd + d.bonusIqd;
        const ratio = max > 0 ? v / max : 0;
        const label = new Date(d.date + 'T00:00:00');
        return (
          <Bar
            key={d.date}
            ratio={ratio}
            value={v}
            width={barWidth}
            chartHeight={CHART_HEIGHT}
            index={i}
            total={days.length}
            label={
              isMonth
                ? label.getDate() % 5 === 0
                  ? String(label.getDate())
                  : ''
                : WEEKDAY_AR[label.getDay()]
            }
            showValue={!isMonth}
          />
        );
      })}
    </View>
  );

  if (isMonth) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // RTL: latest day on the right, scroll starts there.
        contentContainerStyle={{ flexDirection: 'row-reverse' }}
      >
        {body}
      </ScrollView>
    );
  }
  return body;
}

function Bar({
  ratio,
  value,
  width,
  chartHeight,
  index,
  total,
  label,
  showValue,
}: {
  ratio: number;
  value: number;
  width: number;
  chartHeight: number;
  index: number;
  total: number;
  label: string;
  showValue: boolean;
}) {
  // Bars enter right-to-left so the freshest day animates last.
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withDelay(
      (total - 1 - index) * 45,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, []);
  const LABEL_AREA = 18;
  const VALUE_AREA = showValue ? 16 : 0;
  const maxBar = chartHeight - LABEL_AREA - VALUE_AREA;
  const targetH = Math.max(value > 0 ? 4 : 0, ratio * maxBar);

  const barStyle = useAnimatedStyle(() => ({
    height: targetH * grow.value,
  }));
  const valStyle = useAnimatedStyle(() => ({ opacity: grow.value }));

  return (
    <View style={{ alignItems: 'center', width }}>
      {showValue && (
        <Animated.Text
          style={[
            { fontSize: 9, color: '#475569', fontWeight: '700', height: VALUE_AREA },
            valStyle,
          ]}
          numberOfLines={1}
        >
          {value > 0 ? Math.round(value / 1000) + 'ك' : ''}
        </Animated.Text>
      )}
      <View style={{ height: maxBar, justifyContent: 'flex-end', width }}>
        <Animated.View
          style={[
            {
              width,
              borderTopLeftRadius: 6,
              borderTopRightRadius: 6,
              overflow: 'hidden',
            },
            barStyle,
          ]}
        >
          <LinearGradient
            colors={value > 0 ? ['#34d399', '#059669'] : ['#e2e8f0', '#e2e8f0']}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
      <Text
        style={{ fontSize: 9, color: '#94a3b8', marginTop: 4, height: LABEL_AREA }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
