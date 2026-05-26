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

import { usePlantKpis, usePendingLeads } from '@/lib/queries';
import { useAuth } from '@/lib/auth-store';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

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

  const refreshing = kpisQuery.isFetching || leadsQuery.isFetching;

  const onRefresh = useCallback(() => {
    kpisQuery.refetch();
    leadsQuery.refetch();
  }, [kpisQuery, leadsQuery]);

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
                onPress={() => router.push('/(tabs)/orders')}
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
              <AdminTool
                icon="point-of-sale"
                label="بيع نقدي"
                onPress={() => router.push('/walkin' as any)}
              />
              <AdminTool
                icon="campaign"
                label="إنشاء عرض"
                onPress={() => router.push('/promos' as any)}
              />
              <AdminTool
                icon="people"
                label="الزبائن"
                onPress={() => router.push('/(tabs)/customers')}
              />
              <AdminTool
                icon="local-shipping"
                label="السائقون"
                onPress={() => router.push('/(tabs)/orders')}
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
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        opacity: pressed ? 0.85 : 1,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: tint + '1A',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-end',
        }}
      >
        <MaterialIcons name={icon} size={20} color={tint} />
      </View>
      <Text
        style={{
          marginTop: 10,
          fontSize: 22,
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
        }}
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
