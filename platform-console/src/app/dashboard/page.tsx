'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Factory,
  Wallet as WalletIcon,
  Package,
  Truck,
  Undo2,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Server,
  Database,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

// ─── Backend contract shapes ────────────────────────────────────────────
interface PlanBreakdown {
  plan: string;
  count: number;
}
interface RevenuePoint {
  month: string; // "YYYY-MM"
  gmvIqd: number;
  orders: number;
}
interface Overview {
  plantsActive: number;
  plantsTotal: number;
  plantsTrial: number;
  plantsSuspended: number;
  mrrIqd: number;
  ordersToday: number;
  driversOnline: number;
  driversTotal: number;
  cancelRate: number;
  plansBreakdown: PlanBreakdown[];
  revenueByMonth: RevenuePoint[];
  generatedAt: string;
}

interface Health {
  api: string;
  db: string;
  generatedAt: string;
}

type PlantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
interface Plant {
  id: string;
  name: string;
  plan: string;
  status: PlantStatus;
  walletIqd: number;
  planPriceIqd: number;
  driversCount: number;
  customersCount: number;
  ordersThisMonth: number;
  revenueThisMonthIqd: number;
  createdAt: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────
function n(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('en-US');
}
function iqd(v: number | null | undefined): string {
  return n(v) + ' د.ع';
}
// MRR as a compact "م د.ع" (millions) when large, else raw.
function compactIqd(v: number | null | undefined): string {
  const x = v ?? 0;
  if (x >= 1_000_000) return (x / 1_000_000).toFixed(1) + ' م د.ع';
  if (x >= 1_000) return (x / 1_000).toFixed(0) + ' ألف د.ع';
  return n(x) + ' د.ع';
}

const AR_MONTHS = [
  'كانون١',
  'شباط',
  'آذار',
  'نيسان',
  'أيار',
  'حزيران',
  'تموز',
  'آب',
  'أيلول',
  'تشرين١',
  'تشرين٢',
  'كانون٢',
];
function monthLabel(ym: string | null | undefined): string {
  if (!ym) return '—';
  const parts = ym.split('-');
  const m = parseInt(parts[1] ?? '', 10);
  if (Number.isFinite(m) && m >= 1 && m <= 12) return AR_MONTHS[m - 1];
  return ym;
}

const PLAN_LABEL: Record<string, string> = {
  STARTER: 'Starter',
  PRO: 'Pro',
  BUSINESS: 'Business',
  ENTERPRISE: 'Enterprise',
};
const PLAN_COLOR: Record<string, string> = {
  STARTER: '#7c3aed',
  PRO: '#0891b2',
  BUSINESS: '#10b981',
  ENTERPRISE: '#f59e0b',
};
const PLAN_BADGE: Record<string, string> = {
  STARTER: 'bg-slate-100 text-slate-600',
  PRO: 'bg-blue-100 text-blue-700',
  BUSINESS: 'bg-violet-100 text-violet-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
};
const STATUS_META: Record<PlantStatus, { label: string; cls: string }> = {
  ACTIVE: { label: '● نشط', cls: 'text-emerald-600' },
  TRIAL: { label: '● تجريبي', cls: 'text-blue-600' },
  SUSPENDED: { label: '● موقوف', cls: 'text-red-600' },
  CANCELLED: { label: '● ملغى', cls: 'text-slate-400' },
};

export default function OverviewPage() {
  const overviewQuery = useQuery<Overview>({
    queryKey: ['platform', 'overview'],
    queryFn: async () => (await api.get<Overview>('/platform/overview')).data,
    refetchInterval: 60_000,
  });
  const healthQuery = useQuery<Health>({
    queryKey: ['platform', 'health'],
    queryFn: async () => (await api.get<Health>('/platform/health')).data,
    refetchInterval: 30_000,
  });
  const plantsQuery = useQuery<Plant[]>({
    queryKey: ['platform', 'plants'],
    queryFn: async () => (await api.get<Plant[]>('/platform/plants')).data,
    refetchInterval: 60_000,
  });

  const o = overviewQuery.data;
  const revenue = (o?.revenueByMonth ?? []).map((r) => ({
    label: monthLabel(r.month),
    gmvIqd: r.gmvIqd ?? 0,
    orders: r.orders ?? 0,
  }));
  const plans = (o?.plansBreakdown ?? []).filter((p) => (p.count ?? 0) > 0);
  const plansTotal = plans.reduce((s, p) => s + (p.count ?? 0), 0);
  const topPlants = (plantsQuery.data ?? []).slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900">نظرة عامة على المنصّة</h1>
          <p className="text-sm text-slate-400 mt-1">كل معاملك في مكان واحد · تحديث تلقائي</p>
        </div>
        {o?.generatedAt && (
          <div className="text-xs text-slate-400 pt-1">
            آخر تحديث: {new Date(o.generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* Error state */}
      {overviewQuery.isError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          تعذّر تحميل بيانات المنصّة. تحقّق من الاتصال وحاول مجدداً.
        </div>
      )}

      {/* KPIs */}
      {overviewQuery.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <Kpi
            icon={Factory}
            label="المعامل النشطة"
            value={`${n(o?.plantsActive)}`}
            sub={`من ${n(o?.plantsTotal)} معمل`}
            tint="aqua"
          />
          <Kpi
            icon={WalletIcon}
            label="الإيراد الشهري (MRR)"
            value={compactIqd(o?.mrrIqd)}
            sub="اشتراكات المعامل"
            tint="green"
          />
          <Kpi
            icon={Package}
            label="طلبات اليوم (الكل)"
            value={n(o?.ordersToday)}
            sub="عبر كل المعامل"
            tint="blue"
          />
          <Kpi
            icon={Truck}
            label="سائقون متصلون"
            value={n(o?.driversOnline)}
            sub={`من ${n(o?.driversTotal)} سائقاً`}
            tint="violet"
          />
          <Kpi
            icon={Undo2}
            label="نسبة الإلغاء"
            value={`${(o?.cancelRate ?? 0).toFixed(1)}%`}
            sub="من إجمالي الطلبات"
            tint="amber"
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        {/* Revenue bar chart */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-[15px]">الإيراد عبر الأشهر</h3>
              <p className="text-[11.5px] text-slate-400">إجمالي مبيعات المعامل (GMV)</p>
            </div>
            <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-aqua-50 text-aqua-700">
              آخر {revenue.length || 0} أشهر
            </span>
          </div>
          {overviewQuery.isLoading ? (
            <div className="h-[200px] bg-slate-50 animate-pulse rounded-xl" />
          ) : revenue.length === 0 ? (
            <EmptyBox text="لا توجد بيانات إيرادات بعد" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenue} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="revBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#0891b2" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(8,145,178,0.06)' }}
                  formatter={(v: any) => [iqd(v as number), 'الإيراد']}
                  labelFormatter={(l) => `${l}`}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="gmvIqd" fill="url(#revBar)" radius={[8, 8, 4, 4]} maxBarSize={46} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Plans breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="mb-3">
            <h3 className="font-extrabold text-slate-900 text-[15px]">توزيع الخطط</h3>
            <p className="text-[11.5px] text-slate-400">المعامل حسب الاشتراك</p>
          </div>
          {overviewQuery.isLoading ? (
            <div className="h-[200px] bg-slate-50 animate-pulse rounded-xl" />
          ) : plans.length === 0 ? (
            <EmptyBox text="لا توجد معامل مشتركة بعد" />
          ) : (
            <>
              <PlansDonut plans={plans} total={plansTotal} />
              <div className="flex flex-col gap-2 mt-4">
                {plans.map((p) => (
                  <div key={p.plan} className="flex items-center gap-2.5 text-[13px] font-bold text-slate-700">
                    <span
                      className="w-3 h-3 rounded"
                      style={{ background: PLAN_COLOR[p.plan] ?? '#94a3b8' }}
                    />
                    <span>{PLAN_LABEL[p.plan] ?? p.plan}</span>
                    <span className="ms-auto text-slate-400">{n(p.count)} معمل</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* System health strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <HealthCard
          ok={healthQuery.data?.api === 'ok'}
          loading={healthQuery.isLoading}
          icon={Server}
          title="واجهة الـ API"
          okText="يعمل · 200"
          downText="لا يستجيب"
        />
        <HealthCard
          ok={healthQuery.data?.db === 'ok'}
          loading={healthQuery.isLoading}
          icon={Database}
          title="قاعدة البيانات"
          okText="PostgreSQL · صحّية"
          downText="غير متصلة"
        />
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-aqua-50 flex items-center justify-center text-aqua-700">
            <Factory size={18} />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-extrabold text-slate-900">
              {n(o?.plantsTrial)} تجريبي · {n(o?.plantsSuspended)} موقوف
            </div>
            <div className="text-[11px] text-slate-400">حالة المعامل</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
            <CheckCircle2 size={18} />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-extrabold text-slate-900">
              {healthQuery.data?.generatedAt
                ? new Date(healthQuery.data.generatedAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </div>
            <div className="text-[11px] text-slate-400">آخر فحص للنظام</div>
          </div>
        </div>
      </div>

      {/* Top plants preview */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-extrabold text-slate-900 text-[15px]">أبرز المعامل</h3>
            <p className="text-[11.5px] text-slate-400">أعلى المعامل المشتركة</p>
          </div>
          <Link
            href="/dashboard/plants"
            className="text-[12.5px] font-bold text-aqua-700 hover:text-aqua-800 flex items-center gap-1"
          >
            كل المعامل <ArrowUpRight size={14} />
          </Link>
        </div>

        {plantsQuery.isLoading ? (
          <div className="h-32 bg-slate-50 animate-pulse rounded-xl" />
        ) : plantsQuery.isError ? (
          <p className="text-sm text-red-600 py-8 text-center">تعذّر تحميل المعامل.</p>
        ) : topPlants.length === 0 ? (
          <EmptyBox text="لا توجد معامل بعد" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11.5px] text-slate-400 font-extrabold">
                  <th className="text-right pb-3 px-2.5">المعمل</th>
                  <th className="text-right pb-3 px-2.5">الخطة</th>
                  <th className="text-right pb-3 px-2.5">طلبات الشهر</th>
                  <th className="text-right pb-3 px-2.5">الإيراد</th>
                  <th className="text-right pb-3 px-2.5">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {topPlants.map((p) => {
                  const meta = STATUS_META[p.status] ?? { label: p.status, cls: 'text-slate-500' };
                  return (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-2.5 py-3 font-bold text-slate-900">{p.name}</td>
                      <td className="px-2.5 py-3">
                        <span
                          className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg ${
                            PLAN_BADGE[p.plan] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {PLAN_LABEL[p.plan] ?? p.plan}
                        </span>
                      </td>
                      <td className="px-2.5 py-3 text-slate-700 font-semibold">{n(p.ordersThisMonth)}</td>
                      <td className="px-2.5 py-3 text-slate-700 font-semibold">{iqd(p.revenueThisMonthIqd)}</td>
                      <td className={`px-2.5 py-3 font-extrabold text-xs ${meta.cls}`}>{meta.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── pieces ──────────────────────────────────────────────────────────────
const TINTS: Record<string, string> = {
  aqua: 'bg-aqua-50 text-aqua-700',
  green: 'bg-emerald-50 text-emerald-600',
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600',
  amber: 'bg-amber-50 text-amber-700',
};

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
  tint: keyof typeof TINTS;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${TINTS[tint]}`}>
        <Icon size={18} />
      </div>
      <p className="text-[12px] text-slate-400 font-bold">{label}</p>
      <p className="text-[22px] font-black text-slate-900 mt-0.5 leading-tight">{value}</p>
      <p className="text-[11px] text-slate-400 font-semibold mt-1.5">{sub}</p>
    </div>
  );
}

// CSS conic-gradient donut, built from the plan breakdown so the slices always
// match the real data (no hardcoded percentages).
function PlansDonut({ plans, total }: { plans: PlanBreakdown[]; total: number }) {
  let acc = 0;
  const stops: string[] = [];
  for (const p of plans) {
    const frac = total > 0 ? (p.count ?? 0) / total : 0;
    const start = acc * 100;
    acc += frac;
    const end = acc * 100;
    const color = PLAN_COLOR[p.plan] ?? '#94a3b8';
    stops.push(`${color} ${start}% ${end}%`);
  }
  const bg = stops.length > 0 ? `conic-gradient(${stops.join(', ')})` : '#e2e8f0';
  return (
    <div className="relative w-[140px] h-[140px] mx-auto" style={{ borderRadius: '50%', background: bg }}>
      <div className="absolute inset-0 m-auto w-[86px] h-[86px] rounded-full bg-white flex flex-col items-center justify-center">
        <span className="text-[21px] font-black text-slate-900 leading-none">{n(total)}</span>
        <span className="text-[10.5px] text-slate-400 mt-0.5">معمل</span>
      </div>
    </div>
  );
}

function HealthCard({
  ok,
  loading,
  icon: Icon,
  title,
  okText,
  downText,
}: {
  ok: boolean;
  loading: boolean;
  icon: any;
  title: string;
  okText: string;
  downText: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex items-center gap-3">
      <div className="relative shrink-0">
        {loading ? (
          <span className="block w-3 h-3 rounded-full bg-slate-300 animate-pulse" />
        ) : (
          <span
            className={`block w-3 h-3 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{
              boxShadow: ok ? '0 0 0 4px #dcfce7' : '0 0 0 4px #fee2e2',
            }}
          />
        )}
      </div>
      <div className="leading-tight min-w-0 flex-1">
        <div className="text-[13px] font-extrabold text-slate-900 flex items-center gap-1.5">
          {title}
          {!loading &&
            (ok ? (
              <CheckCircle2 size={13} className="text-emerald-500" />
            ) : (
              <XCircle size={13} className="text-red-500" />
            ))}
        </div>
        <div className="text-[11px] text-slate-400 truncate">
          {loading ? 'جارٍ الفحص…' : ok ? okText : downText}
        </div>
      </div>
      <Icon size={18} className="text-slate-300 shrink-0" />
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="h-[180px] flex flex-col items-center justify-center text-center">
      <p className="text-sm font-bold text-slate-600">{text}</p>
      <p className="text-xs text-slate-400 mt-1">ستظهر هنا تلقائياً عند توفّر البيانات</p>
    </div>
  );
}
