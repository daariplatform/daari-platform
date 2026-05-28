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
import { AlertBanner, Card, StatusChip, type ChipTone } from '@/components/ui';
import { theme } from '@/lib/theme';

// CustomerStatus → semantic StatusChip tone + Arabic label.
const STATUS_META: Record<
  CustomerStatus,
  { label: string; tone: ChipTone }
> = {
  ACTIVE: { label: 'نشط', tone: 'success' },
  AT_RISK: { label: 'في خطر', tone: 'warning' },
  INACTIVE: { label: 'متوقف', tone: 'neutral' },
  CHURNED: { label: 'فقدنا الزبون', tone: 'danger' },
  PENDING_APPROVAL: { label: 'بانتظار الموافقة', tone: 'warning' },
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
    <View style={{ flex: 1, backgroundColor: theme.color.surface.page }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.color.surface.card }}>
        <View
          style={{
            paddingHorizontal: theme.space.lg,
            paddingTop: theme.space.sm + 2,
            paddingBottom: theme.space.md,
            backgroundColor: theme.color.surface.card,
            borderBottomWidth: 1,
            borderBottomColor: theme.color.border.subtle,
          }}
        >
          <Text
            style={{
              ...theme.font.displaySm,
              color: theme.color.text.primary,
              textAlign: 'right',
              marginBottom: theme.space.md,
            }}
          >
            الزبائن
          </Text>

          {/* Search input */}
          <View
            style={{
              backgroundColor: theme.color.raw.slate[100],
              borderRadius: theme.radius.lg - 2,
              paddingHorizontal: theme.space.md,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: theme.space.sm,
            }}
          >
            <MaterialIcons name="search" size={20} color={theme.color.text.secondary} />
            <TextInput
              value={search}
              onChangeText={(t) => {
                setSearch(t);
                setPage(1);
              }}
              placeholder="ابحث بالاسم أو الهاتف"
              placeholderTextColor={theme.color.text.disabled}
              style={{
                flex: 1,
                paddingVertical: theme.space.sm + 2,
                fontSize: 13,
                textAlign: 'right',
                color: theme.color.text.primary,
              }}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <MaterialIcons name="close" size={18} color={theme.color.text.secondary} />
              </Pressable>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Pending leads banner */}
      {pendingCount > 0 && (
        <View
          style={{
            paddingHorizontal: theme.space.md + 2,
            paddingTop: theme.space.md,
          }}
        >
          <AlertBanner
            tone="warning"
            icon="person-add"
            title={`${pendingCount.toLocaleString('en-US')} طلب جديد بانتظار موافقتك`}
            onPress={() => {
              // Reset filters so any pending lead in the unified customers
              // list isn't hidden by a stale search query.
              setSearch('');
              setPage(1);
            }}
          />
        </View>
      )}

      {customersQuery.isLoading && (
        <View style={{ padding: theme.space.md + 2 }}>
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
          contentContainerStyle={{
            padding: theme.space.md + 2,
            paddingBottom: theme.space['3xl'] - 2,
          }}
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
    <Card
      variant="flat"
      padding="sm"
      onPress={onPress}
      style={{ marginBottom: 10 }}
    >
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: theme.space.md,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: theme.radius.lg - 2,
            backgroundColor: theme.color.accent.tint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{ color: theme.color.accent.primary, fontWeight: '900', fontSize: 18 }}
          >
            {initial}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '800',
              color: theme.color.text.primary,
            }}
            numberOfLines={1}
          >
            {customer.fullName}
          </Text>
          <Text
            style={{
              ...theme.font.labelLg,
              fontSize: 11,
              fontWeight: '500',
              color: theme.color.text.secondary,
              marginTop: 2,
            }}
          >
            {customer.phone}
            {lastRefill && ` · ${lastRefill}`}
          </Text>
        </View>
        <StatusChip label={meta.label} tone={meta.tone} size="sm" />
      </View>

      {onApprove && (
        <Pressable
          onPress={onApprove}
          disabled={approving}
          style={({ pressed }) => ({
            marginTop: theme.space.sm + 2,
            backgroundColor: theme.color.state.success.solid,
            paddingVertical: theme.space.sm + 2,
            borderRadius: theme.radius.md,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: pressed || approving ? 0.8 : 1,
          })}
        >
          {approving ? (
            <ActivityIndicator color={theme.color.text.onAccent} size="small" />
          ) : (
            <>
              <MaterialIcons name="check" size={18} color={theme.color.text.onAccent} />
              <Text
                style={{
                  color: theme.color.text.onAccent,
                  fontWeight: '800',
                  fontSize: 12,
                }}
              >
                موافقة
              </Text>
            </>
          )}
        </Pressable>
      )}
    </Card>
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
        paddingVertical: theme.space.md + 2,
        paddingHorizontal: 6,
      }}
    >
      <Pressable
        onPress={onPrev}
        disabled={prevDisabled}
        style={({ pressed }) => ({
          padding: 10,
          borderRadius: theme.radius.md,
          backgroundColor: prevDisabled
            ? theme.color.raw.slate[100]
            : theme.color.surface.card,
          borderWidth: 1,
          borderColor: theme.color.border.subtle,
          opacity: pressed ? 0.7 : prevDisabled ? 0.5 : 1,
        })}
      >
        <MaterialIcons
          name="chevron-right"
          size={22}
          color={prevDisabled ? theme.color.border.default : theme.color.accent.primary}
        />
      </Pressable>
      <Text
        style={{ fontWeight: '700', color: theme.color.raw.slate[600], fontSize: 13 }}
      >
        صفحة {(page ?? 1).toLocaleString('en-US')} من{' '}
        {(totalPages ?? 1).toLocaleString('en-US')}
      </Text>
      <Pressable
        onPress={onNext}
        disabled={nextDisabled}
        style={({ pressed }) => ({
          padding: 10,
          borderRadius: theme.radius.md,
          backgroundColor: nextDisabled
            ? theme.color.raw.slate[100]
            : theme.color.surface.card,
          borderWidth: 1,
          borderColor: theme.color.border.subtle,
          opacity: pressed ? 0.7 : nextDisabled ? 0.5 : 1,
        })}
      >
        <MaterialIcons
          name="chevron-left"
          size={22}
          color={nextDisabled ? theme.color.border.default : theme.color.accent.primary}
        />
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
          padding: theme.space.xl,
        }}
      >
        <View
          style={{
            backgroundColor: theme.color.surface.card,
            borderRadius: theme.radius['2xl'],
            padding: theme.space.xl + 2,
            width: '100%',
            maxWidth: 420,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: theme.space.md + 2 }}>
            <LinearGradient
              colors={[theme.color.state.success.solid, theme.color.raw.emerald[600]]}
              style={{
                width: 64,
                height: 64,
                borderRadius: theme.radius['2xl'] - 2,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <MaterialIcons name="check" size={36} color={theme.color.text.onAccent} />
            </LinearGradient>
            <Text
              style={{ fontSize: 17, fontWeight: '900', color: theme.color.text.primary }}
            >
              تمت الموافقة
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: theme.color.text.secondary,
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

          <View
            style={{
              flexDirection: 'row-reverse',
              gap: theme.space.sm,
              marginTop: theme.space.md + 2,
            }}
          >
            <Pressable
              onPress={shareCreds}
              style={({ pressed }) => ({
                flex: 1,
                borderRadius: theme.radius.lg - 2,
                overflow: 'hidden',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <LinearGradient
                colors={[theme.color.raw.teal[500], theme.color.accent.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: theme.space.md,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <MaterialIcons name="share" size={18} color={theme.color.text.onAccent} />
                <Text
                  style={{
                    color: theme.color.text.onAccent,
                    fontWeight: '800',
                    fontSize: 13,
                  }}
                >
                  مشاركة
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: theme.space.md,
                borderRadius: theme.radius.lg - 2,
                borderWidth: 1,
                borderColor: theme.color.border.subtle,
                alignItems: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text
                style={{
                  color: theme.color.raw.slate[600],
                  fontWeight: '800',
                  fontSize: 13,
                }}
              >
                إغلاق
              </Text>
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
        backgroundColor: theme.color.surface.page,
        borderRadius: theme.radius.md,
        padding: 10,
        marginBottom: theme.space.sm,
        borderWidth: 1,
        borderColor: theme.color.border.subtle,
      }}
    >
      <Text style={{ fontSize: 10, color: theme.color.text.secondary, textAlign: 'right' }}>
        {label}
      </Text>
      <Text
        selectable
        style={{
          fontSize: 15,
          fontWeight: '900',
          color: theme.color.text.primary,
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
