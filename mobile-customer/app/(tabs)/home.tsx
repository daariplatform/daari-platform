import { ScrollView, View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import { useMyProfile, useCreateRefillOrder, useMyOrders } from '@/lib/queries';
import { useRouter } from 'expo-router';
import { iqd } from '@/lib/format';
import { RefillStatusStrip } from '@/components/RefillStatusStrip';
import { RecentActivityList } from '@/components/RecentActivityList';
import { RainBackground } from '@/components/RainBackground';
import { hap } from '@/lib/haptics';
import { useState, useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

/**
 * Home — main customer screen.
 *
 * تصميم: gradient hero مع water-drop animation، بطاقات stats بأيقونات 3D،
 * زر اطلب الآن كبير مع pulse animation، tier badge، ads strip.
 */
export default function Home() {
  const router = useRouter();
  const { data: profile, isLoading } = useMyProfile();
  const { data: orders } = useMyOrders();
  const createOrder = useCreateRefillOrder();

  // Find an in-flight refill — used to disable the order button so the
  // customer can't pile up duplicate requests for the same tank. Matches
  // the backend guard in orders.service.create().
  const activeOrder = (orders ?? []).find(
    (o) =>
      o.kind === 'REFILL' &&
      (o.status === 'PENDING' || o.status === 'ASSIGNED' || o.status === 'EN_ROUTE'),
  );

  async function requestRefill() {
    if (!profile) return;
    // Defensive — UI already disables the button, but if the cached state
    // is stale we still get a clean error from the backend's ConflictException.
    if (activeOrder) {
      router.push(`/order/${activeOrder.id}` as any);
      return;
    }
    hap.press();
    try {
      await createOrder.mutateAsync(profile.id);
      hap.success();
      Alert.alert('تم إرسال طلبك للمعمل', 'سيصل السائق خلال ساعة');
    } catch (err: any) {
      hap.error();
      Alert.alert('خطأ', err?.response?.data?.message ?? 'حاول مرة أخرى');
    }
  }

  if (isLoading || !profile) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator color="#0891b2" size="large" />
      </SafeAreaView>
    );
  }

  const tank = profile.tanks[0];
  const balanceOk = profile.balanceIqd >= 0;

  return (
    <View className="flex-1 bg-slate-50">
      {/* Gradient hero بكامل العرض، خارج الـ SafeAreaView لاستخدام الـ status bar */}
      <LinearGradient
        // ── Brand palette: sky bright → sky deep (ألوان فاتحة، حيوية، تناسب الماء) ──
        colors={['#38bdf8', '#0ea5e9', '#0284c7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          paddingBottom: 20,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          overflow: 'hidden',
        }}
      >
        <RainBackground density="light" />
        <SafeAreaView edges={['top']}>
          <View className="px-5 pt-2">
            <MotiView
              from={{ opacity: 0, translateY: -10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 500 }}
              style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <View style={{ flex: 1 }}>
                <Text className="text-cyan-100 text-xs">مرحباً</Text>
                <Text className="text-white font-bold text-xl">{profile.fullName}</Text>
              </View>
              <Pressable
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="notifications" size={22} color="white" />
              </Pressable>
            </MotiView>

            {/* شريط حالة الزبون — يحسب أيام التبقّي حتى الموعد الإلزامي
                ويعطي إشارة بصرية واضحة عن قُرب موعد التعبئة. */}
            <MotiView
              from={{ opacity: 0, translateY: -8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 500, delay: 200 }}
            >
              <RefillStatusStrip lastRefillAt={profile.lastRefillAt} />
            </MotiView>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4" style={{ marginTop: 12 }}>
          {/* Big order CTA — with pulse animation when idle */}
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 400, damping: 14 }}
          >
            <OrderButton
              onPress={requestRefill}
              loading={createOrder.isPending}
              priceIqd={profile.refillPriceIqd}
              activeOrderStatus={
                activeOrder
                  ? (activeOrder.status as 'PENDING' | 'ASSIGNED' | 'EN_ROUTE')
                  : null
              }
            />
          </MotiView>

          {/* Stats chips — أصغر وأنظف. زبون جديد (totalRefills=0)
              يشوف فقط chip "خزاني" لأن "إجمالي تعبئاتي=0" مجرد noise. */}
          <View className="flex-row gap-2 mt-3">
            {profile.totalRefills > 0 && (
              <StatChip
                icon="local-drink"
                label="إجمالي تعبئاتي"
                value={profile.totalRefills.toLocaleString('ar-IQ')}
              />
            )}
            <StatChip
              icon={balanceOk ? 'verified' : 'account-balance-wallet'}
              label="حسابي"
              value={balanceOk ? 'مدفوع' : iqd(-profile.balanceIqd)}
              valueColor={balanceOk ? '#10b981' : '#ea580c'}
            />
            {tank && (
              <StatChip
                icon="water"
                label="خزاني"
                value={tank.capacity === 'L500' ? '٥٠٠ ل' : '٣٥٠ ل'}
              />
            )}
          </View>

          {/* نشاطك الأخير — آخر ٣ طلبات + ملخص معدّل التعبئة */}
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', delay: 700, duration: 500 }}
          >
            <RecentActivityList />
          </MotiView>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * The main "اطلب الآن" CTA. Pulse animation when idle, scale on press,
 * loading spinner when submitting.
 */
