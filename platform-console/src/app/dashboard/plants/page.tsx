'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Factory, Search, Users, Truck, Ban, CheckCircle2, ChevronDown } from 'lucide-react';

// ─── Backend contract ──────────────────────────────────────────────────────
type PlantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
type PlanCode = 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';

interface Plant {
  id: string;
  name: string;
  plan: PlanCode | string;
  status: PlantStatus;
  walletIqd: number;
  planPriceIqd: number;
  driversCount: number;
  customersCount: number;
  ordersThisMonth: number;
  revenueThisMonthIqd: number;
  createdAt: string;
}

const PLANS: PlanCode[] = ['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'];
const PLAN_LABEL: Record<string, string> = {
  STARTER: 'Starter',
  PRO: 'Pro',
  BUSINESS: 'Business',
  ENTERPRISE: 'Enterprise',
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

function n(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('en-US');
}
function iqd(v: number | null | undefined): string {
  return n(v) + ' د.ع';
}

export default function PlantsPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');

  const plantsQuery = useQuery<Plant[]>({
    queryKey: ['platform', 'plants'],
    queryFn: async () => (await api.get<Plant[]>('/platform/plants')).data,
    refetchInterval: 60_000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PlantStatus }) =>
      (await api.post(`/platform/plants/${id}/status`, { status })).data as Plant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'plants'] });
      qc.invalidateQueries({ queryKey: ['platform', 'overview'] });
    },
    onError: (err) => {
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'تعذّر تغيير حالة المعمل',
      );
    },
  });

  const planMutation = useMutation({
    mutationFn: async ({ id, plan }: { id: string; plan: PlanCode }) =>
      (await api.post(`/platform/plants/${id}/plan`, { plan })).data as Plant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'plants'] });
      qc.invalidateQueries({ queryKey: ['platform', 'overview'] });
    },
    onError: (err) => {
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'تعذّر تغيير خطة المعمل',
      );
    },
  });

  const list = plantsQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || (PLAN_LABEL[p.plan] ?? p.plan).toLowerCase().includes(q),
    );
  }, [list, query]);

  const pendingId = statusMutation.isPending
    ? statusMutation.variables?.id
    : planMutation.isPending
      ? planMutation.variables?.id
      : undefined;

  function toggleStatus(p: Plant) {
    const suspend = p.status !== 'SUSPENDED';
    const next: PlantStatus = suspend ? 'SUSPENDED' : 'ACTIVE';
    if (suspend) {
      const ok = window.confirm(
        `تعليق المعمل "${p.name}"؟\nلن يتمكّن من معالجة طلبات جديدة حتى يُعاد تفعيله.`,
      );
      if (!ok) return;
    }
    statusMutation.mutate({ id: p.id, status: next });
  }

  function changePlan(p: Plant, plan: PlanCode) {
    if (plan === p.plan) return;
    planMutation.mutate({ id: p.id, plan });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Factory size={22} className="text-aqua-700" />
            المعامل
          </h1>
          <p className="text-sm text-slate-400 mt-1">كل المعامل المشتركة في المنصّة</p>
        </div>
        <span className="text-[12.5px] font-bold text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          {n(list.length)} معمل
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث باسم المعمل أو الخطة"
          className="w-full pe-10 ps-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-aqua-100 focus:border-aqua-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {plantsQuery.isLoading ? (
          <div className="h-64 bg-slate-50 animate-pulse" />
        ) : plantsQuery.isError ? (
          <div className="py-16 text-center text-sm text-red-600">
            تعذّر تحميل المعامل. حاول مجدداً.
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Factory size={36} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">{query ? 'لا نتائج لهذا البحث' : 'لا توجد معامل بعد'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-[11.5px] font-extrabold">
                  <th className="text-right px-4 py-3">المعمل</th>
                  <th className="text-right px-4 py-3">الخطة</th>
                  <th className="text-right px-4 py-3">الحالة</th>
                  <th className="text-right px-4 py-3">طلبات الشهر</th>
                  <th className="text-right px-4 py-3">إيراد الشهر</th>
                  <th className="text-right px-4 py-3">المحفظة</th>
                  <th className="text-right px-4 py-3">سائق/زبون</th>
                  <th className="text-right px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const meta = STATUS_META[p.status] ?? { label: p.status, cls: 'text-slate-500' };
                  const busy = pendingId === p.id;
                  const suspended = p.status === 'SUSPENDED';
                  return (
                    <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-400">
                          منذ{' '}
                          {p.createdAt
                            ? new Date(p.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                              })
                            : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PlanSelect
                          value={(p.plan as PlanCode) ?? 'STARTER'}
                          disabled={busy}
                          onChange={(plan) => changePlan(p, plan)}
                        />
                        <div className="text-[10.5px] text-slate-400 mt-1">{iqd(p.planPriceIqd)}/شهر</div>
                      </td>
                      <td className={`px-4 py-3 font-extrabold text-xs ${meta.cls}`}>{meta.label}</td>
                      <td className="px-4 py-3 text-slate-700 font-semibold">{n(p.ordersThisMonth)}</td>
                      <td className="px-4 py-3 text-slate-700 font-semibold">{iqd(p.revenueThisMonthIqd)}</td>
                      <td
                        className={`px-4 py-3 font-bold ${
                          (p.walletIqd ?? 0) < 1000
                            ? 'text-red-600'
                            : (p.walletIqd ?? 0) < 5000
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {iqd(p.walletIqd)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Truck size={13} className="text-slate-400" /> {n(p.driversCount)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs ms-3">
                          <Users size={13} className="text-slate-400" /> {n(p.customersCount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleStatus(p)}
                          disabled={busy}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold border transition disabled:opacity-50 ${
                            suspended
                              ? 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                              : 'text-red-600 border-red-200 hover:bg-red-50'
                          }`}
                        >
                          {suspended ? <CheckCircle2 size={14} /> : <Ban size={14} />}
                          {busy ? '...' : suspended ? 'تفعيل' : 'تعليق'}
                        </button>
                      </td>
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

function PlanSelect({
  value,
  disabled,
  onChange,
}: {
  value: PlanCode;
  disabled: boolean;
  onChange: (plan: PlanCode) => void;
}) {
  const badge = PLAN_BADGE[value] ?? 'bg-slate-100 text-slate-600';
  return (
    <div className="relative inline-block">
      <select
        value={PLANS.includes(value) ? value : 'STARTER'}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as PlanCode)}
        className={`appearance-none cursor-pointer text-[11px] font-extrabold ps-2.5 pe-7 py-1.5 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-aqua-200 disabled:opacity-50 ${badge}`}
      >
        {PLANS.map((pl) => (
          <option key={pl} value={pl}>
            {PLAN_LABEL[pl]}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60"
      />
    </div>
  );
}
