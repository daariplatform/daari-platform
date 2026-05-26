import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  ScrollView,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { arSA } from 'date-fns/locale';

import { useAuditLog, type AuditEntry } from '@/lib/queries';
import { SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

// Backend filter values — must match what /plant/audit-log expects.
type ActorFilter = '' | 'OWNER' | 'MANAGER' | 'ACCOUNTANT';
type ActionFilter = '' | 'UPDATE' | 'CREATE' | 'DELETE';

const ROLE_META: Record<
  string,
  { label: string; bg: string; fg: string }
> = {
  OWNER: { label: 'المالك', bg: '#ccfbf1', fg: '#0c7a6e' },
  MANAGER: { label: 'المدير', bg: '#dbeafe', fg: '#1d4ed8' },
  ACCOUNTANT: { label: 'محاسب', bg: '#fef3c7', fg: '#92400e' },
};

const ACTION_META: Record<
  string,
  { icon: MaterialIconName; bg: string; fg: string; verb: string }
> = {
  CREATE: { icon: 'add-circle', bg: '#dcfce7', fg: '#15803d', verb: 'أنشأ' },
  UPDATE: { icon: 'edit', bg: '#dbeafe', fg: '#1d4ed8', verb: 'حدّث' },
  DELETE: { icon: 'delete', bg: '#fee2e2', fg: '#dc2626', verb: 'حذف' },
};

const FALLBACK_ACTION = {
  icon: 'history' as MaterialIconName,
  bg: '#e2e8f0',
  fg: '#475569',
  verb: 'عَدّل',
};

/**
 * Map an entityType from the backend into the Arabic phrase we use to
 * describe what was touched. Unknown types fall through to a generic
 * "السجل" so the row still renders.
 */
const ENTITY_LABEL: Record<string, string> = {
  Order: 'الطلب',
  RefillOrder: 'الطلب',
  Customer: 'الزبون',
  Driver: 'السائق',
  Tank: 'الخزان',
  Stock: 'المخزون',
  StockSettings: 'إعدادات المخزون',
  Promo: 'العرض',
  PromoCampaign: 'العرض',
  Plant: 'المحطة',
  PlantSettings: 'إعدادات المحطة',
  User: 'العضو',
  TeamMember: 'العضو',
  PricingPlan: 'خطة التسعير',
  Subscription: 'الاشتراك',
};

const ACTOR_FILTERS: { key: ActorFilter; label: string }[] = [
  { key: '', label: 'الكل' },
  { key: 'OWNER', label: 'المالك' },
  { key: 'MANAGER', label: 'المدير' },
  { key: 'ACCOUNTANT', label: 'محاسب' },
];

const ACTION_FILTERS: { key: ActionFilter; label: string }[] = [
  { key: '', label: 'الكل' },
  { key: 'UPDATE', label: 'تحديث' },
  { key: 'CREATE', label: 'إنشاء' },
  { key: 'DELETE', label: 'حذف' },
];

/**
 * Try to convert a value into a short, readable Arabic-friendly string.
 * Money fields get a thousands-separator; booleans, dates, and null get
 * special handling. Anything we can't render shortly returns null so
 * the caller knows to fall back to a vaguer phrase.
 */
function formatValue(value: any): string | null {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'مُفعَّل' : 'مُعطَّل';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  if (typeof value === 'string') {
    // Trim long strings so a single big payload doesn't blow the row out.
    if (value.length > 40) return value.slice(0, 37) + '…';
    return value;
  }
  return null;
}

/**
 * Compose a one-line human description of what changed. We look for the
 * single field that differs between `before` and `after` (the most
 * common shape — backend usually emits per-field updates) and render
 * "حدّث X الخزان من A إلى B". When that fails (multi-field write,
 * unfamiliar shape, etc.), we degrade gracefully into a verb-only line.
 */
function describeChange(entry: AuditEntry): string {
  const action = ACTION_META[entry.action] ?? FALLBACK_ACTION;
  const entity = ENTITY_LABEL[entry.entityType] ?? 'السجل';

  if (entry.action === 'CREATE') {
    return `${action.verb} ${entity}`;
  }
  if (entry.action === 'DELETE') {
    return `${action.verb} ${entity}`;
  }

  // UPDATE — diff before/after.
  if (entry.before && entry.after && typeof entry.before === 'object' && typeof entry.after === 'object') {
    const keys = new Set([
      ...Object.keys(entry.before ?? {}),
      ...Object.keys(entry.after ?? {}),
    ]);
    const diffs: { key: string; from: any; to: any }[] = [];
    keys.forEach((k) => {
      const from = (entry.before as any)?.[k];
      const to = (entry.after as any)?.[k];
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        diffs.push({ key: k, from, to });
      }
    });
    if (diffs.length === 1) {
      const { key, from, to } = diffs[0];
      const fromStr = formatValue(from);
      const toStr = formatValue(to);
      const fieldLabel = FIELD_LABELS[key] ?? key;
      if (fromStr && toStr) {
        return `${action.verb} ${fieldLabel} ${entity} من ${fromStr} إلى ${toStr}`;
      }
      return `${action.verb} ${fieldLabel} ${entity}`;
    }
    if (diffs.length > 1) {
      return `${action.verb} ${entity} (${diffs.length.toLocaleString('en-US')} حقول)`;
    }
  }

  return `${action.verb} ${entity}`;
}

