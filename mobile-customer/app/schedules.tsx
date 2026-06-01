/**
 * Scheduled / recurring auto-refill.
 *
 * Reached from: profile → "التعبئة التلقائية".
 * Create a recurring auto-order (cadence + next date + optional saved
 * address), list existing ones, toggle active, and delete.
 *
 * Date picking is dependency-free: the cadence determines a default next
 * date (today + cadence days) and the customer can nudge it ±1 day.
 */
import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { hap } from '@/lib/haptics';
import { fmtArabicDate } from '@/lib/format';
import {
  useMySchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  CADENCE_META,
  type Cadence,
} from '@/lib/features/schedules';
import { useMyAddresses, ADDRESS_LABEL_META } from '@/lib/features/addresses';
import { SkeletonCard } from '@/components/Skeleton';

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0); // default morning slot
  return d;
}

export default function SchedulesScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useMySchedules();
  const { data: addresses } = useMyAddresses();

  const createMut = useCreateSchedule();
  const updateMut = useUpdateSchedule();
  const deleteMut = useDeleteSchedule();

  const [modalOpen, setModalOpen] = useState(false);
  const [cadence, setCadence] = useState<Cadence>('MONTHLY');
  const [nextDate, setNextDate] = useState<Date>(addDays(CADENCE_META.MONTHLY.days));
  const [addressId, setAddressId] = useState<string | null>(null);

  function openCreate() {
    hap.tap();
    setCadence('MONTHLY');
    setNextDate(addDays(CADENCE_META.MONTHLY.days));
    setAddressId(addresses?.find((a) => a.isDefault)?.id ?? null);
    setModalOpen(true);
  }

  function pickCadence(c: Cadence) {
    hap.tap();
    setCadence(c);
    setNextDate(addDays(CADENCE_META[c].days));
  }

  function nudgeDate(delta: number) {
    hap.tap();
    setNextDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      // Don't allow a next date in the past.
      if (d.getTime() < Date.now()) return prev;
      return d;
    });
  }

  async function save() {
    try {
      await createMut.mutateAsync({
        cadence,
        nextRunAt: nextDate.toISOString(),
        addressId: addressId ?? undefined,
      });
      hap.success();
      setModalOpen(false);
    } catch (err: any) {
      hap.error();
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر إنشاء الجدولة. حاول لاحقاً.');
    }
  }

  async function toggle(id: string, active: boolean) {
    hap.tap();
    try {
      await updateMut.mutateAsync({ id, active });
    } catch {
      Alert.alert('خطأ', 'تعذّر تحديث الجدولة.');
    }
  }

  function confirmDelete(id: string) {
    Alert.alert('حذف الجدولة', 'إيقاف التعبئة التلقائية وحذفها؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMut.mutateAsync(id);
            hap.success();
          } catch {
            Alert.alert('خطأ', 'تعذّر الحذف.');
          }
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-slate-50">
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
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
            <View style={{ alignItems: 'flex-end' }}>
              <Text className="text-white text-2xl font-bold">التعبئة التلقائية</Text>
              <Text className="text-cyan-100 text-xs mt-0.5">لا تنسَ ماءك أبداً</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Explainer banner */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
          style={{
            backgroundColor: '#ecfeff',
            borderColor: '#a5f3fc',
            borderWidth: 1,
            borderRadius: 16,
            padding: 14,
            marginBottom: 14,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Ionicons name="sync-circle" size={26} color="#0891b2" />
          <Text style={{ flex: 1, textAlign: 'right', color: '#0e7490', fontSize: 12, lineHeight: 18 }}>
            نُرسل لك طلب تعبئة تلقائياً حسب الجدولة — يصلك السائق دون أن تطلب يدوياً.
          </Text>
        </MotiView>

        {isLoading ? (
          <>
            <SkeletonCard height={104} />
            <SkeletonCard height={104} />
          </>
        ) : isError ? (
          <ErrorRetry onRetry={refetch} />
        ) : !data || data.length === 0 ? (
          <EmptySchedules onAdd={openCreate} />
        ) : (
          data.map((s, idx) => {
            const meta = CADENCE_META[s.cadence];
            const addr = addresses?.find((a) => a.id === s.addressId);
            return (
              <MotiView
                key={s.id}
                from={{ opacity: 0, translateY: 16, scale: 0.97 }}
                animate={{ opacity: 1, translateY: 0, scale: 1 }}
                transition={{ type: 'spring', delay: idx * 60, damping: 16 }}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 18,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: s.active ? '#a5f3fc66' : '#f1f5f9',
                  shadowColor: '#0f172a',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  opacity: s.active ? 1 : 0.7,
                }}
              >
                <View className="flex-row-reverse items-start">
                  <LinearGradient
                    colors={s.active ? ['#22d3ee', '#0891b2'] : ['#cbd5e1', '#94a3b8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}
                  >
                    <Ionicons name="repeat" size={22} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text className="text-sm font-bold text-slate-900 text-right">{meta.text}</Text>
                    <Text className="text-xs text-slate-500 text-right mt-1">
                      التعبئة القادمة: {fmtArabicDate(s.nextRunAt)}
                    </Text>
                    {addr && (
                      <View className="flex-row-reverse items-center gap-1 mt-1">
                        <Ionicons name={ADDRESS_LABEL_META[addr.label]?.icon ?? 'location'} size={12} color="#0891b2" />
                        <Text style={{ color: '#0891b2', fontSize: 10 }}>{addr.title}</Text>
                      </View>
                    )}
                  </View>
                  <Switch
                    value={s.active}
                    onValueChange={(v) => toggle(s.id, v)}
                    trackColor={{ false: '#e2e8f0', true: '#67e8f9' }}
                    thumbColor={s.active ? '#0891b2' : '#f1f5f9'}
                  />
                </View>
                <Pressable
                  onPress={() => confirmDelete(s.id)}
                  className="flex-row-reverse items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 self-end"
                >
                  <Ionicons name="trash-outline" size={14} color="#dc2626" />
                  <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '700' }}>حذف الجدولة</Text>
                </Pressable>
              </MotiView>
            );
          })
        )}
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 28, left: 20, right: 20 }}>
        <Pressable onPress={openCreate}>
          <LinearGradient
            colors={['#06b6d4', '#0891b2', '#0e7490']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 16, borderRadius: 18, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#0891b2', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 }}
          >
            <Ionicons name="add-circle" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>تعبئة تلقائية جديدة</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Create modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setModalOpen(false)} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34 }}>
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: '#e2e8f0' }} />
            </View>
            <Text className="text-lg font-bold text-right mb-4">تعبئة تلقائية</Text>

            <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'right', marginBottom: 8 }}>كل متى؟</Text>
            <View className="flex-row-reverse gap-2 mb-4">
              {(['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as Cadence[]).map((c) => {
                const active = cadence === c;
                return (
                  <Pressable key={c} onPress={() => pickCadence(c)} style={{ flex: 1 }}>
                    {active ? (
                      <LinearGradient colors={['#22d3ee', '#0891b2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{CADENCE_META[c].text}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: '#f1f5f9' }}>
                        <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '700' }}>{CADENCE_META[c].text}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'right', marginBottom: 8 }}>تاريخ أول تعبئة</Text>
            <View className="flex-row-reverse items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl px-3 py-3 mb-4">
              <Pressable onPress={() => nudgeDate(-1)} hitSlop={8} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
                <Ionicons name="remove" size={20} color="#0891b2" />
              </Pressable>
              <View style={{ alignItems: 'center' }}>
                <Ionicons name="calendar" size={18} color="#0891b2" />
                <Text style={{ fontWeight: '800', color: '#0f172a', marginTop: 2 }}>{fmtArabicDate(nextDate)}</Text>
              </View>
              <Pressable onPress={() => nudgeDate(1)} hitSlop={8} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
                <Ionicons name="add" size={20} color="#0891b2" />
              </Pressable>
            </View>

            {/* Optional address picker */}
            {addresses && addresses.length > 0 && (
              <>
                <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'right', marginBottom: 8 }}>عنوان التوصيل (اختياري)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                  <View className="flex-row-reverse gap-2">
                    <Pressable onPress={() => { hap.tap(); setAddressId(null); }}>
                      <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: addressId === null ? '#0891b2' : '#f1f5f9' }}>
                        <Text style={{ color: addressId === null ? '#fff' : '#64748b', fontSize: 12, fontWeight: '700' }}>الافتراضي</Text>
                      </View>
                    </Pressable>
                    {addresses.map((a) => {
                      const active = addressId === a.id;
                      return (
                        <Pressable key={a.id} onPress={() => { hap.tap(); setAddressId(a.id); }}>
                          <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: active ? '#0891b2' : '#f1f5f9' }}>
                            <Text style={{ color: active ? '#fff' : '#64748b', fontSize: 12, fontWeight: '700' }}>{a.title}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            )}

            <Pressable onPress={save} disabled={createMut.isPending} style={{ marginTop: 14 }}>
              <LinearGradient colors={['#06b6d4', '#0891b2', '#0e7490']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 15, borderRadius: 16, alignItems: 'center' }}>
                {createMut.isPending ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>تفعيل التعبئة التلقائية</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function EmptySchedules({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 50 }}>
      <MotiView from={{ scale: 0.9, opacity: 0.7 }} animate={{ scale: 1.05, opacity: 1 }} transition={{ loop: true, type: 'timing', duration: 1600 }}>
        <LinearGradient colors={['#cffafe', '#a5f3fc']} style={{ width: 96, height: 96, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="repeat" size={44} color="#0891b2" />
        </LinearGradient>
      </MotiView>
      <Text className="text-slate-900 font-bold text-base mt-5">لا توجد تعبئة تلقائية</Text>
      <Text className="text-slate-500 text-xs mt-1 text-center px-10 leading-5">
        فعّل تعبئة دورية ولن تقلق على نفاد الماء — نطلب لك تلقائياً
      </Text>
      <Pressable onPress={onAdd} className="mt-5 bg-cyan-600 px-6 py-3 rounded-2xl">
        <Text className="text-white font-bold text-sm">فعّل التعبئة التلقائية</Text>
      </Pressable>
    </View>
  );
}

function ErrorRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 50 }}>
      <Ionicons name="cloud-offline-outline" size={48} color="#94a3b8" />
      <Text className="text-slate-700 font-bold text-base mt-4">تعذّر تحميل الجدولة</Text>
      <Pressable onPress={onRetry} className="mt-5 bg-cyan-600 px-6 py-3 rounded-2xl">
        <Text className="text-white font-bold text-sm">إعادة المحاولة</Text>
      </Pressable>
    </View>
  );
}
