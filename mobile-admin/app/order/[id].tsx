import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Linking,
  Modal,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { arSA } from 'date-fns/locale';

import { useOrderDetail, useDriversList, useAssignDriver } from '@/lib/queries';
import type { RefillOrderStatus, RefillOrder } from '@/lib/types';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const TIMELINE: { key: RefillOrderStatus; label: string; icon: MaterialIconName }[] = [
  { key: 'PENDING', label: 'جديد', icon: 'fiber-new' },
  { key: 'ASSIGNED', label: 'مكلّف', icon: 'assignment-ind' },
  { key: 'EN_ROUTE', label: 'في الطريق', icon: 'local-shipping' },
  { key: 'COMPLETED', label: 'مكتمل', icon: 'check-circle' },
];

const STATUS_META: Record<
  RefillOrderStatus,
  { label: string; bg: string; fg: string }
> = {
  PENDING: { label: 'جديد', bg: '#fef3c7', fg: '#92400e' },
  ASSIGNED: { label: 'مكلّف', bg: '#dbeafe', fg: '#1e40af' },
  EN_ROUTE: { label: 'في الطريق', bg: '#ffedd5', fg: '#9a3412' },
  COMPLETED: { label: 'مكتمل', bg: '#d1fae5', fg: '#065f46' },
  CANCELLED: { label: 'ملغى', bg: '#fee2e2', fg: '#991b1b' },
  FAILED: { label: 'فشل', bg: '#fee2e2', fg: '#991b1b' },
};

/**
 * Order detail — full status timeline, customer card, driver assignment,
 * pricing, and cancel action. Heart of the daily admin workflow: open this
 * screen from either the orders tab or a push notification, do the thing,
 * close.
 *
 * NOTE: customer info (name, phone, address) is NOT on the RefillOrder type
 * in lib/types.ts as currently shaped — the backend `/orders/:id` endpoint
 * returns it but the typed shape needs widening to consume it cleanly. We
 * read the extended fields via a loose cast so the UI works today; flag in
 * the deliverable report for backend-side type sync.
 */
