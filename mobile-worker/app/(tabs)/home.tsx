import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useMyTodayTasks, useAvailableOrders, useClaimOrder, type DriverTask } from '@/lib/queries';
import { pendingCount } from '@/lib/offline-queue';
import { getCurrentCoords, distanceMetres } from '@/lib/location';
import { WorkerHeader } from '@/components/WorkerHeader';
import { SkeletonCard } from '@/components/Skeleton';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

// ── Design tokens (match design/order-flow-mockup.html Phone 1) ──────────────
const T = {
  aqua700: '#0e7490',
  aqua600: '#0891b2',
  aqua500: '#06b6d4',
  aqua400: '#22d3ee',
  aqua50: '#ecfeff',
  green600: '#059669',
  green500: '#10b981',
  ink: '#0f172a',
  slate: '#475569',
  muted: '#94a3b8',
  line: '#e2e8f0',
} as const;

const kindIcon: Record<DriverTask['kind'], IconName> = {
  REFILL: 'water-drop',
  TANK_DELIVERY: 'inventory-2',
  TANK_RECLAIM: 'undo',
};
const kindLabel: Record<DriverTask['kind'], string> = {
  REFILL: 'تعبئة',
  TANK_DELIVERY: 'توصيل خزان',
  TANK_RECLAIM: 'سحب خزان',
};
const kindColor: Record<DriverTask['kind'], { bg: string; fg: string }> = {
  REFILL: { bg: '#e0f2fe', fg: '#0284c7' },
  TANK_DELIVERY: { bg: '#dbeafe', fg: '#1d4ed8' },
  TANK_RECLAIM: { bg: '#fef2f2', fg: '#dc2626' },
};

/** Western-digit thousands grouping for IQD amounts. */
function fmtIqd(n: number | null | undefined): string {
  const v = Math.round(n ?? 0);
  return v.toLocaleString('en-US');
}

/** Human distance label, or null when coords are missing. */
function distLabel(
  coords: { lng: number; lat: number } | null,
  lat: number | null,
  lng: number | null,
): string | null {
  if (!coords || lat == null || lng == null) return null;
  const m = distanceMetres(coords, { lat, lng });
  return m >= 1000 ? `${(m / 1000).toFixed(1)} كم` : `${Math.round(m)} م`;
}

export default function Home() {
  const { data: tasks, isLoading, refetch, isRefetching } = useMyTodayTasks();
  const available = useAvailableOrders();
  const [queued, setQueued] = useState(0);
  // Live NetInfo subscription — the WorkerHeader badge used to be hardcoded
  // to true so the driver had no way to know if pings/photos were actually
  // reaching the backend. The OfflineBanner overlays a separate red strip,
  // but the in-header badge gives a glanceable signal on every screen.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    pendingCount().then(setQueued);
    const t = setInterval(() => pendingCount().then(setQueued), 5_000);
    const unsub = NetInfo.addEventListener((s) => {
      setOnline(s.isConnected !== false && s.isInternetReachable !== false);
    });
    NetInfo.fetch()
      .then((s) =>
        setOnline(s.isConnected !== false && s.isInternetReachable !== false),
      )
      .catch(() => {});
    return () => {
      clearInterval(t);
      unsub();
    };
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: '#f6f8fa' }}>
      {/* Header يدير الـ top safe-area داخلياً (مع gradient extending إلى status bar) */}
      <WorkerHeader online={online} queuedCount={queued} />

      {isLoading ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 14 }}>
          <SkeletonCard height={68} />
          <SkeletonCard height={150} />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <DriverHome
          tasks={tasks ?? []}
          available={available.data ?? []}
          refreshing={isRefetching || available.isRefetching}
          onRefresh={() => {
            refetch();
            available.refetch();
          }}
        />
      )}
    </View>
  );
}

