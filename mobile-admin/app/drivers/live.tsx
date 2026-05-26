import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Linking,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { arSA } from 'date-fns/locale';

import { useDriversLive, type LiveDriver } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

// react-native-maps is listed in the brief as "already installed", but it
// isn't actually present in package.json yet. Until that lands we render a
// rich list-based fallback that still surfaces driver state (online /
// on-route / stale) + last-seen + active order. Once the package ships,
// swap the FallbackList in the render below for a <MapView> block — the
// hook payload + bucketing logic are unchanged.
const MAP_LIB_AVAILABLE = false;

const STALE_OFFLINE_MS = 30 * 60 * 1000; // 30 minutes — beyond this we treat the driver as offline.

type LiveCategory = 'AVAILABLE' | 'ON_ROUTE' | 'OFFLINE';

const CATEGORY_META: Record<
  LiveCategory,
  { label: string; tint: string; bg: string; icon: React.ComponentProps<typeof MaterialIcons>['name'] }
> = {
  AVAILABLE: { label: 'متاح', tint: '#10b981', bg: '#d1fae5', icon: 'check-circle' },
  ON_ROUTE: { label: 'في طريق', tint: '#3b82f6', bg: '#dbeafe', icon: 'local-shipping' },
  OFFLINE: { label: 'غير متصل', tint: '#64748b', bg: '#f1f5f9', icon: 'cloud-off' },
};

function categorize(driver: LiveDriver): LiveCategory {
  const last = new Date(driver.lastSeen).getTime();
  if (Number.isFinite(last) && Date.now() - last > STALE_OFFLINE_MS) return 'OFFLINE';
  if (driver.activeOrderId) return 'ON_ROUTE';
  return 'AVAILABLE';
}

function n(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('en-US');
}

/**
 * Live driver map view. The 30s refetch is handled by the useDriversLive
 * hook itself (refetchInterval). A "تحديث" button at the top forces a
 * manual refetch in case the owner wants the latest state right now.
 */
