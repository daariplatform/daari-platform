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
  // /auth/me payload yet, so we fall back to the literal label per spec.
  const plantName = user?.tenantId ? 'معملك' : 'معملك';

  const kpis = kpisQuery.data;

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

        {kpis && (
          <>
            {/* ── Alert banners (conditional) ───────────────────────── */}
            {kpis.overLimit && (
              <AlertBanner
                tone="red"
                icon="error"
                title="تجاوزت حدّ خطّتك الشهرية"
                subtitle={`${(kpis.opsThisMonth ?? 0).toLocaleString('ar-IQ')} من ${(kpis.planLimit ?? 0).toLocaleString('ar-IQ')} عملية`}
                onPress={() => router.push('/(tabs)/settings')}
              />
            )}
            {!kpis.overLimit && kpis.nearLimit && (
              <AlertBanner
                tone="amber"
                icon="warning"
                title="اقتربت من حدّ الخطة"
                subtitle={`${(kpis.opsThisMonth ?? 0).toLocaleString('ar-IQ')} من ${(kpis.planLimit ?? 0).toLocaleString('ar-IQ')} عملية`}
                onPress={() => router.push('/(tabs)/settings')}
              />
            )}
            {kpis.stockLow && (
              <AlertBanner
                tone="orange"
                icon="water-drop"
                title="المخزون منخفض"
                subtitle={`${(kpis.stockLevelLiters ?? 0).toLocaleString('ar-IQ')} لتر متبقّي`}
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
                    {(kpis.todayRevenueIqd ?? 0).toLocaleString('ar-IQ')}{' '}
                    <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '700' }}>
                      د.ع
                    </Text>
                  </Text>
                  <Text style={{ fontSize: 12, color: '#0284c7', marginTop: 4 }}>
                    {(kpis.todayCompletedOrders ?? 0).toLocaleString('ar-IQ')} طلب مكتمل
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
                value={(kpis.todayPendingOrders ?? 0).toLocaleString('ar-IQ')}
                tint="#f59e0b"
                onPress={() => router.push('/(tabs)/orders')}
              />
              <StatTile
                icon="local-shipping"
                label="السائقون النشطون"
                value={(kpis.activeDrivers ?? 0).toLocaleString('ar-IQ')}
                tint="#0284c7"
                onPress={() => router.push('/(tabs)/orders')}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <StatTile
                icon="person-add"
                label="زبائن بانتظار الموافقة"
                value={(kpis.pendingLeadsCount ?? 0).toLocaleString('ar-IQ')}
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
                      {(kpis.pendingLeadsCount ?? 0).toLocaleString('ar-IQ')} زبون بانتظار
                      موافقتك
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
                label="إضافة طلب walk-in"
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
  if (!capacity || capacity <= 0) return '٠';
  const pct = Math.max(0, Math.min(100, Math.round((current / capacity) * 100)));
  return pct.toLocaleString('ar-IQ');
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