function DriverHome({
  tasks,
  available,
  refreshing,
  onRefresh,
}: {
  tasks: DriverTask[];
  available: DriverTask[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const safeTasks = tasks ?? [];
  const safeAvailable = available ?? [];

  const total = safeTasks.length;
  const done = safeTasks.filter((t) => t.status === 'COMPLETED').length;
  const active = safeTasks.find((t) => t.status === 'EN_ROUTE');
  const others = safeTasks.filter((t) => t.status !== 'EN_ROUTE' && t.status !== 'COMPLETED');

  // ── Driver coords (used for the distance chips in both sections) ──────────
  // Fetched once on mount; if GPS is unavailable the distance chips simply
  // hide (never block the list).
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentCoords()
      .then((c) => {
        if (!cancelled && c) setCoords(c);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Route ordering (frontend-only) ──────────────────────────────────────
  // When enabled, sort the upcoming tasks nearest-first using the driver's
  // current GPS + each customer's coords (haversine). Tasks with no coords
  // sink to the bottom so the list never drops anything.
  const [nearestFirst, setNearestFirst] = useState(false);
  const [locating, setLocating] = useState(false);

  async function toggleNearest() {
    if (nearestFirst) {
      setNearestFirst(false);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    if (coords) {
      setNearestFirst(true);
      return;
    }
    setLocating(true);
    try {
      const c = await getCurrentCoords();
      if (!c) {
        Alert.alert('GPS غير متاح', 'فعّل خدمات الموقع للترتيب حسب الأقرب.');
        return;
      }
      setCoords(c);
      setNearestFirst(true);
    } finally {
      setLocating(false);
    }
  }

  const orderedOthers = useMemo(() => {
    if (!nearestFirst || !coords) return others;
    return [...others].sort((a, b) => {
      const da =
        a.customer?.locationLat != null && a.customer?.locationLng != null
          ? distanceMetres(coords, {
              lat: a.customer.locationLat,
              lng: a.customer.locationLng,
            })
          : Number.POSITIVE_INFINITY;
      const db =
        b.customer?.locationLat != null && b.customer?.locationLng != null
          ? distanceMetres(coords, {
              lat: b.customer.locationLat,
              lng: b.customer.locationLng,
            })
          : Number.POSITIVE_INFINITY;
      return da - db;
    });
    // others is derived from tasks; depend on its identity + sort inputs.
  }, [others, nearestFirst, coords]);

  return (
    <ScrollView
      className="flex-1"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.aqua600} />
      }
      contentContainerStyle={{
        paddingBottom: 24,
        paddingTop: 14,
        // الـ padding يجب يكون هنا (مش className) عشان يطبّق على المحتوى
        // المتمرّر. className="px-4" على الـ ScrollView العام يخلّي فراغ
        // غير متناسق في RTL.
        paddingHorizontal: 12,
      }}
    >
      {/* ════════ طلبات متاحة (claim pool) — only rendered when non-empty ════════ */}
      {safeAvailable.length > 0 && (
        <View style={{ marginBottom: 4 }}>
          <View className="flex-row-reverse items-center justify-between mb-2 px-1">
            <View className="flex-row-reverse items-center gap-2">
              <NewPulseBadge />
              <Text style={{ fontSize: 16, fontWeight: '900', color: T.ink }}>طلبات متاحة</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '800', color: T.muted }}>
              {safeAvailable.length} متاح
            </Text>
          </View>
          {safeAvailable.map((order, i) => (
            <AvailableOrderCard key={order.id} order={order} coords={coords} index={i} />
          ))}
        </View>
      )}

      {/* Progress card — يظهر فقط عند وجود مهام (يخفّف الفراغ في الأيام الفارغة) */}
      {total > 0 && (
        <View style={cardStyle}>
          <View className="flex-row-reverse items-center justify-between mb-2">
            <Text style={{ fontSize: 14, fontWeight: '800', color: T.ink }}>جولة اليوم</Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: T.slate }}>
              {done} / {total} مهمة
            </Text>
          </View>
          <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#f1f5f9' }}>
            <View
              style={{
                height: '100%',
                backgroundColor: T.aqua600,
                width: `${total ? (done / total) * 100 : 0}%`,
              }}
            />
          </View>
        </View>
      )}

      {/* Quick actions — cash / shift / van inventory shortcuts */}
      <View className="flex-row-reverse gap-2 mb-3">
        <QuickCard href="/cash" grad={['#0e7490', '#06b6d4']} icon="payments" label="تسوية النقد" />
        <QuickCard
          href="/shift-summary"
          grad={['#1d4ed8', '#3b82f6']}
          icon="emoji-events"
          label="ملخّص الوردية"
        />
        <QuickCard
          href="/van-inventory"
          grad={['#0284c7', '#0ea5e9']}
          icon="local-shipping"
          label="جرد الشاحنة"
        />
      </View>

      {/* ════════ مهامي — active + upcoming ════════ */}
      {/* Active task — featured prominent card with aqua gradient */}
      {active && (
        <Link href={`/task/${active.id}`} asChild>
          <Pressable
            style={{
              borderRadius: 22,
              overflow: 'hidden',
              marginBottom: 12,
              shadowColor: T.aqua700,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.28,
              shadowRadius: 14,
              elevation: 6,
            }}
          >
            <LinearGradient
              colors={[T.aqua700, T.aqua500]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 16 }}
            >
              <View className="flex-row-reverse items-center justify-between mb-2">
                <View className="flex-row-reverse items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}>
                  <MaterialIcons name="schedule" size={12} color="#fff" />
                  <Text className="text-white text-[11px] font-bold">قيد التنفيذ</Text>
                </View>
                <Text className="text-[11px]" style={{ color: '#cffafe' }}>
                  {active.scheduledFor ?? 'الآن'}
                </Text>
              </View>
              <View className="flex-row-reverse items-center gap-2 mt-1">
                <MaterialIcons name={kindIcon[active.kind]} size={28} color="#fff" />
                <Text className="text-white text-xl font-bold">{kindLabel[active.kind]}</Text>
              </View>
              <Text className="text-white font-bold text-lg mt-1 text-right">
                {active.customer?.fullName ?? 'زبون'}
              </Text>
              <Text className="text-xs text-right" style={{ color: '#cffafe' }}>
                {active.customer?.district ?? '—'} · {active.customer?.addressLine ?? ''}
              </Text>
              <View className="bg-white rounded-xl py-3 mt-3 flex-row-reverse items-center justify-center gap-2">
                <Text style={{ color: T.aqua700, fontWeight: '800' }}>متابعة المهمة</Text>
                <MaterialIcons name="chevron-left" size={20} color={T.aqua700} />
              </View>
            </LinearGradient>
          </Pressable>
        </Link>
      )}

      {/* Section title + nearest-first toggle */}
      {(others.length > 0 || active) && (
        <View className="flex-row-reverse items-center justify-between mb-2 px-1">
          <View className="flex-row-reverse items-center gap-1.5">
            <MaterialIcons name="list" size={18} color={T.aqua600} />
            <Text style={{ fontSize: 16, fontWeight: '900', color: T.ink }}>مهامي</Text>
          </View>
          {others.length > 1 && (
            <Pressable
              onPress={toggleNearest}
              disabled={locating}
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 5,
                backgroundColor: nearestFirst ? T.aqua600 : T.aqua50,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <MaterialIcons
                name={locating ? 'hourglass-empty' : 'near-me'}
                size={14}
                color={nearestFirst ? '#fff' : T.aqua700}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: nearestFirst ? '#fff' : T.aqua700,
                }}
              >
                {locating ? 'جارٍ التحديد…' : 'الأقرب أولاً'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      {others.length === 0 && !active && (
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 22,
            paddingVertical: 28,
            paddingHorizontal: 16,
            alignItems: 'center',
            marginBottom: 12,
            shadowColor: T.ink,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              backgroundColor: '#ecfdf5',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <MaterialIcons name="check-circle" size={36} color={T.green500} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>جولة اليوم خلصت</Text>
          <Text style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>ما عندك مهام أخرى الآن</Text>
        </View>
      )}
      {orderedOthers.map((t) => {
        const c = kindColor[t.kind];
        const dist = nearestFirst
          ? distLabel(coords, t.customer?.locationLat ?? null, t.customer?.locationLng ?? null)
          : null;
        return (
          <Link key={t.id} href={`/task/${t.id}`} asChild>
            <Pressable style={cardStyle}>
              <View className="flex-row-reverse items-center gap-3">
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: c.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons name={kindIcon[t.kind]} size={24} color={c.fg} />
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '800', fontSize: 14, color: T.ink }}>
                    {t.customer?.fullName ?? 'زبون'}
                  </Text>
                  <Text style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                    {(t.customer?.district ?? '—') + ' · ' + kindLabel[t.kind]}
                  </Text>
                </View>
                {dist && (
                  <View
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 3,
                      backgroundColor: T.aqua50,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 999,
                    }}
                  >
                    <MaterialIcons name="near-me" size={12} color={T.aqua600} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: T.aqua700 }}>{dist}</Text>
                  </View>
                )}
                <MaterialIcons name="chevron-left" size={22} color="#cbd5e1" />
              </View>
            </Pressable>
          </Link>
        );
      })}

      {/* Walk-in / register customer — bordered card matching others' styling */}
      <Link href="/walkin" asChild>
        <Pressable
          style={{
            marginTop: 4,
            backgroundColor: '#fff',
            borderWidth: 1.5,
            borderColor: '#bae6fd',
            borderRadius: 18,
            paddingVertical: 14,
            paddingHorizontal: 14,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 10,
            shadowColor: T.ink,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: '#e0f2fe',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialIcons name="add" size={24} color="#0284c7" />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={{ color: T.aqua700, fontWeight: '800', fontSize: 14 }}>
              بيع فوري أو زبون جديد
            </Text>
            <Text style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
              للزبون الذي لم يطلب من التطبيق
            </Text>
          </View>
          <MaterialIcons name="chevron-left" size={22} color="#0284c7" />
        </Pressable>
      </Link>
    </ScrollView>
  );
}

