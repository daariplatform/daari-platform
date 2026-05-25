import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { arSA } from 'date-fns/locale';

import { useCustomerDetail } from '@/lib/queries';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import type { CustomerStatus, Tank } from '@/lib/types';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

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

interface CustomerOrderSummary {
  id: string;
  status: string;
  priceIqd: number;
  requestedAt: string;
  kind: string;
}

/**
 * Customer detail — profile + tanks + recent orders + admin actions
 * (reset password). Backend doesn't ship the recent-orders list inside
 * /customers/:id (lib/queries' useCustomerDetail returns CustomerProfile
 * which has no orders[] field) so for now we render the section as a stub
 * with a "view full history on web" hint. Flagged in the report.
 */
export default function CustomerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useCustomerDetail(id);
  const [resetting, setResetting] = useState(false);

  // Pull-in: cast loosely to surface fields that may be present on the
  // response payload even though they're not on the typed CustomerProfile
  // (recentOrders is one such extra-field). The risk: nothing renders if
  // the backend doesn't supply them, which is the desired fallback.
  const customer = query.data as
    | (typeof query.data & { recentOrders?: CustomerOrderSummary[] })
    | undefined;

  async function resetPassword() {
    if (!customer) return;
    Alert.alert(
      'إعادة تعيين كلمة المرور',
      `سيُنشأ كلمة مرور مؤقتة جديدة لـ ${customer.fullName}.`,
      [
        { text: 'تراجع', style: 'cancel' },
        {
          text: 'تأكيد',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              const { data } = await api.post<{ tempPassword: string }>(
                `/customers/${customer.id}/reset-password`,
              );
              Alert.alert(
                'كلمة المرور الجديدة',
                `الهاتف: ${customer.phone}\nكلمة المرور: ${data.tempPassword}\n\nشاركها مع الزبون.`,
              );
            } catch (err: any) {
              Alert.alert(
                'خطأ',
                err?.response?.data?.message ?? 'تعذّر إعادة تعيين كلمة المرور',
              );
            } finally {
              setResetting(false);
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
            style={{ fontSize: 17, fontWeight: '900', color: '#0f172a', flex: 1, textAlign: 'right' }}
            numberOfLines={1}
          >
            {customer?.fullName ?? 'الزبون'}
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
      </SafeAreaView>

      {query.isLoading && (
        <View style={{ padding: 14 }}>
          <Skeleton height={140} borderRadius={22} style={{ marginBottom: 12 }} />
          <Skeleton height={88} borderRadius={18} style={{ marginBottom: 10 }} />
          <Skeleton height={120} borderRadius={18} style={{ marginBottom: 10 }} />
        </View>
      )}

      {query.isError && (
        <EmptyState
          icon="cloud-off"
          title="تعذّر تحميل الزبون"
          actionLabel="إعادة المحاولة"
          onAction={() => query.refetch()}
        />
      )}

      {customer && (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          {/* Profile hero */}
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
              <LinearGradient
                colors={['#0ea5e9', '#0284c7']}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26 }}>
                  {(customer.fullName ?? '?').trim().charAt(0) || '؟'}
                </Text>
              </LinearGradient>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>
                  {customer.fullName}
                </Text>
                <StatusPill status={customer.status} />
              </View>
            </View>

            <View style={{ marginTop: 14 }}>
              <InfoRow
                label="الهاتف"
                value={customer.phone}
                action={
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${customer.phone}`)}
                    hitSlop={8}
                    style={({ pressed }) => ({
                      backgroundColor: '#e0f2fe',
                      padding: 8,
                      borderRadius: 12,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <MaterialIcons name="call" size={18} color="#0284c7" />
                  </Pressable>
                }
              />
              <InfoRow label="المنطقة" value={customer.district || '—'} />
              <InfoRow label="العنوان" value={customer.addressLine || '—'} />
              <InfoRow
                label="إجمالي التعبئات"
                value={(customer.totalRefills ?? 0).toLocaleString('ar-IQ')}
              />
              <InfoRow
                label="الرصيد"
                value={`${(customer.balanceIqd ?? 0).toLocaleString('ar-IQ')} د.ع`}
                valueColor={
                  (customer.balanceIqd ?? 0) >= 0 ? '#10b981' : '#dc2626'
                }
              />
            </View>
          </View>

          {/* Tanks */}
          <SectionCard icon="water-drop" title="الخزّانات">
            {customer.tanks.length === 0 ? (
              <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'right' }}>
                لا يوجد خزّان مسجّل لهذا الزبون
              </Text>
            ) : (
              customer.tanks.map((t) => <TankRow key={t.id} tank={t} />)
            )}
          </SectionCard>

          {/* Recent orders — opportunistic. Backend doesn't currently include
              this on the response; we render the placeholder only when the
              field is genuinely populated. */}
          {customer.recentOrders && customer.recentOrders.length > 0 && (
            <SectionCard icon="receipt-long" title="الطلبات الأخيرة">
              {customer.recentOrders.slice(0, 5).map((o) => (
                <Pressable
                  key={o.id}
                  onPress={() => router.push(`/order/${o.id}` as any)}
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: '#f1f5f9',
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>
                      {(o.priceIqd ?? 0).toLocaleString('ar-IQ')} د.ع
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {formatDistanceToNow(new Date(o.requestedAt), {
                        addSuffix: true,
                        locale: arSA,
                      })}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-left" size={20} color="#94a3b8" />
                </Pressable>
              ))}
            </SectionCard>
          )}

          {/* Actions */}
          <Pressable
            onPress={resetPassword}
            disabled={resetting}
            style={({ pressed }) => ({
              backgroundColor: '#fff',
              borderRadius: 18,
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: '#fde68a',
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: pressed || resetting ? 0.8 : 1,
            })}
          >
            {resetting ? (
              <ActivityIndicator color="#d97706" />
            ) : (
              <>
                <MaterialIcons name="lock-reset" size={20} color="#d97706" />
                <Text style={{ color: '#92400e', fontWeight: '800', fontSize: 13 }}>
                  إعادة تعيين كلمة المرور
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function StatusPill({ status }: { status: CustomerStatus }) {
  const meta = STATUS_META[status];
  return (
    <View
      style={{
        backgroundColor: meta.bg,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 999,
        marginTop: 4,
      }}
    >
      <Text style={{ color: meta.fg, fontWeight: '700', fontSize: 10 }}>{meta.label}</Text>
    </View>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: MaterialIconName;
  title: string;
  children: React.ReactNode;
}) {
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
          gap: 8,
          marginBottom: 12,
        }}
      >
        <MaterialIcons name={icon} size={18} color="#0284c7" />
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoRow({
  label,
  value,
  action,
  valueColor,
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
  valueColor?: string;
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
            color: valueColor ?? '#0f172a',
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

function TankRow({ tank }: { tank: Tank }) {
  const capacityLabel = tank.capacity === 'L500' ? '٥٠٠ لتر' : '٣٥٠ لتر';
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: '#e0f2fe',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name="qr-code-2" size={22} color="#0284c7" />
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>
          {tank.serialNumber}
        </Text>
        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          {capacityLabel} · QR {tank.qrCode}
        </Text>
      </View>
    </View>
  );
}
