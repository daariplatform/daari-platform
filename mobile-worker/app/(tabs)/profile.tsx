import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-store';
import { api } from '@/lib/api';
import { stopShiftTracking } from '@/lib/location';
import {
  useMyDriverProfile,
  useMyPerf,
  useChangePassword,
} from '@/lib/queries';
import { iqd } from '@/lib/format';
import { Skeleton } from '@/components/Skeleton';

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { data: driver, isLoading: driverLoading } = useMyDriverProfile();
  const { data: perf, isLoading: perfLoading } = useMyPerf('month');
  const [period, setPeriod] = useState<'week' | 'month'>('month');
  // Period-aware refetch — when the user taps "هذا الأسبوع" we want the
  // tile values to reflect the 7-day window, not just relabel the chip.
  const { data: perfPeriod } = useMyPerf(period);
  const [pwOpen, setPwOpen] = useState(false);

  return (
    <View className="flex-1 bg-slate-50">
      {/* Sky gradient header */}
      <LinearGradient
        colors={['#38bdf8', '#0ea5e9', '#0284c7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          paddingBottom: 24,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <SafeAreaView edges={['top']}>
          <View className="px-4 pt-2 items-center">
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                backgroundColor: 'rgba(255,255,255,0.22)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.35)',
              }}
            >
              <MaterialIcons name="local-shipping" size={48} color="#fff" />
            </View>
            <Text className="text-white font-bold text-lg mt-3">
              {perf?.fullName || user?.phone || 'مستخدم'}
            </Text>
            <View className="bg-white/22 px-3 py-1 rounded-full mt-2 flex-row-reverse items-center gap-1">
              <Text className="text-white text-[11px] font-bold">سائق معمل</Text>
              {driver?.vehiclePlate && (
                <>
                  <Text className="text-sky-100">·</Text>
                  <Text className="text-white text-[11px] font-bold">
                    {driver.vehiclePlate}
                  </Text>
                </>
              )}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: 32,
          paddingTop: 14,
          paddingHorizontal: 12,
        }}
      >
        {/* Period switcher — week / month for perf tiles */}
        <View className="flex-row-reverse gap-2 mb-3">
          {(['week', 'month'] as const).map((p) => {
            const active = period === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                className={`flex-1 rounded-xl py-2 ${
                  active ? 'bg-aqua-600' : 'bg-white border border-slate-200'
                }`}
              >
                <Text
                  className={`text-center text-[12px] font-bold ${
                    active ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  {p === 'week' ? 'هذا الأسبوع' : 'هذا الشهر'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Perf tiles — completed orders + bonus IQD */}
        {perfLoading ? (
          <View className="flex-row-reverse gap-2 mb-3">
            <Skeleton height={84} borderRadius={14} />
            <Skeleton height={84} borderRadius={14} />
          </View>
        ) : perfPeriod ? (
          <View className="flex-row-reverse gap-2 mb-3">
            <PerfTile
              label="مهام مكتملة"
              value={perfPeriod.completedOrders.toLocaleString('ar-IQ')}
              icon="check-circle"
              color="#0284c7"
              bg="#e0f2fe"
            />
            <PerfTile
              label="بونص + عمولات"
              value={iqd(perfPeriod.bonusIqd ?? 0)}
              icon="payments"
              color="#059669"
              bg="#d1fae5"
            />
          </View>
        ) : null}

        {/* Driver compensation card — base + commission per refill.
            Audit finding: drivers had no way to see what they earn per
            refill; the figure lives in the Driver table but was never
            surfaced. Showing it builds trust + reduces "is the boss
            cheating me?" disputes. */}
        {driverLoading ? (
          <Skeleton height={92} borderRadius={14} />
        ) : driver ? (
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 14,
              padding: 12,
              marginBottom: 12,
              shadowColor: '#0f172a',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <Text className="text-[11px] text-slate-500 mb-1 text-right">
              تعويضاتك المعتمدة (من قِبَل المعمل)
            </Text>
            <View className="flex-row-reverse items-center justify-between">
              <Text className="text-[11px] text-slate-600">الراتب الأساسي</Text>
              <Text className="font-bold text-[13px]">
                {driver.baseSalaryIqd ? iqd(driver.baseSalaryIqd) : '—'}
              </Text>
            </View>
            <View className="flex-row-reverse items-center justify-between mt-1">
              <Text className="text-[11px] text-slate-600">عمولة كل تعبئة</Text>
              <Text className="font-bold text-[13px] text-emerald-700">
                {driver.commissionPerRefillIqd
                  ? iqd(driver.commissionPerRefillIqd)
                  : '—'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Driver self-service shortcuts — cash reconciliation, earnings,
            shift summary, and van inventory. These were previously only
            reachable from home; surfacing them here too matches how drivers
            think of "my account / my money / my van". */}
        <ActionRow
          icon="payments"
          iconBg="#cffafe"
          iconFg="#0891b2"
          label="تسوية النقد وتسليمه"
          color="#0f172a"
          onPress={() => router.push('/cash' as any)}
        />

        <ActionRow
          icon="show-chart"
          iconBg="#d1fae5"
          iconFg="#059669"
          label="أرباحي عبر الوقت"
          color="#0f172a"
          onPress={() => router.push('/earnings' as any)}
        />

        <ActionRow
          icon="emoji-events"
          iconBg="#dbeafe"
          iconFg="#1d4ed8"
          label="ملخّص الوردية وإنهاؤها"
          color="#0f172a"
          onPress={() => router.push('/shift-summary' as any)}
        />

        <ActionRow
          icon="local-shipping"
          iconBg="#e0f2fe"
          iconFg="#0284c7"
          label="جرد خزانات الشاحنة"
          color="#0f172a"
          onPress={() => router.push('/van-inventory' as any)}
        />

        <ActionRow
          icon="lock"
          iconBg="#e0e7ff"
          iconFg="#4338ca"
          label="تغيير كلمة المرور"
          color="#0f172a"
          onPress={() => setPwOpen(true)}
        />

        <ActionRow
          icon="logout"
          iconBg="#fef2f2"
          iconFg="#dc2626"
          label="تسجيل خروج"
          color="#dc2626"
          onPress={async () => {
            await stopShiftTracking();
            await logout();
            router.replace('/(auth)/driver-login');
          }}
        />

        {/* In-app account deletion — required by Apple (5.1.1(v)) and Google
            for any account-based app. Backend DELETE /auth/me anonymizes the
            account (scrubs PII, returns tanks, cancels in-flight orders) and
            keeps historical accounting rows intact. */}
        <ActionRow
          icon="delete-forever"
          iconBg="#fef2f2"
          iconFg="#b91c1c"
          label="حذف الحساب نهائياً"
          color="#b91c1c"
          onPress={() => {
            Alert.alert(
              'حذف الحساب',
              'سيتم حذف بياناتك الشخصية نهائياً وإيقاف دخولك. تبقى سجلات تعبئاتك المكتملة في حسابات المعمل. لا يمكن التراجع.',
              [
                { text: 'إلغاء', style: 'cancel' },
                {
                  text: 'تأكيد الحذف',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await api.delete('/auth/me');
                      await stopShiftTracking();
                      await logout();
                      router.replace('/(auth)/driver-login');
                      Alert.alert('تم الحذف', 'تم حذف حسابك. للعودة للعمل تواصل مع المعمل.');
                    } catch (e: any) {
                      Alert.alert(
                        'تعذّر الحذف',
                        e?.response?.data?.message ?? 'حاول لاحقاً أو تواصل مع المعمل.',
                      );
                    }
                  },
                },
              ],
            );
          }}
        />

        <Pressable
          onPress={() =>
            Alert.alert(
              'سياسة الخصوصية',
              'موقعك يُسجَّل فقط أثناء وردية العمل لتأكيد التعبئات. لا نشاركه مع أي طرف خارجي.',
            )
          }
          className="mt-6"
        >
          <Text className="text-slate-400 text-[11px] text-center underline">
            سياسة الخصوصية والشروط
          </Text>
        </Pressable>
      </ScrollView>

      <ChangePasswordModal visible={pwOpen} onClose={() => setPwOpen(false)} />
    </View>
  );
}

function PerfTile({
  label,
  value,
  icon,
  color,
  bg,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
  bg: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 12,
        alignItems: 'flex-end',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
        }}
      >
        <MaterialIcons name={icon} size={18} color={color} />
      </View>
      <Text className="text-[11px] text-slate-500 text-right">{label}</Text>
      <Text className="font-bold text-[15px] text-slate-900 mt-0.5 text-right">
        {value}
      </Text>
    </View>
  );
}

/**
 * Change-password modal — backend `/auth/change-password` requires the
 * current password, hashes the new one with argon2 (see common/crypto.ts),
 * and revokes any other active sessions. We show inline error states for
 * the most common failures (wrong current password, mismatched confirm).
 */
function ChangePasswordModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const change = useChangePassword();

  function reset() {
    setCurrent('');
    setNext('');
    setConfirm('');
  }

  async function submit() {
    if (next.length < 6) {
      Alert.alert('كلمة مرور قصيرة', 'الحد الأدنى 6 أحرف.');
      return;
    }
    if (next !== confirm) {
      Alert.alert('غير متطابقة', 'كلمة المرور الجديدة وتأكيدها غير متطابقتين.');
      return;
    }
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      reset();
      onClose();
      Alert.alert('تم ✓', 'تم تغيير كلمة المرور بنجاح. سجّل دخول مرة ثانية في الأجهزة الأخرى.');
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ?? 'تعذّر تغيير كلمة المرور. حاول لاحقاً.';
      Alert.alert('خطأ', typeof msg === 'string' ? msg : 'فشل غير معروف');
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 18,
            }}
          >
            <Text className="font-bold text-lg text-right mb-3">
              تغيير كلمة المرور
            </Text>
            <Text className="text-[11px] text-slate-600 mb-3 text-right">
              ستحتاج لإعادة تسجيل الدخول في الأجهزة الأخرى.
            </Text>

            <Text className="text-[11px] font-bold text-slate-600 mb-1 text-right">
              كلمة المرور الحالية
            </Text>
            <TextInput
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              autoCapitalize="none"
              className="border border-slate-200 rounded-xl px-3 py-3 mb-3 text-right"
              placeholder="••••••"
            />

            <Text className="text-[11px] font-bold text-slate-600 mb-1 text-right">
              كلمة المرور الجديدة (6 أحرف على الأقل)
            </Text>
            <TextInput
              value={next}
              onChangeText={setNext}
              secureTextEntry
              autoCapitalize="none"
              className="border border-slate-200 rounded-xl px-3 py-3 mb-3 text-right"
              placeholder="••••••"
            />

            <Text className="text-[11px] font-bold text-slate-600 mb-1 text-right">
              تأكيد كلمة المرور الجديدة
            </Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              className="border border-slate-200 rounded-xl px-3 py-3 mb-4 text-right"
              placeholder="••••••"
            />

            <View className="flex-row-reverse gap-2">
              <Pressable
                onPress={() => {
                  reset();
                  onClose();
                }}
                disabled={change.isPending}
                className="flex-1 bg-slate-100 rounded-xl py-3"
              >
                <Text className="text-slate-700 font-bold text-center">إلغاء</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={change.isPending || !current || !next || !confirm}
                className={`flex-1 rounded-xl py-3 ${
                  change.isPending || !current || !next || !confirm
                    ? 'bg-slate-300'
                    : 'bg-aqua-600'
                }`}
              >
                {change.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-center">احفظ</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Single profile row — consistent styling matching customer app's profile.
 */
function ActionRow({
  icon,
  iconBg,
  iconFg,
  label,
  color,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  iconBg: string;
  iconFg: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 14,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 10,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
        marginBottom: 12,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name={icon} size={20} color={iconFg} />
      </View>
      <Text style={{ flex: 1, color, fontWeight: '700', fontSize: 13, textAlign: 'right' }}>
        {label}
      </Text>
      <MaterialIcons name="chevron-left" size={22} color="#94a3b8" />
    </Pressable>
  );
}
