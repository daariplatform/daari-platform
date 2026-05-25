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
      {/* Sky gradient hero — extended outside the SafeArea so the status-bar
          area paints in the brand colour. */}
      <LinearGradient
        colors={['#0ea5e9', '#0284c7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          paddingBottom: 22,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <SafeAreaView edges={['top']}>
          <View style={{ paddingHorizontal: 18, paddingTop: 4 }}>
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#bae6fd', fontSize: 12 }}>أهلاً بعودتك</Text>
                <Text
                  style={{
                    color: '#fff',
                    fontWeight: '900',
                    fontSize: 22,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {plantName}
                </Text>
                <Text style={{ color: '#bae6fd', fontSize: 12, marginTop: 4 }}>
                  {todayLabel}
                </Text>
              </View>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.25)',
                }}
              >
                <MaterialIcons name="water-drop" size={28} color="#fff" />
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

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
              borderColor: '#e0f2fe',
            }}
          >
            <LinearGradient
              colors={['#0ea5e9', '#0284c7']}
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
                  colors={['#0ea5e9', '#0284c7']}
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
                  borderColor: '#0284c7',
                  backgroundColor: '#f0f9ff',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <MaterialIcons name="add-shopping-cart" size={18} color="#0284c7" />
                <Text style={{ color: '#0284c7', fontWeight: '700', fontSize: 13 }}>
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

            {/* ── Big revenue tile ─────────────────────────────────── */}
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 22,
                padding: 18,
                marginTop: 4,
                marginBottom: 12,
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
                elevation: 2,
                borderWidth: 1,
                borderColor: '#e0f2fe',
              }}
            >
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>إيرادات اليوم</Text>
                  <Text
                    style={{
                      fontSize: 30,
                      fontWeight: '900',
                      color: '#0f172a',
                      marginTop: 4,
                      lineHeight: 36,
                    }}
                  >
                    {n(kpis.todayRevenueIqd)}{' '}
                    <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '700' }}>
                      د.ع
                    </Text>
                  </Text>
                  <Text style={{ fontSize: 12, color: '#0284c7', marginTop: 4 }}>
                    {n(kpis.todayCompletedOrders)} طلب مكتمل
                  </Text>
                </View>
                <LinearGradient
                  colors={['#0ea5e9', '#0284c7']}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons name="trending-up" size={32} color="#fff" />
                </LinearGradient>
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
                tint="#0284c7"
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

            {/* ── Quick actions ─────────────────────────────────────── */}
            <View
              style={{
                marginTop: 16,
                flexDirection: 'row-reverse',
                gap: 10,
              }}
            >
              <QuickAction
                icon="add-shopping-cart"
                label="تعبئة مباشرة"
                onPress={() => router.push('/walkin' as any)}
                primary
              />
              <QuickAction
                icon="local-shipping"
                label="تتبّع السائقين"
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
          colors={['#0ea5e9', '#0284c7']}
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
        borderColor: '#bae6fd',
        paddingVertical: 14,
        paddingHorizontal: 14,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <MaterialIcons name={icon} size={20} color="#0284c7" />
      <Text style={{ color: '#0369a1', fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
