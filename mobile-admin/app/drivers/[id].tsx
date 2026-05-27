import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Linking,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  useDriversAdmin,
  useDriverPerf,
  useUpdateDriver,
  type DriverRow,
} from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { safeBack } from '@/lib/nav';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];
type Period = 'week' | 'month';

function n(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('en-US');
}

/**
 * Driver detail — profile + performance window (week/month) + edit/disable.
 *
 * We don't have a dedicated /drivers/:id endpoint in the contract, so the
 * profile data is sourced from the list cache: useDriversAdmin returns
 * the same set the previous screen rendered, and we find the matching
 * row. If the user deep-linked into this route before opening the list,
 * we still fire the list query to populate the cache.
 */
export default function DriverDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const driversQuery = useDriversAdmin({ page: 1, pageSize: 100 });
  const driver = useMemo(
    () => driversQuery.data?.items.find((d) => d.id === id),
    [driversQuery.data, id],
  );
  const [period, setPeriod] = useState<Period>('week');
  const perf = useDriverPerf(id, period);
  const [editOpen, setEditOpen] = useState(false);
  const update = useUpdateDriver();

  async function onDisable() {
    if (!driver) return;
    Alert.alert(
      'تعطيل السائق',
      `سيتم تعطيل ${driver.fullName} ولن يستلم طلبات جديدة. هل أنت متأكد؟`,
      [
        { text: 'تراجع', style: 'cancel' },
        {
          text: 'تعطيل',
          style: 'destructive',
          onPress: async () => {
            try {
              await update.mutateAsync({ driverId: driver.id, status: 'DISABLED' });
              Alert.alert('تم', 'عُطّل السائق');
              safeBack(router);
            } catch (err: any) {
              Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر التعطيل');
            }
          },
        },
      ],
    );
  }

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
          <Text
            style={{
              fontSize: 17,
              fontWeight: '900',
              color: '#0f172a',
              flex: 1,
              textAlign: 'right',
            }}
            numberOfLines={1}
          >
            {driver?.fullName ?? 'السائق'}
          </Text>
          <Pressable
            onPress={() => safeBack(router)}
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
      </SafeAreaView>

      {driversQuery.isLoading && !driver && (
        <View style={{ padding: 14 }}>
          <Skeleton height={140} borderRadius={22} style={{ marginBottom: 12 }} />
          <Skeleton height={90} borderRadius={18} style={{ marginBottom: 10 }} />
          <Skeleton height={110} borderRadius={18} />
        </View>
      )}

      {!driversQuery.isLoading && !driver && (
        <EmptyState
          icon="person-off"
          title="لم يُعثر على السائق"
          subtitle="ربما حُذف من القائمة. حاول العودة وتحديثها."
          actionLabel="رجوع"
          onAction={() => safeBack(router)}
        />
      )}

      {driver && (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          <ProfileCard driver={driver} />

          <PeriodToggle value={period} onChange={setPeriod} />

          <StatsGrid perf={perf.data} loading={perf.isLoading} />

          <Pressable
            onPress={() => setEditOpen(true)}
            style={({ pressed }) => ({
              backgroundColor: '#fff',
              borderRadius: 18,
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 10,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <MaterialIcons name="edit" size={20} color="#0e9384" />
            <Text style={{ color: '#0e9384', fontWeight: '800', fontSize: 13 }}>
              تعديل البيانات
            </Text>
          </Pressable>

          <Pressable
            onPress={onDisable}
            disabled={update.isPending}
            style={({ pressed }) => ({
              backgroundColor: '#fff',
              borderRadius: 18,
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: '#fecaca',
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: pressed || update.isPending ? 0.85 : 1,
            })}
          >
            <MaterialIcons name="block" size={20} color="#dc2626" />
            <Text style={{ color: '#991b1b', fontWeight: '800', fontSize: 13 }}>
              تعطيل السائق
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {driver && (
        <EditDriverModal
          visible={editOpen}
          driver={driver}
          onClose={() => setEditOpen(false)}
        />
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Profile card
// ────────────────────────────────────────────────────────────────────

function ProfileCard({ driver }: { driver: DriverRow }) {
  const initial = (driver.fullName ?? '?').trim().charAt(0) || '؟';
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <View style={{ position: 'relative' }}>
          <LinearGradient
            colors={['#14b8a6', '#0e9384']}
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26 }}>
              {initial}
            </Text>
          </LinearGradient>
          {driver.isOnline && (
            <View
              style={{
                position: 'absolute',
                bottom: -2,
                left: -2,
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: '#10b981',
                borderWidth: 2,
                borderColor: '#fff',
              }}
            />
          )}
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>
            {driver.fullName}
          </Text>
          <View
            style={{
              backgroundColor: driver.isOnline ? '#d1fae5' : '#f1f5f9',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              marginTop: 4,
            }}
          >
            <Text
              style={{
                color: driver.isOnline ? '#065f46' : '#475569',
                fontWeight: '800',
                fontSize: 10,
              }}
            >
              {driver.isOnline ? 'متصل الآن' : 'غير متصل'}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 14 }}>
        <InfoRow
          label="الهاتف"
          value={driver.phone}
          action={
            <Pressable
              onPress={() => Linking.openURL(`tel:${driver.phone}`)}
              hitSlop={8}
              style={({ pressed }) => ({
                backgroundColor: '#ccfbf1',
                padding: 8,
                borderRadius: 12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <MaterialIcons name="call" size={18} color="#0e9384" />
            </Pressable>
          }
        />
        <InfoRow label="الحالة" value={driver.status || '—'} />
        <InfoRow
          label="آخر موقع"
          value={
            driver.lastLocationAt
              ? new Date(driver.lastLocationAt).toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'
          }
        />
      </View>
    </View>
  );
}

function PeriodToggle({
  value,
  onChange,
}: {
  value: Period;
  onChange: (v: Period) => void;
}) {
  const opts: { key: Period; label: string }[] = [
    { key: 'week', label: 'هذا الأسبوع' },
    { key: 'month', label: 'هذا الشهر' },
  ];
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        gap: 8,
        marginBottom: 10,
      }}
    >
      {opts.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: active ? '#0e9384' : '#fff',
              borderWidth: 1,
              borderColor: active ? '#0e9384' : '#e2e8f0',
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: active ? '#fff' : '#475569',
                fontWeight: active ? '800' : '600',
                fontSize: 12,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StatsGrid({
  perf,
  loading,
}: {
  perf: { completedOrders: number; revenue: number; bonus: number; avgCompletionMin: number } | undefined;
  loading: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <StatTile
          icon="check-circle"
          label="طلبات مكتملة"
          value={n(perf?.completedOrders)}
          tint="#10b981"
          loading={loading}
        />
        <StatTile
          icon="trending-up"
          label="إيرادات"
          value={n(perf?.revenue)}
          suffix="د.ع"
          tint="#0e9384"
          loading={loading}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile
          icon="card-giftcard"
          label="مكافآت"
          value={n(perf?.bonus)}
          suffix="د.ع"
          tint="#f59e0b"
          loading={loading}
        />
        <StatTile
          icon="schedule"
          label="متوسط الإنجاز"
          value={n(perf?.avgCompletionMin)}
          suffix="دقيقة"
          tint="#6366f1"
          loading={loading}
        />
      </View>
    </View>
  );
}

function StatTile({
  icon,
  label,
  value,
  suffix,
  tint,
  loading,
}: {
  icon: MaterialIconName;
  label: string;
  value: string;
  suffix?: string;
  tint: string;
  loading?: boolean;
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
          width: 30,
          height: 30,
          borderRadius: 10,
          backgroundColor: tint + '18',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-end',
        }}
      >
        <MaterialIcons name={icon} size={16} color={tint} />
      </View>
      <Text
        style={{
          fontSize: 10,
          color: '#64748b',
          fontWeight: '700',
          marginTop: 8,
          textAlign: 'right',
        }}
      >
        {label}
      </Text>
      {loading ? (
        <Skeleton width={'70%'} height={20} style={{ marginTop: 6 }} />
      ) : (
        <Text
          style={{
            fontSize: 18,
            fontWeight: '900',
            color: '#0f172a',
            textAlign: 'right',
            marginTop: 4,
          }}
        >
          {value}
          {suffix && (
            <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '700' }}>
              {' '}
              {suffix}
            </Text>
          )}
        </Text>
      )}
    </View>
  );
}

function InfoRow({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
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
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
          flex: 1,
          justifyContent: 'flex-start',
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: '#0f172a',
            textAlign: 'left',
          }}
          numberOfLines={2}
        >
          {value}
        </Text>
        {action}
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Edit modal
// ────────────────────────────────────────────────────────────────────

function EditDriverModal({
  visible,
  driver,
  onClose,
}: {
  visible: boolean;
  driver: DriverRow;
  onClose: () => void;
}) {
  const update = useUpdateDriver();
  const [salary, setSalary] = useState('');
  const [commission, setCommission] = useState('');

  async function submit() {
    const patch: { salaryIqd?: number; baseCommissionPct?: number } = {};
    if (salary.trim()) {
      const v = parseInt(salary, 10);
      if (!Number.isFinite(v) || v < 0) {
        Alert.alert('تحقّق', 'الراتب غير صالح');
        return;
      }
      patch.salaryIqd = v;
    }
    if (commission.trim()) {
      const v = parseFloat(commission);
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        Alert.alert('تحقّق', 'العمولة يجب أن تكون بين 0 و 100');
        return;
      }
      patch.baseCommissionPct = v;
    }
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    try {
      await update.mutateAsync({ driverId: driver.id, ...patch });
      onClose();
      setSalary('');
      setCommission('');
      Alert.alert('تم', 'حُفظت التعديلات');
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر الحفظ');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(15,23,42,0.55)',
          justifyContent: 'flex-end',
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          <SafeAreaView edges={['bottom']}>
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 14,
                paddingTop: 14,
                paddingBottom: 6,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>
                تعديل {driver.fullName}
              </Text>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={({ pressed }) => ({
                  padding: 8,
                  borderRadius: 12,
                  backgroundColor: '#f1f5f9',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <MaterialIcons name="close" size={22} color="#0f172a" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 14 }}>
              <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 12, textAlign: 'right' }}>
                اترك الحقل فارغاً للإبقاء على القيمة الحالية.
              </Text>

              <Field
                label="الراتب الشهري (د.ع)"
                value={salary}
                onChangeText={setSalary}
                placeholder="500000"
                icon="payments"
                keyboardType="number-pad"
              />
              <Field
                label="نسبة العمولة (%)"
                value={commission}
                onChangeText={setCommission}
                placeholder="10"
                icon="percent"
                keyboardType="number-pad"
              />

              <Pressable
                onPress={submit}
                disabled={update.isPending}
                style={({ pressed }) => ({
                  borderRadius: 18,
                  overflow: 'hidden',
                  opacity: pressed || update.isPending ? 0.85 : 1,
                  marginTop: 4,
                })}
              >
                <LinearGradient
                  colors={['#14b8a6', '#0e9384']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingVertical: 14,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {update.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="check" size={20} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                        حفظ التعديلات
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  icon: MaterialIconName;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: '#475569',
          textAlign: 'right',
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#e2e8f0',
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <MaterialIcons name={icon} size={20} color="#0e9384" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType={keyboardType ?? 'default'}
          style={{
            flex: 1,
            fontSize: 14,
            color: '#0f172a',
            textAlign: 'right',
            paddingVertical: 4,
          }}
        />
      </View>
    </View>
  );
}
