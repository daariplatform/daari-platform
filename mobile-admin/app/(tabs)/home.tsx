import { useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  RefreshControl,
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
import {
  AdminTool,
  AlertBanner,
  Card,
  IconBadge,
  SectionHeader,
  StatTile,
  type IconBadgeTone,
} from '@/components/ui';
import { theme } from '@/lib/theme';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

/**
 * Plant-owner home — KPIs + alerts + quick actions.
 *
 * تصميم: hero بـ sky gradient، تنبيهات عاجلة (تجاوز الخطة، اقتراب الحدّ، مخزون
 * منخفض)، tile كبير لإيرادات اليوم، شبكة 2×2 للإحصائيات، CTA للزبائن المعلّقين,
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
    <View style={{ flex: 1, backgroundColor: theme.color.surface.page }}>
      {/* Business dashboard header — deliberately NOT a consumer-style hero.
          A plant owner is running a business; they need a control-panel feel,
          not a "welcome back!" greeting card. White surface, dense info, role
          chip to make the management context unmistakable.

          (The customer + worker apps DO use a colourful greeting hero —
          keep this one distinct so an owner never confuses the surfaces.) */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.color.surface.card }}>
        <View
          style={{
            paddingHorizontal: theme.space.lg,
            paddingTop: theme.space.xs + 2,
            paddingBottom: theme.space.md,
            backgroundColor: theme.color.surface.card,
            borderBottomWidth: 1,
            borderBottomColor: theme.color.border.subtle,
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
                  gap: theme.space.xs,
                  backgroundColor: theme.color.accent.tint,
                  paddingHorizontal: theme.space.sm,
                  paddingVertical: theme.space.xxs,
                  borderRadius: theme.radius.pill,
                  marginBottom: theme.space.xs,
                }}
              >
                <MaterialIcons
                  name="admin-panel-settings"
                  size={11}
                  color={theme.color.accent.primary}
                />
                <Text
                  style={{
                    ...theme.font.labelSm,
                    color: theme.color.accent.primary,
                  }}
                >
                  وضع الإدارة
                </Text>
              </View>
              <Text
                style={{
                  ...theme.font.displaySm,
                  fontSize: 20,
                  color: theme.color.text.primary,
                  textAlign: 'right',
                }}
                numberOfLines={1}
              >
                لوحة {plantName}
              </Text>
              <Text
                style={{
                  ...theme.font.bodySm,
                  color: theme.color.text.secondary,
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
                borderRadius: theme.radius.lg - 2,
                backgroundColor: theme.color.raw.teal[50],
                borderWidth: 1,
                borderColor: theme.color.accent.tint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name="dashboard" size={24} color={theme.color.accent.primary} />
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.space.md + 2,
          paddingTop: theme.space.md + 2,
          paddingBottom: theme.space['2xl'] + theme.space.xs,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Loading skeletons */}
        {kpisQuery.isLoading && !kpis && (
          <View>
            <Skeleton height={56} borderRadius={theme.radius.lg} style={{ marginBottom: 10 }} />
            <Skeleton height={120} borderRadius={theme.radius.xl} style={{ marginBottom: theme.space.md }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Skeleton height={84} borderRadius={theme.radius.lg} style={{ flex: 1 }} />
              <Skeleton height={84} borderRadius={theme.radius.lg} style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Skeleton height={84} borderRadius={theme.radius.lg} style={{ flex: 1 }} />
              <Skeleton height={84} borderRadius={theme.radius.lg} style={{ flex: 1 }} />
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
          <Card
            variant="raised"
            padding="lg"
            style={{ marginTop: theme.space.xs, borderColor: theme.color.accent.tint }}
          >
            <LinearGradient
              colors={[theme.color.raw.teal[500], theme.color.accent.primary]}
              style={{
                width: 72,
                height: 72,
                borderRadius: theme.radius['2xl'],
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                marginBottom: theme.space.md + 2,
              }}
            >
              <MaterialIcons name="celebration" size={36} color={theme.color.text.onAccent} />
            </LinearGradient>
            <Text
              style={{
                ...theme.font.headingLg,
                fontSize: 18,
                color: theme.color.text.primary,
                textAlign: 'center',
              }}
            >
              مرحباً بمعملك على داري
            </Text>
            <Text
              style={{
                ...theme.font.bodyMd,
                fontSize: 13,
                color: theme.color.text.secondary,
                textAlign: 'center',
                marginTop: theme.space.xs + 2,
                lineHeight: 20,
              }}
            >
              لم تبدأ أي عمليات بعد. ابدأ بإضافة زبائنك وفعّل سائقاً واحداً
              لتشاهد إحصاءاتك اليوميّة هنا.
            </Text>
            <View style={{ marginTop: theme.space.lg, gap: 10 }}>
              <Pressable
                onPress={() => router.push('/(tabs)/customers')}
                style={({ pressed }) => ({
                  borderRadius: theme.radius.lg - 2,
                  overflow: 'hidden',
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <LinearGradient
                  colors={[theme.color.raw.teal[500], theme.color.accent.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    padding: 13,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: theme.space.sm,
                  }}
                >
                  <MaterialIcons name="person-add" size={20} color={theme.color.text.onAccent} />
                  <Text
                    style={{
                      color: theme.color.text.onAccent,
                      fontWeight: '800',
                      fontSize: 14,
                    }}
                  >
                    أضف أول زبون
                  </Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                onPress={() => router.push('/walkin' as any)}
                style={({ pressed }) => ({
                  borderRadius: theme.radius.lg - 2,
                  padding: theme.space.md,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: theme.space.sm,
                  borderWidth: 1.5,
                  borderColor: theme.color.accent.primary,
                  backgroundColor: theme.color.raw.teal[50],
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <MaterialIcons
                  name="add-shopping-cart"
                  size={18}
                  color={theme.color.accent.primary}
                />
                <Text
                  style={{
                    color: theme.color.accent.primary,
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  أو سجّل تعبئة مباشرة
                </Text>
              </Pressable>
            </View>
          </Card>
        )}

        {/* Regular dashboard view — only when the plant has any signal. */}
        {kpis && !isFreshPlant && (
          <>
            {/* ── Alert banners (conditional) ───────────────────────── */}
            {kpis.overLimit && (
              <AlertBanner
                tone="danger"
                icon="error"
                title="تجاوزت حدّ خطّتك الشهرية"
                subtitle={`${n(kpis.opsThisMonth)} من ${n(kpis.planLimit)} عملية`}
                onPress={() => router.push('/(tabs)/settings')}
              />
            )}
            {!kpis.overLimit && kpis.nearLimit && (
              <AlertBanner
                tone="warning"
                icon="warning"
                title="اقتربت من حدّ الخطة"
                subtitle={`${n(kpis.opsThisMonth)} من ${n(kpis.planLimit)} عملية`}
                onPress={() => router.push('/(tabs)/settings')}
              />
            )}
            {kpis.stockLow && (
              <AlertBanner
                tone="warning"
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
            <Card
              variant="flat"
              padding="sm"
              style={{ marginTop: theme.space.xs, marginBottom: 10 }}
            >
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: theme.space.sm,
                }}
              >
                <MaterialIcons name="trending-up" size={14} color={theme.color.accent.primary} />
                <Text
                  style={{
                    ...theme.font.labelLg,
                    fontSize: 11,
                    color: theme.color.text.secondary,
                  }}
                >
                  الإيرادات
                </Text>
              </View>
              <View style={{ flexDirection: 'row-reverse', gap: theme.space.md + 2 }}>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      ...theme.font.labelSm,
                      fontWeight: '500',
                      color: theme.color.text.disabled,
                    }}
                  >
                    اليوم
                  </Text>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '900',
                      color: theme.color.text.primary,
                      marginTop: 2,
                    }}
                  >
                    {n(kpis.todayRevenueIqd)}
                    <Text
                      style={{
                        ...theme.font.labelLg,
                        color: theme.color.text.secondary,
                      }}
                    >
                      {' '}
                      د.ع
                    </Text>
                  </Text>
                  <Text
                    style={{
                      ...theme.font.labelSm,
                      fontWeight: '500',
                      color: theme.color.accent.primary,
                      marginTop: 2,
                    }}
                  >
                    {n(kpis.todayCompletedOrders)} طلب
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: theme.color.border.subtle }} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      ...theme.font.labelSm,
                      fontWeight: '500',
                      color: theme.color.text.disabled,
                    }}
                  >
                    الشهر
                  </Text>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '900',
                      color: theme.color.text.primary,
                      marginTop: 2,
                    }}
                  >
                    {n(kpis.opsThisMonth)}
                    <Text
                      style={{
                        ...theme.font.labelLg,
                        color: theme.color.text.secondary,
                      }}
                    >
                      {' '}
                      عملية
                    </Text>
                  </Text>
                  <Text
                    style={{
                      ...theme.font.labelSm,
                      fontWeight: '500',
                      color: theme.color.text.secondary,
                      marginTop: 2,
                    }}
                  >
                    من {n(kpis.planLimit)}
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: theme.color.border.subtle }} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      ...theme.font.labelSm,
                      fontWeight: '500',
                      color: theme.color.text.disabled,
                    }}
                  >
                    المخزون
                  </Text>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '900',
                      color: kpis.stockLow
                        ? theme.color.state.danger.solid
                        : theme.color.text.primary,
                      marginTop: 2,
                    }}
                  >
                    {stockPct(kpis.stockLevelLiters, kpis.stockCapacityLiters)}
                    <Text
                      style={{
                        ...theme.font.labelLg,
                        color: theme.color.text.secondary,
                      }}
                    >
                      %
                    </Text>
                  </Text>
                  <Text
                    style={{
                      ...theme.font.labelSm,
                      fontWeight: '500',
                      color: theme.color.text.secondary,
                      marginTop: 2,
                    }}
                  >
                    {n(kpis.stockLevelLiters)} لتر
                  </Text>
                </View>
              </View>
            </Card>

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
                tone="amber"
                onPress={() => router.push('/(tabs)/orders')}
              />
              <StatTile
                icon="local-shipping"
                label="السائقون النشطون"
                value={n(kpis.activeDrivers)}
                tone="teal"
                onPress={() => router.push('/drivers' as any)}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <StatTile
                icon="person-add"
                label="زبائن بانتظار الموافقة"
                value={n(kpis.pendingLeadsCount)}
                tone="emerald"
                onPress={() => router.push('/(tabs)/customers')}
              />
              <StatTile
                icon="water-drop"
                label="نسبة المخزون"
                value={`${stockPct(kpis.stockLevelLiters, kpis.stockCapacityLiters)}%`}
                tone={kpis.stockLow ? 'rose' : 'sky'}
                onPress={() => router.push('/(tabs)/stock')}
              />
            </View>

            {/* ── Pending leads CTA ─────────────────────────────────── */}
            {kpis.pendingLeadsCount > 0 && (
              <Pressable
                onPress={() => router.push('/(tabs)/customers')}
                style={({ pressed }) => ({
                  marginTop: theme.space.md + 2,
                  borderRadius: theme.radius.xl - 2,
                  overflow: 'hidden',
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <LinearGradient
                  colors={[theme.color.raw.amber[100], '#fde68a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    padding: theme.space.md + 2,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: theme.space.md,
                    borderWidth: 1,
                    borderColor: '#fcd34d',
                    borderRadius: theme.radius.xl - 2,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: theme.radius.lg - 2,
                      backgroundColor: theme.color.raw.amber[500],
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MaterialIcons
                      name="person-add"
                      size={24}
                      color={theme.color.text.onAccent}
                    />
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
                    <Text style={{ color: theme.color.raw.amber[700], fontSize: 11, marginTop: 2 }}>
                      اضغط لمراجعة الطلبات الجديدة
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-left" size={24} color={theme.color.raw.amber[700]} />
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
            <SectionHeader title="أدوات الإدارة" />
            <View
              style={{
                flexDirection: 'row-reverse',
                flexWrap: 'wrap',
                gap: theme.space.sm,
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

// ────────────────────────────────────────────────────────────────
// Trend + insights + activity feed sub-components
// ────────────────────────────────────────────────────────────────

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
    <Card variant="flat" padding="sm" style={{ marginBottom: 10 }}>
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 6,
          marginBottom: 10,
        }}
      >
        <MaterialIcons name="show-chart" size={14} color={theme.color.accent.primary} />
        <Text
          style={{
            ...theme.font.headingMd,
            fontSize: 12,
            color: theme.color.text.primary,
          }}
        >
          اتجاه الإيرادات
        </Text>
        <Text
          style={{
            ...theme.font.labelSm,
            fontWeight: '600',
            color: theme.color.text.secondary,
          }}
        >
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
            gap: theme.space.sm,
            paddingVertical: 18,
          }}
        >
          <MaterialIcons name="bar-chart" size={18} color={theme.color.text.disabled} />
          <Text
            style={{
              ...theme.font.bodyMd,
              color: theme.color.text.secondary,
            }}
          >
            لا توجد بيانات لعرض الاتجاه بعد
          </Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row-reverse', gap: theme.space.md }}>
          {/* Chart + day-label row */}
          <View style={{ flex: 1 }}>
            <Sparkline
              data={values}
              height={60}
              color={theme.color.accent.primary}
              fillColor={theme.color.accent.tint}
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
                    color: theme.color.text.disabled,
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
              borderLeftColor: theme.color.border.subtle,
              paddingLeft: 10,
              gap: theme.space.sm,
              alignItems: 'flex-end',
            }}
          >
            <SideStat label="الإجمالي" value={iqdCompact(total)} tone={theme.color.text.primary} />
            <SideStat label="المعدل" value={iqdCompact(avg)} tone={theme.color.accent.primary} />
            <SideStat label="الذروة" value={iqdCompact(peak)} tone={theme.color.raw.amber[500]} />
          </View>
        </View>
      )}
    </Card>
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
      <Text style={{ fontSize: 9, color: theme.color.text.disabled, fontWeight: '600' }}>
        {label}
      </Text>
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
      <View style={{ marginTop: theme.space.md }}>
        <SectionHeader title="نظرة سريعة" />
        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          <Skeleton height={84} borderRadius={theme.radius.lg - 2} style={{ flex: 1 }} />
          <Skeleton height={84} borderRadius={theme.radius.lg - 2} style={{ flex: 1 }} />
          <Skeleton height={84} borderRadius={theme.radius.lg - 2} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }

  const growth = data?.growthVsLastWeekPct ?? 0;
  const growthSign = growth > 0 ? '+' : growth < 0 ? '−' : '';
  const growthAbs = Math.abs(growth).toLocaleString('en-US', {
    maximumFractionDigits: 1,
  });
  const growthTone: IconBadgeTone =
    growth > 0 ? 'emerald' : growth < 0 ? 'rose' : 'teal';
  const growthHighlight =
    growth > 0
      ? theme.color.state.success.solid
      : growth < 0
        ? theme.color.state.danger.solid
        : theme.color.text.secondary;
  const growthIcon: MaterialIconName =
    growth > 0 ? 'trending-up' : growth < 0 ? 'trending-down' : 'trending-flat';

  return (
    <View>
      <SectionHeader title="نظرة سريعة" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: theme.space.sm,
          flexDirection: 'row-reverse',
          paddingHorizontal: 2,
        }}
      >
        <InsightCard
          icon="emoji-events"
          tone="teal"
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
          tone="sky"
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
          tone={growthTone}
          label="النمو هذا الأسبوع"
          primary={data ? `${growthSign}${growthAbs}%` : '—'}
          secondary={
            data
              ? growth === 0
                ? 'بدون تغيير'
                : 'مقارنة بالأسبوع الماضي'
              : 'لا توجد بيانات'
          }
          highlight={growthHighlight}
        />
      </ScrollView>
    </View>
  );
}

