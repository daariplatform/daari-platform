import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { arSA } from 'date-fns/locale';

import {
  useDriversAdmin,
  useCreateDriver,
  type DriverRow,
} from '@/lib/queries';
import { SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { safeBack } from '@/lib/nav';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

function n(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('en-US');
}

/**
 * Driver roster — see who's working today, their online state, and tap
 * through to a detail screen with stats + edit. The "+ توظيف سائق" FAB
 * opens a create modal. A side button at the top opens the live map.
 */
export default function DriversScreen() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const query = useDriversAdmin({ page, pageSize: 50 });

  const items = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const onlineCount = items.filter((d) => d.isOnline).length;

  const renderItem: ListRenderItem<DriverRow> = ({ item }) => (
    <DriverRowCard
      driver={item}
      onPress={() => router.push(`/drivers/${item.id}` as any)}
    />
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
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '900',
                color: '#0f172a',
              }}
            >
              السائقون
            </Text>
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {n(onlineCount)} متصل من {n(items.length)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
            <Pressable
              onPress={() => router.push('/drivers/live' as any)}
              hitSlop={6}
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: '#ccfbf1',
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 4,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <MaterialIcons name="map" size={18} color="#0e9384" />
              <Text style={{ color: '#0e9384', fontWeight: '800', fontSize: 11 }}>
                خريطة
              </Text>
            </Pressable>
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
        </View>
      </SafeAreaView>

      {query.isLoading && (
        <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
          <SkeletonCard height={84} />
          <SkeletonCard height={84} />
          <SkeletonCard height={84} />
        </View>
      )}

      {query.isError && !query.data && (
        <EmptyState
          icon="cloud-off"
          title="تعذّر تحميل السائقين"
          actionLabel="إعادة المحاولة"
          onAction={() => query.refetch()}
        />
      )}

      {!query.isLoading && items.length === 0 && !query.isError && (
        <EmptyState
          icon="local-shipping"
          title="لا يوجد سائقون"
          subtitle="ابدأ بتوظيف سائق ليتم تكليف الطلبات تلقائياً."
          actionLabel="+ توظيف سائق"
          onAction={() => setCreateOpen(true)}
        />
      )}

      {items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(d) => d.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isLoading}
              onRefresh={() => query.refetch()}
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
          <MaterialIcons name="person-add" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>
            توظيف سائق
          </Text>
        </LinearGradient>
      </Pressable>

      <CreateDriverModal visible={createOpen} onClose={() => setCreateOpen(false)} />
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Row
// ────────────────────────────────────────────────────────────────────

function DriverRowCard({
  driver,
  onPress,
}: {
  driver: DriverRow;
  onPress: () => void;
}) {
  const initial = (driver.fullName ?? '?').trim().charAt(0) || '؟';
  const lastSeen = driver.lastLocationAt
    ? formatDistanceToNow(new Date(driver.lastLocationAt), {
        addSuffix: true,
        locale: arSA,
      })
    : null;

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
          gap: 12,
        }}
      >
        <View style={{ position: 'relative' }}>
          <LinearGradient
            colors={['#14b8a6', '#0e9384']}
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 20 }}>
              {initial}
            </Text>
          </LinearGradient>
          {driver.isOnline && (
            <View
              style={{
                position: 'absolute',
                bottom: -2,
                left: -2,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: '#10b981',
                borderWidth: 2,
                borderColor: '#fff',
              }}
            />
          )}
        </View>

        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '900',
                color: '#0f172a',
              }}
              numberOfLines={1}
            >
              {driver.fullName}
            </Text>
            <View
              style={{
                backgroundColor: driver.isOnline ? '#d1fae5' : '#f1f5f9',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: driver.isOnline ? '#10b981' : '#94a3b8',
                }}
              />
              <Text
                style={{
                  color: driver.isOnline ? '#065f46' : '#475569',
                  fontWeight: '800',
                  fontSize: 10,
                }}
              >
                {driver.isOnline ? 'متصل' : 'غير متصل'}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
            {driver.phone}
          </Text>
          {lastSeen && !driver.isOnline && (
            <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
              آخر ظهور {lastSeen}
            </Text>
          )}
        </View>

        <MaterialIcons name="chevron-left" size={22} color="#cbd5e1" />
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
// Create modal
// ────────────────────────────────────────────────────────────────────

function CreateDriverModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const create = useCreateDriver();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [salary, setSalary] = useState('500000');
  const [commission, setCommission] = useState('10');

  const salaryNum = parseInt(salary, 10);
  const commissionNum = parseFloat(commission);
  const valid =
    fullName.trim().length > 1 &&
    /^07\d{9}$/.test(phone.trim()) &&
    Number.isFinite(salaryNum) &&
    salaryNum >= 0 &&
    Number.isFinite(commissionNum) &&
    commissionNum >= 0 &&
    commissionNum <= 100;

  function reset() {
    setFullName('');
    setPhone('');
    setSalary('500000');
    setCommission('10');
  }

  async function submit() {
    if (!valid) {
      Alert.alert('تحقّق', 'تأكّد من الاسم ورقم الهاتف (07XXXXXXXXX) والراتب والعمولة (0-100)');
      return;
    }
    try {
      await create.mutateAsync({
        fullName: fullName.trim(),
        phone: phone.trim(),
        salaryIqd: salaryNum,
        baseCommissionPct: commissionNum,
      });
      reset();
      onClose();
      Alert.alert('تم', 'أُضيف السائق');
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر إنشاء السائق');
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
                توظيف سائق
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
                label="الاسم الكامل"
                value={fullName}
                onChangeText={setFullName}
                placeholder="مثلاً: علي حسن"
                icon="person"
              />
              <Field
                label="الهاتف"
                value={phone}
                onChangeText={setPhone}
                placeholder="07XXXXXXXXX"
                icon="phone"
                keyboardType="phone-pad"
              />
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
                disabled={create.isPending || !valid}
                style={({ pressed }) => ({
                  borderRadius: 18,
                  overflow: 'hidden',
                  opacity: !valid ? 0.55 : pressed || create.isPending ? 0.85 : 1,
                  marginTop: 4,
                })}
              >
                <LinearGradient
                  colors={valid ? ['#14b8a6', '#0e9384'] : ['#cbd5e1', '#94a3b8']}
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
                      <MaterialIcons name="check" size={20} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                        إضافة السائق
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