export default function DriversLiveScreen() {
  const router = useRouter();
  const query = useDriversLive();
  const [selected, setSelected] = useState<LiveDriver | null>(null);

  const drivers = query.data ?? [];
  const buckets = useMemo(() => {
    const out: Record<LiveCategory, LiveDriver[]> = {
      AVAILABLE: [],
      ON_ROUTE: [],
      OFFLINE: [],
    };
    for (const d of drivers) out[categorize(d)].push(d);
    return out;
  }, [drivers]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: '#e2e8f0',
          }}
        >
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a' }}>
              السائقون الآن
            </Text>
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              يُحدّث تلقائياً كل 30 ثانية
            </Text>
          </View>
          <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
            <Pressable
              onPress={() => query.refetch()}
              disabled={query.isFetching}
              hitSlop={6}
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: '#ccfbf1',
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 4,
                opacity: pressed || query.isFetching ? 0.7 : 1,
              })}
            >
              <MaterialIcons name="refresh" size={18} color="#0e9384" />
              <Text style={{ color: '#0e9384', fontWeight: '800', fontSize: 11 }}>
                تحديث
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={({ pressed }) => ({
                padding: 8,
                borderRadius: 12,
                backgroundColor: '#f1f5f9',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <MaterialIcons name="arrow-forward" size={22} color="#0f172a" />
            </Pressable>
          </View>
        </View>

        {/* Status legend / counts */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            gap: 8,
            flexDirection: 'row-reverse',
          }}
        >
          <CategoryChip cat="AVAILABLE" count={buckets.AVAILABLE.length} />
          <CategoryChip cat="ON_ROUTE" count={buckets.ON_ROUTE.length} />
          <CategoryChip cat="OFFLINE" count={buckets.OFFLINE.length} />
        </ScrollView>
      </SafeAreaView>

      {/* When react-native-maps is wired in, swap this for the MapView block. */}
      {MAP_LIB_AVAILABLE ? null : (
        <FallbackList
          query={query}
          buckets={buckets}
          onSelect={setSelected}
        />
      )}

      <DriverSheet driver={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Fallback (no react-native-maps yet) — grouped list of drivers
// ────────────────────────────────────────────────────────────────────

function FallbackList({
  query,
  buckets,
  onSelect,
}: {
  query: ReturnType<typeof useDriversLive>;
  buckets: Record<LiveCategory, LiveDriver[]>;
  onSelect: (d: LiveDriver) => void;
}) {
  const total = buckets.AVAILABLE.length + buckets.ON_ROUTE.length + buckets.OFFLINE.length;

  if (query.isLoading && !query.data) {
    return (
      <View style={{ padding: 14 }}>
        <Skeleton height={92} borderRadius={18} style={{ marginBottom: 10 }} />
        <Skeleton height={92} borderRadius={18} style={{ marginBottom: 10 }} />
        <Skeleton height={92} borderRadius={18} style={{ marginBottom: 10 }} />
      </View>
    );
  }

  if (query.isError && !query.data) {
    return (
      <EmptyState
        icon="cloud-off"
        title="تعذّر تحميل المواقع"
        actionLabel="إعادة المحاولة"
        onAction={() => query.refetch()}
      />
    );
  }

  if (total === 0) {
    return (
      <EmptyState
        icon="my-location"
        title="لا يوجد سائقون نشطون"
        subtitle="عند تشغيل سائق GPS سيظهر هنا فوراً"
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching && !query.isLoading}
          onRefresh={() => query.refetch()}
        />
      }
    >
      <NotePill text="عرض الخريطة سيتفعّل بعد إضافة مكتبة الخرائط (react-native-maps)" />

      <SectionHeader cat="ON_ROUTE" count={buckets.ON_ROUTE.length} />
      {buckets.ON_ROUTE.map((d) => (
        <DriverCard key={d.id} driver={d} cat="ON_ROUTE" onPress={() => onSelect(d)} />
      ))}

      <SectionHeader cat="AVAILABLE" count={buckets.AVAILABLE.length} />
      {buckets.AVAILABLE.map((d) => (
        <DriverCard key={d.id} driver={d} cat="AVAILABLE" onPress={() => onSelect(d)} />
      ))}

      <SectionHeader cat="OFFLINE" count={buckets.OFFLINE.length} />
      {buckets.OFFLINE.map((d) => (
        <DriverCard key={d.id} driver={d} cat="OFFLINE" onPress={() => onSelect(d)} />
      ))}
    </ScrollView>
  );
}

function NotePill({ text }: { text: string }) {
  return (
    <View
      style={{
        backgroundColor: '#fffbeb',
        borderColor: '#fde68a',
        borderWidth: 1,
        borderRadius: 14,
        padding: 10,
        marginBottom: 14,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <MaterialIcons name="info-outline" size={16} color="#92400e" />
      <Text style={{ color: '#92400e', fontSize: 11, fontWeight: '700', flex: 1, textAlign: 'right' }}>
        {text}
      </Text>
    </View>
  );
}

function SectionHeader({ cat, count }: { cat: LiveCategory; count: number }) {
  const meta = CATEGORY_META[cat];
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        marginBottom: 8,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: meta.tint,
        }}
      />
      <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a' }}>
        {meta.label} · {n(count)}
      </Text>
    </View>
  );
}

function CategoryChip({ cat, count }: { cat: LiveCategory; count: number }) {
  const meta = CATEGORY_META[cat];
  return (
    <View
      style={{
        backgroundColor: meta.bg,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: meta.tint,
        }}
      />
      <Text style={{ color: meta.tint, fontWeight: '900', fontSize: 12 }}>
        {meta.label}
      </Text>
      <Text style={{ color: meta.tint, fontWeight: '900', fontSize: 12 }}>{n(count)}</Text>
    </View>
  );
}

function DriverCard({
  driver,
  cat,
  onPress,
}: {
  driver: LiveDriver;
  cat: LiveCategory;
  onPress: () => void;
}) {
  const meta = CATEGORY_META[cat];
  const initial = (driver.fullName ?? '?').trim().charAt(0) || '؟';
  const last = formatDistanceToNow(new Date(driver.lastSeen), {
    addSuffix: true,
    locale: arSA,
  });
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: meta.tint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{initial}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: '#0f172a' }}>
            {driver.fullName}
          </Text>
          <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{last}</Text>
          {driver.activeOrderId && (
            <View
              style={{
                marginTop: 4,
                backgroundColor: '#dbeafe',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: '#1e40af', fontWeight: '800', fontSize: 10 }}>
                طلب نشط
              </Text>
            </View>
          )}
        </View>
        <MaterialIcons name="chevron-left" size={20} color="#cbd5e1" />
      </View>
    </Pressable>
  );
}

