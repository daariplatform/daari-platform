'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { iqd } from '@/lib/format';
import {
  Database, Users, Truck, AlertCircle, ClipboardList, TrendingUp,
  Crown, Bell, ArrowUpRight, Droplet, Truck as TruckIcon, Gift, UserPlus, Settings as SettingsIcon,
} from 'lucide-react';
import {
  LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import Link from 'next/link';

interface Stats {
  tankCount: number;
  customerCount: number;
  driverCount: number;
  todaysRefills: number;
  atRiskCustomers: number;
  monthRevenueIqd: number;
  todayRevenueIqd?: number;
  weekRevenueIqd?: number;
  revenueByDay?: Array<{ date: string; revenueIqd: number; refills: number }>;
  topCustomers?: Array<{ id: string; fullName: string; totalRefills: number; balanceIqd: number }>;
  activeDrivers?: Array<{ id: string; fullName: string; status: string; todayDeliveries: number }>;
}

interface TenantSettings {
  refillPriceIqd: number;
  deliveryFeeIqd: number;
  refillBonusIqd: number;
  newCustomerBonusIqd: number;
}

interface StockSnap {
  currentLiters: number;
  capacityLiters: number;
  lowThresholdLiters: number;
}

interface UsageSnap {
  plan: string;
  opsThisMonth: number;
  opsLimit: number;
  usagePercent: number;
  nearLimit: boolean;
  overLimit: boolean;
  monthlyPriceIqd: number;
}

export default function DashboardHome() {
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: async () => (await api.get('/tenants/me/stats')).data,
  });

  // Live tenant settings — single source of truth for "what's the current
  // price?" displayed in the widget. Short staleTime (15s) + refetchOnWindowFocus
  // so the moment an admin saves a change in settings, this card reflects it.
  const { data: settings } = useQuery<TenantSettings>({
    queryKey: ['tenant-settings'],
    queryFn: async () => (await api.get('/tenants/me/settings')).data,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  // Stock + usage banners — surface critical alerts at top of dashboard.
  const { data: stock } = useQuery<StockSnap>({
    queryKey: ['plant-stock'],
    queryFn: async () => (await api.get('/plant/stock')).data,
    refetchInterval: 60_000,
  });
  const { data: usage } = useQuery<UsageSnap>({
    queryKey: ['plant-usage'],
    queryFn: async () => (await api.get('/plant/usage')).data,
    refetchInterval: 60_000,
  });
  const isLowStock = !!stock && stock.currentLiters <= stock.lowThresholdLiters;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-slate-100 animate-pulse rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-32 bg-slate-100 animate-pulse rounded-2xl" />
          <div className="h-32 bg-slate-100 animate-pulse rounded-2xl" />
          <div className="h-32 bg-slate-100 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }
  if (!data) return null;

  // Audit found the home page fabricated a 7-day trend with Math.random()
  // when the backend returned no data — misleading the plant admin into
  // thinking they had revenue history when they didn't. We now render an
  // empty-state placeholder instead. The real series comes from the
  // backend `/plant/kpis` → `revenueByDay` field once orders exist.
  const revenueData = data.revenueByDay ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">لوحة الرئيسية</h1>
          <p className="text-slate-500 text-sm mt-1">نظرة عامة على عمل المعمل اليوم</p>
        </div>
        <div className="text-xs text-slate-400">آخر تحديث: {new Date().toLocaleString('ar-IQ')}</div>
      </div>

      {/* Critical alerts — only render when they actually fire, so the
          dashboard stays clean on healthy days. Order matters: usage
          first (existential — can't process orders), then stock. */}
      {usage?.overLimit && (
        <Link href={'/dashboard/subscription' as any}>
          <div className="rounded-2xl p-4 bg-red-50 border border-red-300 flex items-center gap-3 hover:bg-red-100 cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-red-200 flex items-center justify-center text-red-800 text-xl">
              🚨
            </div>
            <div className="flex-1">
              <div className="font-bold text-red-900 text-sm">
                تخطّيت حدّ خطّتك ({usage.opsLimit.toLocaleString('ar-IQ')} عملية/شهر)
              </div>
              <div className="text-red-700 text-xs">
                الطلبات الجديدة معطّلة. اضغط للترقية لخطّة أعلى
              </div>
            </div>
            <ArrowUpRight className="text-red-700" size={20} />
          </div>
        </Link>
      )}
      {usage?.nearLimit && !usage.overLimit && (
        <Link href={'/dashboard/subscription' as any}>
          <div className="rounded-2xl p-4 bg-amber-50 border border-amber-300 flex items-center gap-3 hover:bg-amber-100 cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 text-xl">
              ⚠️
            </div>
            <div className="flex-1">
              <div className="font-bold text-amber-900 text-sm">
                اقتربت من حدّ خطّتك ({usage.usagePercent}%)
              </div>
              <div className="text-amber-700 text-xs">
                {usage.opsThisMonth.toLocaleString('ar-IQ')} من {usage.opsLimit.toLocaleString('ar-IQ')} عملية هذا الشهر
              </div>
            </div>
            <ArrowUpRight className="text-amber-700" size={20} />
          </div>
        </Link>
      )}
      {isLowStock && (
        <Link href={'/dashboard/stock' as any}>
          <div className="rounded-2xl p-4 bg-orange-50 border border-orange-300 flex items-center gap-3 hover:bg-orange-100 cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center text-orange-800 text-xl">
              💧
            </div>
            <div className="flex-1">
              <div className="font-bold text-orange-900 text-sm">
                مخزون المياه منخفض!
              </div>
              <div className="text-orange-700 text-xs">
                {stock!.currentLiters.toLocaleString('ar-IQ')} لتر متبقّي — حدّ التنبيه {stock!.lowThresholdLiters.toLocaleString('ar-IQ')} لتر
              </div>
            </div>
            <ArrowUpRight className="text-orange-700" size={20} />
          </div>
        </Link>
      )}

      {/* Current settings — single source of truth, updates within 15s
          of any settings edit. Lets the plant admin verify their config
          change actually took effect, across all apps. */}
      {settings && <CurrentSettingsCard settings={settings} />}

      {/* Big revenue hero */}
      <div
        className="rounded-3xl p-6 text-white relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0e7490 0%, #0891b2 50%, #06b6d4 100%)',
        }}
      >
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-cyan-100 text-sm">إيرادات الشهر</p>
            <p className="text-5xl font-bold mt-1" style={{ letterSpacing: -1 }}>
              {iqd(data.monthRevenueIqd)}
            </p>
            <div className="flex items-center gap-4 mt-4 text-cyan-100 text-sm">
              <div>
                <span className="text-cyan-200 text-xs">اليوم:</span>{' '}
                <b className="text-white">{iqd(data.todayRevenueIqd ?? 0)}</b>
              </div>
              <div>
                <span className="text-cyan-200 text-xs">الأسبوع:</span>{' '}
                <b className="text-white">{iqd(data.weekRevenueIqd ?? 0)}</b>
              </div>
            </div>
          </div>
          <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <TrendingUp size={36} className="text-white" />
          </div>
        </div>
        {/* Decorative circles */}
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/5" />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Kpi label="الخزانات" value={data.tankCount} icon={Database} color="#0891b2" />
        <Kpi label="الزبائن" value={data.customerCount} icon={Users} color="#10b981" />
        <Kpi label="السائقون" value={data.driverCount} icon={Truck} color="#8b5cf6" />
        <Kpi label="تعبئات اليوم" value={data.todaysRefills} icon={ClipboardList} color="#f59e0b" />
        <Kpi label="زبائن خطر" value={data.atRiskCustomers} icon={AlertCircle} color="#dc2626" />
        <Kpi label="نشطون الآن" value={data.activeDrivers?.length ?? 0} icon={Bell} color="#06b6d4" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue chart (2/3 width) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">الإيرادات • آخر ٧ أيام</h2>
            <Link href="/dashboard/accounting" className="text-aqua-700 text-sm flex items-center gap-1">
              التفاصيل <ArrowUpRight size={14} />
            </Link>
          </div>
          {revenueData.length === 0 ? (
            <div className="h-[240px] flex flex-col items-center justify-center text-center">
              <p className="text-sm font-bold text-slate-700">لا توجد بيانات إيرادات بعد</p>
              <p className="text-xs text-slate-500 mt-1">
                ستظهر هنا تلقائياً بعد أول طلب مكتمل
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={revenueData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0891b2" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#0891b2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: any) => iqd(v as number)}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                />
                <Line
                  type="monotone"
                  dataKey="revenueIqd"
                  stroke="#0891b2"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#0891b2', strokeWidth: 2, stroke: 'white' }}
                  activeDot={{ r: 7 }}
                  fill="url(#revGrad)"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top customers (1/3 width) */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Crown size={20} className="text-amber-500" />
              أعلى الزبائن
            </h2>
            <Link href="/dashboard/customers" className="text-aqua-700 text-sm flex items-center gap-1">
              الكل <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            {(data.topCustomers ?? []).slice(0, 5).map((c, idx) => (
              <div key={c.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  idx === 0 ? 'bg-amber-100 text-amber-700' :
                  idx === 1 ? 'bg-slate-200 text-slate-700' :
                  idx === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-slate-100 text-slate-500'
                }`}>{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{c.fullName}</p>
                  <p className="text-xs text-slate-500">{c.totalRefills} تعبئة</p>
                </div>
                <p className="text-xs font-bold text-aqua-700">{iqd(c.balanceIqd ?? 0)}</p>
              </div>
            ))}
            {(!data.topCustomers || data.topCustomers.length === 0) && (
              <p className="text-center text-sm text-slate-400 py-6">لا بيانات بعد</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Live snapshot of `Tenant.refillPriceIqd` + related settings — exactly
 *  what the customer mobile and the driver mobile read when creating new
 *  orders. Updating any of these values in /settings refreshes here within
 *  15 seconds (or instantly on tab focus), so the admin can verify changes
 *  propagated. Order-history figures elsewhere are unaffected: those keep
 *  the price each order was placed at (audit trail).
 */
function CurrentSettingsCard({ settings }: { settings: TenantSettings }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-sky-50 flex items-center justify-center">
            <SettingsIcon size={18} className="text-sky-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-sm">الإعدادات النشطة الآن</h2>
            <p className="text-[11px] text-slate-500">
              ما يراه الزبون والسائق في تطبيقاتهم — يتحدّث خلال 15 ثانية من أي تعديل
            </p>
          </div>
        </div>
        <Link
          href={'/dashboard/settings' as any}
          className="text-xs text-sky-700 hover:text-sky-900 font-medium flex items-center gap-1"
        >
          تعديل <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SettingTile
          icon={Droplet}
          label="سعر التعبئة"
          value={settings.refillPriceIqd}
          color="#0284c7"
          highlight
        />
        <SettingTile
          icon={TruckIcon}
          label="رسوم التوصيل"
          value={settings.deliveryFeeIqd}
          color="#7c3aed"
        />
        <SettingTile
          icon={Gift}
          label="مكافأة كل تعبئة (للسائق)"
          value={settings.refillBonusIqd}
          color="#10b981"
        />
        <SettingTile
          icon={UserPlus}
          label="مكافأة زبون جديد"
          value={settings.newCustomerBonusIqd}
          color="#f59e0b"
        />
      </div>
    </div>
  );
}

function SettingTile({
  icon: Icon,
  label,
  value,
  color,
  highlight,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 border ${
        highlight ? 'border-sky-300 bg-sky-50/50' : 'border-slate-200 bg-slate-50/50'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={13} style={{ color }} />
        <span className="text-[10px] text-slate-600 leading-tight">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold" style={{ color }}>
          {value.toLocaleString('ar-IQ')}
        </span>
        <span className="text-[10px] text-slate-500">د.ع</span>
      </div>
    </div>
  );
}

function Kpi({
  label, value, icon: Icon, color,
}: { label: string; value: number | string; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-2"
        style={{ backgroundColor: `${color}15`, color }}
      >
        <Icon size={18} />
      </div>
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-xl font-bold mt-0.5" style={{ color }}>{value}</p>
    </div>
  );
}

// `generateMockTrend` was removed in the integration audit — it fabricated
// 7 days of Math.random() revenue when the backend returned no data, which
// misled plant admins into thinking they had real history. Empty state is
// rendered inline instead.
