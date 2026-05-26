import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { arSA } from 'date-fns/locale';

import { usePromos, usePausePromo, type PromoCampaign } from '@/lib/queries';
import { safeBack } from '@/lib/nav';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const MIN_WALLET_FOR_NEW = 1000;
const LOW_WALLET_HINT = 5000;

const STATUS_META: Record<
  PromoCampaign['status'],
  { label: string; bg: string; fg: string }
> = {
  ACTIVE: { label: 'نشط', bg: '#d1fae5', fg: '#065f46' },
  PAUSED_BY_OWNER: { label: 'متوقف', bg: '#e2e8f0', fg: '#334155' },
  EXPIRED: { label: 'منتهي', bg: '#e2e8f0', fg: '#334155' },
  OUT_OF_BUDGET: { label: 'نفد الرصيد', bg: '#fed7aa', fg: '#9a3412' },
};

function n(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('en-US');
}

/**
 * Promos screen — wallet balance hero + active-campaign card + list of past.
 * Reached from home QuickAction or Settings entry; not a tab (we already have
 * 5 and adding a 6th would crowd the bar).
 */
export default function PromosScreen() {
  const router = useRouter();
  const promosQuery = usePromos();
  const pause = usePausePromo();

  // Tick every minute so the active countdown stays fresh without thrashing
  // the API more than the 60s refetchInterval already does.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const data = promosQuery.data;
  const walletBalance = data?.walletBalanceIqd ?? 0;
  const campaigns = data?.campaigns ?? [];
  const active = useMemo(() => campaigns.find((c) => c.status === 'ACTIVE'), [campaigns]);
  const past = useMemo(() => campaigns.filter((c) => c.status !== 'ACTIVE'), [campaigns]);
  const canCreate = walletBalance >= MIN_WALLET_FOR_NEW && !active;
  const lowBalance = walletBalance < LOW_WALLET_HINT;

  async function onPause() {
    if (!active) return;
    Alert.alert(
      'إيقاف العرض',
      'هل تريد إيقاف العرض الآن؟ لن يتم استرداد الخصومات السابقة.',
      [
        { text: 'تراجع', style: 'cancel' },
        {
          text: 'إيقاف',
          style: 'destructive',
          onPress: async () => {
            try {
              await pause.mutateAsync(active.id);
            } catch (err: any) {
              Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر الإيقاف');
            }
          },
        },
      ],
    );
  }

  function onCreate() {
    if (!canCreate) {
      if (active) {
        Alert.alert('عرض نشط بالفعل', 'يوجد عرض نشط حالياً. أوقفه أو انتظر انتهاءه.');
      } else {
        Alert.alert(
          'رصيد غير كافٍ',
          `يجب أن يكون رصيد المحفظة ${n(MIN_WALLET_FOR_NEW)} د.ع على الأقل. تواصل مع داري للشحن.`,
        );
      }
      return;
    }
    router.push('/promo-create' as any);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Sky-gradient hero — same pattern as home tab. */}
      <LinearGradient
        colors={['#14b8a6', '#0e9384']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          paddingBottom: 22,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <SafeAreaView edges={['top']}>
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 4,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Pressable
              onPress={() => safeBack(router)}
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
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>العروض</Text>
            <View style={{ width: 38 }} />
          </View>

          <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
            <Text style={{ color: '#99f6e4', fontSize: 12 }}>رصيد محفظة العروض</Text>
            <Text
              style={{
                color: '#fff',
                fontWeight: '900',
                fontSize: 34,
                marginTop: 4,
                lineHeight: 40,
              }}
            >
              {n(walletBalance)}{' '}
              <Text style={{ fontSize: 14, opacity: 0.85, fontWeight: '700' }}>د.ع</Text>
            </Text>
            <Text style={{ color: '#99f6e4', fontSize: 11, marginTop: 4 }}>
              يكفي لـ {n(Math.floor(walletBalance / 1000))} طلب بسعر العرض
            </Text>
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
        {/* Low-balance hint */}
        {!promosQuery.isLoading && lowBalance && (
          <View
            style={{
              backgroundColor: '#fffbeb',
              borderColor: '#fde68a',
              borderWidth: 1,
              borderRadius: 16,
              padding: 12,
              marginBottom: 12,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: '#f59e0b',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name="warning" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={{ color: '#92400e', fontWeight: '800', fontSize: 13 }}>
                رصيدك منخفض
              </Text>
              <Text style={{ color: '#b45309', fontSize: 11, marginTop: 2, textAlign: 'right' }}>
                تواصل مع داري لشحن المحفظة
              </Text>
            </View>
          </View>
        )}

        {/* Create CTA */}
        <Pressable
          onPress={onCreate}
          disabled={!canCreate}
          style={({ pressed }) => ({
            borderRadius: 18,
            overflow: 'hidden',
            marginBottom: 14,
            opacity: !canCreate ? 0.55 : pressed ? 0.9 : 1,
          })}
        >
          <LinearGradient
            colors={canCreate ? ['#14b8a6', '#0e9384'] : ['#cbd5e1', '#94a3b8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingVertical: 16,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <MaterialIcons name="add" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>عرض جديد</Text>
          </LinearGradient>
        </Pressable>

        {/* Loading skeletons */}
        {promosQuery.isLoading && (
          <>
            <Skeleton height={180} borderRadius={22} style={{ marginBottom: 12 }} />
            <Skeleton height={88} borderRadius={18} style={{ marginBottom: 10 }} />
            <Skeleton height={88} borderRadius={18} style={{ marginBottom: 10 }} />
          </>
        )}

        {/* Error */}
        {promosQuery.isError && !data && (
          <EmptyState
            icon="cloud-off"
            title="تعذّر تحميل العروض"
            actionLabel="إعادة المحاولة"
            onAction={() => promosQuery.refetch()}
          />
        )}

        {/* Active campaign */}
        {active && (
          <ActiveCard campaign={active} onPause={onPause} pausing={pause.isPending} />
        )}

        {/* Past list header */}
        {data && (
          <Text
            style={{
              fontSize: 12,
              fontWeight: '900',
              color: '#475569',
              textAlign: 'right',
              marginTop: 18,
              marginBottom: 8,
            }}
          >
            العروض السابقة ({past.length})
          </Text>
        )}

        {/* Past list */}
        {data && past.length === 0 && !active ? (
          <EmptyState
            icon="campaign"
            title="لا توجد عروض بعد"
            subtitle="أنشئ عرضك الأوّل لتجذب الزبائن في ساعات قليلة."
          />
        ) : (
          past.map((c) => (
            <PromoRow
              key={c.id}
              campaign={c}
              onPress={() => router.push(`/promo/${c.id}` as any)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Active campaign card
// ────────────────────────────────────────────────────────────────────

function ActiveCard({
  campaign,
  onPause,
  pausing,
}: {
  campaign: PromoCampaign;
  onPause: () => void;
  pausing: boolean;
}) {
  const router = useRouter();
  const remaining = useMemo(() => {
    const ms = new Date(campaign.endAt).getTime() - Date.now();
    if (ms <= 0) return 'انتهى';
    return formatDistanceToNow(new Date(campaign.endAt), {
      addSuffix: false,
      locale: arSA,
    });
  }, [campaign.endAt]);

  const discountPct = Math.round(
    ((campaign.originalPriceIqd - campaign.promoPriceIqd) / campaign.originalPriceIqd) * 100,
  );

  return (
    <Pressable
      onPress={() => router.push(`/promo/${campaign.id}` as any)}
      style={({ pressed }) => ({
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#10b981',
        borderRadius: 22,
        overflow: 'hidden',
        opacity: pressed ? 0.95 : 1,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
        elevation: 4,
      })}
    >
      {/* Live indicator bar */}
      <View
        style={{
          backgroundColor: '#d1fae5',
          paddingHorizontal: 14,
          paddingVertical: 8,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: 1,
          borderBottomColor: '#a7f3d0',
        }}
      >
        <View
          style={{
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
              backgroundColor: '#10b981',
            }}
          />
          <Text style={{ color: '#065f46', fontWeight: '900', fontSize: 12 }}>
            عرض نشط الآن
          </Text>
        </View>
        <Pressable
          onPress={onPause}
          disabled={pausing}
          hitSlop={6}
          style={({ pressed }) => ({
            backgroundColor: '#fff',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#fecaca',
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 4,
            opacity: pressed || pausing ? 0.7 : 1,
          })}
        >
          <MaterialIcons name="pause" size={14} color="#b91c1c" />
          <Text style={{ color: '#b91c1c', fontWeight: '800', fontSize: 11 }}>
            {pausing ? '...' : 'إيقاف'}
          </Text>
        </Pressable>
      </View>

      <View style={{ padding: 14 }}>
        {/* Prices */}
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 30, fontWeight: '900', color: '#0c7a6e' }}>
            {n(campaign.promoPriceIqd)} د.ع
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: '#94a3b8',
              textDecorationLine: 'line-through',
            }}
          >
            {n(campaign.originalPriceIqd)} د.ع
          </Text>
          <View
            style={{
              backgroundColor: '#fef3c7',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: '#92400e', fontWeight: '900', fontSize: 11 }}>
              -{discountPct}%
            </Text>
          </View>
        </View>

        {/* Countdown */}
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 6,
            marginTop: 10,
          }}
        >
          <MaterialIcons name="schedule" size={16} color="#f59e0b" />
          <Text style={{ fontSize: 12, color: '#475569' }}>ينتهي خلال </Text>
          <Text style={{ fontSize: 12, color: '#0f172a', fontWeight: '900' }}>
            {remaining}
          </Text>
        </View>

        {/* Live stats — 2x2 */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <StatBlock
            icon="send"
            label="تم إرساله"
            value={n(campaign.pushSentCount)}
            tint="#0891b2"
          />
          <StatBlock
            icon="local-mall"
            label="طلبات"
            value={n(campaign.orderCount)}
            tint="#10b981"
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <StatBlock
            icon="trending-up"
            label="إيرادات"
            value={`${n(campaign.totalRevenueIqd)}`}
            tint="#10b981"
            suffix="د.ع"
          />
          <StatBlock
            icon="account-balance-wallet"
            label="مخصوم"
            value={`${n(campaign.totalDeductedIqd)}`}
            tint="#f59e0b"
            suffix="د.ع"
          />
        </View>
      </View>
    </Pressable>
  );
}

function StatBlock({
  icon,
  label,
  value,
  tint,
  suffix,
}: {
  icon: MaterialIconName;
  label: string;
  value: string;
  tint: string;
  suffix?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tint + '14',
        borderRadius: 14,
        padding: 10,
      }}
    >
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <MaterialIcons name={icon} size={13} color={tint} />
        <Text style={{ fontSize: 10, color: '#475569', fontWeight: '700' }}>{label}</Text>
      </View>
      <Text
        style={{
          marginTop: 4,
          fontSize: 16,
          fontWeight: '900',
          color: tint,
          textAlign: 'right',
        }}
      >
        {value}
        {suffix && (
          <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '700' }}> {suffix}</Text>
        )}
      </Text>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Past campaign row
// ────────────────────────────────────────────────────────────────────

function PromoRow({
  campaign,
  onPress,
}: {
  campaign: PromoCampaign;
  onPress: () => void;
}) {
  const meta = STATUS_META[campaign.status];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '900', color: '#0c7a6e' }}>
            {n(campaign.promoPriceIqd)} د.ع
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: '#94a3b8',
              textDecorationLine: 'line-through',
            }}
          >
            {n(campaign.originalPriceIqd)}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: meta.bg,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: meta.fg, fontWeight: '900', fontSize: 10 }}>
            {meta.label}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 4,
        }}
      >
        <View style={{ flexDirection: 'row-reverse', gap: 14 }}>
          <Stat label="إرسال" value={n(campaign.pushSentCount)} />
          <Stat label="طلبات" value={n(campaign.orderCount)} />
          <Stat label="إيرادات" value={`${n(campaign.totalRevenueIqd)}`} />
        </View>
        <Text style={{ fontSize: 10, color: '#94a3b8' }}>
          {new Date(campaign.startAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      </View>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ fontSize: 10, color: '#64748b' }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '800', color: '#0f172a', marginTop: 1 }}>
        {value}
      </Text>
    </View>
  );
}
