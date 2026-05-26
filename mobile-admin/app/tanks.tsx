import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  TextInput,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  useTanks,
  useTankInventory,
  useCreateTank,
  useAssignTank,
  useReclaimTank,
  useCustomersList,
  type TankRow,
} from '@/lib/queries';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const STATUS_META: Record<
  TankRow['status'],
  { label: string; bg: string; fg: string }
> = {
  IN_PLANT: { label: 'في المعمل', bg: '#dbeafe', fg: '#1e40af' },
  ASSIGNED: { label: 'مع زبون', bg: '#d1fae5', fg: '#065f46' },
  AT_RISK: { label: 'بخطر', bg: '#fef3c7', fg: '#92400e' },
  RECLAIMED: { label: 'مُسترجَع', bg: '#e2e8f0', fg: '#334155' },
  DAMAGED: { label: 'تالف', bg: '#fee2e2', fg: '#991b1b' },
};

const STATUS_FILTERS: { key: TankRow['status'] | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'الكل' },
  { key: 'IN_PLANT', label: 'في المعمل' },
  { key: 'ASSIGNED', label: 'مع زبون' },
  { key: 'AT_RISK', label: 'بخطر' },
  { key: 'RECLAIMED', label: 'مُسترجَع' },
  { key: 'DAMAGED', label: 'تالف' },
];

function n(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('en-US');
}

/**
 * Tank inventory + lifecycle management. Plant-admin can:
 *   - See current inventory snapshot at the top (5 stat chips).
 *   - Filter list by status.
 *   - Create a new tank (modal — serial + QR + capacity).
 *   - Tap a row to open an action sheet (assign / reclaim / edit / delete).
 *
 * Edit + delete are stubs that point at backend endpoints not in the brief
 * (PATCH/DELETE on /tanks/:id) — they degrade to a placeholder alert so
 * the UI stays useful even before those routes exist.
 */
export default function TanksScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<TankRow['status'] | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionSheet, setActionSheet] = useState<TankRow | null>(null);
  const [assignTank, setAssignTank] = useState<TankRow | null>(null);
  const [reclaimTank, setReclaimTank] = useState<TankRow | null>(null);

  const tanksQuery = useTanks({
    page,
    pageSize: 50,
    status: filter === 'ALL' ? undefined : filter,
  });
  const inventory = useTankInventory();

  const items = tanksQuery.data?.items ?? [];
  const totalPages = tanksQuery.data?.totalPages ?? 0;

  const onChangeFilter = (next: TankRow['status'] | 'ALL') => {
    setFilter(next);
    setPage(1);
  };

  const renderItem: ListRenderItem<TankRow> = ({ item }) => (
    <TankListRow tank={item} onPress={() => setActionSheet(item)} />
  );

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
              fontSize: 18,
              fontWeight: '900',
              color: '#0f172a',
              flex: 1,
              textAlign: 'right',
            }}
          >
            الخزانات
          </Text>
          <Pressable
            onPress={() => router.back()}
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

        {/* Inventory chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            gap: 8,
            flexDirection: 'row-reverse',
          }}
        >
          <InventoryChip
            label="في المعمل"
            value={inventory.data?.inPlant}
            tint="#0e9384"
            loading={inventory.isLoading}
          />
          <InventoryChip
            label="مع زبون"
            value={inventory.data?.assigned}
            tint="#10b981"
            loading={inventory.isLoading}
          />
          <InventoryChip
            label="بخطر"
            value={inventory.data?.atRisk}
            tint="#f59e0b"
            loading={inventory.isLoading}
          />
          <InventoryChip
            label="مُسترجَع"
            value={inventory.data?.reclaimed}
            tint="#64748b"
            loading={inventory.isLoading}
          />
          <InventoryChip
            label="تالف"
            value={inventory.data?.damaged}
            tint="#dc2626"
            loading={inventory.isLoading}
          />
        </ScrollView>

        {/* Status filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingBottom: 10,
            gap: 8,
            flexDirection: 'row-reverse',
          }}
        >
          {STATUS_FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <Pressable
                key={f.key}
                onPress={() => onChangeFilter(f.key)}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: active ? '#0e9384' : '#f1f5f9',
                  borderWidth: 1,
                  borderColor: active ? '#0e9384' : '#e2e8f0',
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text
                  style={{
                    color: active ? '#fff' : '#475569',
                    fontWeight: active ? '800' : '600',
                    fontSize: 11,
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {tanksQuery.isLoading && (
        <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
          <SkeletonCard height={82} />
          <SkeletonCard height={82} />
          <SkeletonCard height={82} />
        </View>
      )}

      {tanksQuery.isError && !tanksQuery.data && (
        <EmptyState
          icon="cloud-off"
          title="تعذّر تحميل الخزانات"
          actionLabel="إعادة المحاولة"
          onAction={() => tanksQuery.refetch()}
        />
      )}

      {!tanksQuery.isLoading && items.length === 0 && !tanksQuery.isError && (
        <EmptyState
          icon="propane-tank"
          title="لا توجد خزانات"
          subtitle="ابدأ بإضافة خزان جديد إلى المخزون."
          actionLabel="+ خزان جديد"
          onAction={() => setCreateOpen(true)}
        />
      )}

      {items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={tanksQuery.isFetching && !tanksQuery.isLoading}
              onRefresh={() => {
                tanksQuery.refetch();
                inventory.refetch();
              }}
            />
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            ) : null
          }
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => setCreateOpen(true)}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: 20,
          right: 20,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <LinearGradient
          colors={['#14b8a6', '#0e9384']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 18,
            height: 52,
            borderRadius: 26,
            shadowColor: '#0e9384',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <MaterialIcons name="add" size={22} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>
            خزان جديد
          </Text>
        </LinearGradient>
      </Pressable>

      {/* Create modal */}
      <CreateTankModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {/* Action sheet */}
      <ActionSheet
        tank={actionSheet}
        onClose={() => setActionSheet(null)}
        onAssign={() => {
          const t = actionSheet;
          setActionSheet(null);
          if (t) setAssignTank(t);
        }}
        onReclaim={() => {
          const t = actionSheet;
          setActionSheet(null);
          if (t) setReclaimTank(t);
        }}
        onEdit={() => {
          setActionSheet(null);
          Alert.alert('قريباً', 'تعديل بيانات الخزان غير متاح بعد. سيتم إضافته لاحقاً.');
        }}
        onDelete={() => {
          setActionSheet(null);
          Alert.alert('قريباً', 'حذف الخزان غير متاح بعد. سيتم إضافته لاحقاً.');
        }}
      />

      <AssignTankModal
        tank={assignTank}
        onClose={() => setAssignTank(null)}
      />

      <ReclaimTankModal
        tank={reclaimTank}
        onClose={() => setReclaimTank(null)}
      />
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Row + chips
// ────────────────────────────────────────────────────────────────────

