'use client';

/**
 * Accounting — the audit found this page only rendered P&L despite the
 * backend exposing 12+ accounting endpoints (expenses, salaries, invoices,
 * categories, recurring expenses, cash-flow, transactions feed). All of
 * that revenue + cost workflow was orphaned, forcing plants to use the
 * mobile app even for desktop-only book-keeping.
 *
 * This rewrite exposes the most-used flows as tabs so plant admins can
 * record expenses, compute + pay driver salaries, manage invoices, and
 * scan the unified transactions feed without leaving the dashboard.
 *
 * Each tab pulls only when it's selected (React Query enabled gate) so
 * the first paint stays fast on large books.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate, iqd } from '@/lib/format';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Receipt,
  FileText,
  Users,
  Activity,
} from 'lucide-react';

type Tab = 'overview' | 'expenses' | 'salaries' | 'invoices' | 'transactions';

const EXPENSE_CATEGORIES = [
  { id: 'FUEL', label: 'وقود' },
  { id: 'MAINTENANCE', label: 'صيانة' },
  { id: 'UTILITIES', label: 'فواتير الخدمات' },
  { id: 'PURCHASE', label: 'مشتريات' },
  { id: 'RENT', label: 'إيجار' },
  { id: 'OTHER', label: 'أخرى' },
] as const;
type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]['id'];

interface PnL {
  from: string;
  to: string;
  revenueIqd: number;
  expensesIqd: number;
  salariesIqd: number;
  netIqd: number;
  completedOrders: number;
}

interface Expense {
  id: string;
  category: ExpenseCategoryId;
  amountIqd: number;
  description: string | null;
  occurredAt: string;
  receiptUrl: string | null;
}

interface Driver {
  id: string;
  user: { fullName: string };
}

interface SalaryComputeResult {
  id: string;
  driverId: string;
  periodStart: string;
  periodEnd: string;
  baseIqd: number;
  commissionIqd: number;
  bonusIqd: number;
  deductionIqd: number;
  totalIqd: number;
  paidAt: string | null;
}

interface Invoice {
  id: string;
  customerId: string | null;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID';
  totalIqd: number;
  paidIqd: number;
  dueAt: string | null;
  createdAt: string;
  customer?: { fullName: string } | null;
}

interface Transaction {
  id: string;
  kind: 'sale' | 'expense' | 'salary';
  amountIqd: number;
  occurredAt: string;
  description: string;
}

interface PaginatedTx {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">المحاسبة</h1>
        <p className="text-slate-500">إدارة الإيرادات والمصاريف والرواتب والفواتير</p>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {(
          [
            { id: 'overview', label: 'نظرة عامة', icon: TrendingUp },
            { id: 'expenses', label: 'المصاريف', icon: Receipt },
            { id: 'salaries', label: 'الرواتب', icon: Users },
            { id: 'invoices', label: 'الفواتير', icon: FileText },
            { id: 'transactions', label: 'الحركات', icon: Activity },
          ] as const
        ).map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                active ? 'bg-white shadow-sm text-aqua-700' : 'text-slate-500'
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'expenses' && <ExpensesTab />}
      {tab === 'salaries' && <SalariesTab />}
      {tab === 'invoices' && <InvoicesTab />}
      {tab === 'transactions' && <TransactionsTab />}
    </div>
  );
}

function OverviewTab() {
  const { data, isLoading } = useQuery<PnL>({
    queryKey: ['pnl'],
    queryFn: async () => (await api.get('/accounting/pnl')).data,
  });

  if (isLoading) return <p className="text-slate-500">جاري التحميل…</p>;
  if (!data) return <p className="text-slate-500">لا توجد بيانات</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard
        icon={TrendingUp}
        color="bg-emerald-50 text-emerald-700"
        label="الإيرادات"
        value={iqd(data.revenueIqd)}
      />
      <SummaryCard
        icon={TrendingDown}
        color="bg-red-50 text-red-700"
        label="المصاريف"
        value={iqd(data.expensesIqd)}
      />
      <SummaryCard
        icon={Wallet}
        color="bg-violet-50 text-violet-700"
        label="الرواتب"
        value={iqd(data.salariesIqd)}
      />
      <SummaryCard
        icon={TrendingUp}
        color={
          data.netIqd >= 0
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-red-50 text-red-700'
        }
        label="الصافي"
        value={iqd(data.netIqd)}
      />
    </div>
  );
}

function ExpensesTab() {
  const qc = useQueryClient();
  const { data: expenses, isLoading } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: async () => (await api.get('/accounting/expenses')).data,
  });
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<ExpenseCategoryId>('FUEL');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const addMutation = useMutation({
    mutationFn: async (body: {
      category: ExpenseCategoryId;
      amountIqd: number;
      description: string;
    }) => (await api.post('/accounting/expenses', body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      setShowForm(false);
      setAmount('');
      setDescription('');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'فشل تسجيل المصروف';
      alert(msg);
    },
  });

  function submit() {
    const n = parseInt(amount, 10);
    if (!Number.isFinite(n) || n <= 0) {
      alert('أدخل مبلغ صحيح أكبر من صفر');
      return;
    }
    addMutation.mutate({ category, amountIqd: n, description });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">المصاريف</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-aqua-600 hover:bg-aqua-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
        >
          <Plus size={14} /> مصروف جديد
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategoryId)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="المبلغ بالدينار"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف اختياري"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={addMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {addMutation.isPending ? 'جارٍ الحفظ…' : 'احفظ'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-slate-500">جاري التحميل…</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-right px-4 py-3">التصنيف</th>
                <th className="text-right px-4 py-3">الوصف</th>
                <th className="text-right px-4 py-3">المبلغ</th>
                <th className="text-right px-4 py-3">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {(expenses ?? []).map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-4 py-3">
                    {EXPENSE_CATEGORIES.find((c) => c.id === e.category)?.label ??
                      e.category}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {e.description ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-bold text-red-700">
                    {iqd(e.amountIqd)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {fmtDate(e.occurredAt)}
                  </td>
                </tr>
              ))}
              {(!expenses || expenses.length === 0) && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-slate-400 text-sm"
                  >
                    لا توجد مصاريف مسجّلة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SalariesTab() {
  const qc = useQueryClient();
  const { data: drivers } = useQuery<{ items: Driver[] }>({
    queryKey: ['drivers', 'salaries-tab'],
    queryFn: async () =>
      (await api.get('/drivers', { params: { page: 1, pageSize: 200 } })).data,
  });
  const [computed, setComputed] = useState<SalaryComputeResult | null>(null);

  const computeMutation = useMutation({
    mutationFn: async (body: {
      driverId: string;
      periodStart: string;
      periodEnd: string;
    }) => (await api.post<SalaryComputeResult>('/accounting/salaries/compute', body)).data,
    onSuccess: (data) => setComputed(data),
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'فشل احتساب الراتب';
      alert(msg);
    },
  });

  const payMutation = useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/accounting/salaries/${id}/pay`)).data,
    onSuccess: () => {
      setComputed(null);
      qc.invalidateQueries({ queryKey: ['pnl'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      alert('تم دفع الراتب وتسجيله في الحركات.');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'فشل دفع الراتب';
      alert(msg);
    },
  });

  const [driverId, setDriverId] = useState<string>('');
  // Default window = current calendar month so the typical "pay end-of-month"
  // flow takes one click.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [periodStart, setPeriodStart] = useState(
    monthStart.toISOString().slice(0, 10),
  );
  const [periodEnd, setPeriodEnd] = useState(now.toISOString().slice(0, 10));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">احتساب رواتب السائقين</h2>
      <div className="bg-white rounded-2xl shadow-sm p-5 grid md:grid-cols-4 gap-3">
        <select
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">اختر سائق…</option>
          {drivers?.items?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.user.fullName}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={() =>
            computeMutation.mutate({
              driverId,
              periodStart: new Date(periodStart).toISOString(),
              periodEnd: new Date(periodEnd).toISOString(),
            })
          }
          disabled={!driverId || computeMutation.isPending}
          className="bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50"
        >
          {computeMutation.isPending ? 'جارٍ الحساب…' : 'احسب الراتب'}
        </button>
      </div>

      {computed && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="font-bold text-sm text-slate-500 mb-3">نتيجة الحساب</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SalaryLine label="الأساسي" value={iqd(computed.baseIqd)} />
            <SalaryLine label="عمولة" value={iqd(computed.commissionIqd)} />
            <SalaryLine label="بونص" value={iqd(computed.bonusIqd)} />
            <SalaryLine label="خصم" value={iqd(computed.deductionIqd)} />
            <SalaryLine
              label="الإجمالي"
              value={iqd(computed.totalIqd)}
              highlight
            />
          </div>
          {!computed.paidAt && (
            <button
              onClick={() => payMutation.mutate(computed.id)}
              disabled={payMutation.isPending}
              className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50"
            >
              {payMutation.isPending ? 'جارٍ الدفع…' : 'سجّل الدفع نقداً'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SalaryLine({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg ${highlight ? 'bg-emerald-50' : 'bg-slate-50'}`}
    >
      <p className="text-[11px] text-slate-500">{label}</p>
      <p
        className={`text-sm font-bold mt-1 ${
          highlight ? 'text-emerald-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function InvoicesTab() {
  const qc = useQueryClient();
  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: async () => (await api.get('/accounting/invoices')).data,
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ id, amountIqd }: { id: string; amountIqd: number }) =>
      (await api.post(`/accounting/invoices/${id}/mark-paid`, { amountIqd }))
        .data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'فشل تسجيل الدفع';
      alert(msg);
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">الفواتير</h2>
      {isLoading ? (
        <p className="text-slate-500">جاري التحميل…</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-right px-4 py-3">العميل</th>
                <th className="text-right px-4 py-3">المبلغ</th>
                <th className="text-right px-4 py-3">المدفوع</th>
                <th className="text-right px-4 py-3">الحالة</th>
                <th className="text-right px-4 py-3">تاريخ الاستحقاق</th>
                <th className="text-right px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {(invoices ?? []).map((inv) => {
                const remaining = inv.totalIqd - (inv.paidIqd ?? 0);
                return (
                  <tr key={inv.id} className="border-t">
                    <td className="px-4 py-3 font-medium">
                      {inv.customer?.fullName ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-bold">{iqd(inv.totalIqd)}</td>
                    <td className="px-4 py-3 text-emerald-700">
                      {iqd(inv.paidIqd ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {inv.dueAt ? fmtDate(inv.dueAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {inv.status !== 'PAID' && inv.status !== 'VOID' && remaining > 0 && (
                        <button
                          onClick={() => {
                            const v = window.prompt(
                              'المبلغ المدفوع بالدينار؟',
                              String(remaining),
                            );
                            const n = v ? parseInt(v, 10) : NaN;
                            if (!Number.isFinite(n) || n <= 0) return;
                            markPaidMutation.mutate({ id: inv.id, amountIqd: n });
                          }}
                          disabled={markPaidMutation.isPending}
                          className="text-xs text-emerald-700 hover:text-emerald-900 font-bold disabled:opacity-50"
                        >
                          تسجيل دفع
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!invoices || invoices.length === 0) && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-400 text-sm"
                  >
                    لا توجد فواتير
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: Invoice['status'] }) {
  const map: Record<Invoice['status'], { label: string; klass: string }> = {
    DRAFT: { label: 'مسودّة', klass: 'bg-slate-100 text-slate-700' },
    SENT: { label: 'مُرسَلة', klass: 'bg-blue-50 text-blue-700' },
    PAID: { label: 'مدفوعة', klass: 'bg-emerald-50 text-emerald-700' },
    OVERDUE: { label: 'متأخرة', klass: 'bg-red-50 text-red-700' },
    VOID: { label: 'ملغية', klass: 'bg-slate-100 text-slate-500' },
  };
  const m = map[status];
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-bold ${m.klass}`}
    >
      {m.label}
    </span>
  );
}

function TransactionsTab() {
  const [kind, setKind] = useState<'all' | 'sale' | 'expense' | 'salary'>('all');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<PaginatedTx>({
    queryKey: ['transactions', kind, page],
    queryFn: async () =>
      (
        await api.get('/accounting/transactions', {
          params: { kind, page, pageSize: 50 },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold">سجل الحركات</h2>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['all', 'sale', 'expense', 'salary'] as const).map((k) => (
            <button
              key={k}
              onClick={() => {
                setKind(k);
                setPage(1);
              }}
              className={`px-3 py-1 rounded text-xs font-bold ${
                kind === k ? 'bg-white shadow-sm text-aqua-700' : 'text-slate-500'
              }`}
            >
              {k === 'all'
                ? 'الكل'
                : k === 'sale'
                  ? 'مبيعات'
                  : k === 'expense'
                    ? 'مصاريف'
                    : 'رواتب'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-slate-500">جاري التحميل…</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-right px-4 py-3">النوع</th>
                <th className="text-right px-4 py-3">الوصف</th>
                <th className="text-right px-4 py-3">المبلغ</th>
                <th className="text-right px-4 py-3">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((tx) => (
                <tr key={tx.id} className="border-t">
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full ${
                        tx.kind === 'sale'
                          ? 'bg-emerald-50 text-emerald-700'
                          : tx.kind === 'expense'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-violet-50 text-violet-700'
                      }`}
                    >
                      {tx.kind === 'sale'
                        ? 'بيع'
                        : tx.kind === 'expense'
                          ? 'مصروف'
                          : 'راتب'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{tx.description}</td>
                  <td
                    className={`px-4 py-3 font-bold ${
                      tx.kind === 'sale' ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {tx.kind === 'sale' ? '+' : '−'}
                    {iqd(tx.amountIqd)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {fmtDate(tx.occurredAt)}
                  </td>
                </tr>
              ))}
              {(!data || data.items.length === 0) && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-slate-400 text-sm"
                  >
                    لا توجد حركات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 rounded border border-slate-300 disabled:opacity-40"
          >
            « السابق
          </button>
          <span className="text-slate-600">
            صفحة {page} من {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            className="px-3 py-1 rounded border border-slate-300 disabled:opacity-40"
          >
            التالي »
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: any;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}
      >
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
      </div>
    </div>
  );
}
