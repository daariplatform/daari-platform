import { ScrollView, View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import {
  useMyProfile,
  useCreateRefillOrder,
  useMyOrders,
  useActivePromo,
  type ActivePromo,
} from '@/lib/queries';
import { useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { track } from '@/lib/posthog';
import { iqd } from '@/lib/format';
import { RefillStatusStrip } from '@/components/RefillStatusStrip';
import { RecentActivityList } from '@/components/RecentActivityList';
import { RainBackground } from '@/components/RainBackground';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
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
  const { data: activePromo } = useActivePromo();
  const createOrder = useCreateRefillOrder();
  const ph = usePostHog();

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
      track(ph, 'order_created', {
        priceIqd: activePromo?.promoPriceIqd ?? profile.refillPriceIqd,
        // Attribute the conversion to a running campaign when one exists —
        // lets the plant see how many orders the promo actually generated.
        promoId: activePromo?.id,
        // No `liters` field on the customer flow — the tank size is a
        // tenant-level setting; we omit it here and the worker fires the
        // detailed event with liters in `order_completed`.
      });
      Alert.alert('تم إرسال طلبك للمعمل', 'سيصل السائق خلال ساعة');
    } catch (err: any) {
      hap.error();
      Alert.alert('خطأ', err?.response?.data?.message ?? 'حاول مرة أخرى');
    }
  }

  if (isLoading || !profile) {
    // Skeleton placeholders: hero bar + big CTA + 3 stat chips + activity rows.
    // أفضل من spinner عام — يطمئن العين بالشكل العام للشاشة.
    return (
      <View className="flex-1 bg-slate-50">
        <SafeAreaView edges={['top']}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Skeleton width={'50%'} height={20} />
            <Skeleton width={'80%'} height={28} style={{ marginTop: 8 }} />
            <Skeleton height={48} borderRadius={16} style={{ marginTop: 14 }} />
            <Skeleton height={96} borderRadius={26} style={{ marginTop: 20 }} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Skeleton height={50} borderRadius={14} style={{ flex: 1 }} />
              <Skeleton height={50} borderRadius={14} style={{ flex: 1 }} />
              <Skeleton height={50} borderRadius={14} style={{ flex: 1 }} />
            </View>
            <View style={{ marginTop: 18 }}>
              <SkeletonCard height={90} />
              <SkeletonCard height={90} />
            </View>
          </View>
        </SafeAreaView>
      </View>
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
              {/* Bell — opens the customer inbox. Previously had NO
                  onPress at all, so push notifications had no in-app
                  destination. Now wired to /notifications. */}
              <Pressable
                onPress={() => router.push('/notifications')}
                hitSlop={8}
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
              // Only surface the promo when there's no in-flight order —
              // an active order short-circuits the CTA into "track" mode,
              // and stacking a "discount countdown" on top of that is noise.
              promo={!activeOrder ? activePromo ?? null : null}
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
 *
 * Three visual states, mutually exclusive:
 *   - `activeOrderStatus` set    → amber "track existing order" mode
 *   - `promo` set                → emerald-badged discount mode w/ countdown
 *   - neither                    → standard sky-blue order CTA
 */
function OrderButton({
  onPress,
  loading,
  priceIqd,
  activeOrderStatus,
  promo,
}: {
  onPress: () => void;
  loading: boolean;
  priceIqd: number;
  /** When set, the button switches into "view existing order" mode instead
   *  of "place a new one" — prevents the customer from spamming duplicate
   *  requests for the same tank. */
  activeOrderStatus: 'PENDING' | 'ASSIGNED' | 'EN_ROUTE' | null;
  /** When set, the CTA morphs into a discount variant: strikethrough original
   *  price + promo price + countdown to `endAt`. Suppressed by `activeOrderStatus`. */
  promo: ActivePromo | null;
}) {
  const pulse = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const hasActive = activeOrderStatus !== null;
  const hasPromo = !hasActive && promo !== null;

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
    <View>
      {hasPromo && promo && (
        <PromoBadge endAt={promo.endAt} />
      )}
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
                    : hasPromo
                      ? ['#0ea5e9', '#0284c7', '#0369a1'] // deeper sky — promo variant
                      : ['#38bdf8', '#0ea5e9', '#0284c7'] // sky — "ready to order"
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
                shadowColor: hasActive ? '#d97706' : hasPromo ? '#10b981' : '#0ea5e9',
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
                ) : hasPromo && promo ? (
                  <>
                    <Text className="text-white font-bold text-lg">اطلب الآن</Text>
                    {/* Strikethrough original price — small, dim — sits ABOVE
                        the big new price so the eye reads "10,000 → 7,000". */}
                    <Text
                      style={{
                        color: '#94a3b8',
                        fontSize: 14,
                        marginTop: 4,
                        textDecorationLine: 'line-through',
                        fontWeight: '700',
                      }}
                    >
                      بدلاً من {promo.originalPriceIqd.toLocaleString('en-US')} د.ع
                    </Text>
                    <Text
                      style={{
                        color: '#fff',
                        fontWeight: '900',
                        fontSize: 28,
                        marginTop: 2,
                        lineHeight: 30,
                      }}
                    >
                      {promo.promoPriceIqd.toLocaleString('en-US')}{' '}
                      <Text style={{ fontSize: 14, opacity: 0.9, fontWeight: '700' }}>
                        د.ع
                      </Text>
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
                  {/* قطرة ماء عند طلب جديد، ساعة عند طلب نشط، تخفيض عند العرض —
                      نشير بصرياً لحالة الزر دون الحاجة لقراءة النص. */}
                  <MaterialIcons
                    name={
                      hasActive
                        ? 'access-time'
                        : hasPromo
                          ? 'local-offer'
                          : 'water-drop'
                    }
                    size={32}
                    color="#fff"
                  />
                </View>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </Animated.View>
      {hasPromo && promo && (
        <PromoCountdown endAt={promo.endAt} />
      )}
    </View>
  );
}

/**
 * Emerald "limited offer" pill that sits above the promo CTA. Kept as a
 * separate component so the OrderButton tree stays readable.
 */
function PromoBadge({ endAt: _endAt }: { endAt: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-end',
        backgroundColor: '#10b981',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 999,
        marginBottom: 8,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>
        🎉 عرض محدود!
      </Text>
    </View>
  );
}

/**
 * Auto-updating countdown line below the promo CTA. Recomputes from
 * `endAt` (server clock) on every tick — never accumulates from a local
 * `secondsRemaining` counter to avoid drift if the device clock is wrong.
 *
 * Ticks every 30s — fine for "X ساعة و Y دقيقة" granularity. The final
 * 5 minutes flash red as an urgency cue.
 */
function PromoCountdown({ endAt }: { endAt: string }) {
  const computeMs = () => new Date(endAt).getTime() - Date.now();
  const [msLeft, setMsLeft] = useState<number>(computeMs);

  useEffect(() => {
    // Re-sync immediately whenever `endAt` changes (e.g. plant extended the campaign).
    setMsLeft(computeMs());
    const id = setInterval(() => setMsLeft(computeMs()), 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endAt]);

  if (msLeft <= 0) return null;

  const totalMinutes = Math.floor(msLeft / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const isUrgent = msLeft <= 5 * 60_000;

  const label =
    hours > 0
      ? `ينتهي خلال ${hours} ساعة و ${minutes} دقيقة`
      : `ينتهي خلال ${minutes} دقيقة`;

  return (
    <View style={{ alignItems: 'center', marginTop: 8 }}>
      <Text
        style={{
          color: isUrgent ? '#ef4444' : '#64748b',
          fontSize: 12,
          fontWeight: isUrgent ? '900' : '700',
        }}
      >
        {label}
      </Text>
    </View>
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
