/**
 * Accounting — daily/monthly P&L + transaction ledger.
 *
 * Three sections:
 *   1. Period selector (today/week/month/year) — defaults to month.
 *   2. 2×2 KPI grid: revenue, expenses, net profit (big, tinted), growth%
 *      vs previous comparable period.
 *   3. Filterable + paginated transactions list (all / sales / expenses /
 *      salaries) with a "+ إضافة مصروف" FAB → modal.
 *
 * Notes on UX choices:
 *   - Net profit gets the largest typography in the KPI grid — it's the
 *     single number the owner actually cares about. Tint flips red on a loss.
 *   - Growth arrow points UP for positive growth, DOWN for negative. We
 *     keep the percentage positive in the label (e.g. "▼ 12%") so the
 *     direction comes from the icon, not a minus sign.
 *   - Transaction rows: positive amounts are green (sales), negative red
 *     (expenses/salaries). We always show the absolute amount with a sign
 *     prefix because Arabic readers don't parse `-1,000` left-of-number
 *     cleanly in RTL.
 */

import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { arSA } from 'date-fns/locale';

import {
  useAccountingSummary,
  useAccountingTransactions,
  useCreateExpense,
  type AccountingPeriod,
  type AccountingTxFilter,
  type AccountingTransaction,
} from '@/lib/queries';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

// Period pill order matches what owners scan visually in RTL: most-recent
// (today) on the right, longest (year) on the left. Default to month — the
// horizon most plant owners think in when they look at "how am I doing".
const PERIODS: { key: AccountingPeriod; label: string }[] = [
  { key: 'today', label: 'اليوم' },
  { key: 'week', label: 'الأسبوع' },
  { key: 'month', label: 'الشهر' },
  { key: 'year', label: 'السنة' },
];

const TX_FILTERS: { key: AccountingTxFilter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'sale', label: 'مبيعات' },
  { key: 'expense', label: 'مصروفات' },
  { key: 'salary', label: 'رواتب' },
];

const EXPENSE_CATEGORIES: { key: string; label: string; icon: MaterialIconName }[] = [
  { key: 'fuel', label: 'وقود', icon: 'local-gas-station' },
  { key: 'maintenance', label: 'صيانة', icon: 'build' },
  { key: 'salary', label: 'راتب', icon: 'badge' },
  { key: 'utilities', label: 'فواتير', icon: 'bolt' },
  { key: 'rent', label: 'إيجار', icon: 'home-work' },
  { key: 'other', label: 'أخرى', icon: 'more-horiz' },
];

function n(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('en-US');
}

function iqd(v: number): string {
  return `${n(v)} د.ع`;
}

// Tx kind → label + colour for the list row. Sales positive, others negative.
const TX_META: Record<
  AccountingTransaction['kind'],
  { label: string; icon: MaterialIconName; tint: string; bg: string }
> = {
  sale: { label: 'بيع', icon: 'trending-up', tint: '#10b981', bg: '#d1fae5' },
  expense: { label: 'مصروف', icon: 'trending-down', tint: '#ef4444', bg: '#fee2e2' },
  salary: { label: 'راتب', icon: 'badge', tint: '#f59e0b', bg: '#fef3c7' },
};

