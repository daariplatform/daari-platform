/**
 * Cash reconciliation / handover.
 *
 * The driver collects cash on every refill and hands it to the plant. This
 * screen shows today's collected / handed-over / pending totals as animated
 * gradient stat cards, a "سلّم النقد للمعمل" form, and the ledger of past
 * handovers with PENDING / CONFIRMED chips.
 *
 * Endpoints (may 404 until backend deploys — handled gracefully):
 *   GET  /drivers/me/cash-summary
 *   POST /drivers/me/cash-handover { amountIqd, note? }
 *   GET  /drivers/me/cash-handovers
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
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
import {
  useMyCashSummary,
  useMyCashHandovers,
  useCashHandover,
  type CashHandover,
} from '@/lib/queries';
import { iqd } from '@/lib/format';
import { fmtArabicDate } from '@/lib/format';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Skeleton } from '@/components/Skeleton';

export default function CashScreen() {
  const router = useRouter();
  const summary = useMyCashSummary();
  const handovers = useMyCashHandovers();
  const handover = useCashHandover();

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const pending = summary.data?.pendingIqd ?? 0;

  async function submit() {
    const amt = parseInt(amount, 10);
    if (!Number.isFinite(amt) || amt <= 0) {
      Alert.alert('قيمة غير صحيحة', 'أدخل مبلغاً صحيحاً أكبر من صفر.');
      return;
    }
    try {
      await handover.mutateAsync({ amountIqd: amt, note: note.trim() || undefined });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAmount('');
      setNote('');
      Alert.alert('تم ✓', 'سُجّل تسليم النقد. بانتظار تأكيد المعمل.');
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'تعذّر التسليم',
        e?.response?.data?.message ?? 'حاول لاحقاً أو تواصل مع المعمل.',
      );
    }
  }

  return (
    <View className="flex-1 bg-slate-50">
      {/* Gradient header */}
      <LinearGradient
        colors={['#0e7490', '#0891b2', '#06b6d4']}
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
              <Text className="text-white text-2xl font-bold">تسوية النقد</Text>
              <Text className="text-cyan-100 text-xs mt-0.5">
                ما حصّلته وما سلّمته اليوم
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 36 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={summary.isRefetching || handovers.isRefetching}
              onRefresh={() => {
                summary.refetch();
                handovers.refetch();
              }}
              tintColor="#0891b2"
            />
          }
        >
          {/* Stat cards */}
          {summary.isLoading ? (
            <View className="flex-row-reverse gap-2 mb-4">
              <Skeleton height={100} borderRadius={18} />
              <Skeleton height={100} borderRadius={18} />
            </View>
          ) : summary.isError ? (
            <ErrorCard
              message="تعذّر جلب ملخّص النقد."
              onRetry={() => summary.refetch()}
            />
          ) : summary.data ? (
            <>
              <Animated.View entering={FadeInDown.duration(450)}>
                <PendingHero amount={summary.data.pendingIqd} />
              </Animated.View>
              <View className="flex-row-reverse gap-2 mb-4">
                <StatCard
                  delay={120}
                  grad={['#34d399', '#059669']}
                  icon="account-balance-wallet"
                  label="حصّلته اليوم"
                  value={summary.data.collectedTodayIqd}
                />
                <StatCard
                  delay={200}
                  grad={['#60a5fa', '#2563eb']}
                  icon="upload"
                  label="سلّمته اليوم"
                  value={summary.data.handedOverTodayIqd}
                />
              </View>
            </>
          ) : null}

          {/* Handover form */}
          <Animated.View
            entering={FadeInDown.delay(260).duration(450)}
            style={{
              backgroundColor: '#fff',
              borderRadius: 18,
              padding: 16,
              marginBottom: 16,
              shadowColor: '#0f172a',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View className="flex-row-reverse items-center gap-2 mb-3">
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  backgroundColor: '#ecfeff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialIcons name="payments" size={20} color="#0891b2" />
              </View>
              <Text className="font-bold text-slate-900 text-base text-right flex-1">
                سلّم النقد للمعمل
              </Text>
            </View>

            <Text className="text-[11px] font-bold text-slate-600 mb-1 text-right">
              المبلغ المسلَّم (د.ع)
            </Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder={pending > 0 ? String(pending) : '0'}
              className="border border-slate-200 rounded-xl px-3 py-3 mb-2 text-right text-base"
            />
            {pending > 0 && (
              <Pressable
                onPress={() => setAmount(String(pending))}
                className="self-end mb-3"
              >
                <Text className="text-[11px] font-bold text-aqua-700">
                  تعبئة المبلغ المتبقّي ({iqd(pending)})
                </Text>
              </Pressable>
            )}

            <Text className="text-[11px] font-bold text-slate-600 mb-1 text-right">
              ملاحظة (اختياري)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="مثال: تسليم نهاية الوردية"
              className="border border-slate-200 rounded-xl px-3 py-3 mb-4 text-right"
            />

            <Pressable
              onPress={submit}
              disabled={handover.isPending || !amount}
              style={{ borderRadius: 14, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={
                  handover.isPending || !amount
                    ? ['#cbd5e1', '#94a3b8']
                    : ['#0891b2', '#0e7490']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 14, alignItems: 'center' }}
              >
                {handover.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View className="flex-row-reverse items-center gap-2">
                    <MaterialIcons name="check-circle" size={20} color="#fff" />
                    <Text className="text-white font-bold text-base">سلّم النقد</Text>
                  </View>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Past handovers */}
          <View className="flex-row-reverse items-center gap-1.5 mb-2 px-1">
            <MaterialIcons name="receipt-long" size={18} color="#0891b2" />
            <Text className="text-sm font-bold text-slate-700">سجل التسليمات</Text>
          </View>

          {handovers.isLoading ? (
            <>
              <Skeleton height={64} borderRadius={14} style={{ marginBottom: 8 }} />
              <Skeleton height={64} borderRadius={14} style={{ marginBottom: 8 }} />
            </>
          ) : handovers.isError ? (
            <ErrorCard
              message="تعذّر جلب سجل التسليمات."
              onRetry={() => handovers.refetch()}
            />
          ) : (handovers.data?.length ?? 0) === 0 ? (
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                paddingVertical: 28,
                alignItems: 'center',
              }}
            >
              <MaterialIcons name="inbox" size={40} color="#cbd5e1" />
              <Text className="text-slate-500 text-sm mt-2">لا توجد تسليمات بعد</Text>
            </View>
          ) : (
            handovers.data!.map((h, i) => <HandoverRow key={h.id} h={h} index={i} />)
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Big "pending to hand over" hero with a looping pulse on the amount. */
function PendingHero({ amount }: { amount: number }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.04, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const settled = amount <= 0;

  return (
    <LinearGradient
      colors={settled ? ['#10b981', '#059669'] : ['#f59e0b', '#d97706']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 20,
        padding: 18,
        marginBottom: 12,
        shadowColor: settled ? '#059669' : '#d97706',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
        elevation: 6,
      }}
    >
      <View className="flex-row-reverse items-center justify-between">
        <View style={{ alignItems: 'flex-end' }}>
          <Text className="text-white/90 text-xs font-bold">
            {settled ? 'لا يوجد نقد بانتظار التسليم' : 'نقد بانتظار التسليم'}
          </Text>
          <Animated.View style={style}>
            <AnimatedNumber
              value={amount}
              format={(n) => iqd(Math.round(n))}
              style={{ color: '#fff', fontWeight: '800', fontSize: 30, marginTop: 4 }}
            />
          </Animated.View>
        </View>
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.22)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons
            name={settled ? 'verified' : 'savings'}
            size={30}
            color="#fff"
          />
        </View>
      </View>
    </LinearGradient>
  );
}

function StatCard({
  grad,
  icon,
  label,
  value,
  delay,
}: {
  grad: [string, string];
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  value: number;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(450)} style={{ flex: 1 }}>
      <LinearGradient
        colors={grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 18,
          padding: 14,
          alignItems: 'flex-end',
          shadowColor: grad[1],
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 10,
          elevation: 4,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.25)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <MaterialIcons name={icon} size={18} color="#fff" />
        </View>
        <Text className="text-white/90 text-[11px] text-right">{label}</Text>
        <AnimatedNumber
          value={value}
          format={(n) => iqd(Math.round(n))}
          style={{ color: '#fff', fontWeight: '800', fontSize: 16, marginTop: 2 }}
        />
      </LinearGradient>
    </Animated.View>
  );
}