/**
 * A claimable order from the pool. Shows customer, district + QR, distance +
 * tank chips, the dashed cash line, and a prominent GREEN "قبول الطلب" button.
 * Claiming is first-come: a 409 means another driver beat us — the pool
 * auto-refreshes via the mutation's onError invalidation.
 */
function AvailableOrderCard({
  order,
  coords,
  index,
}: {
  order: DriverTask;
  coords: { lng: number; lat: number } | null;
  index: number;
}) {
  const router = useRouter();
  const claim = useClaimOrder();
  const c = order.customer;
  const firstLetter = c?.fullName?.trim()?.[0] ?? '؟';
  const dist = distLabel(coords, c?.locationLat ?? null, c?.locationLng ?? null);
  const qr = order.tank?.qrCode;
  const capacity = order.tank?.capacity;

  function onAccept() {
    if (claim.isPending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    claim.mutate(order.id, {
      onSuccess: (res) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        const goId = res?.id ?? order.id;
        Alert.alert('تم قبول الطلب', 'تم تعيين الطلب لك — ابدأ المهمة.', [
          { text: 'فتح المهمة', onPress: () => router.push(`/task/${goId}`) },
        ]);
      },
      onError: (err: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        const msg = err?.response?.data?.message ?? 'تعذّر قبول الطلب';
        Alert.alert('تعذّر قبول الطلب', typeof msg === 'string' ? msg : 'تعذّر قبول الطلب');
      },
    });
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(320).delay(Math.min(index, 6) * 60)}
      style={{
        backgroundColor: '#fff',
        borderRadius: 22,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: '#a5e8f5',
        shadowColor: T.aqua600,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
        elevation: 4,
      }}
    >
      {/* "جديد" badge — top-left in RTL */}
      <View
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 5,
          borderRadius: 999,
          overflow: 'hidden',
          zIndex: 2,
        }}
      >
        <LinearGradient
          colors={[T.aqua400, T.aqua600]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5 }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
          <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '800' }}>جديد</Text>
        </LinearGradient>
      </View>

      {/* Customer row: avatar + name + district/QR */}
      <View className="flex-row-reverse items-center gap-3">
        <LinearGradient
          colors={[T.aqua400, T.aqua700]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 46,
            height: 46,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>{firstLetter}</Text>
        </LinearGradient>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: T.ink }}>
            {c?.fullName ?? 'زبون'}
          </Text>
          <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }} numberOfLines={1}>
            {(c?.district ?? '—') + (qr ? ` · QR ${qr}` : '')}
          </Text>
        </View>
      </View>

      {/* Chips: distance + tank capacity */}
      <View className="flex-row-reverse flex-wrap" style={{ gap: 7, marginVertical: 13 }}>
        {dist && (
          <Chip aqua icon="near-me" label={dist} />
        )}
        {capacity && (
          <Chip aqua icon="water-drop" label={`خزان ${capacity}`} />
        )}
        <Chip icon={kindIcon[order.kind]} label={kindLabel[order.kind]} />
      </View>

      {/* Dashed cash line */}
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f0fdf4',
          borderWidth: 1,
          borderColor: '#bbf7d0',
          borderStyle: 'dashed',
          borderRadius: 14,
          paddingHorizontal: 13,
          paddingVertical: 10,
          marginBottom: 13,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#166534' }}>
          تحصيل نقدي عند التسليم
        </Text>
        <Text style={{ fontSize: 17, fontWeight: '900', color: '#15803d' }}>
          {fmtIqd(order.priceIqd)} د.ع
        </Text>
      </View>

      {/* Green accept button */}
      <Pressable onPress={onAccept} disabled={claim.isPending} style={{ borderRadius: 16, overflow: 'hidden' }}>
        <LinearGradient
          colors={[T.green500, T.green600]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            opacity: claim.isPending ? 0.7 : 1,
          }}
        >
          {claim.isPending ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>جارٍ القبول…</Text>
            </>
          ) : (
            <>
              <MaterialIcons name="check" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>قبول الطلب</Text>
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/** Small chip matching the mockup's `.chip` / `.chip.aqua`. */
function Chip({ icon, label, aqua }: { icon: IconName; label: string; aqua?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 5,
        backgroundColor: aqua ? T.aqua50 : '#f1f5f9',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
      }}
    >
      <MaterialIcons name={icon} size={13} color={aqua ? T.aqua700 : T.slate} />
      <Text style={{ fontSize: 11.5, fontWeight: '700', color: aqua ? T.aqua700 : T.slate }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Pulsing green dot for the "طلبات متاحة" header. The looping animation is
 * started inside useEffect (never touching `.value` during render) per the
 * reanimated-4 safety rule.
 */
function NewPulseBadge() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.out(Easing.ease) }), -1, false);
  }, [p]);
  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + p.value * 1.6 }],
    opacity: 0.45 * (1 - p.value),
  }));
  return (
    <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: '#22c55e',
          },
          ring,
        ]}
      />
      <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#22c55e' }} />
    </View>
  );
}

const cardStyle = {
  backgroundColor: '#fff',
  borderRadius: 22,
  padding: 14,
  marginBottom: 12,
  shadowColor: T.ink,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 1,
} as const;

/**
 * Small gradient shortcut tile used in the home quick-actions row. Routes to
 * the cash / shift / van-inventory driver screens.
 */
function QuickCard({
  href,
  grad,
  icon,
  label,
}: {
  href: string;
  grad: [string, string];
  icon: IconName;
  label: string;
}) {
  return (
    <Link href={href as any} asChild>
      <Pressable style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}>
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 8,
            alignItems: 'center',
            shadowColor: grad[1],
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              backgroundColor: 'rgba(255,255,255,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 6,
            }}
          >
            <MaterialIcons name={icon} size={20} color="#fff" />
          </View>
          <Text
            style={{ color: '#fff', fontSize: 11, fontWeight: '800', textAlign: 'center' }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </LinearGradient>
      </Pressable>
    </Link>
  );
}