export default function AccountingScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<AccountingPeriod>('month');
  const [txFilter, setTxFilter] = useState<AccountingTxFilter>('all');
  const [page, setPage] = useState(1);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  const summaryQuery = useAccountingSummary(period);
  const txQuery = useAccountingTransactions({ kind: txFilter, page, pageSize: 50 });

  const items = txQuery.data?.items ?? [];
  const totalPages = txQuery.data?.totalPages ?? 0;

  const summary = summaryQuery.data;
  const netPositive = (summary?.netProfit ?? 0) >= 0;
  const growthPositive = (summary?.growthPct ?? 0) >= 0;

  function onChangeFilter(next: AccountingTxFilter) {
    setTxFilter(next);
    setPage(1);
  }

  function onChangePeriod(next: AccountingPeriod) {
    setPeriod(next);
  }

  const renderTx: ListRenderItem<AccountingTransaction> = ({ item }) => (
    <TxRow tx={item} />
  );

  function onRefreshAll() {
    summaryQuery.refetch();
    txQuery.refetch();
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Hero — teal gradient header echoing promos/home for visual continuity. */}
      <LinearGradient
        colors={['#14b8a6', '#0e9384']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
      >
        <SafeAreaView edges={['top']}>
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 4,
              paddingBottom: 14,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={({ pressed }) => ({
                padding: 8,
                borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.18)',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <MaterialIcons name="arrow-forward" size={22} color="#fff" />
            </Pressable>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>
              المحاسبة
            </Text>
            <View style={{ width: 38 }} />
          </View>

          {/* Period selector pills */}
          <View style={{ paddingHorizontal: 12, paddingBottom: 14 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: 8,
                flexDirection: 'row-reverse',
                paddingHorizontal: 4,
              }}
            >
              {PERIODS.map((p) => {
                const active = p.key === period;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => onChangePeriod(p.key)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: active ? '#fff' : 'rgba(255,255,255,0.22)',
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: active ? '#0e9384' : '#fff',
                        fontWeight: active ? '900' : '700',
                        fontSize: 12,
                      }}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={
              (summaryQuery.isFetching && !summaryQuery.isLoading) ||
              (txQuery.isFetching && !txQuery.isLoading)
            }
            onRefresh={onRefreshAll}
          />
        }
      >
        {/* KPI grid: 2×2 with net-profit emphasised */}
        {summaryQuery.isLoading ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Skeleton height={92} borderRadius={18} style={{ width: '48%' }} />
            <Skeleton height={92} borderRadius={18} style={{ width: '48%' }} />
            <Skeleton height={92} borderRadius={18} style={{ width: '48%' }} />
            <Skeleton height={92} borderRadius={18} style={{ width: '48%' }} />
          </View>
        ) : summaryQuery.isError && !summary ? (
          <EmptyState
            icon="cloud-off"
            title="تعذّر تحميل الملخّص"
            actionLabel="إعادة المحاولة"
            onAction={() => summaryQuery.refetch()}
          />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <KpiCard
              icon="trending-up"
              label="الإيرادات"
              value={iqd(summary?.revenue ?? 0)}
              tint="#10b981"
            />
            <KpiCard
              icon="trending-down"
              label="المصروفات"
              value={iqd(summary?.expenses ?? 0)}
              tint="#ef4444"
            />
            <KpiCard
              icon={netPositive ? 'attach-money' : 'money-off'}
              label="صافي الربح"
              value={iqd(summary?.netProfit ?? 0)}
              tint={netPositive ? '#0e9384' : '#ef4444'}
              big
            />
            <KpiCard
              icon={growthPositive ? 'arrow-upward' : 'arrow-downward'}
              label="النمو vs السابق"
              value={`${Math.abs(summary?.growthPct ?? 0).toFixed(1)}%`}
              tint={growthPositive ? '#10b981' : '#ef4444'}
            />
          </View>
        )}

        {/* Transactions header + filter chips */}
        <View
          style={{
            marginTop: 22,
            marginBottom: 10,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>
            المعاملات
          </Text>
          {txQuery.data && (
            <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700' }}>
              {n(txQuery.data.total)} معاملة
            </Text>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: 8,
            flexDirection: 'row-reverse',
            paddingBottom: 12,
          }}
        >
          {TX_FILTERS.map((f) => {
            const active = f.key === txFilter;
            return (
              <Pressable
                key={f.key}
                onPress={() => onChangeFilter(f.key)}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? '#0e9384' : '#fff',
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
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Transactions body */}
        {txQuery.isLoading && (
          <View>
            <SkeletonCard height={70} />
            <SkeletonCard height={70} />
            <SkeletonCard height={70} />
          </View>
        )}

        {!txQuery.isLoading && !txQuery.isError && items.length === 0 && (
          <EmptyState
            icon="receipt"
            title="لا توجد معاملات"
            subtitle={
              txFilter === 'all'
                ? 'ستظهر هنا المبيعات والمصروفات فور تسجيلها.'
                : 'لا توجد معاملات بهذا التصنيف.'
            }
          />
        )}

        {items.length > 0 && (
          <FlatList
            data={items}
            keyExtractor={(t) => t.id}
            renderItem={renderTx}
            scrollEnabled={false}
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
      </ScrollView>

      {/* + إضافة مصروف FAB */}
      <Pressable
        onPress={() => setShowExpenseModal(true)}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: 24,
          right: 20,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <LinearGradient
          colors={['#14b8a6', '#0e9384']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: 18,
            paddingVertical: 14,
            borderRadius: 30,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 8,
            shadowColor: '#0e9384',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <MaterialIcons name="add" size={22} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>
            إضافة مصروف
          </Text>
        </LinearGradient>
      </Pressable>

      <ExpenseModal
        visible={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
      />
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// KPI card
// ────────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  tint,
  big = false,
}: {
  icon: MaterialIconName;
  label: string;
  value: string;
  tint: string;
  big?: boolean;
}) {
  return (
    <View
      style={{
        width: '48%',
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 14,
        borderWidth: big ? 2 : 1,
        borderColor: big ? tint : '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
      }}
    >
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 10,
            backgroundColor: tint + '1F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons name={icon} size={16} color={tint} />
        </View>
        <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700' }}>
          {label}
        </Text>
      </View>
      <Text
        style={{
          fontSize: big ? 20 : 16,
          fontWeight: '900',
          color: tint,
          textAlign: 'right',
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Transaction row
// ────────────────────────────────────────────────────────────────────

function TxRow({ tx }: { tx: AccountingTransaction }) {
  const meta = TX_META[tx.kind];
  // amountIqd from backend can be signed; we always display the absolute and
  // re-derive sign from kind so an accidentally-positive expense still reads
  // as red (defensive — backend is supposed to send negatives for expenses).
  const isPositive = tx.kind === 'sale';
  const abs = Math.abs(tx.amountIqd ?? 0);
  const sign = isPositive ? '+' : '−';
  const tint = isPositive ? '#10b981' : '#ef4444';

  const when = formatDistanceToNow(new Date(tx.createdAt), {
    addSuffix: true,
    locale: arSA,
  });

  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: meta.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name={meta.icon} size={20} color={meta.tint} />
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text
          style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}
          numberOfLines={1}
        >
          {tx.note ?? meta.label}
        </Text>
        <View
          style={{
            flexDirection: 'row-reverse',
            gap: 8,
            marginTop: 2,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 10, color: '#94a3b8' }}>{when}</Text>
          {tx.actorName && (
            <>
              <Text style={{ fontSize: 10, color: '#cbd5e1' }}>·</Text>
              <Text style={{ fontSize: 10, color: '#64748b' }}>{tx.actorName}</Text>
            </>
          )}
        </View>
      </View>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '900',
          color: tint,
          textAlign: 'left',
        }}
      >
        {sign} {n(abs)}{' '}
        <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '700' }}>د.ع</Text>
      </Text>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// Pagination (mirrors orders.tsx — kept inline to avoid touching other files)
// ────────────────────────────────────────────────────────────────────

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
// Expense modal
// ────────────────────────────────────────────────────────────────────

function ExpenseModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const create = useCreateExpense();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].key);
  const [note, setNote] = useState('');

  const amountNum = parseInt(amount, 10);
  const valid = Number.isFinite(amountNum) && amountNum > 0;

  function reset() {
    setAmount('');
    setCategory(EXPENSE_CATEGORIES[0].key);
    setNote('');
  }

  async function submit() {
    if (!valid) {
      Alert.alert('تحقّق', 'أدخل مبلغاً صحيحاً أكبر من صفر');
      return;
    }
    try {
      await create.mutateAsync({
        amountIqd: amountNum,
        category,
        note: note.trim() || undefined,
      });
      reset();
      onClose();
      // Quiet success — invalidation will refresh the list, no need for Alert.
    } catch (err: any) {
      Alert.alert(
        'خطأ',
        err?.response?.data?.message ?? 'تعذّر تسجيل المصروف',
      );
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#e2e8f0',
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a' }}>
              إضافة مصروف
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
        </SafeAreaView>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#475569',
                textAlign: 'right',
                marginBottom: 8,
              }}
            >
              التصنيف
            </Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
              {EXPENSE_CATEGORIES.map((c) => {
                const active = c.key === category;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: active ? '#0e9384' : '#fff',
                      borderWidth: 1,
                      borderColor: active ? '#0e9384' : '#e2e8f0',
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 6,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <MaterialIcons
                      name={c.icon}
                      size={14}
                      color={active ? '#fff' : '#0e9384'}
                    />
                    <Text
                      style={{
                        color: active ? '#fff' : '#475569',
                        fontWeight: active ? '800' : '600',
                        fontSize: 12,
                      }}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <ModalField
              label="المبلغ (د.ع)"
              value={amount}
              onChangeText={setAmount}
              placeholder="مثلاً: 50000"
              icon="payments"
              keyboardType="number-pad"
            />
            <ModalField
              label="ملاحظة (اختياري)"
              value={note}
              onChangeText={setNote}
              placeholder="تفاصيل المصروف…"
              icon="notes"
            />
          </ScrollView>

          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#fff',
              padding: 14,
              borderTopWidth: 1,
              borderTopColor: '#e2e8f0',
            }}
          >
            <SafeAreaView edges={['bottom']}>
              <Pressable
                onPress={submit}
                disabled={!valid || create.isPending}
                style={({ pressed }) => ({
                  borderRadius: 18,
                  overflow: 'hidden',
                  opacity: pressed || create.isPending || !valid ? 0.85 : 1,
                })}
              >
                <LinearGradient
                  colors={!valid ? ['#cbd5e1', '#94a3b8'] : ['#14b8a6', '#0e9384']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingVertical: 16,
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
                        تسجيل المصروف
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </SafeAreaView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function ModalField({
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
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={{ marginTop: 14 }}>
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
