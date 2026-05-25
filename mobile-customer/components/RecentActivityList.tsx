import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useMyOrders } from '@/lib/queries';
import { iqd, fmtArabicDate, daysBetween } from '@/lib/format';
import type { RefillOrder, RefillOrderStatus, RefillOrderKind } from '@/lib/types';

/**
 * "نشاطك الأخير" — يعرض آخر ٣ طلبات + ملخّص معدّل التعبئة.
 * يستهلك useMyOrders (سيكون مكسوراً حتى يضاف backend endpoint /orders/me
 * في مرحلة الـ backend cleanup). يعالج loading / error / empty بهدوء.
 */

interface StatusVisual {
  bg: string;
  fg: string;
  icon: 'task-alt' | 'schedule' | 'cancel' | 'local-shipping';
  text: string;
}

function statusVisual(status: RefillOrderStatus, _kind: RefillOrderKind): StatusVisual {
  switch (status) {
    case 'COMPLETED':
      return { bg: '#ecfdf5', fg: '#10b981', icon: 'task-alt', text: 'مكتمل' };
    case 'ASSIGNED':
    case 'EN_ROUTE':
      return { bg: '#e0f2fe', fg: '#0284c7', icon: 'local-shipping', text: 'في الطريق' };
    case 'CANCELLED':
    case 'FAILED':
      return { bg: '#fef2f2', fg: '#ef4444', icon: 'cancel', text: 'ملغي' };
    case 'PENDING':
    default:
      return { bg: '#fef3c7', fg: '#d97706', icon: 'schedule', text: 'قيد المعالجة' };
  }
}

function kindLabel(kind: RefillOrderKind): string {
  switch (kind) {
    case 'REFILL':
      return 'تعبئة خزان';
    case 'TANK_DELIVERY':
      return 'تسليم خزان جديد';
    case 'TANK_RECLAIM':
      return 'سحب الخزان';
    case 'WALKIN_SALE':
      return 'بيع مباشر';
  }
}

/** "قبل ٢٣ يوم" أو "اليوم" أو "أمس". */
function relativeArabic(date: string | null | undefined): string {
  if (!date) return '—';
  const d = daysBetween(date);
  if (d === 0) return 'اليوم';
  if (d === 1) return 'أمس';
  if (d < 30) return `قبل ${d.toLocaleString('ar-IQ')} يوم`;
  const months = Math.floor(d / 30);
  return `قبل ${months.toLocaleString('ar-IQ')} ${months === 1 ? 'شهر' : 'أشهر'}`;
}

/** متوسط الأيام بين الطلبات المكتملة. */
function avgInterval(orders: RefillOrder[]): number | null {
  const completed = orders
    .filter((o) => o.completedAt && o.kind === 'REFILL')
    .map((o) => new Date(o.completedAt!).getTime())
    .sort((a, b) => b - a);
  if (completed.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 0; i < completed.length - 1; i++) {
    gaps.push((completed[i] - completed[i + 1]) / (1000 * 60 * 60 * 24));
  }
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
}

function ActivityRow({ order, showDivider }: { order: RefillOrder; showDivider: boolean }) {
  const v = statusVisual(order.status, order.kind);
  const date = order.completedAt ?? order.requestedAt;
  return (
    <>
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
          padding: 12,
        }}
      >
        <View
          style={{
            backgroundColor: v.bg,
            width: 36,
            height: 36,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons name={v.icon} size={20} color={v.fg} />
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 12, color: '#0f172a', fontWeight: '700' }}>
            {kindLabel(order.kind)}
          </Text>
          <Text style={{ fontSize: 10, color: '#94a3b8' }}>
            {relativeArabic(date)} · {fmtArabicDate(date)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 11, color: v.fg, fontWeight: '900' }}>
            {order.priceIqd > 0 ? iqd(order.priceIqd) : '—'}
          </Text>
          <Text style={{ fontSize: 9, color: v.fg, fontWeight: '700' }}>{v.text}</Text>
        </View>
      </View>
      {showDivider && (
        <View
          style={{
            height: 1,
            backgroundColor: '#f1f5f9',
            marginHorizontal: 12,
          }}
        />
      )}
    </>
  );
}

export function RecentActivityList() {
  const { data: orders, isLoading, error } = useMyOrders();

  // Empty / error / loading — لا نخفي القسم كاملاً، لكن نختصره.
  if (isLoading) {
    return (
      <View style={{ marginTop: 18 }}>
        <Header />
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 18,
            padding: 24,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>جاري التحميل…</Text>
        </View>
      </View>
    );
  }

  if (error || !orders || orders.length === 0) {
    return (
      <View style={{ marginTop: 18 }}>
        <Header />
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 18,
            padding: 20,
            alignItems: 'center',
            gap: 8,
          }}
        >
          <MaterialIcons name="receipt-long" size={32} color="#cbd5e1" />
          <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center' }}>
            لا توجد طلبات سابقة — اطلب تعبئتك الأولى من الزر فوق
          </Text>
        </View>
      </View>
    );
  }

  const recent = orders.slice(0, 3);
  const totalSpent = orders
    .filter((o) => o.status === 'COMPLETED')
    .reduce((sum, o) => sum + o.paidAmountIqd, 0);
  const completedRefills = orders.filter(
    (o) => o.status === 'COMPLETED' && o.kind === 'REFILL',
  ).length;
  const avg = avgInterval(orders);

  return (
    <View style={{ marginTop: 18 }}>
      <Header />

      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 18,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 1,
          overflow: 'hidden',
        }}
      >
        {recent.map((o, i) => (
          <ActivityRow key={o.id} order={o} showDivider={i < recent.length - 1} />
        ))}
      </View>

      {/* Summary chip */}
      <View
        style={{
          marginTop: 10,
          backgroundColor: '#f0fdfa',
          borderColor: '#ccfbf1',
          borderWidth: 1,
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <MaterialIcons name="trending-up" size={18} color="#0d9488" />
          <Text style={{ fontSize: 11, color: '#0d9488', fontWeight: '700' }}>
            {avg != null
              ? `معدّل التعبئة كل ${avg.toLocaleString('ar-IQ')} يوم`
              : 'سيظهر معدّل التعبئة بعد طلبَين'}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: '#0d9488', fontWeight: '900' }}>
          {completedRefills.toLocaleString('ar-IQ')} تعبئات · {iqd(totalSpent)}
        </Text>
      </View>
    </View>
  );
}

function Header() {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 4,
        marginBottom: 10,
      }}
    >
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <MaterialIcons name="receipt-long" size={18} color="#0284c7" />
        <Text style={{ fontSize: 13, fontWeight: '900', color: '#0f172a' }}>
          نشاطك الأخير
        </Text>
      </View>
      <Pressable
        onPress={() => router.push('/(tabs)/orders')}
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Text style={{ fontSize: 11, color: '#0369a1', fontWeight: '700' }}>عرض الكل</Text>
        <MaterialIcons name="chevron-left" size={14} color="#0284c7" />
      </Pressable>
    </View>
  );
}
