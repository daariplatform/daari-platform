/**
 * Wallet / loyalty — balance + loyalty points with an animated counter and
 * a progress ring toward the next reward, plus payment history (paid orders).
 *
 * Reached from: profile → "محفظتي ونقاطي".
 */
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useMyOrders } from '@/lib/queries';
import { useWallet, REWARD_THRESHOLD } from '@/lib/features/wallet';
import { iqd, fmtArabicDate } from '@/lib/format';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function WalletScreen() {
  const router = useRouter();
  const { data: profile, isLoading, isError, refetch, isRefetching } = useWallet();
  const { data: orders } = useMyOrders();

  const paidOrders = (orders ?? []).filter((o) => (o.paidAmountIqd ?? 0) > 0);

  if (isLoading || (!profile && !isError)) {
    return (
      <View className="flex-1 bg-slate-50">
        <Header onBack={() => router.back()} />
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton height={180} borderRadius={24} />
          <SkeletonCard height={70} />
          <SkeletonCard height={70} />
        </View>
      </View>
    );
  }

  if (isError || !profile) {
    return (
      <View className="flex-1 bg-slate-50">
        <Header onBack={() => router.back()} />
        <View style={{ alignItems: 'center', paddingTop: 80 }}>
          <Ionicons name="cloud-offline-outline" size={48} color="#94a3b8" />
          <Text className="text-slate-700 font-bold text-base mt-4">تعذّر تحميل المحفظة</Text>
          <Pressable onPress={() => refetch()} className="mt-5 bg-cyan-600 px-6 py-3 rounded-2xl">
            <Text className="text-white font-bold text-sm">إعادة المحاولة</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const points = profile.loyaltyPoints ?? 0;
  const progress = Math.min(1, points / REWARD_THRESHOLD);
  const remaining = Math.max(0, REWARD_THRESHOLD - points);

  return (
    <View className="flex-1 bg-slate-50">
      <Header onBack={() => router.back()} />
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0891b2" />}
      >
        {/* Loyalty hero card */}
        <MotiView
          from={{ opacity: 0, translateY: 16, scale: 0.97 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          style={{ borderRadius: 24, overflow: 'hidden', shadowColor: '#0891b2', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 }}
        >
          <LinearGradient colors={['#0e7490', '#0891b2', '#06b6d4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
            <View className="flex-row-reverse items-center justify-between">
              {/* Progress ring */}
              <ProgressRing progress={progress} points={points} />
              <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 16 }}>
                <Text style={{ color: '#cffafe', fontSize: 12 }}>نقاط الولاء</Text>
                <AnimatedCounter
                  value={points}
                  style={{ color: '#fff', fontSize: 40, fontWeight: '900', lineHeight: 46 }}
                />
                <Text style={{ color: '#a5f3fc', fontSize: 11, marginTop: 2 }}>نقطة</Text>
                {remaining > 0 ? (
                  <Text style={{ color: '#ecfeff', fontSize: 11, marginTop: 8, textAlign: 'right' }}>
                    باقٍ {remaining} نقطة لتعبئة مجانية 🎁
                  </Text>
                ) : (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>🎉 مكافأة جاهزة!</Text>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </MotiView>

        {/* Balance card */}
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', delay: 150, duration: 400 }}
          style={{ backgroundColor: '#fff', borderRadius: 18, padding: 16, marginTop: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }}
        >
          <LinearGradient colors={profile.balanceIqd >= 0 ? ['#34d399', '#059669'] : ['#fca5a5', '#dc2626']} style={{ width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="wallet" size={24} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={{ color: '#64748b', fontSize: 12 }}>رصيد الحساب</Text>
            <Text style={{ fontSize: 20, fontWeight: '900', color: profile.balanceIqd >= 0 ? '#059669' : '#dc2626', marginTop: 2 }}>
              {profile.balanceIqd === 0 ? 'مدفوع بالكامل' : iqd(Math.abs(profile.balanceIqd))}
            </Text>
            {profile.balanceIqd < 0 && <Text style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>مبلغ مستحق عليك</Text>}
          </View>
        </MotiView>

        {/* How points work */}
        <View style={{ backgroundColor: '#ecfeff', borderColor: '#a5f3fc', borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
          <Ionicons name="information-circle" size={22} color="#0891b2" />
          <Text style={{ flex: 1, textAlign: 'right', color: '#0e7490', fontSize: 12, lineHeight: 18 }}>
            تكسب نقاط ولاء مع كل تعبئة. اجمع {REWARD_THRESHOLD} نقطة لتحصل على تعبئة مجانية.
          </Text>
        </View>

        {/* Payment history */}
        <Text className="text-base font-bold text-right mt-6 mb-3 px-1">سجل المدفوعات</Text>
        {paidOrders.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 30 }}>
            <Ionicons name="receipt-outline" size={40} color="#cbd5e1" />
            <Text className="text-slate-500 text-sm mt-2">لا توجد مدفوعات بعد</Text>
          </View>
        ) : (
          paidOrders.map((o, idx) => (
            <MotiView
              key={o.id}
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', delay: idx * 40, duration: 300 }}
            >
              <Pressable
                onPress={() => router.push(`/order/${o.id}` as any)}
                style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="cash" size={20} color="#059669" />
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '800', color: '#0f172a', fontSize: 14 }}>{iqd(o.paidAmountIqd)}</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{fmtArabicDate(o.completedAt ?? o.requestedAt)}</Text>
                </View>
                <Ionicons name="chevron-back" size={18} color="#cbd5e1" />
              </Pressable>
            </MotiView>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <LinearGradient colors={['#0e7490', '#0891b2', '#06b6d4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}>
      <SafeAreaView edges={['top']}>
        <View className="px-5 pt-3 pb-4 flex-row-reverse items-center justify-between">
          <Pressable onPress={onBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </Pressable>
          <View style={{ alignItems: 'flex-end' }}>
            <Text className="text-white text-2xl font-bold">محفظتي</Text>
            <Text className="text-cyan-100 text-xs mt-0.5">رصيدك ونقاط ولائك</Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

/** Animated circular progress ring (SVG + reanimated stroke-dashoffset). */
function ProgressRing({ progress, points }: { progress: number; points: number }) {
  const SIZE = 96;
  const STROKE = 9;
  const R = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * R;
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withTiming(progress, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [anim, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - anim.value),
  }));

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(255,255,255,0.25)" strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke="#fff"
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          animatedProps={animatedProps}
        />
      </Svg>
      <Ionicons name="gift" size={30} color="#fff" />
      <Text style={{ color: '#cffafe', fontSize: 10, fontWeight: '800', marginTop: 2 }}>{Math.round(progress * 100)}%</Text>
    </View>
  );
}
