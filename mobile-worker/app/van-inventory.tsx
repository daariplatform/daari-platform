/**
 * Van tank inventory.
 *
 * Edit tanksFullOnVan / tanksEmptyOnVan with +/- steppers, then
 * POST /drivers/me/van-inventory { tanksFullOnVan, tanksEmptyOnVan }.
 * Current values come from GET /drivers/me (already returns them).
 *
 * Endpoint may 404 until backend deploys — the save mutation surfaces the
 * error inline and leaves the local edits intact so nothing is lost.
 */

import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useMyDriverProfile, useUpdateVanInventory } from '@/lib/queries';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Skeleton } from '@/components/Skeleton';
import { ErrorCard } from './cash';

export default function VanInventoryScreen() {
  const router = useRouter();
  const { data: driver, isLoading, isError, refetch } = useMyDriverProfile();
  const update = useUpdateVanInventory();

  const [full, setFull] = useState(0);
  const [empty, setEmpty] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // Seed local steppers from the server values once they arrive.
  useEffect(() => {
    if (driver && !hydrated) {
      setFull(driver.tanksFullOnVan ?? 0);
      setEmpty(driver.tanksEmptyOnVan ?? 0);
      setHydrated(true);
    }
  }, [driver, hydrated]);

  const dirty =
    hydrated &&
    (full !== (driver?.tanksFullOnVan ?? 0) ||
      empty !== (driver?.tanksEmptyOnVan ?? 0));

  async function save() {
    try {
      await update.mutateAsync({ tanksFullOnVan: full, tanksEmptyOnVan: empty });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('تم الحفظ ✓', 'حُدِّث جرد الشاحنة.');
      router.back();
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'تعذّر الحفظ',
        e?.response?.data?.message ?? 'حاول لاحقاً أو تواصل مع المعمل.',
      );
    }
  }

  return (
    <View className="flex-1 bg-slate-50">
      <LinearGradient
        colors={['#075985', '#0284c7', '#0ea5e9']}
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
              <Text className="text-white text-2xl font-bold">جرد الشاحنة</Text>
              <Text className="text-sky-100 text-xs mt-0.5">
                الخزانات المحمّلة الآن
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <>
            <Skeleton height={170} borderRadius={20} style={{ marginBottom: 12 }} />
            <Skeleton height={170} borderRadius={20} />
          </>
        ) : isError ? (
          <ErrorCard message="تعذّر جلب بيانات الشاحنة." onRetry={refetch} />
        ) : (
          <>
            {/* Total glance */}
            <Animated.View entering={FadeInDown.duration(450)}>
              <LinearGradient
                colors={['#0e7490', '#0891b2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 20,
                  padding: 16,
                  marginBottom: 14,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  shadowColor: '#0891b2',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.22,
                  shadowRadius: 12,
                  elevation: 5,
                }}
              >
                <View style={{ alignItems: 'flex-end' }}>
                  <Text className="text-cyan-100 text-xs font-bold">
                    إجمالي الخزانات على الشاحنة
                  </Text>
                  <AnimatedNumber
                    value={full + empty}
                    format={(n) => Math.round(n).toLocaleString('en-US')}
                    style={{ color: '#fff', fontWeight: '800', fontSize: 30, marginTop: 4 }}
                  />
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
                  <MaterialIcons name="local-shipping" size={30} color="#fff" />
                </View>
              </LinearGradient>
            </Animated.View>

            <Stepper
              delay={120}
              label="خزانات ممتلئة"
              hint="جاهزة للتسليم"
              icon="water-drop"
              grad={['#34d399', '#059669']}
              tint="#059669"
              value={full}
              onChange={setFull}
            />
            <Stepper
              delay={200}
              label="خزانات فارغة"
              hint="مسحوبة من الزبائن"
              icon="opacity"
              grad={['#94a3b8', '#475569']}
              tint="#475569"
              value={empty}
              onChange={setEmpty}
            />

            {/* Save */}
            <Animated.View entering={FadeInDown.delay(280).duration(450)}>
              <Pressable
                onPress={save}
                disabled={!dirty || update.isPending}
                style={{ borderRadius: 16, overflow: 'hidden', marginTop: 8 }}
              >
                <LinearGradient
                  colors={
                    !dirty || update.isPending
                      ? ['#cbd5e1', '#94a3b8']
                      : ['#0284c7', '#075985']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 16, alignItems: 'center' }}
                >
                  <View className="flex-row-reverse items-center gap-2">
                    <MaterialIcons name="save" size={20} color="#fff" />
                    <Text className="text-white font-bold text-base">
                      {update.isPending ? 'جارٍ الحفظ…' : 'احفظ الجرد'}
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>
              {!dirty && (
                <Text className="text-slate-400 text-[11px] text-center mt-3">
                  لا توجد تغييرات لحفظها
                </Text>
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stepper({
  label,
  hint,
  icon,
  grad,
  tint,
  value,
  onChange,
  delay,
}: {
  label: string;
  hint: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  grad: [string, string];
  tint: string;
  value: number;
  onChange: (n: number) => void;
  delay: number;
}) {
  // A tiny bounce on the number every time it changes.
  const bounce = useSharedValue(1);
  const numStyle = useAnimatedStyle(() => ({ transform: [{ scale: bounce.value }] }));

  function bump(delta: number) {
    const next = Math.max(0, value + delta);
    if (next === value) return;
    Haptics.selectionAsync().catch(() => {});
    bounce.value = withSequence(
      withTiming(1.18, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 140, easing: Easing.inOut(Easing.ease) }),
    );
    onChange(next);
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(450)}
      style={{
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className="flex-row-reverse items-center gap-3 mb-3">
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons name={icon} size={24} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text className="font-bold text-slate-900 text-base">{label}</Text>
          <Text className="text-[11px] text-slate-500 mt-0.5">{hint}</Text>
        </View>
      </View>

      <View className="flex-row-reverse items-center justify-between">
        <StepBtn icon="remove" tint={tint} onPress={() => bump(-1)} disabled={value <= 0} />
        <Animated.View style={numStyle}>
          <Text style={{ fontSize: 38, fontWeight: '800', color: '#0f172a' }}>
            {value.toLocaleString('en-US')}
          </Text>
        </Animated.View>
        <StepBtn icon="add" tint={tint} onPress={() => bump(1)} />
      </View>
    </Animated.View>
  );
}

function StepBtn({
  icon,
  tint,
  onPress,
  disabled,
}: {
  icon: 'add' | 'remove';
  tint: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: disabled ? '#f1f5f9' : `${tint}1A`,
        borderWidth: 1.5,
        borderColor: disabled ? '#e2e8f0' : `${tint}40`,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed && !disabled ? 0.92 : 1 }],
      })}
    >
      <MaterialIcons name={icon} size={28} color={disabled ? '#cbd5e1' : tint} />
    </Pressable>
  );
}
