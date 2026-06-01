/**
 * End-of-shift summary.
 *
 * GET /drivers/me/shift-summary → today's { completedOrders, collectedCashIqd,
 * byKind }. A beautiful summary card with an "أنهِ الوردية" CTA that calls the
 * existing stopShiftTracking() (which flips the driver OFFLINE and stops GPS),
 * then logs the summary and bounces the user home.
 *
 * Endpoint may 404 until backend deploys — handled gracefully.
 */

import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { stopShiftTracking } from '@/lib/location';
import { useMyShiftSummary, type ShiftSummary } from '@/lib/queries';
import { track } from '@/lib/posthog';
import { usePostHog } from 'posthog-react-native';
import { iqd } from '@/lib/format';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Skeleton } from '@/components/Skeleton';
import { ErrorCard } from './cash';

const KIND_META: Record<
  'REFILL' | 'TANK_DELIVERY' | 'TANK_RECLAIM',
  { label: string; icon: React.ComponentProps<typeof MaterialIcons>['name']; color: string; bg: string }
> = {
  REFILL: { label: 'تعبئة', icon: 'water-drop', color: '#0284c7', bg: '#e0f2fe' },
  TANK_DELIVERY: { label: 'توصيل خزان', icon: 'inventory-2', color: '#1d4ed8', bg: '#dbeafe' },
  TANK_RECLAIM: { label: 'سحب خزان', icon: 'undo', color: '#dc2626', bg: '#fef2f2' },
};

export default function ShiftSummaryScreen() {
  const router = useRouter();
  const ph = usePostHog();
  const { data, isLoading, isError, refetch, isRefetching } = useMyShiftSummary();
  const [ending, setEnding] = useState(false);

  async function endShift() {
    Alert.alert(
      'إنهاء الوردية',
      'سيتم إيقاف تتبّع موقعك وتعيين حالتك "غير متصل". تأكّد أنك سلّمت النقد للمعمل.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'أنهِ الوردية',
          style: 'destructive',
          onPress: async () => {
            setEnding(true);
            try {
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              await stopShiftTracking();
              track(ph, 'shift_ended', {
                completedOrders: data?.completedOrders ?? 0,
                collectedCashIqd: data?.collectedCashIqd ?? 0,
              });
              Alert.alert('انتهت الوردية ✓', 'شكراً على عملك اليوم 👏');
              router.replace('/(tabs)/home');
            } catch {
              Alert.alert('تعذّر الإنهاء', 'حاول مرة أخرى.');
            } finally {
              setEnding(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <LinearGradient
        colors={['#1e3a8a', '#1d4ed8', '#3b82f6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}
      >
        <SafeAreaView edges={['top']}>
          <View className="px-5 pt-3 pb-4 flex-row-reverse items-center justify-between">
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
            <View style={{ alignItems: 'flex-end' }}>
              <Text className="text-white text-2xl font-bold">ملخّص الوردية</Text>
              <Text className="text-blue-100 text-xs mt-0.5">إنجاز اليوم</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#1d4ed8" />
        }
      >
        {isLoading ? (
          <>
            <Skeleton height={150} borderRadius={20} style={{ marginBottom: 12 }} />
            <Skeleton height={120} borderRadius={20} />
          </>
        ) : isError ? (
          <ErrorCard message="تعذّر جلب ملخّص الوردية." onRetry={refetch} />
        ) : data ? (
          <ShiftBody data={data} />
        ) : null}

        {/* CTA always shown (the driver may want to end an empty shift too) */}
        {!isLoading && !isError && (
          <Animated.View entering={FadeInDown.delay(300).duration(450)}>
            <Pressable
              onPress={endShift}
              disabled={ending}
              style={{ borderRadius: 16, overflow: 'hidden', marginTop: 18 }}
            >
              <LinearGradient
                colors={ending ? ['#cbd5e1', '#94a3b8'] : ['#1d4ed8', '#1e3a8a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 16, alignItems: 'center' }}
              >
                <View className="flex-row-reverse items-center gap-2">
                  <MaterialIcons name="logout" size={22} color="#fff" />
                  <Text className="text-white font-bold text-base">أنهِ الوردية</Text>
                </View>
              </LinearGradient>
            </Pressable>
            <Text className="text-slate-400 text-[11px] text-center mt-3 leading-5">
              سيتوقّف تتبّع موقعك وتُعيَّن حالتك "غير متصل".{'\n'}
              تأكّد من تسليم النقد قبل الإنهاء.
            </Text>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

function ShiftBody({ data }: { data: ShiftSummary }) {
  // Looping pulse on the trophy badge.
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const kinds = Object.entries(data.byKind).filter(([, n]) => (n ?? 0) > 0) as [
    keyof typeof KIND_META,
    number,
  ][];

  return (
    <>
      {/* Hero */}
      <Animated.View entering={FadeInDown.duration(450)}>
        <LinearGradient
          colors={['#0e7490', '#0891b2', '#06b6d4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 22,
            padding: 20,
            alignItems: 'center',
            marginBottom: 12,
            shadowColor: '#0891b2',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.28,
            shadowRadius: 14,
            elevation: 6,
          }}
        >
          <Animated.View
            style={[
              {
                width: 70,
                height: 70,
                borderRadius: 24,
                backgroundColor: 'rgba(255,255,255,0.22)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              },
              badgeStyle,
            ]}
          >
            <MaterialIcons name="emoji-events" size={40} color="#fff" />
          </Animated.View>
          <Text className="text-cyan-100 text-xs font-bold">مهام أنجزتها اليوم</Text>
          <AnimatedNumber
            value={data.completedOrders}
            format={(n) => Math.round(n).toLocaleString('en-US')}
            style={{ color: '#fff', fontWeight: '800', fontSize: 44, marginTop: 2 }}
          />
        </LinearGradient>
      </Animated.View>

      {/* Cash collected */}
      <Animated.View
        entering={FadeInDown.delay(120).duration(450)}
        style={{
          backgroundColor: '#fff',
          borderRadius: 18,
          padding: 16,
          marginBottom: 12,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 12,
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: '#d1fae5',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons name="payments" size={26} color="#059669" />
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text className="text-[11px] text-slate-500">النقد المُحصَّل اليوم</Text>
          <AnimatedNumber
            value={data.collectedCashIqd}
            format={(n) => iqd(Math.round(n))}
            style={{ color: '#047857', fontWeight: '800', fontSize: 20, marginTop: 2 }}
          />
        </View>
      </Animated.View>

      {/* Breakdown by kind */}
      {kinds.length > 0 && (
        <Animated.View
          entering={FadeInDown.delay(200).duration(450)}
          style={{
            backgroundColor: '#fff',
            borderRadius: 18,
            padding: 16,
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text className="text-sm font-bold text-slate-700 mb-3 text-right">
            تفصيل حسب النوع
          </Text>
          {kinds.map(([kind, n], i) => {
            const m = KIND_META[kind];
            return (
              <View
                key={kind}
                className="flex-row-reverse items-center gap-3"
                style={{ marginBottom: i === kinds.length - 1 ? 0 : 10 }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: m.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons name={m.icon} size={20} color={m.color} />
                </View>
                <Text className="flex-1 text-right font-bold text-slate-800 text-sm">
                  {m.label}
                </Text>
                <View
                  style={{
                    backgroundColor: m.bg,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ color: m.color, fontWeight: '800', fontSize: 13 }}>
                    {n.toLocaleString('en-US')}
                  </Text>
                </View>
              </View>
            );
          })}
        </Animated.View>
      )}
    </>
  );
}
