import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDistanceToNow, format } from 'date-fns';
import { arSA } from 'date-fns/locale';

import { usePromos, usePausePromo, type PromoCampaign } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const STATUS_META: Record<
  PromoCampaign['status'],
  { label: string; bg: string; fg: string; icon: MaterialIconName }
> = {
  ACTIVE: { label: 'نشط', bg: '#d1fae5', fg: '#065f46', icon: 'campaign' },
  PAUSED_BY_OWNER: { label: 'متوقف', bg: '#e2e8f0', fg: '#334155', icon: 'pause-circle' },
  EXPIRED: { label: 'منتهي', bg: '#e2e8f0', fg: '#334155', icon: 'history' },
  OUT_OF_BUDGET: { label: 'نفد الرصيد', bg: '#fed7aa', fg: '#9a3412', icon: 'money-off' },
};

function n(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('en-US');
}

/**
 * Promo detail — full stats for one campaign. We don't have a dedicated
 * /plant/promos/:id endpoint (the contract uses the list response), so we
 * hydrate from the cached `usePromos()` query. If the user deep-links to a
 * promo we don't have, we refetch and show "not found" if still missing.
 */
export default function PromoDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const promosQuery = usePromos();
  const pause = usePausePromo();

  // Tick once a minute for the countdown.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const campaign = useMemo(
    () => promosQuery.data?.campaigns.find((c) => c.id === id),
    [promosQuery.data, id],
  );

  async function onPause() {
    if (!campaign) return;
    Alert.alert('إيقاف العرض', 'هل تريد إيقاف العرض الآن؟', [
      { text: 'تراجع', style: 'cancel' },
      {
        text: 'إيقاف',
        style: 'destructive',
        onPress: async () => {
          try {
            await pause.mutateAsync(campaign.id);
          } catch (err: any) {
            Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر الإيقاف');
          }
        },
      },
    ]);
  }

  if (promosQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <SafeAreaView edges={['top']}>
          <View style={{ padding: 16 }}>
            <Skeleton height={32} width={160} />
            <Skeleton height={180} style={{ marginTop: 14 }} borderRadius={22} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!campaign) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
          <Header onBack={() => router.back()} title="العرض" />
        </SafeAreaView>
        <EmptyState
          icon="search-off"
          title="لم يتم العثور على العرض"
          subtitle="ربما تم حذفه أو لا تملك صلاحية لعرضه."
          actionLabel="عودة"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const meta = STATUS_META[campaign.status];
  const isActive = campaign.status === 'ACTIVE';
  const discountPct = Math.round(
    ((campaign.originalPriceIqd - campaign.promoPriceIqd) / campaign.originalPriceIqd) * 100,
  );

  const remaining = (() => {
    const ms = new Date(campaign.endAt).getTime() - Date.now();
    if (ms <= 0) return null;
    return formatDistanceToNow(new Date(campaign.endAt), {
      addSuffix: false,
      locale: arSA,
    });
  })();

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <LinearGradient
        colors={isActive ? ['#10b981', '#059669'] : ['#475569', '#334155']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          paddingBottom: 22,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <SafeAreaView edges={['top']}>
          <Header onBack={() => router.back()} title="تفاصيل العرض" light />
          <View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
            {/* Status pill */}
            <View
              style={{
                alignSelf: 'flex-end',
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(255,255,255,0.18)',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                marginBottom: 8,
              }}
            >
              <MaterialIcons name={meta.icon} size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>
                {meta.label}
              </Text>
            </View>

            {/* Prices */}
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 36, fontWeight: '900' }}>
                {n(campaign.promoPriceIqd)}{' '}
                <Text style={{ fontSize: 14, opacity: 0.85, fontWeight: '700' }}>د.ع</Text>
              </Text>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: 14,
                  textDecorationLine: 'line-through',
                }}
              >
                {n(campaign.originalPriceIqd)} د.ع
              </Text>
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>
                  -{discountPct}%
                </Text>
              </View>
            </View>

            {/* Time info */}
            {isActive && remaining ? (
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 10,
                }}
              >
                <MaterialIcons name="schedule" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12, opacity: 0.9 }}>ينتهي خلال </Text>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>
                  {remaining}
                </Text>
              </View>
            ) : (
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 8 }}>
                {format(new Date(campaign.startAt), 'd MMM HH:mm', { locale: arSA })}{' '}
                ←{' '}
                {format(new Date(campaign.endAt), 'd MMM HH:mm', { locale: arSA })}
              </Text>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={promosQuery.isFetching && !promosQuery.isLoading}
            onRefresh={() => promosQuery.refetch()}
          />
        }
      >
        {/* Pause button (active only) */}
        {isActive && (
          <Pressable
            onPress={onPause}
            disabled={pause.isPending}
            style={({ pressed }) => ({
              backgroundColor: '#fff',
              borderWidth: 1.5,
              borderColor: '#fecaca',
              borderRadius: 16,
              paddingVertical: 14,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: pause.isPending || pressed ? 0.85 : 1,
              marginBottom: 14,
            })}
          >
            {pause.isPending ? (
              <ActivityIndicator color="#b91c1c" />
            ) : (
              <>
                <MaterialIcons name="pause" size={20} color="#b91c1c" />
                <Text style={{ color: '#b91c1c', fontWeight: '900', fontSize: 14 }}>
                  إيقاف العرض الآن
                </Text>
              </>
            )}
          </Pressable>
        )}

        {/* Stats grid */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile
              icon="send"
              label="إشعارات أُرسلت"
              value={n(campaign.pushSentCount)}
              tint="#0891b2"
            />
            <StatTile
              icon="error-outline"
              label="إشعارات فشلت"
              value={n(campaign.pushFailedCount)}
              tint={campaign.pushFailedCount > 0 ? '#ef4444' : '#94a3b8'}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile
              icon="local-mall"
              label="طلبات بسعر العرض"
              value={n(campaign.orderCount)}
              tint="#10b981"
            />
            <StatTile
              icon="trending-up"
              label="إيرادات"
              value={n(campaign.totalRevenueIqd)}
              suffix="د.ع"
              tint="#10b981"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile
              icon="account-balance-wallet"
              label="رصيد البداية"
              value={n(campaign.walletBalanceAtStartIqd)}
              suffix="د.ع"
              tint="#475569"
            />
            <StatTile
              icon="money-off"
              label="مخصوم من المحفظة"
              value={n(campaign.totalDeductedIqd)}
              suffix="د.ع"
              tint="#f59e0b"
            />
          </View>
        </View>

        {/* Meta info */}
        <View
          style={{
            marginTop: 16,
            backgroundColor: '#fff',
            borderRadius: 18,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            padding: 14,
            gap: 10,
          }}
        >
          <Row label="بدأ في" value={format(new Date(campaign.startAt), 'd MMM yyyy · HH:mm', { locale: arSA })} />
          <Row label="ينتهي في" value={format(new Date(campaign.endAt), 'd MMM yyyy · HH:mm', { locale: arSA })} />
          <Row label="الكلفة لكل طلب" value={`${n(campaign.costPerOrderIqd)} د.ع`} />
        </View>
      </ScrollView>
    </View>
  );
}