function InventoryChip({
  label,
  value,
  tint,
  loading,
}: {
  label: string;
  value: number | undefined;
  tint: string;
  loading?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        minWidth: 96,
        alignItems: 'flex-end',
      }}
    >
      <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '700' }}>{label}</Text>
      {loading ? (
        <Skeleton width={40} height={18} style={{ marginTop: 4 }} />
      ) : (
        <Text
          style={{
            fontSize: 18,
            fontWeight: '900',
            color: tint,
            marginTop: 2,
          }}
        >
          {n(value)}
        </Text>
      )}
    </View>
  );
}

function TankListRow({ tank, onPress }: { tank: TankRow; onPress: () => void }) {
  const meta = STATUS_META[tank.status];
  const capacityLabel = tank.capacity === 'L500' ? '500 L' : '350 L';

  function copyQr() {
    // expo-clipboard isn't installed in this app yet; surface the QR in an
    // Alert so the owner can read it / take a screenshot. Swap to
    // Clipboard.setStringAsync once the dependency is added.
    Alert.alert('رمز QR', tank.qrCode);
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        opacity: pressed ? 0.92 : 1,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
      })}
    >
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <View
            style={{
              backgroundColor: meta.bg,
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: meta.fg, fontWeight: '800', fontSize: 11 }}>
              {meta.label}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: '#ccfbf1',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: '#0e9384', fontWeight: '800', fontSize: 11 }}>
              {capacityLabel}
            </Text>
          </View>
        </View>
        <MaterialIcons name="more-horiz" size={20} color="#94a3b8" />
      </View>

      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 14, fontWeight: '900', color: '#0f172a' }}>
            {tank.serialNumber}
          </Text>
          {tank.customerName && (
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              الزبون: {tank.customerName}
            </Text>
          )}
        </View>
        <Pressable
          onPress={copyQr}
          hitSlop={8}
          style={({ pressed }) => ({
            backgroundColor: '#f1f5f9',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 10,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 6,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <MaterialIcons name="content-copy" size={14} color="#475569" />
          <Text
            style={{
              fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
              fontSize: 11,
              color: '#0f172a',
              fontWeight: '700',
            }}
          >
            {tank.qrCode}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 6,
      }}
    >
      <Pressable
        onPress={onPrev}
        disabled={prevDisabled}
        style={({ pressed }) => ({
          padding: 10,
          borderRadius: 12,
          backgroundColor: prevDisabled ? '#f1f5f9' : '#fff',
          borderWidth: 1,
          borderColor: '#e2e8f0',
          opacity: pressed ? 0.7 : prevDisabled ? 0.5 : 1,
        })}
      >
        <MaterialIcons
          name="chevron-right"
          size={22}
          color={prevDisabled ? '#cbd5e1' : '#0e9384'}
        />
      </Pressable>
      <Text style={{ fontWeight: '700', color: '#475569', fontSize: 13 }}>
        صفحة {n(page)} من {n(totalPages)}
      </Text>
      <Pressable
        onPress={onNext}
        disabled={nextDisabled}
        style={({ pressed }) => ({
          padding: 10,
          borderRadius: 12,
          backgroundColor: nextDisabled ? '#f1f5f9' : '#fff',
          borderWidth: 1,
          borderColor: '#e2e8f0',
          opacity: pressed ? 0.7 : nextDisabled ? 0.5 : 1,
        })}
      >
        <MaterialIcons
          name="chevron-left"
          size={22}
          color={nextDisabled ? '#cbd5e1' : '#0e9384'}
        />
      </Pressable>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Action sheet
// ────────────────────────────────────────────────────────────────────

function ActionSheet({
  tank,
  onClose,
  onAssign,
  onReclaim,
  onEdit,
  onDelete,
}: {
  tank: TankRow | null;
  onClose: () => void;
  onAssign: () => void;
  onReclaim: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const visible = !!tank;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(15,23,42,0.55)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          // swallow taps inside the sheet
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 16,
          }}
        >
          <SafeAreaView edges={['bottom']}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '900',
                color: '#0f172a',
                textAlign: 'right',
                marginBottom: 12,
              }}
            >
              {tank?.serialNumber}
            </Text>
            <ActionRow
              icon="person-add"
              label="تعيين لزبون"
              tint="#0e9384"
              onPress={onAssign}
              disabled={tank?.status === 'ASSIGNED'}
            />
            <ActionRow
              icon="undo"
              label="استرجاع"
              tint="#f59e0b"
              onPress={onReclaim}
              disabled={tank?.status !== 'ASSIGNED' && tank?.status !== 'AT_RISK'}
            />
            <ActionRow icon="edit" label="تعديل" tint="#475569" onPress={onEdit} />
            <ActionRow icon="delete" label="حذف" tint="#dc2626" onPress={onDelete} />
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                marginTop: 6,
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: '#f1f5f9',
                alignItems: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontWeight: '800', color: '#475569' }}>إغلاق</Text>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  tint,
  onPress,
  disabled,
}: {
  icon: MaterialIconName;
  label: string;
  tint: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 14,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: tint + '14',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name={icon} size={20} color={tint} />
      </View>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a', textAlign: 'right' }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ────────────────────────────────────────────────────────────────────
// Create modal
// ────────────────────────────────────────────────────────────────────

function CreateTankModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const create = useCreateTank();
  const [serial, setSerial] = useState('');
  const [qr, setQr] = useState('');
  const [capacity, setCapacity] = useState<'L350' | 'L500'>('L500');

  function reset() {
    setSerial('');
    setQr('');
    setCapacity('L500');
  }

  async function submit() {
    if (!serial.trim() || !qr.trim()) {
      Alert.alert('تحقّق', 'أدخل الرقم التسلسلي ورمز QR');
      return;
    }
    try {
      await create.mutateAsync({
        serialNumber: serial.trim(),
        qrCode: qr.trim(),
        capacity,
      });
      reset();
      onClose();
      Alert.alert('تم', 'أُضيف الخزان للمخزون');
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر إنشاء الخزان');
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
              <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a' }}>
                خزان جديد
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
              <Field
                label="الرقم التسلسلي"
                value={serial}
                onChangeText={setSerial}
                placeholder="مثلاً: T-001234"
                icon="confirmation-number"
              />
              <Field
                label="رمز QR"
                value={qr}
                onChangeText={setQr}
                placeholder="مثلاً: QR-AB12CD"
                icon="qr-code-2"
              />

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: '#475569',
                  textAlign: 'right',
                  marginBottom: 6,
                }}
              >
                السعة
              </Text>
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 14 }}>
                {(['L350', 'L500'] as const).map((c) => {
                  const active = c === capacity;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setCapacity(c)}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 14,
                        backgroundColor: active ? '#0e9384' : '#f1f5f9',
                        alignItems: 'center',
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: active ? '#fff' : '#475569',
                          fontWeight: '900',
                          fontSize: 14,
                        }}
                      >
                        {c === 'L350' ? '350 L' : '500 L'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={submit}
                disabled={create.isPending}
                style={({ pressed }) => ({
                  borderRadius: 18,
                  overflow: 'hidden',
                  opacity: pressed || create.isPending ? 0.85 : 1,
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
                  {create.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="add" size={20} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                        إضافة
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

// ────────────────────────────────────────────────────────────────────
// Assign modal — pick a customer
// ────────────────────────────────────────────────────────────────────

function AssignTankModal({
  tank,
  onClose,
}: {
  tank: TankRow | null;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const customers = useCustomersList({ search, page: 1, pageSize: 30 });
  const assign = useAssignTank();
  const visible = !!tank;

  async function doAssign(customerId: string, customerName: string) {
    if (!tank) return;
    try {
      await assign.mutateAsync({ tankId: tank.id, customerId });
      onClose();
      setSearch('');
      Alert.alert('تم', `تم تعيين الخزان لـ ${customerName}`);
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر التعيين');
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
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '85%',
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
                paddingBottom: 8,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>
                تعيين {tank?.serialNumber}
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

            <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
              <Field
                label="ابحث عن زبون"
                value={search}
                onChangeText={setSearch}
                placeholder="الاسم أو الهاتف"
                icon="search"
              />
            </View>

            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ padding: 14, paddingTop: 0 }}>
              {customers.isLoading && (
                <>
                  <SkeletonCard height={64} />
                  <SkeletonCard height={64} />
                </>
              )}
              {!customers.isLoading && (customers.data?.items ?? []).length === 0 && (
                <EmptyState
                  icon="person-off"
                  title="لا يوجد زبائن"
                  subtitle="جرّب اسم أو رقم آخر"
                />
              )}
              {(customers.data?.items ?? []).map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => doAssign(c.id, c.fullName)}
                  disabled={assign.isPending}
                  style={({ pressed }) => ({
                    backgroundColor: '#fff',
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 10,
                    opacity: pressed || assign.isPending ? 0.85 : 1,
                  })}
                >
                  <LinearGradient
                    colors={['#14b8a6', '#0e9384']}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '900' }}>
                      {(c.fullName ?? '?').trim().charAt(0) || '؟'}
                    </Text>
                  </LinearGradient>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>
                      {c.fullName}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {c.phone}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────
// Reclaim modal
// ────────────────────────────────────────────────────────────────────

const RECLAIM_REASONS: { key: string; label: string }[] = [
  { key: 'CUSTOMER_REQUEST', label: 'طلب الزبون' },
  { key: 'NON_PAYMENT', label: 'عدم الدفع' },
  { key: 'MOVED', label: 'انتقل من المنطقة' },
  { key: 'DAMAGED', label: 'تالف' },
  { key: 'OTHER', label: 'أخرى' },
];

function ReclaimTankModal({
  tank,
  onClose,
}: {
  tank: TankRow | null;
  onClose: () => void;
}) {
  const reclaim = useReclaimTank();
  const [reason, setReason] = useState<string>(RECLAIM_REASONS[0].key);
  const [notes, setNotes] = useState('');
  const visible = !!tank;

  async function submit() {
    if (!tank) return;
    try {
      await reclaim.mutateAsync({
        tankId: tank.id,
        reason,
        notes: notes.trim() || undefined,
      });
      onClose();
      setNotes('');
      setReason(RECLAIM_REASONS[0].key);
      Alert.alert('تم', 'سُجّل الاسترجاع');
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر الاسترجاع');
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
                استرجاع {tank?.serialNumber}
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
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: '#475569',
                  textAlign: 'right',
                  marginBottom: 8,
                }}
              >
                سبب الاسترجاع
              </Text>
              <View
                style={{
                  flexDirection: 'row-reverse',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                {RECLAIM_REASONS.map((r) => {
                  const active = r.key === reason;
                  return (
                    <Pressable
                      key={r.key}
                      onPress={() => setReason(r.key)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: active ? '#0e9384' : '#f1f5f9',
                        borderWidth: 1,
                        borderColor: active ? '#0e9384' : '#e2e8f0',
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
                        {r.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: '#475569',
                  textAlign: 'right',
                  marginBottom: 6,
                }}
              >
                ملاحظات (اختياري)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="تفاصيل إضافية..."
                placeholderTextColor="#94a3b8"
                style={{
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  borderRadius: 14,
                  padding: 12,
                  fontSize: 13,
                  color: '#0f172a',
                  textAlign: 'right',
                  minHeight: 80,
                  textAlignVertical: 'top',
                  marginBottom: 14,
                }}
              />

              <Pressable
                onPress={submit}
                disabled={reclaim.isPending}
                style={({ pressed }) => ({
                  borderRadius: 18,
                  overflow: 'hidden',
                  opacity: pressed || reclaim.isPending ? 0.85 : 1,
                })}
              >
                <LinearGradient
                  colors={['#f59e0b', '#d97706']}
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
                  {reclaim.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="undo" size={20} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                        تأكيد الاسترجاع
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

// ────────────────────────────────────────────────────────────────────
// Shared input
// ────────────────────────────────────────────────────────────────────

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