/**
 * Friendly Arabic labels for the most-common change fields. Anything
 * not in this map falls back to the raw key — which is ugly but at
 * least visible.
 */
const FIELD_LABELS: Record<string, string> = {
  price: 'سعر',
  priceIqd: 'سعر',
  refillPrice: 'سعر التعبئة',
  refillPriceIqd: 'سعر التعبئة',
  capacity: 'السعة',
  capacityLiters: 'السعة',
  lowThresholdLiters: 'حد الإنذار',
  status: 'الحالة',
  fullName: 'الاسم',
  phone: 'الهاتف',
  isActive: 'حالة التفعيل',
  isOnline: 'الاتصال',
  role: 'الدور',
  liters: 'اللترات',
  paidAmountIqd: 'المبلغ المدفوع',
  baseCommissionPct: 'نسبة العمولة',
  salaryIqd: 'الراتب',
};

/**
 * Entity-type → in-app route. Only types where a detail screen exists
 * become tappable; the rest stay informational.
 */
function entityRoute(entry: AuditEntry): string | null {
  switch (entry.entityType) {
    case 'Order':
    case 'RefillOrder':
      return `/order/${entry.entityId}`;
    case 'Customer':
      return `/customer/${entry.entityId}`;
    case 'Driver':
      return `/drivers/${entry.entityId}`;
    case 'Promo':
    case 'PromoCampaign':
      return `/promo/${entry.entityId}`;
    default:
      return null;
  }
}

/**
 * Audit log — read-only trail of who changed what. Two filter rows
 * (actor role + action verb), paginated list, smart Arabic phrasing
 * of `before/after` diffs. Tappable if the entity has a detail screen
 * in this app.
 */