// ────────────────────────────────────────────────────────────────────
// Bottom sheet — pin tap detail
// ────────────────────────────────────────────────────────────────────

function DriverSheet({
  driver,
  onClose,
}: {
  driver: LiveDriver | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const visible = !!driver;
  const cat = driver ? categorize(driver) : 'AVAILABLE';
  const meta = CATEGORY_META[cat];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(15,23,42,0.55)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 16,
          }}
        >
          <SafeAreaView edges={['bottom']}>
            {driver && (
              <>
                <View
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <LinearGradient
                    colors={['#14b8a6', '#0e9384']}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 22 }}>
                      {(driver.fullName ?? '?').trim().charAt(0) || '؟'}
                    </Text>
                  </LinearGradient>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#0f172a' }}>
                      {driver.fullName}
                    </Text>
                    <View
                      style={{
                        backgroundColor: meta.bg,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                        marginTop: 4,
                      }}
                    >
                      <Text style={{ color: meta.tint, fontWeight: '800', fontSize: 10 }}>
                        {meta.label}
                      </Text>
                    </View>
                  </View>
                </View>

                <InfoLine
                  label="آخر تحديث"
                  value={formatDistanceToNow(new Date(driver.lastSeen), {
                    addSuffix: true,
                    locale: arSA,
                  })}
                />
                <InfoLine
                  label="الإحداثيات"
                  value={`${driver.lat.toFixed(5)}, ${driver.lng.toFixed(5)}`}
                />
                {driver.activeOrderId && (
                  <InfoLine label="الطلب النشط" value={driver.activeOrderId.slice(0, 8)} />
                )}

                <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 14 }}>
                  <Pressable
                    onPress={() =>
                      Linking.openURL(
                        `https://maps.google.com/?q=${driver.lat},${driver.lng}`,
                      )
                    }
                    style={({ pressed }) => ({
                      flex: 1,
                      backgroundColor: '#ccfbf1',
                      paddingVertical: 12,
                      borderRadius: 14,
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <MaterialIcons name="map" size={18} color="#0e9384" />
                    <Text style={{ color: '#0e9384', fontWeight: '800', fontSize: 12 }}>
                      فتح في الخرائط
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push(`/drivers/${driver.id}` as any);
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      backgroundColor: '#0e9384',
                      paddingVertical: 12,
                      borderRadius: 14,
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <MaterialIcons name="person" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
                      ملف السائق
                    </Text>
                  </Pressable>
                </View>

                {driver.activeOrderId && (
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push(`/order/${driver.activeOrderId}` as any);
                    }}
                    style={({ pressed }) => ({
                      marginTop: 8,
                      paddingVertical: 12,
                      borderRadius: 14,
                      backgroundColor: '#f1f5f9',
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <MaterialIcons name="receipt-long" size={18} color="#475569" />
                    <Text style={{ color: '#475569', fontWeight: '800', fontSize: 12 }}>
                      عرض الطلب النشط
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
      }}
    >
      <Text style={{ fontSize: 12, color: '#64748b' }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '800', color: '#0f172a' }}>{value}</Text>
    </View>
  );
}
