import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  RefreshControl,
  Modal,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { arSA } from 'date-fns/locale';

import { useCustomersList, usePendingLeads, useApproveLead } from '@/lib/queries';
import type { CustomerProfile, CustomerStatus } from '@/lib/types';
import { SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

const STATUS_META: Record<
  CustomerStatus,
  { label: string; bg: string; fg: string }
> = {
  ACTIVE: { label: 'نشط', bg: '#d1fae5', fg: '#065f46' },
  AT_RISK: { label: 'في خطر', bg: '#ffedd5', fg: '#9a3412' },
  INACTIVE: { label: 'متوقف', bg: '#f1f5f9', fg: '#475569' },
  CHURNED: { label: 'فقدنا الزبون', bg: '#fee2e2', fg: '#991b1b' },
  PENDING_APPROVAL: { label: 'بانتظار الموافقة', bg: '#fef3c7', fg: '#92400e' },
};

/**
 * Customers list — search + pending-leads banner + inline approve action.
 * The PENDING_APPROVAL row gets its own quick-approve button so the admin
 * doesn't have to open the detail screen for every new lead.
 */
export default function CustomersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [credentials, setCredentials] = useState<{
    phone: string;
    fullName: string;
    tempPassword: string;
  } | null>(null);

  const customersQuery = useCustomersList({ page, pageSize: 50, search: search || undefined });
  const leadsQuery = usePendingLeads();
  const approve = useApproveLead();

  const items = customersQuery.data?.items ?? [];
  const totalPages = customersQuery.data?.totalPages ?? 0;
  const pendingCount = leadsQuery.data?.length ?? 0;

  async function handleApprove(c: CustomerProfile) {
    try {
      const res = await approve.mutateAsync(c.id);
      setCredentials({
        phone: res.customer.phone,
        fullName: res.customer.fullName,
        tempPassword: res.tempPassword,
      });
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر الموافقة على الزبون');
    }
  }

  const renderItem: ListRenderItem<CustomerProfile> = ({ item }) => (
    <CustomerRow
      customer={item}
      onPress={() => router.push(`/customer/${item.id}` as any)}
      onApprove={item.status === 'PENDING_APPROVAL' ? () => handleApprove(item) : undefined}
      approving={approve.isPending}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 12,
            backgroundColor: '#fff',
            borderBottomWidth: 1,
            borderBottomColor: '#e2e8f0',
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: '900',
              color: '#0f172a',
              textAlign: 'right',
              marginBottom: 12,
            }}
          >
            الزبائن
          </Text>

          {/* Search input */}
          <View
            style={{
              backgroundColor: '#f1f5f9',
              borderRadius: 14,
              paddingHorizontal: 12,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <MaterialIcons name="search" size={20} color="#64748b" />
            <TextInput
              value={search}
              onChangeText={(t) => {
                setSearch(t);
                setPage(1);
              }}
              placeholder="ابحث بالاسم أو الهاتف"
              placeholderTextColor="#94a3b8"
              style={{
                flex: 1,
                paddingVertical: 10,
                fontSize: 13,
                textAlign: 'right',
                color: '#0f172a',
              }}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <MaterialIcons name="close" size={18} color="#64748b" />
              </Pressable>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Pending leads banner */}
      {pendingCount > 0 && (
        <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
          <View
            style={{
              backgroundColor: '#fffbeb',
              borderColor: '#fde68a',
              borderWidth: 1,
              borderRadius: 16,
              padding: 12,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: '#f59e0b',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name="person-add" size={22} color="#fff" />
            </View>
            <Text
              style={{ flex: 1, color: '#92400e', fontWeight: '800', fontSize: 13, textAlign: 'right' }}
            >
              {pendingCount.toLocaleString('en-US')} طلب جديد بانتظار موافقتك
            </Text>
            <Pressable
              onPress={() => {
                // Reset filters so any pending lead in the unified customers
                // list isn't hidden by a stale search query.
                setSearch('');
                setPage(1);
              }}
              style={({ pressed }) => ({
                backgroundColor: '#f59e0b',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>عرض</Text>
            </Pressable>
          </View>
        </View>
      )}

      {customersQuery.isLoading && (
        <View style={{ padding: 14 }}>
          <SkeletonCard height={84} />
          <SkeletonCard height={84} />
          <SkeletonCard height={84} />
          <SkeletonCard height={84} />
        </View>
      )}

      {customersQuery.isError && !customersQuery.data && (
        <EmptyState
          icon="cloud-off"
          title="تعذّر تحميل الزبائن"
          actionLabel="إعادة المحاولة"
          onAction={() => customersQuery.refetch()}
        />
      )}

      {!customersQuery.isLoading && items.length === 0 && (
        <EmptyState
          icon="people-outline"
          title={search ? 'لا توجد نتائج' : 'لا يوجد زبائن بعد'}
          subtitle={
            search
              ? `لم نجد زبوناً مطابقاً لـ "${search}"`
              : 'سيظهر هنا أي زبون يسجّل حسابه أو يضيفه السائق'
          }
        />
      )}

      {items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
          refreshControl={
            <RefreshControl
              refreshing={customersQuery.isFetching && !customersQuery.isLoading}
              onRefresh={() => {
                customersQuery.refetch();
                leadsQuery.refetch();
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

      <CredentialsModal creds={credentials} onClose={() => setCredentials(null)} />
    </View>
  );
}

function CustomerRow({
  customer,
  onPress,
  onApprove,
  approving,
}: {
  customer: CustomerProfile;
  onPress: () => void;
  onApprove?: () => void;
  approving: boolean;
}) {
  const meta = STATUS_META[customer.status];
  const initial = (customer.fullName ?? '?').trim().charAt(0) || '؟';
  const lastRefill = customer.lastRefillAt
    ? formatDistanceToNow(new Date(customer.lastRefillAt), {
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
      })}
    >
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: '#ccfbf1',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#0e9384', fontWeight: '900', fontSize: 18 }}>{initial}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text
            style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}
            numberOfLines={1}
          >
            {customer.fullName}
          </Text>
          <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {customer.phone}
            {lastRefill && ` · ${lastRefill}`}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: meta.bg,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: meta.fg, fontWeight: '700', fontSize: 10 }}>{meta.label}</Text>
        </View>
      </View>

      {onApprove && (
        <Pressable
          onPress={onApprove}
          disabled={approving}
          style={({ pressed }) => ({
            marginTop: 10,
            backgroundColor: '#10b981',
            paddingVertical: 10,
            borderRadius: 12,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: pressed || approving ? 0.8 : 1,
          })}
        >
          {approving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialIcons name="check" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>موافقة</Text>
            </>
          )}
        </Pressable>
      )}
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
        <MaterialIcons name="chevron-right" size={22} color={prevDisabled ? '#cbd5e1' : '#0e9384'} />
      </Pressable>
      <Text style={{ fontWeight: '700', color: '#475569', fontSize: 13 }}>
        صفحة {(page ?? 1).toLocaleString('en-US')} من {(totalPages ?? 1).toLocaleString('en-US')}
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
        <MaterialIcons name="chevron-left" size={22} color={nextDisabled ? '#cbd5e1' : '#0e9384'} />
      </Pressable>
    </View>
  );
}

function CredentialsModal({
  creds,
  onClose,
}: {
  creds: { phone: string; fullName: string; tempPassword: string } | null;
  onClose: () => void;
}) {
  if (!creds) return null;

  async function shareCreds() {
    // Native Share sheet — admins usually want to send these straight to
    // WhatsApp, and that's one tap away from this sheet.
    try {
      await Share.share({
        message: `مرحباً ${creds!.fullName}\n\nتمت الموافقة على حسابك في تطبيق داري.\n\nرقم الهاتف: ${creds!.phone}\nكلمة المرور المؤقتة: ${creds!.tempPassword}\n\nقم بتغيير كلمة المرور بعد أول دخول.`,
      });
    } catch {
      // user cancelled — no-op
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(15,23,42,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 24,
            padding: 22,
            width: '100%',
            maxWidth: 420,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 14 }}>
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={{
                width: 64,
                height: 64,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <MaterialIcons name="check" size={36} color="#fff" />
            </LinearGradient>
            <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a' }}>
              تمت الموافقة
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: '#64748b',
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              شارك هذه البيانات مع الزبون ليدخل التطبيق
            </Text>
          </View>

          <CredField label="الاسم" value={creds.fullName} />
          <CredField label="رقم الهاتف" value={creds.phone} />
          <CredField label="كلمة المرور المؤقتة" value={creds.tempPassword} mono />

          <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 14 }}>
            <Pressable
              onPress={shareCreds}
              style={({ pressed }) => ({
                flex: 1,
                borderRadius: 14,
                overflow: 'hidden',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <LinearGradient
                colors={['#14b8a6', '#0e9384']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 12,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <MaterialIcons name="share" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>مشاركة</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                alignItems: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: '#475569', fontWeight: '800', fontSize: 13 }}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CredField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
      }}
    >
      <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'right' }}>{label}</Text>
      <Text
        selectable
        style={{
          fontSize: 15,
          fontWeight: '900',
          color: '#0f172a',
          marginTop: 4,
          textAlign: 'right',
          fontFamily: mono
            ? Platform.select({ ios: 'Menlo', android: 'monospace' })
            : undefined,
          letterSpacing: mono ? 1.2 : 0,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