export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const query = useOrderDetail(id);
  const [showDriverPicker, setShowDriverPicker] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const order = query.data as
    | (RefillOrder & {
        customer?: { id: string; fullName: string; phone: string; district?: string; addressLine?: string };
        tank?: { qrCode: string; capacity: string } | null;
        liters?: number;
      })
    | undefined;

  async function cancelOrder() {
    if (!order) return;
    Alert.alert('تأكيد الإلغاء', 'هل أنت متأكد من إلغاء هذا الطلب؟', [
      { text: 'تراجع', style: 'cancel' },
      {
        text: 'إلغاء الطلب',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await api.post(`/orders/${order.id}/cancel`);
            qc.invalidateQueries({ queryKey: ['orders'] });
            qc.invalidateQueries({ queryKey: ['plant', 'kpis'] });
            router.back();
          } catch (err: any) {
            Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر إلغاء الطلب');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
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
          <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a' }}>
            تفاصيل الطلب
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
          <Skeleton height={120} borderRadius={22} style={{ marginBottom: 12 }} />
          <Skeleton height={88} borderRadius={18} style={{ marginBottom: 10 }} />
          <Skeleton height={88} borderRadius={18} style={{ marginBottom: 10 }} />
        </View>
      )}

      {query.isError && (
        <EmptyState
          icon="cloud-off"
          title="تعذّر تحميل الطلب"
          actionLabel="إعادة المحاولة"
          onAction={() => query.refetch()}
        />
      )}

      {order && (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          {/* Status header + timeline */}
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
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <StatusPill status={order.status} />
              <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                {formatDistanceToNow(new Date(order.requestedAt), {
                  addSuffix: true,
                  locale: arSA,
                })}
              </Text>
            </View>
            <Timeline status={order.status} />
          </View>

          {/* Customer card */}
          {order.customer && (
            <SectionCard icon="person" title="معلومات الزبون">
              <InfoRow label="الاسم" value={order.customer.fullName} />
              <InfoRow
                label="الهاتف"
                value={order.customer.phone}
                action={
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${order.customer!.phone}`)}
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
              {order.customer.district && (
                <InfoRow label="المنطقة" value={order.customer.district} />
              )}
              {order.customer.addressLine && (
                <InfoRow label="العنوان" value={order.customer.addressLine} />
              )}
            </SectionCard>
          )}

          {/* Driver section */}
          <SectionCard icon="local-shipping" title="السائق">
            {order.driver ? (
              <View>
                <InfoRow label="الاسم" value={order.driver.user.fullName} />
              </View>
            ) : (
              <Pressable
                onPress={() => setShowDriverPicker(true)}
                style={({ pressed }) => ({
                  borderRadius: 16,
                  overflow: 'hidden',
                  opacity: pressed ? 0.9 : 1,
                  marginTop: 4,
                })}
              >
                <LinearGradient
                  colors={['#0ea5e9', '#0284c7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <MaterialIcons name="person-add" size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                    تعيين سائق
                  </Text>
                </LinearGradient>
              </Pressable>
            )}
          </SectionCard>

          {/* Pricing */}
          <SectionCard icon="payments" title="السعر والدفع">
            <InfoRow
              label="السعر"
              value={`${(order.priceIqd ?? 0).toLocaleString('en-US')} د.ع`}
            />
            <InfoRow
              label="المدفوع"
              value={`${(order.paidAmountIqd ?? 0).toLocaleString('en-US')} د.ع`}
              valueColor={order.paidAmountIqd >= order.priceIqd ? '#10b981' : '#dc2626'}
            />
            {order.liters !== undefined && order.liters !== null && (
              <InfoRow
                label="اللترات"
                value={`${(order.liters ?? 0).toLocaleString('en-US')} لتر`}
              />
            )}
          </SectionCard>

          {/* Cancel button */}
          {(order.status === 'PENDING' || order.status === 'ASSIGNED') && (
            <Pressable
              onPress={cancelOrder}
              disabled={cancelling}
              style={({ pressed }) => ({
                marginTop: 6,
                backgroundColor: '#fee2e2',
                borderColor: '#fca5a5',
                borderWidth: 1,
                borderRadius: 18,
                paddingVertical: 14,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: pressed || cancelling ? 0.7 : 1,
              })}
            >
              {cancelling ? (
                <ActivityIndicator color="#dc2626" />
              ) : (
                <>
                  <MaterialIcons name="cancel" size={20} color="#dc2626" />
                  <Text style={{ color: '#dc2626', fontWeight: '800', fontSize: 14 }}>
                    إلغاء الطلب
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </ScrollView>
      )}

      <DriverPickerModal
        visible={showDriverPicker}
        onClose={() => setShowDriverPicker(false)}
        orderId={order?.id ?? ''}
      />
    </View>
  );
}

function StatusPill({ status }: { status: RefillOrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <View
      style={{
        backgroundColor: meta.bg,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: meta.fg, fontWeight: '800', fontSize: 12 }}>{meta.label}</Text>
    </View>
  );
}

function Timeline({ status }: { status: RefillOrderStatus }) {
  // Find current node's position so previous nodes render as "completed".
  const currentIdx = TIMELINE.findIndex((n) => n.key === status);

  // Cancelled / failed orders fall outside the linear flow — show a flat
  // banner instead of forcing them into the happy-path timeline.
  if (status === 'CANCELLED' || status === 'FAILED') {
    return (
      <View
        style={{
          backgroundColor: '#fef2f2',
          borderColor: '#fecaca',
          borderWidth: 1,
          borderRadius: 14,
          padding: 12,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <MaterialIcons name="block" size={22} color="#dc2626" />
        <Text style={{ color: '#991b1b', fontWeight: '700', fontSize: 13 }}>
          {STATUS_META[status].label}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}
    >
      {TIMELINE.map((node, i) => {
        const done = i <= currentIdx;
        return (
          <View key={node.key} style={{ alignItems: 'center', flex: 1 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: done ? '#10b981' : '#fff',
                borderWidth: 2,
                borderColor: done ? '#10b981' : '#cbd5e1',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name={node.icon} size={18} color={done ? '#fff' : '#cbd5e1'} />
            </View>
            <Text
              style={{
                fontSize: 10,
                marginTop: 4,
                color: done ? '#065f46' : '#94a3b8',
                fontWeight: done ? '800' : '600',
              }}
            >
              {node.label}
            </Text>
          </View>
        );
      })}
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

function DriverPickerModal({
  visible,
  onClose,
  orderId,
}: {
  visible: boolean;
  onClose: () => void;
  orderId: string;
}) {
  const driversQuery = useDriversList();
  const assign = useAssignDriver();

  async function pick(driverId: string) {
    try {
      await assign.mutateAsync({ orderId, driverId });
      onClose();
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'تعذّر تعيين السائق');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#e2e8f0',
            backgroundColor: '#fff',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>اختر سائقاً</Text>
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
            <MaterialIcons name="close" size={20} color="#0f172a" />
          </Pressable>
        </View>

        {driversQuery.isLoading && (
          <View style={{ padding: 14 }}>
            <Skeleton height={64} borderRadius={16} style={{ marginBottom: 8 }} />
            <Skeleton height={64} borderRadius={16} style={{ marginBottom: 8 }} />
            <Skeleton height={64} borderRadius={16} style={{ marginBottom: 8 }} />
          </View>
        )}

        {driversQuery.data?.items.length === 0 && (
          <EmptyState
            icon="local-shipping"
            title="لا يوجد سائقون"
            subtitle="أضف سائقاً من لوحة الويب أوّلاً"
          />
        )}

        {driversQuery.data && driversQuery.data.items.length > 0 && (
          <FlatList
            data={driversQuery.data.items}
            keyExtractor={(d) => d.id}
            contentContainerStyle={{ padding: 14 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => pick(item.id)}
                disabled={assign.isPending}
                style={({ pressed }) => ({
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 12,
                  opacity: pressed || assign.isPending ? 0.7 : 1,
                })}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: item.isOnline ? '#dcfce7' : '#f1f5f9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons
                    name="local-shipping"
                    size={22}
                    color={item.isOnline ? '#10b981' : '#94a3b8'}
                  />
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>
                    {item.fullName}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    {item.phone} · {item.isOnline ? 'متصل' : 'غير متصل'}
                  </Text>
                </View>
                {item.activeOrderId && (
                  <View
                    style={{
                      backgroundColor: '#fff7ed',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ color: '#9a3412', fontSize: 10, fontWeight: '700' }}>مشغول</Text>
                  </View>
                )}
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