function HandoverRow({ h, index }: { h: CashHandover; index: number }) {
  const confirmed = h.status === 'CONFIRMED';
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(400)}
      style={{
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 8,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: confirmed ? '#d1fae5' : '#fef3c7',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons
          name={confirmed ? 'check-circle' : 'schedule'}
          size={22}
          color={confirmed ? '#059669' : '#d97706'}
        />
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text className="font-bold text-slate-900 text-[15px]">{iqd(h.amountIqd)}</Text>
        <Text className="text-[11px] text-slate-500 mt-0.5">
          {h.note ? h.note + ' · ' : ''}
          {fmtArabicDate(h.createdAt)}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: confirmed ? '#d1fae5' : '#fef3c7',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
        }}
      >
        <Text
          style={{
            color: confirmed ? '#047857' : '#b45309',
            fontSize: 11,
            fontWeight: '800',
          }}
        >
          {confirmed ? 'مؤكَّد' : 'بالانتظار'}
        </Text>
      </View>
    </Animated.View>
  );
}

/** Inline error card with a retry button — used wherever an endpoint 404s. */
export function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 18,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#fee2e2',
      }}
    >
      <MaterialIcons name="cloud-off" size={36} color="#f87171" />
      <Text className="text-slate-700 text-sm font-bold mt-2 text-center">{message}</Text>
      <Pressable
        onPress={onRetry}
        className="mt-3 bg-slate-100 rounded-xl px-5 py-2 flex-row-reverse items-center gap-1.5"
      >
        <MaterialIcons name="refresh" size={16} color="#0891b2" />
        <Text className="text-slate-700 font-bold text-xs">إعادة المحاولة</Text>
      </Pressable>
    </View>
  );
}