function OrderButton({
  onPress,
  loading,
  priceIqd,
  activeOrderStatus,
}: {
  onPress: () => void;
  loading: boolean;
  priceIqd: number;
  /** When set, the button switches into "view existing order" mode instead
   *  of "place a new one" — prevents the customer from spamming duplicate
   *  requests for the same tank. */
  activeOrderStatus: 'PENDING' | 'ASSIGNED' | 'EN_ROUTE' | null;
}) {
  const pulse = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const hasActive = activeOrderStatus !== null;

  useEffect(() => {
    // Stop pulsing when an order is already in flight — calmer state matches
    // "everything's fine, just wait" message.
    if (hasActive) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1.04, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse, hasActive]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: loading || pressed ? 1 : pulse.value }],
  }));

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressed ? 0.97 : 1 }],
  }));

  // Human-readable status label for the "you already have an order" state.
  const activeLabel =
    activeOrderStatus === 'PENDING'
      ? 'بانتظار التعيين'
      : activeOrderStatus === 'ASSIGNED'
        ? 'تم تعيين سائق'
        : activeOrderStatus === 'EN_ROUTE'
          ? 'السائق في الطريق'
          : '';

  return (
    <Animated.View style={pulseStyle}>
      <Animated.View style={pressStyle}>
        <Pressable
          onPress={onPress}
          disabled={loading}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
        >
          <LinearGradient
            colors={
              loading
                ? ['#bae6fd', '#7dd3fc']
                : hasActive
                  ? ['#fbbf24', '#f59e0b', '#d97706']   // amber — "in progress, wait"
                  : ['#38bdf8', '#0ea5e9', '#0284c7']   // sky — "ready to order"
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 26,
              paddingVertical: 18,
              paddingHorizontal: 18,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              shadowColor: hasActive ? '#d97706' : '#0ea5e9',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.35,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : hasActive ? (
                <>
                  <Text className="text-white font-bold text-lg">طلبك قيد التنفيذ</Text>
                  <Text
                    style={{
                      color: '#fff',
                      fontWeight: '900',
                      fontSize: 18,
                      marginTop: 4,
                      lineHeight: 22,
                    }}
                  >
                    {activeLabel}
                  </Text>
                  <Text style={{ color: '#fef3c7', fontSize: 10, marginTop: 4 }}>
                    اضغط لمتابعة الطلب الحالي
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-white font-bold text-lg">اطلب تعبئة الآن</Text>
                  {/* السعر بسطر مستقل + بحجم كبير (24px) — أكثر بروزاً من قبل. */}
                  <Text
                    style={{
                      color: '#fff',
                      fontWeight: '900',
                      fontSize: 24,
                      marginTop: 4,
                      lineHeight: 26,
                    }}
                  >
                    {(priceIqd ?? 0).toLocaleString('en-US')}{' '}
                    <Text style={{ fontSize: 13, opacity: 0.85, fontWeight: '700' }}>
                      د.ع
                    </Text>
                  </Text>
                  <Text style={{ color: '#bae6fd', fontSize: 10, marginTop: 4 }}>
                    يصلك خلال ساعة · دفع نقدي
                  </Text>
                </>
              )}
            </View>
            {!loading && (
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.3)',
                }}
              >
                {/* قطرة ماء عند طلب جديد، ساعة عند طلب نشط — نشير بصرياً
                    لحالة الزر دون الحاجة لقراءة النص. */}
                <MaterialIcons
                  name={hasActive ? 'access-time' : 'water-drop'}
                  size={32}
                  color="#fff"
                />
              </View>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Chip أفقي مدمج بدل StatCard الكبير. الفرق:
 *  - الـ Card كان يحتل ١٤٠ بكسل ارتفاع ولو القيمة 0
 *  - الـ Chip يحتل ٥٠ بكسل، يدمج ٣ معلومات في صف واحد، يخفي ما هو صفر بالكامل
 */
function StatChip({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#e0f2fe',
      }}
    >
      <View
        style={{
          backgroundColor: '#e0f2fe',
          width: 32,
          height: 32,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name={icon} size={18} color="#0284c7" />
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 10, color: '#94a3b8' }}>{label}</Text>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '900',
            color: valueColor ?? '#0f172a',
            marginTop: 1,
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}