function Header({
  title,
  onBack,
  light,
}: {
  title: string;
  onBack: () => void;
  light?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 12,
      }}
    >
      <Pressable
        onPress={onBack}
        hitSlop={10}
        style={({ pressed }) => ({
          padding: 8,
          borderRadius: 12,
          backgroundColor: light ? 'rgba(255,255,255,0.18)' : '#f1f5f9',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <MaterialIcons name="arrow-forward" size={22} color={light ? '#fff' : '#0f172a'} />
      </Pressable>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '900',
          color: light ? '#fff' : '#0f172a',
        }}
      >
        {title}
      </Text>
      <View style={{ width: 38 }} />
    </View>
  );
}

function StatTile({
  icon,
  label,
  value,
  suffix,
  tint,
}: {
  icon: MaterialIconName;
  label: string;
  value: string;
  suffix?: string;
  tint: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: tint + '1A',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-end',
        }}
      >
        <MaterialIcons name={icon} size={18} color={tint} />
      </View>
      <Text
        style={{
          marginTop: 8,
          fontSize: 18,
          fontWeight: '900',
          color: '#0f172a',
          textAlign: 'right',
        }}
      >
        {value}
        {suffix && (
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b' }}> {suffix}</Text>
        )}
      </Text>
      <Text
        style={{
          fontSize: 11,
          color: '#64748b',
          textAlign: 'right',
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ fontSize: 12, color: '#64748b' }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '800', color: '#0f172a' }}>{value}</Text>
    </View>
  );
}
