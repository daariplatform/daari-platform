import { useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  RefreshControl,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  usePlantKpis,
  usePendingLeads,
  useRevenue7d,
  useDailyInsights,
  useActivityFeed,
  type RevenueDay,
  type DailyInsights,
  type ActivityEvent,
} from '@/lib/queries';
import { useAuth } from '@/lib/auth-store';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { Sparkline } from '@/components/charts/Sparkline';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

/**
 * Plant-owner home — KPIs + alerts + quick actions.
 *
 * تصميم: hero بـ sky gradient، تنبيهات عاجلة (تجاوز الخطة، اقتراب الحدّ، مخزون
 * منخفض)، tile كبير لإيرادات اليوم، شبكة 2×2 للإحصائيات، CTA للزبائن المعلّقين،
 * وأكشن سريع لإضافة طلب walk-in.
 */
export default function PlantHome() {
  const router = useRouter();
  const { user } = useAuth();

  const kpisQuery = usePlantKpis();
  const leadsQuery = usePendingLeads();
  const revenue7dQuery = useRevenue7d();
  const insightsQuery = useDailyInsights();
  const activityQuery = useActivityFeed(8);

  const refreshing =
    kpisQuery.isFetching ||
    leadsQuery.isFetching ||
    revenue7dQuery.isFetching ||
    insightsQuery.isFetching ||
    activityQuery.isFetching;

  const onRefresh = useCallback(() => {
    kpisQuery.refetch();
    leadsQuery.refetch();
    revenue7dQuery.refetch();
    insightsQuery.refetch();
    activityQuery.refetch();
  }, [kpisQuery, leadsQuery, revenue7dQuery, insightsQuery, activityQuery]);

  // Build the Arabic "today" string lazily so it always reflects local time.
  const todayLabel = new Intl.DateTimeFormat('ar-IQ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  // Plant name placeholder — backend doesn't surface tenant.name in the
  // /auth/me payload yet, so we fall back to a friendly label.
  const plantName = 'معملك';

  const kpis = kpisQuery.data;

  // "Fresh plant" = literally nothing has happened yet. A wall of "٠" looks
  // broken (Arabic-Indic zero renders as a tiny dot that looks like a
  // bullet). Show a welcoming empty state instead so the owner knows the
  // app is working and what to do first.
  const isFreshPlant =
    !!kpis &&
    (kpis.todayCompletedOrders ?? 0) === 0 &&
    (kpis.todayPendingOrders ?? 0) === 0 &&
    (kpis.pendingLeadsCount ?? 0) === 0 &&
    (kpis.todayRevenueIqd ?? 0) === 0 &&
    (kpis.opsThisMonth ?? 0) === 0;

  /** Render numbers as Latin digits (0, 12, 1,234) — Arabic-Indic ٠ renders
   * as a tiny dot that users routinely mistake for a bullet in this UI. */
  function n(v: number | null | undefined): string {
    return (v ?? 0).toLocaleString('en-US');
  }

  return (
    <View className="flex-1 bg-slate-50">
      {/* Business dashboard header — deliberately NOT a consumer-style hero.
          A plant owner is running a business; they need a control-panel feel,
          not a "welcome back!" greeting card. White surface, dense info, role
          chip to make the management context unmistakable.

          (The customer + worker apps DO use a colourful greeting hero —
          keep this one distinct so an owner never confuses the surfaces.) */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 6,
            paddingBottom: 12,
            backgroundColor: '#fff',
            borderBottomWidth: 1,
            borderBottomColor: '#e2e8f0',
          }}
        >
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1 }}>
              {/* Role chip — leaves zero ambiguity who this app is for. */}
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignSelf: 'flex-end',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: '#ccfbf1',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  marginBottom: 4,
                }}
              >
                <MaterialIcons name="admin-panel-settings" size={11} color="#0e9384" />
                <Text style={{ color: '#0e9384', fontSize: 10, fontWeight: '800' }}>
                  وضع الإدارة
                </Text>
              </View>
              <Text
                style={{
                  color: '#0f172a',
                  fontWeight: '900',
                  fontSize: 20,
                  textAlign: 'right',
                }}
                numberOfLines={1}
              >
                لوحة {plantName}
              </Text>
              <Text
                style={{
                  color: '#64748b',
                  fontSize: 11,
                  textAlign: 'right',
                  marginTop: 2,
                }}
              >
                {todayLabel}
              </Text>
            </View>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: '#f0fdfa',
                borderWidth: 1,
                borderColor: '#ccfbf1',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name="dashboard" size={24} color="#0e9384" />
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Loading skeletons */}
        {kpisQuery.isLoading && !kpis && (
          <View>
            <Skeleton height={56} borderRadius={16} style={{ marginBottom: 10 }} />
            <Skeleton height={120} borderRadius={22} style={{ marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Skeleton height={84} borderRadius={18} style={{ flex: 1 }} />
              <Skeleton height={84} borderRadius={18} style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Skeleton height={84} borderRadius={18} style={{ flex: 1 }} />
              <Skeleton height={84} borderRadius={18} style={{ flex: 1 }} />
            </View>
            <SkeletonCard height={70} />
          </View>
        )}

        {/* Error fallback */}
        {kpisQuery.isError && !kpis && (
          <EmptyState
            icon="cloud-off"
            title="تعذّر تحميل البيانات"
            subtitle="تأكّد من الاتصال بالإنترنت ثم أعد المحاولة"
            actionLabel="إعادة المحاولة"
            onAction={() => kpisQuery.refetch()}
          />
        )}

        {/* Fresh plant — welcome state instead of a wall of zeros. */}
        {kpis && isFreshPlant && (
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 22,
              padding: 22,
              marginTop: 4,
              shadowColor: '#0f172a',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 2,
              borderWidth: 1,
              borderColor: '#ccfbf1',
            }}
          >
            <LinearGradient
              colors={['#14b8a6', '#0e9384']}
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                marginBottom: 14,
              }}
            >
              <MaterialIcons name="celebration" size={36} color="#fff" />
            </LinearGradient>
            <Text
              style={{
                color: '#0f172a',
                fontWeight: '900',
                fontSize: 18,
                textAlign: 'center',
              }}
            >
              مرحباً بمعملك على داري
            </Text>
            <Text
              style={{
                color: '#64748b',
                fontSize: 13,
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 20,
              }}
            >
              لم تبدأ أي عمليات بعد. ابدأ بإضافة زبائنك وفعّل سائقاً واحداً
              لتشاهد إحصاءاتك اليوميّة هنا.
            </Text>
            <View style={{ marginTop: 16, gap: 10 }}>
              <Pressable
                onPress={() => router.push('/(tabs)/customers')}
                style={({ pressed }) => ({
                  borderRadius: 14,
                  overflow: 'hidden',
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <LinearGradient
                  colors={['#14b8a6', '#0e9384']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    padding: 13,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <MaterialIcons name="person-add" size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                    أضف أول زبون
                  </Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                onPress={() => router.push('/walkin' as any)}
                style={({ pressed }) => ({
                  borderRadius: 14,
                  padding: 12,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderWidth: 1.5,
                  borderColor: '#0e9384',
                  backgroundColor: '#f0fdfa',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <MaterialIcons name="add-shopping-cart" size={18} color="#0e9384" />
                <Text style={{ color: '#0e9384', fontWeight: '700', fontSize: 13 }}>
                  أو سجّل تعبئة مباشرة
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Regular dashboard view — only when the plant has any signal. */}
        {kpis && !isFreshPlant && (
          <>
            {/* ── Alert banners (conditional) ───────────────────────── */}
            {kpis.overLimit && (
              <AlertBanner
                tone="red"
                icon="error"
                title="تجاوزت حدّ خطّتك الشهرية"
                subtitle={`${n(kpis.opsThisMonth)} من ${n(kpis.planLimit)} عملية`}
                onPress={() => router.push('/(tabs)/settings')}
              />
            )}
            {!kpis.overLimit && kpis.nearLimit && (
              <AlertBanner
                tone="amber"
                icon="warning"
                title="اقتربت من حدّ الخطة"
                subtitle={`${n(kpis.opsThisMonth)} من ${n(kpis.planLimit)} عملية`}
                onPress={() => router.push('/(tabs)/settings')}
              />
            )}
            {kpis.stockLow && (
              <AlertBanner
                tone="orange"
                icon="water-drop"
                title="المخزون منخفض"
                subtitle={`${n(kpis.stockLevelLiters)} لتر متبقّي`}
                onPress={() => router.push('/(tabs)/stock')}
              />
            )}

            {/* ── Revenue strip ─────────────────────────────────────
                Dense, dashboard-style: today + month + delta, no oversized
                hero number. Compare to the customer app's "اطلب الآن" hero —
                this is intentionally NOT a CTA. */}
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 14,
                marginTop: 4,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: '#e2e8f0',
              }}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <MaterialIcons name="trending-up" size={14} color="#0e9384" />
                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700' }}>
                  الإيرادات
                </Text>
              </View>
              <View style={{ flexDirection: 'row-reverse', gap: 14 }}>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 10, color: '#94a3b8' }}>اليوم</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a', marginTop: 2 }}>
                    {n(kpis.todayRevenueIqd)}
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700' }}>{' '}د.ع</Text>
                  </Text>
                  <Text style={{ fontSize: 10, color: '#0e9384', marginTop: 2 }}>
                    {n(kpis.todayCompletedOrders)} طلب
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: '#e2e8f0' }} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 10, color: '#94a3b8' }}>الشهر</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a', marginTop: 2 }}>
                    {n(kpis.opsThisMonth)}
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700' }}>{' '}عملية</Text>
                  </Text>
                  <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                    من {n(kpis.planLimit)}
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: '#e2e8f0' }} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 10, color: '#94a3b8' }}>المخزون</Text>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '900',
                      color: kpis.stockLow ? '#ef4444' : '#0f172a',
                      marginTop: 2,
                    }}
                  >
                    {stockPct(kpis.stockLevelLiters, kpis.stockCapacityLiters)}
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700' }}>%</Text>
                  </Text>
                  <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                    {n(kpis.stockLevelLiters)} لتر
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Revenue sparkline (7-day trend) ───────────────────
                Sits between the revenue strip and the 2×2 grid: gives a
                visual "is this week up or down?" before the eye lands on
                the numeric tiles. The line auto-scales to data so any
                shape is readable even on slow weeks. */}
            <RevenueTrendCard
              query={revenue7dQuery}
              isLoading={revenue7dQuery.isLoading && !revenue7dQuery.data}
            />

            {/* ── "نظرة سريعة" insight cards ────────────────────────
                Horizontal scroller with three signals: best driver, top
                customer, weekly growth. Each falls back to "—" when the
                backend returns null, so the row never collapses. */}
            <InsightsRow
              data={insightsQuery.data ?? null}
              isLoading={insightsQuery.isLoading && !insightsQuery.data}
            />

            {/* ── 2×2 stat grid ─────────────────────────────────────── */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatTile
                icon="schedule"
                label="طلبات قيد الانتظار"
                value={n(kpis.todayPendingOrders)}
                tint="#f59e0b"
                onPress={() => router.push('/(tabs)/orders')}
              />
              <StatTile
                icon="local-shipping"
                label="السائقون النشطون"
                value={n(kpis.activeDrivers)}
                tint="#0e9384"
                onPress={() => router.push('/drivers' as any)}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <StatTile
                icon="person-add"
                label="زبائن بانتظار الموافقة"
                value={n(kpis.pendingLeadsCount)}
                tint="#10b981"
                onPress={() => router.push('/(tabs)/customers')}
              />
              <StatTile
                icon="water-drop"
                label="نسبة المخزون"
                value={`${stockPct(kpis.stockLevelLiters, kpis.stockCapacityLiters)}%`}
                tint={kpis.stockLow ? '#ef4444' : '#0891b2'}
                onPress={() => router.push('/(tabs)/stock')}
              />
            </View>

            {/* ── Pending leads CTA ─────────────────────────────────── */}
            {kpis.pendingLeadsCount > 0 && (
              <Pressable
                onPress={() => router.push('/(tabs)/customers')}
                style={({ pressed }) => ({
                  marginTop: 14,
                  borderRadius: 18,
                  overflow: 'hidden',
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <LinearGradient
                  colors={['#fef3c7', '#fde68a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    padding: 14,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 12,
                    borderWidth: 1,
                    borderColor: '#fcd34d',
                    borderRadius: 18,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: '#f59e0b',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MaterialIcons name="person-add" size={24} color="#fff" />
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text
                      style={{
                        color: '#78350f',
                        fontWeight: '900',
                        fontSize: 14,
                      }}
                    >
                      {n(kpis.pendingLeadsCount)} زبون بانتظار موافقتك
                    </Text>
                    <Text style={{ color: '#92400e', fontSize: 11, marginTop: 2 }}>
                      اضغط لمراجعة الطلبات الجديدة
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-left" size={24} color="#92400e" />
                </LinearGradient>
              </Pressable>
            )}

            {/* ── "آخر النشاط" activity feed ──────────────────────
                Last 8 events across the plant (orders, leads, stock,
                drivers). Sits between the KPI grid and the admin tools so
                the owner can scan "what changed?" without leaving home.
                Tappable items deep-link into the relevant tab. */}
            <ActivityFeedSection
              data={activityQuery.data ?? []}
              isLoading={activityQuery.isLoading && !activityQuery.data}
              onTap={(ev) => {
                if (ev.deeplink) {
                  // Deep-links are validated by the router; cast keeps
                  // TS happy because the string isn't in the static
                  // typed-routes union.
                  router.push(ev.deeplink as any);
                }
              }}
            />

            {/* ── Admin quick actions ───────────────────────────────
                Small icon buttons (NOT large CTAs). These are management
                shortcuts, not consumer "press to order" affordances. The
                customer app intentionally uses the opposite pattern (one
                big "اطلب الآن"). Names also avoid the word "اطلب" so they
                never read like the customer flow. */}
            <Text
              style={{
                fontSize: 11,
                color: '#64748b',
                fontWeight: '700',
                textAlign: 'right',
                marginTop: 16,
                marginBottom: 8,
              }}
            >
              أدوات الإدارة
            </Text>
            <View
              style={{
                flexDirection: 'row-reverse',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {/* Row 1 — daily ops the manager touches most */}
              <AdminTool
                icon="point-of-sale"
                label="بيع نقدي"
                onPress={() => router.push('/walkin' as any)}
              />
              <AdminTool
                icon="people"
                label="الزبائن"
                onPress={() => router.push('/(tabs)/customers')}
              />
              <AdminTool
                icon="directions-car"
                label="السائقون"
                onPress={() => router.push('/drivers' as any)}
              />
              <AdminTool
                icon="inventory-2"
                label="الخزّانات"
                onPress={() => router.push('/tanks' as any)}
              />

              {/* Row 2 — analytics + finance */}
              <AdminTool
                icon="insights"
                label="التقارير"
                onPress={() => router.push('/reports' as any)}
              />
              <AdminTool
                icon="account-balance"
                label="المحاسبة"
                onPress={() => router.push('/accounting' as any)}
              />
              <AdminTool
                icon="campaign"
                label="العروض"
                onPress={() => router.push('/promos' as any)}
              />
              <AdminTool
                icon="map"
                label="الخريطة الحيّة"
                onPress={() => router.push('/drivers/live' as any)}
              />

              {/* Row 3 — admin / governance */}
              <AdminTool
                icon="groups"
                label="فريق العمل"
                onPress={() => router.push('/team' as any)}
              />
              <AdminTool
                icon="notifications"
                label="التنبيهات"
                onPress={() => router.push('/notifications' as any)}
              />
              <AdminTool
                icon="history"
                label="سجلّ التعديلات"
                onPress={() => router.push('/audit-log' as any)}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function stockPct(current: number, capacity: number): string {
  if (!capacity || capacity <= 0) return '0';
  const pct = Math.max(0, Math.min(100, Math.round((current / capacity) * 100)));
  return pct.toLocaleString('en-US');
}

// ────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────

function AlertBanner({
  tone,
  icon,
  title,
  subtitle,
  onPress,
}: {
  tone: 'red' | 'amber' | 'orange';
  icon: MaterialIconName;
  title: string;
  subtitle?: string;
  onPress?: (e: GestureResponderEvent) => void;
}) {
  // tone → bg / border / icon-bg / fg colour map. Kept inline so a designer
  // editing one tone doesn't have to chase a shared palette file.
  const palette = {
    red: {
      bg: '#fef2f2',
      border: '#fecaca',
      iconBg: '#ef4444',
      title: '#991b1b',
      subtitle: '#b91c1c',
    },
    amber: {
      bg: '#fffbeb',
      border: '#fde68a',
      iconBg: '#f59e0b',
      title: '#92400e',
      subtitle: '#b45309',
    },
    orange: {
      bg: '#fff7ed',
      border: '#fed7aa',
      iconBg: '#fb923c',
      title: '#9a3412',
      subtitle: '#c2410c',
    },
  }[tone];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: palette.iconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name={icon} size={22} color="#fff" />
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={{ color: palette.title, fontWeight: '800', fontSize: 13 }}>{title}</Text>
        {subtitle && (
          <Text style={{ color: palette.subtitle, fontSize: 11, marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {onPress && <MaterialIcons name="chevron-left" size={22} color={palette.subtitle} />}
    </Pressable>
  );
}

function StatTile({
  icon,
  label,
  value,
  tint,
  onPress,
}: {
  icon: MaterialIconName;
  label: string;
  value: string;
  tint: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 14,
        // Tinted border so each tile feels intentionally placed instead of
        // floating against the page. The very pale `tint + '33'` reads as
        // ink, not chrome — keeps the dashboard quiet but legible.
        borderWidth: 1,
        borderColor: tint + '33',
        opacity: pressed ? 0.85 : 1,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        // Minimum height locks the 2×2 grid to a square-ish rhythm even
        // when one label wraps to a second line.
        minHeight: 116,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: tint + '1A',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-end',
        }}
      >
        <MaterialIcons name={icon} size={22} color={tint} />
      </View>
      <Text
        style={{
          marginTop: 12,
          fontSize: 24,
          fontWeight: '900',
          color: '#0f172a',
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 11,
          color: '#64748b',
          marginTop: 2,
          textAlign: 'right',
          fontWeight: '600',
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * AdminTool — small icon+label tile used in the admin home's tool strip.
 * Wraps to 2-per-row on narrow screens. Intentionally NOT a big CTA: the
 * customer app owns that pattern (the "اطلب الآن" pulse button). Admin
 * tools are management shortcuts, not primary calls-to-action.
 */
function AdminTool({
  icon,
  label,
  onPress,
}: {
  icon: MaterialIconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: '48.5%',
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 12,
        paddingHorizontal: 12,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 10,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: '#f0fdfa',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name={icon} size={18} color="#0e9384" />
      </View>
      <Text style={{ color: '#0f172a', fontWeight: '700', fontSize: 12, flex: 1, textAlign: 'right' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: MaterialIconName;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  if (primary) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flex: 1,
          borderRadius: 18,
          overflow: 'hidden',
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <LinearGradient
          colors={['#14b8a6', '#0e9384']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 14,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <MaterialIcons name={icon} size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#99f6e4',
        paddingVertical: 14,
        paddingHorizontal: 14,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <MaterialIcons name={icon} size={20} color="#0e9384" />
      <Text style={{ color: '#0c7a6e', fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

// ────────────────────────────────────────────────────────────────────
// Trend + insights + activity feed sub-components
// ────────────────────────────────────────────────────────────────────

/** Short Arabic weekday name (أحد، اثنين، ...) from a YYYY-MM-DD date. */
const AR_WEEKDAY_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
function arabicShortDay(dateStr: string): string {
  // Treat the backend's plain "YYYY-MM-DD" as a local-time date — using
  // `new Date('YYYY-MM-DD')` parses as UTC and can shift the weekday by
  // one in Baghdad time zones, which would make the labels wrong.
  const [y, m, d] = dateStr.split('-').map((s) => parseInt(s, 10));
  if (!y || !m || !d) return '—';
  const dt = new Date(y, m - 1, d);
  const wd = dt.getDay();
  return AR_WEEKDAY_SHORT[wd] ?? '—';
}

/** Compact Latin-digit IQD short form for sidebars: "12ك" / "3.4م". */
function iqdCompact(amount: number): string {
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'م';
  }
  if (amount >= 1_000) {
    return Math.round(amount / 1_000).toLocaleString('en-US') + 'ك';
  }
  return Math.round(amount).toLocaleString('en-US');
}

/** Human-relative time in Arabic: "قبل ٥ د"، "قبل ٢ سا"، "أمس". */
function relativeTimeAr(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `قبل ${diffMin.toLocaleString('en-US')} د`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `قبل ${diffH.toLocaleString('en-US')} سا`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'أمس';
  if (diffD < 7) return `قبل ${diffD.toLocaleString('en-US')} يوم`;
  return new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'short' }).format(
    new Date(t),
  );
}

/**
 * RevenueTrendCard — sparkline + day labels + total/avg/peak side stats.
 *
 * The card is intentionally one row: the sparkline fills the left (in RTL,
 * the visual right), and a thin stats column hugs the trailing edge. When
 * the API returns 0 days we render a static empty state instead of a
 * deceptive flat-line at 0 — the difference between "no data" and "zero
 * revenue all week" matters to an owner.
 */
function RevenueTrendCard({
  query,
  isLoading,
}: {
  query: { data?: RevenueDay[]; isError?: boolean };
  isLoading: boolean;
}) {
  const data = query.data ?? [];
  const values = data.map((d) => d.revenueIqd);
  const total = values.reduce((a, b) => a + b, 0);
  const avg = values.length ? total / values.length : 0;
  const peak = values.length ? Math.max(...values) : 0;

  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
      }}
    >
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 6,
          marginBottom: 10,
        }}
      >
        <MaterialIcons name="show-chart" size={14} color="#0e9384" />
        <Text style={{ fontSize: 12, color: '#0f172a', fontWeight: '800' }}>
          اتجاه الإيرادات
        </Text>
        <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '600' }}>
          (آخر 7 أيام)
        </Text>
      </View>

      {isLoading ? (
        <Skeleton height={70} borderRadius={10} />
      ) : data.length === 0 ? (
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 18,
          }}
        >
          <MaterialIcons name="bar-chart" size={18} color="#94a3b8" />
          <Text style={{ color: '#64748b', fontSize: 12 }}>
            لا توجد بيانات لعرض الاتجاه بعد
          </Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row-reverse', gap: 12 }}>
          {/* Chart + day-label row */}
          <View style={{ flex: 1 }}>
            <Sparkline
              data={values}
              height={60}
              color="#0e9384"
              fillColor="#ccfbf1"
            />
            {/* Day labels — RTL row so the rightmost label is the oldest day. */}
            <View
              style={{
                flexDirection: 'row-reverse',
                justifyContent: 'space-between',
                marginTop: 6,
              }}
            >
              {data.map((d) => (
                <Text
                  key={d.date}
                  style={{
                    fontSize: 9,
                    color: '#94a3b8',
                    fontWeight: '600',
                    width: 32,
                    textAlign: 'center',
                  }}
                  numberOfLines={1}
                >
                  {arabicShortDay(d.date)}
                </Text>
              ))}
            </View>
          </View>

          {/* Side stats column */}
          <View
            style={{
              width: 64,
              borderLeftWidth: 1,
              borderLeftColor: '#e2e8f0',
              paddingLeft: 10,
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            <SideStat label="الإجمالي" value={iqdCompact(total)} tone="#0f172a" />
            <SideStat label="المعدل" value={iqdCompact(avg)} tone="#0e9384" />
            <SideStat label="الذروة" value={iqdCompact(peak)} tone="#f59e0b" />
          </View>
        </View>
      )}
    </View>
  );
}

function SideStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 13, color: tone, fontWeight: '900', marginTop: 1 }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * InsightsRow — three "نظرة سريعة" cards in a horizontal scroller.
 *
 * The row scrolls because three full-width cards would stack vertically
 * and balloon the home; a horizontal flick keeps the dashboard feel
 * dense. RTL is honoured via `inverted`-style ScrollView config (we
 * just reverse the children order — easier than wrestling RN's RTL
 * scroll behaviour, which differs subtly across platforms).
 */
function InsightsRow({
  data,
  isLoading,
}: {
  data: DailyInsights | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <View style={{ marginTop: 12 }}>
        <Text
          style={{
            fontSize: 11,
            color: '#64748b',
            fontWeight: '700',
            textAlign: 'right',
            marginBottom: 8,
          }}
        >
          نظرة سريعة
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Skeleton height={84} borderRadius={14} style={{ flex: 1 }} />
          <Skeleton height={84} borderRadius={14} style={{ flex: 1 }} />
          <Skeleton height={84} borderRadius={14} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }

  const growth = data?.growthVsLastWeekPct ?? 0;
  const growthSign = growth > 0 ? '+' : growth < 0 ? '−' : '';
  const growthAbs = Math.abs(growth).toLocaleString('en-US', {
    maximumFractionDigits: 1,
  });
  const growthTint = growth > 0 ? '#10b981' : growth < 0 ? '#ef4444' : '#64748b';
  const growthIcon: MaterialIconName =
    growth > 0 ? 'trending-up' : growth < 0 ? 'trending-down' : 'trending-flat';

  return (
    <View style={{ marginTop: 12 }}>
      <Text
        style={{
          fontSize: 11,
          color: '#64748b',
          fontWeight: '700',
          textAlign: 'right',
          marginBottom: 8,
        }}
      >
        نظرة سريعة
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 8,
          flexDirection: 'row-reverse',
          paddingHorizontal: 2,
        }}
      >
        <InsightCard
          icon="emoji-events"
          tint="#0e9384"
          label="أفضل سائق"
          primary={data?.bestDriver?.fullName ?? '—'}
          secondary={
            data?.bestDriver
              ? `${data.bestDriver.completedOrders.toLocaleString('en-US')} طلب`
              : 'لا توجد بيانات'
          }
        />
        <InsightCard
          icon="person"
          tint="#0891b2"
          label="أعلى زبون"
          primary={data?.topCustomer?.fullName ?? '—'}
          secondary={
            data?.topCustomer
              ? `${data.topCustomer.totalSpendIqd.toLocaleString('en-US')} د.ع`
              : 'لا توجد بيانات'
          }
        />
        <InsightCard
          icon={growthIcon}
          tint={growthTint}
          label="النمو هذا الأسبوع"
          primary={data ? `${growthSign}${growthAbs}%` : '—'}
          secondary={
            data
              ? growth === 0
                ? 'بدون تغيير'
                : growth > 0
                ? 'مقارنة بالأسبوع الماضي'
                : 'مقارنة بالأسبوع الماضي'
              : 'لا توجد بيانات'
          }
          highlight={growthTint}
        />
      </ScrollView>
    </View>
  );
}

function InsightCard({
  icon,
  tint,
  label,
  primary,
  secondary,
  highlight,
}: {
  icon: MaterialIconName;
  tint: string;
  label: string;
  primary: string;
  secondary: string;
  /** If set, paints the `primary` value in this colour (used by growth). */
  highlight?: string;
}) {
  return (
    <View
      style={{
        width: 180,
        backgroundColor: '#fff',
        // Match the 2x2 StatTile styling below (radius 18 + shadow) so the
        // two rows feel like one unified dashboard surface instead of two
        // mismatched widgets stacked on each other.
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
      }}
    >
      <View
        style={{
          flexDirection: 'row-reverse',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            color: '#94a3b8',
            fontWeight: '700',
            flex: 1,
            textAlign: 'right',
            paddingRight: 6,
          }}
        >
          {label}
        </Text>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: tint + '1A',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons name={icon} size={20} color={tint} />
        </View>
      </View>
      <Text
        style={{
          marginTop: 10,
          // Bigger primary so the insight tile reads at the same rhythm
          // as the 2x2 stat tiles below (which use 22pt). 18pt keeps two
          // tiles per row comfortable on a narrow phone.
          fontSize: 18,
          fontWeight: '900',
          color: highlight ?? '#0f172a',
          textAlign: 'right',
        }}
        numberOfLines={1}
      >
        {primary}
      </Text>
      <Text
        style={{
          marginTop: 2,
          fontSize: 11,
          color: '#64748b',
          textAlign: 'right',
        }}
        numberOfLines={1}
      >
        {secondary}
      </Text>
    </View>
  );
}

/**
 * ActivityFeedSection — "آخر النشاط" list of the last N events.
 *
 * Each row is tappable when a `deeplink` is present. Empty state uses a
 * compact inline message (not the big EmptyState component) because we're
 * in a dense dashboard scroll — a giant empty illustration would push the
 * admin tools off-screen even on a busy plant.
 */
function ActivityFeedSection({
  data,
  isLoading,
  onTap,
}: {
  data: ActivityEvent[];
  isLoading: boolean;
  onTap: (ev: ActivityEvent) => void;
}) {
  if (isLoading) {
    return (
      <View style={{ marginTop: 16 }}>
        <Text
          style={{
            fontSize: 11,
            color: '#64748b',
            fontWeight: '700',
            textAlign: 'right',
            marginBottom: 8,
          }}
        >
          آخر النشاط
        </Text>
        <SkeletonCard height={64} />
        <SkeletonCard height={64} />
      </View>
    );
  }

  return (
    <View style={{ marginTop: 16 }}>
      <Text
        style={{
          fontSize: 11,
          color: '#64748b',
          fontWeight: '700',
          textAlign: 'right',
          marginBottom: 8,
        }}
      >
        آخر النشاط
      </Text>
      {data.length === 0 ? (
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            paddingVertical: 18,
            alignItems: 'center',
            gap: 6,
          }}
        >
          <MaterialIcons name="history" size={22} color="#94a3b8" />
          <Text style={{ color: '#64748b', fontSize: 12 }}>
            لا يوجد نشاط حديث
          </Text>
        </View>
      ) : (
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            overflow: 'hidden',
          }}
        >
          {data.map((ev, i) => (
            <ActivityRow
              key={ev.id}
              event={ev}
              showDivider={i < data.length - 1}
              onPress={() => onTap(ev)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function ActivityRow({
  event,
  showDivider,
  onPress,
}: {
  event: ActivityEvent;
  showDivider: boolean;
  onPress: () => void;
}) {
  const meta = ACTIVITY_KIND_META[event.kind] ?? ACTIVITY_KIND_META.order;
  const tappable = !!event.deeplink;

  return (
    <Pressable
      onPress={tappable ? onPress : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: showDivider ? 1 : 0,
        borderBottomColor: '#f1f5f9',
        opacity: pressed && tappable ? 0.75 : 1,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: meta.tint + '1A',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name={meta.icon} size={16} color={meta.tint} />
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text
          style={{
            color: '#0f172a',
            fontWeight: '700',
            fontSize: 12,
            textAlign: 'right',
          }}
          numberOfLines={1}
        >
          {event.title}
        </Text>
        <Text
          style={{
            color: '#64748b',
            fontSize: 10,
            marginTop: 2,
            textAlign: 'right',
          }}
          numberOfLines={1}
        >
          {event.subtitle}
        </Text>
      </View>
      <Text
        style={{
          color: '#94a3b8',
          fontSize: 9,
          fontWeight: '600',
          marginLeft: 4,
        }}
      >
        {relativeTimeAr(event.createdAt)}
      </Text>
      {tappable && (
        <MaterialIcons name="chevron-left" size={18} color="#94a3b8" />
      )}
    </Pressable>
  );
}

const ACTIVITY_KIND_META: Record<
  ActivityEvent['kind'],
  { icon: MaterialIconName; tint: string }
> = {
  order: { icon: 'receipt-long', tint: '#0e9384' },
  lead: { icon: 'person-add', tint: '#f59e0b' },
  stock: { icon: 'water-drop', tint: '#0891b2' },
  driver: { icon: 'local-shipping', tint: '#7c3aed' },
};