export default function AuditLogScreen() {
  const router = useRouter();
  const [actor, setActor] = useState<ActorFilter>('');
  const [action, setAction] = useState<ActionFilter>('');
  const [page, setPage] = useState(1);

  const logQuery = useAuditLog({
    page,
    pageSize: 50,
    actor: actor || undefined,
    action: action || undefined,
  });

  const items = logQuery.data?.items ?? [];
  const totalPages = logQuery.data?.totalPages ?? 0;

  function handleEntityTap(entry: AuditEntry) {
    const route = entityRoute(entry);
    if (route) router.push(route as any);
  }

  const renderItem: ListRenderItem<AuditEntry> = ({ item }) => (
    <AuditRow entry={item} onPressEntity={() => handleEntityTap(item)} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 12,
            gap: 8,
            borderBottomWidth: 1,
            borderBottomColor: '#e2e8f0',
          }}
        >
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
          <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a' }}>
            سجل التعديلات
          </Text>
        </View>

        {/* Actor filter row */}
        <FilterRow
          label="حسب العضو"
          options={ACTOR_FILTERS}
          value={actor}
          onChange={(v) => {
            setActor(v as ActorFilter);
            setPage(1);
          }}
        />
        {/* Action filter row */}
        <FilterRow
          label="حسب العملية"
          options={ACTION_FILTERS}
          value={action}
          onChange={(v) => {
            setAction(v as ActionFilter);
            setPage(1);
          }}
        />
      </SafeAreaView>

      {logQuery.isLoading && (
        <View style={{ padding: 14 }}>
          <SkeletonCard height={80} />
          <SkeletonCard height={80} />
          <SkeletonCard height={80} />
          <SkeletonCard height={80} />
        </View>
      )}

      {logQuery.isError && !logQuery.data && (
        <EmptyState
          icon="cloud-off"
          title="تعذّر تحميل السجل"
          actionLabel="إعادة المحاولة"
          onAction={() => logQuery.refetch()}
        />
      )}

      {!logQuery.isLoading && !logQuery.isError && items.length === 0 && (
        <EmptyState
          icon="history"
          title="لا توجد تعديلات"
          subtitle={
            actor || action
              ? 'لا توجد نتائج مطابقة للفلتر المختار.'
              : 'سيظهر هنا أي تعديل يجريه أعضاء الفريق.'
          }
        />
      )}

      {items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(e) => e.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
          refreshControl={
            <RefreshControl
              refreshing={logQuery.isFetching && !logQuery.isLoading}
              onRefresh={() => logQuery.refetch()}
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
    </View>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View
      style={{
        paddingTop: 8,
        paddingBottom: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '800',
          color: '#94a3b8',
          textAlign: 'right',
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // RTL: render right-to-left so "الكل" lands under the label.
        contentContainerStyle={{ flexDirection: 'row-reverse', gap: 6, paddingHorizontal: 2 }}
      >
        {options.map((opt) => {
          const active = value === opt.key;
          return (
            <Pressable
              key={opt.key || 'all'}
              onPress={() => onChange(opt.key)}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 6,
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
                  fontWeight: '800',
                  fontSize: 11,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function AuditRow({
  entry,
  onPressEntity,
}: {
  entry: AuditEntry;
  onPressEntity: () => void;
}) {
  const action = ACTION_META[entry.action] ?? FALLBACK_ACTION;
  const role = ROLE_META[entry.actorRole] ?? {
    label: entry.actorRole,
    bg: '#f1f5f9',
    fg: '#475569',
  };
  const description = useMemo(() => describeChange(entry), [entry]);
  const when = useMemo(
    () =>
      formatDistanceToNow(new Date(entry.createdAt), {
        addSuffix: true,
        locale: arSA,
      }),
    [entry.createdAt],
  );
  const route = entityRoute(entry);

  return (
    <Pressable
      onPress={route ? onPressEntity : undefined}
      disabled={!route}
      style={({ pressed }) => ({
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        opacity: pressed && route ? 0.92 : 1,
      })}
    >
      <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: action.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons name={action.icon} size={20} color={action.fg} />
        </View>

        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
              alignSelf: 'stretch',
              justifyContent: 'flex-start',
            }}
          >
            <Text
              style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}
              numberOfLines={1}
            >
              {entry.actorName}
            </Text>
            <View
              style={{
                backgroundColor: role.bg,
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: role.fg, fontWeight: '800', fontSize: 9 }}>
                {role.label}
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontSize: 12,
              color: '#334155',
              marginTop: 6,
              textAlign: 'right',
              lineHeight: 18,
            }}
          >
            {description}
          </Text>

          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 6,
              marginTop: 6,
            }}
          >
            <Text style={{ fontSize: 10, color: '#94a3b8' }}>{when}</Text>
            {route && (
              <>
                <Text style={{ fontSize: 10, color: '#cbd5e1' }}>·</Text>
                <View
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <MaterialIcons name="open-in-new" size={11} color="#0e9384" />
                  <Text style={{ fontSize: 10, color: '#0e9384', fontWeight: '800' }}>
                    عرض
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
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
        صفحة {page.toLocaleString('en-US')} من {totalPages.toLocaleString('en-US')}
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
