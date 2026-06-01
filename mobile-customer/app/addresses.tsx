/**
 * Saved addresses — list + add/edit/delete + set-default.
 *
 * Reached from: profile → "عناويني المحفوظة".
 * Map pin reuses the same `/(auth)/map-picker` flow as signup; we read the
 * picked coords back via router params on focus.
 *
 * Design: cyan/teal gradient header + gradient label badges + Moti entrance
 * stagger + an add/edit bottom sheet-style modal. RTL throughout.
 */
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { hap } from '@/lib/haptics';
import {
  useMyAddresses,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
  useMakeDefaultAddress,
  ADDRESS_LABEL_META,
  type AddressLabel,
  type SavedAddress,
} from '@/lib/features/addresses';
import { SkeletonCard } from '@/components/Skeleton';

export default function AddressesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pickedLat?: string; pickedLng?: string; pickedAddress?: string }>();
  const { data, isLoading, isError, refetch } = useMyAddresses();

  const createMut = useCreateAddress();
  const updateMut = useUpdateAddress();
  const deleteMut = useDeleteAddress();
  const defaultMut = useMakeDefaultAddress();

  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Form state (lives here so a returning map-picker can patch the coords).
  const [label, setLabel] = useState<AddressLabel>('HOME');
  const [title, setTitle] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // When the map-picker returns, it replaces back to signup with params —
  // but if we navigated here we read pickedLat/Lng straight off our params.
  useEffect(() => {
    if (params.pickedLat && params.pickedLng) {
      setCoords({ lat: Number(params.pickedLat), lng: Number(params.pickedLng) });
      if (params.pickedAddress) setAddressLine((prev) => prev || String(params.pickedAddress));
      setModalOpen(true);
      // Clear the params so re-renders don't re-trigger.
      router.setParams({ pickedLat: undefined, pickedLng: undefined, pickedAddress: undefined } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.pickedLat, params.pickedLng]);

  function openCreate() {
    hap.tap();
    setEditing(null);
    setLabel('HOME');
    setTitle('');
    setAddressLine('');
    setCoords(null);
    setModalOpen(true);
  }

  function openEdit(a: SavedAddress) {
    hap.tap();
    setEditing(a);
    setLabel(a.label);
    setTitle(a.title);
    setAddressLine(a.addressLine);
    setCoords(a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : null);
    setModalOpen(true);
  }

  async function save() {
    if (!title.trim() || !addressLine.trim()) {
      Alert.alert('بيانات ناقصة', 'أدخل اسماً للعنوان وتفاصيل الموقع.');
      return;
    }
    const payload = {
      label,
      title: title.trim(),
      addressLine: addressLine.trim(),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...payload });
      } else {
        await createMut.mutateAsync(payload);
      }
      hap.success();
      setModalOpen(false);
    } catch (err: any) {
      hap.error();
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر حفظ العنوان. حاول لاحقاً.');
    }
  }

  function confirmDelete(a: SavedAddress) {
    Alert.alert('حذف العنوان', `حذف «${a.title}»؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMut.mutateAsync(a.id);
            hap.success();
          } catch (err: any) {
            Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر الحذف.');
          }
        },
      },
    ]);
  }

  const saving = createMut.isPending || updateMut.isPending;

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
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
            <View style={{ alignItems: 'flex-end' }}>
              <Text className="text-white text-2xl font-bold">عناويني</Text>
              <Text className="text-cyan-100 text-xs mt-0.5">
                {data ? `${data.length} عنوان محفوظ` : 'إدارة عناوين التوصيل'}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <>
            <SkeletonCard height={92} />
            <SkeletonCard height={92} />
          </>
        ) : isError ? (
          <ErrorRetry onRetry={refetch} />
        ) : !data || data.length === 0 ? (
          <EmptyAddresses onAdd={openCreate} />
        ) : (
          data.map((a, idx) => {
            const meta = ADDRESS_LABEL_META[a.label] ?? ADDRESS_LABEL_META.CUSTOM;
            return (
              <MotiView
                key={a.id}
                from={{ opacity: 0, translateY: 16, scale: 0.97 }}
                animate={{ opacity: 1, translateY: 0, scale: 1 }}
                transition={{ type: 'spring', delay: idx * 60, damping: 16 }}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 18,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: a.isDefault ? `${meta.grad[1]}55` : '#f1f5f9',
                  shadowColor: '#0f172a',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                }}
              >
                <View className="flex-row-reverse items-start">
                  <LinearGradient
                    colors={meta.grad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 46, height: 46, borderRadius: 15,
                      alignItems: 'center', justifyContent: 'center', marginLeft: 12,
                    }}
                  >
                    <Ionicons name={meta.icon} size={22} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <View className="flex-row-reverse items-center gap-2">
                      <Text className="text-sm font-bold text-slate-900 text-right">{a.title}</Text>
                      {a.isDefault && (
                        <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ color: '#059669', fontSize: 10, fontWeight: '800' }}>الافتراضي</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-slate-500 text-right mt-1 leading-5">{a.addressLine}</Text>
                    {a.lat != null && a.lng != null && (
                      <View className="flex-row-reverse items-center gap-1 mt-1">
                        <Ionicons name="location" size={12} color="#0891b2" />
                        <Text style={{ color: '#0891b2', fontSize: 10 }}>موقع محدد على الخريطة</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View className="flex-row-reverse items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                  {!a.isDefault && (
                    <Pressable
                      onPress={async () => {
                        hap.tap();
                        try {
                          await defaultMut.mutateAsync(a.id);
                        } catch {
                          Alert.alert('خطأ', 'تعذّر التعيين كافتراضي.');
                        }
                      }}
                      className="flex-row-reverse items-center gap-1.5 bg-cyan-50 px-3 py-1.5 rounded-full"
                    >
                      <Ionicons name="star-outline" size={14} color="#0891b2" />
                      <Text style={{ color: '#0891b2', fontSize: 11, fontWeight: '700' }}>تعيين افتراضي</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => openEdit(a)} className="flex-row-reverse items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-full">
                    <Ionicons name="create-outline" size={14} color="#475569" />
                    <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700' }}>تعديل</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmDelete(a)} className="flex-row-reverse items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: '#fef2f2' }}>
                    <Ionicons name="trash-outline" size={14} color="#dc2626" />
                    <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '700' }}>حذف</Text>
                  </Pressable>
                </View>
              </MotiView>
            );
          })
        )}
      </ScrollView>

      {/* Floating add button */}
      <View style={{ position: 'absolute', bottom: 28, left: 20, right: 20 }}>
        <Pressable onPress={openCreate}>
          <LinearGradient
            colors={['#06b6d4', '#0891b2', '#0e7490']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingVertical: 16,
              borderRadius: 18,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              shadowColor: '#0891b2',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <Ionicons name="add-circle" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>إضافة عنوان جديد</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* Add / edit modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setModalOpen(false)} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34 }}>
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: '#e2e8f0' }} />
            </View>
            <Text className="text-lg font-bold text-right mb-4">
              {editing ? 'تعديل العنوان' : 'عنوان جديد'}
            </Text>

            {/* Label picker */}
            <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'right', marginBottom: 8 }}>نوع العنوان</Text>
            <View className="flex-row-reverse gap-2 mb-4">
              {(['HOME', 'WORK', 'CUSTOM'] as AddressLabel[]).map((l) => {
                const m = ADDRESS_LABEL_META[l];
                const active = label === l;
                return (
                  <Pressable
                    key={l}
                    onPress={() => { hap.tap(); setLabel(l); }}
                    style={{ flex: 1 }}
                  >
                    {active ? (
                      <LinearGradient colors={m.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 4 }}>
                        <Ionicons name={m.icon} size={20} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{m.text}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={{ borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9' }}>
                        <Ionicons name={m.icon} size={20} color="#64748b" />
                        <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '700' }}>{m.text}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'right', marginBottom: 6 }}>اسم العنوان</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="مثال: بيت أهلي"
              placeholderTextColor="#94a3b8"
              textAlign="right"
              style={inputStyle}
            />

            <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'right', marginBottom: 6, marginTop: 12 }}>تفاصيل الموقع</Text>
            <TextInput
              value={addressLine}
              onChangeText={setAddressLine}
              placeholder="الحي، الشارع، رقم البيت…"
              placeholderTextColor="#94a3b8"
              textAlign="right"
              multiline
              style={[inputStyle, { minHeight: 64, textAlignVertical: 'top' }]}
            />

            {/* Map pin */}
            <Pressable
              onPress={() => {
                setModalOpen(false);
                router.push({
                  pathname: '/(auth)/map-picker',
                  params: {
                    returnTo: '/addresses',
                    ...(coords ? { lat: String(coords.lat), lng: String(coords.lng) } : {}),
                  },
                } as any);
              }}
              style={{
                marginTop: 12,
                borderWidth: 1,
                borderColor: coords ? '#a5f3fc' : '#e2e8f0',
                backgroundColor: coords ? '#ecfeff' : '#f8fafc',
                borderRadius: 14,
                padding: 14,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Ionicons name={coords ? 'checkmark-circle' : 'map'} size={22} color={coords ? '#0891b2' : '#64748b'} />
              <Text style={{ flex: 1, textAlign: 'right', color: coords ? '#0e7490' : '#475569', fontWeight: '700', fontSize: 13 }}>
                {coords ? 'تم تحديد الموقع على الخريطة' : 'حدد الموقع على الخريطة (اختياري)'}
              </Text>
              <Ionicons name="chevron-back" size={18} color="#cbd5e1" />
            </Pressable>

            <Pressable onPress={save} disabled={saving} style={{ marginTop: 18 }}>
              <LinearGradient
                colors={['#06b6d4', '#0891b2', '#0e7490']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 15, borderRadius: 16, alignItems: 'center' }}
              >
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                    {editing ? 'حفظ التعديلات' : 'إضافة العنوان'}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const inputStyle = {
  backgroundColor: '#f8fafc',
  borderWidth: 1,
  borderColor: '#e2e8f0',
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 14,
  color: '#0f172a',
} as const;

function EmptyAddresses({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 70 }}>
      <MotiView
        from={{ scale: 0.9, opacity: 0.7 }}
        animate={{ scale: 1.05, opacity: 1 }}
        transition={{ loop: true, type: 'timing', duration: 1600 }}
      >
        <LinearGradient colors={['#cffafe', '#a5f3fc']} style={{ width: 96, height: 96, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="location-outline" size={44} color="#0891b2" />
        </LinearGradient>
      </MotiView>
      <Text className="text-slate-900 font-bold text-base mt-5">لا توجد عناوين محفوظة</Text>
      <Text className="text-slate-500 text-xs mt-1 text-center px-10 leading-5">
        احفظ عناوينك المتكررة (البيت، العمل) لطلب التوصيل بسرعة
      </Text>
      <Pressable onPress={onAdd} className="mt-5 bg-cyan-600 px-6 py-3 rounded-2xl">
        <Text className="text-white font-bold text-sm">أضف عنوانك الأول</Text>
      </Pressable>
    </View>
  );
}

function ErrorRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 70 }}>
      <Ionicons name="cloud-offline-outline" size={48} color="#94a3b8" />
      <Text className="text-slate-700 font-bold text-base mt-4">تعذّر تحميل العناوين</Text>
      <Text className="text-slate-500 text-xs mt-1 text-center px-10">تأكد من اتصالك وحاول مرة أخرى</Text>
      <Pressable onPress={onRetry} className="mt-5 bg-cyan-600 px-6 py-3 rounded-2xl">
        <Text className="text-white font-bold text-sm">إعادة المحاولة</Text>
      </Pressable>
    </View>
  );
}