function InsightCard({
  icon,
  tone,
  label,
  primary,
  secondary,
  highlight,
}: {
  icon: MaterialIconName;
  tone: IconBadgeTone;
  label: string;
  primary: string;
  secondary: string;
  /** If set, paints the `primary` value in this colour (used by growth). */
  highlight?: string;
}) {
  return (
    <Card variant="raised" padding="sm" style={{ width: 180 }}>
      <View
        style={{
          flexDirection: 'row-reverse',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <Text
          style={{
            ...theme.font.labelLg,
            fontSize: 11,
            color: theme.color.text.disabled,
            flex: 1,
            textAlign: 'right',
            paddingRight: 6,
          }}
        >
          {label}
        </Text>
        <IconBadge icon={icon} tone={tone} size="sm" />
      </View>
      <Text
        style={{
          marginTop: 10,
          // Bigger primary so the insight tile reads at the same rhythm
          // as the 2x2 stat tiles below (which use 22pt). 18pt keeps two
          // tiles per row comfortable on a narrow phone.
          fontSize: 18,
          fontWeight: '900',
          color: highlight ?? theme.color.text.primary,
          textAlign: 'right',
        }}
        numberOfLines={1}
      >
        {primary}
      </Text>
      <Text
        style={{
          ...theme.font.labelLg,
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
          color: theme.color.text.secondary,
          textAlign: 'right',
        }}
        numberOfLines={1}
      >
        {secondary}
      </Text>
    </Card>
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
      <View>
        <SectionHeader title="آخر النشاط" />
        <SkeletonCard height={64} />
        <SkeletonCard height={64} />
      </View>
    );
  }

  return (
    <View>
      <SectionHeader title="آخر النشاط" />
      {data.length === 0 ? (
        <Card variant="flat" padding="md" style={{ alignItems: 'center', gap: 6 }}>
          <MaterialIcons name="history" size={22} color={theme.color.text.disabled} />
          <Text style={{ ...theme.font.bodyMd, color: theme.color.text.secondary }}>
            لا يوجد نشاط حديث
          </Text>
        </Card>
      ) : (
        <Card variant="flat" padding="none" style={{ overflow: 'hidden' }}>
          {data.map((ev, i) => (
            <ActivityRow
              key={ev.id}
              event={ev}
              showDivider={i < data.length - 1}
              onPress={() => onTap(ev)}
            />
          ))}
        </Card>
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
        paddingHorizontal: theme.space.md,
        borderBottomWidth: showDivider ? 1 : 0,
        borderBottomColor: theme.color.raw.slate[100],
        opacity: pressed && tappable ? 0.75 : 1,
      })}
    >
      <IconBadge icon={meta.icon} tone={meta.tone} size="sm" />
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text
          style={{
            color: theme.color.text.primary,
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
            color: theme.color.text.secondary,
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
          color: theme.color.text.disabled,
          fontSize: 9,
          fontWeight: '600',
          marginLeft: 4,
        }}
      >
        {relativeTimeAr(event.createdAt)}
      </Text>
      {tappable && (
        <MaterialIcons name="chevron-left" size={18} color={theme.color.text.disabled} />
      )}
    </Pressable>
  );
}

const ACTIVITY_KIND_META: Record<
  ActivityEvent['kind'],
  { icon: MaterialIconName; tone: IconBadgeTone }
> = {
  order: { icon: 'receipt-long', tone: 'teal' },
  lead: { icon: 'person-add', tone: 'amber' },
  stock: { icon: 'water-drop', tone: 'sky' },
  driver: { icon: 'local-shipping', tone: 'violet' },
};
