'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Megaphone,
  Wallet,
  Plus,
  Pause,
  TrendingUp,
  Send,
  AlertTriangle,
  Clock,
  Tag,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { arSA } from 'date-fns/locale';

// ─── Types ─────────────────────────────────────────────────────────────
interface PromoCampaign {
  id: string;
  originalPriceIqd: number;
  promoPriceIqd: number;
  costPerOrderIqd: number;
  startAt: string;
  endAt: string;
  status: 'ACTIVE' | 'PAUSED_BY_OWNER' | 'EXPIRED' | 'OUT_OF_BUDGET';
  walletBalanceAtStartIqd: number;
  pushSentCount: number;
  pushFailedCount: number;
  orderCount: number;
  totalDeductedIqd: number;
  totalRevenueIqd: number;
  createdAt: string;
}

interface PromosListResult {
  walletBalanceIqd: number;
  campaigns: PromoCampaign[];
}

interface TenantSettings {
  refillPriceIqd: number;
}

const MIN_WALLET_FOR_NEW = 1000;
const LOW_WALLET_HINT = 5000;

// Status pill mapping — keep order/colors in sync with mobile-admin.
const STATUS_META: Record<
  PromoCampaign['status'],
  { label: string; bg: string; fg: string; border: string }
> = {
  ACTIVE: {
    label: 'نشط',
    bg: 'bg-emerald-50',
    fg: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  PAUSED_BY_OWNER: {
    label: 'متوقف',
    bg: 'bg-slate-100',
    fg: 'text-slate-700',
    border: 'border-slate-200',
  },
  EXPIRED: {
    label: 'منتهي',
    bg: 'bg-slate-100',
    fg: 'text-slate-700',
    border: 'border-slate-200',
  },
  OUT_OF_BUDGET: {
    label: 'نفد الرصيد',
    bg: 'bg-amber-50',
    fg: 'text-amber-700',
    border: 'border-amber-200',
  },
};

function n(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('en-US');
}

// ─── Page ──────────────────────────────────────────────────────────────
export default function PromosPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const promosQuery = useQuery<PromosListResult>({
    queryKey: ['plant', 'promos'],
    queryFn: async () => (await api.get<PromosListResult>('/plant/promos')).data,
    refetchInterval: 60_000,
  });

  const settingsQuery = useQuery<TenantSettings>({
    queryKey: ['plant-settings'],
    queryFn: async () => (await api.get('/tenants/me/settings')).data,
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: string) =>
      (await api.post<PromoCampaign>(`/plant/promos/${id}/pause`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plant', 'promos'] }),
    onError: (err) => {
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'تعذّر إيقاف العرض',
      );
    },
  });

  const data = promosQuery.data;
  const walletBalance = data?.walletBalanceIqd ?? 0;
  const campaigns = data?.campaigns ?? [];
  const active = campaigns.find((c) => c.status === 'ACTIVE');
  const past = campaigns.filter((c) => c.status !== 'ACTIVE');
  const canCreate = walletBalance >= MIN_WALLET_FOR_NEW && !active;
  const lowBalance = walletBalance < LOW_WALLET_HINT;

  if (promosQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 bg-slate-100 animate-pulse rounded" />
        <div className="h-32 bg-slate-100 animate-pulse rounded-2xl" />
        <div className="h-48 bg-slate-100 animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone size={22} className="text-primary-600" />
            العروض
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            أنشئ عرض خصم وأرسله فوراً لكل زبائنك. تُخصم 1,000 د.ع لكل طلب يتمّ بسعر العرض.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={!canCreate}
          className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-primary-200"
          title={
            active
              ? 'يوجد عرض نشط بالفعل'
              : walletBalance < MIN_WALLET_FOR_NEW
                ? `يجب أن يكون رصيد المحفظة ${MIN_WALLET_FOR_NEW.toLocaleString('en-US')} د.ع على الأقل`
                : ''
          }
        >
          <Plus size={18} />
          عرض جديد
        </button>
      </div>

      {/* Wallet balance hero card */}
      <div
        className="rounded-3xl p-6 text-white relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #14b8a6 0%, #0e9384 50%, #0c7a6e 100%)',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-teal-50 text-sm flex items-center gap-2">
              <Wallet size={16} />
              رصيد محفظة العروض
            </p>
            <p className="text-4xl font-bold mt-2 leading-tight">
              {n(walletBalance)}{' '}
              <span className="text-base font-semibold opacity-80">د.ع</span>
            </p>
            <p className="text-teal-50 text-xs mt-3">
              يكفي لـ{' '}
              <span className="font-bold">
                {n(Math.floor(walletBalance / 1000))}
              </span>{' '}
              طلب بسعر العرض (1,000 د.ع/طلب)
            </p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
            <Wallet size={32} />
          </div>
        </div>

        {lowBalance && (
          <div className="mt-5 bg-white/15 backdrop-blur rounded-xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle size={18} className="shrink-0" />
            <p className="text-sm font-medium">
              رصيدك منخفض — تواصل مع داري لشحن المحفظة قبل أن ينفد أثناء عرضك القادم.
            </p>
          </div>
        )}
      </div>

      {/* Active campaign card */}
      {active && (
        <ActiveCampaignCard
          campaign={active}
          onPause={() => {
            if (confirm('هل تريد إيقاف العرض الآن؟ لن يتم استرداد الخصومات السابقة.')) {
              pauseMutation.mutate(active.id);
            }
          }}
          pausing={pauseMutation.isPending}
        />
      )}

      {/* Past campaigns */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp size={18} className="text-primary-600" />
            العروض السابقة ({past.length})
          </h2>
        </div>

        {past.length === 0 && !active ? (
          <div className="py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 mx-auto mb-4 flex items-center justify-center">
              <Megaphone size={32} className="text-primary-600" />
            </div>
            <p className="font-bold text-slate-700">لا توجد عروض بعد</p>
            <p className="text-sm text-slate-500 mt-1">أنشئ عرضك الأوّل لتجذب الزبائن.</p>
            {canCreate && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-bold"
              >
                + عرض جديد
              </button>
            )}
          </div>
        ) : past.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            لا توجد عروض سابقة بعد
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-right px-4 py-3 font-semibold">الحالة</th>
                  <th className="text-right px-4 py-3 font-semibold">سعر العرض</th>
                  <th className="text-right px-4 py-3 font-semibold">السعر العادي</th>
                  <th className="text-right px-4 py-3 font-semibold">تم إرسالها</th>
                  <th className="text-right px-4 py-3 font-semibold">الطلبات</th>
                  <th className="text-right px-4 py-3 font-semibold">الإيرادات</th>
                  <th className="text-right px-4 py-3 font-semibold">المخصوم</th>
                  <th className="text-right px-4 py-3 font-semibold">من</th>
                  <th className="text-right px-4 py-3 font-semibold">إلى</th>
                </tr>
              </thead>
              <tbody>
                {past.map((c) => {
                  const m = STATUS_META[c.status];
                  return (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[11px] font-bold px-2 py-1 rounded-full border ${m.bg} ${m.fg} ${m.border}`}
                        >
                          {m.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-primary-700">
                        {n(c.promoPriceIqd)} د.ع
                      </td>
                      <td className="px-4 py-3 text-slate-500 line-through">
                        {n(c.originalPriceIqd)} د.ع
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {n(c.pushSentCount)}
                        {c.pushFailedCount > 0 && (
                          <span className="text-[10px] text-red-500 ms-1">
                            (-{n(c.pushFailedCount)})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{n(c.orderCount)}</td>
                      <td className="px-4 py-3 font-bold text-emerald-700">
                        {n(c.totalRevenueIqd)} د.ع
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {n(c.totalDeductedIqd)} د.ع
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(c.startAt).toLocaleString('en-US', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(c.endAt).toLocaleString('en-US', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreatePromoModal
          onClose={() => setShowCreate(false)}
          walletBalanceIqd={walletBalance}
          defaultOriginalPriceIqd={settingsQuery.data?.refillPriceIqd ?? 0}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['plant', 'promos'] });
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Active campaign card with live countdown ──────────────────────────
function ActiveCampaignCard({
  campaign,
  onPause,
  pausing,
}: {
  campaign: PromoCampaign;
  onPause: () => void;
  pausing: boolean;
}) {
  // Re-render every minute so the countdown stays fresh without polling
  // the API more than once a minute (which is the refetchInterval already).
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const remaining = useMemo(() => {
    const ms = new Date(campaign.endAt).getTime() - Date.now();
    if (ms <= 0) return 'انتهى';
    return formatDistanceToNow(new Date(campaign.endAt), {
      addSuffix: false,
      locale: arSA,
    });
  }, [campaign.endAt]);

  const discountPct = Math.round(
    ((campaign.originalPriceIqd - campaign.promoPriceIqd) / campaign.originalPriceIqd) * 100,
  );

  return (
    <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-emerald-100/50 border-b border-emerald-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-emerald-800 text-sm">عرض نشط الآن</span>
        </div>
        <button
          onClick={onPause}
          disabled={pausing}
          className="px-3 py-1.5 bg-white border border-red-200 text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
        >
          <Pause size={14} />
          {pausing ? 'جارٍ الإيقاف...' : 'إيقاف العرض'}
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Big price */}
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-4xl font-bold text-primary-700">
            {n(campaign.promoPriceIqd)} د.ع
          </span>
          <span className="text-lg text-slate-400 line-through">
            {n(campaign.originalPriceIqd)} د.ع
          </span>
          <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-full">
            خصم {discountPct}%
          </span>
        </div>

        {/* Countdown */}
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Clock size={16} className="text-amber-600" />
          ينتهي خلال <span className="font-bold text-slate-900">{remaining}</span>
        </div>

        {/* Live stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <Stat icon={Send} label="تم إرساله" value={n(campaign.pushSentCount)} tint="sky" />
          <Stat
            icon={Tag}
            label="طلبات بسعر العرض"
            value={n(campaign.orderCount)}
            tint="emerald"
          />
          <Stat
            icon={TrendingUp}
            label="الإيرادات"
            value={`${n(campaign.totalRevenueIqd)} د.ع`}
            tint="emerald"
          />
          <Stat
            icon={Wallet}
            label="تم خصمه"
            value={`${n(campaign.totalDeductedIqd)} د.ع`}
            tint="amber"
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: any;
  label: string;
  value: string;
  tint: 'sky' | 'emerald' | 'amber';
}) {
  const palette = {
    sky: { bg: 'bg-sky-50', fg: 'text-sky-700' },
    emerald: { bg: 'bg-emerald-50', fg: 'text-emerald-700' },
    amber: { bg: 'bg-amber-50', fg: 'text-amber-700' },
  }[tint];
  return (
    <div className={`rounded-xl border border-slate-200 p-3 ${palette.bg}`}>
      <div className="flex items-center gap-1.5 text-xs text-slate-600">
        <Icon size={14} className={palette.fg} />
        {label}
      </div>
      <p className={`mt-1 text-xl font-bold ${palette.fg}`}>{value}</p>
    </div>
  );
}

// ─── Create modal ──────────────────────────────────────────────────────
function CreatePromoModal({
  onClose,
  walletBalanceIqd,
  defaultOriginalPriceIqd,
  onSuccess,
}: {
  onClose: () => void;
  walletBalanceIqd: number;
  defaultOriginalPriceIqd: number;
  onSuccess: () => void;
}) {
  // Default promo price = 30% off the current refill price (rounded to nearest 50).
  const suggested =
    defaultOriginalPriceIqd > 0
      ? Math.max(1, Math.round((defaultOriginalPriceIqd * 0.7) / 50) * 50)
      : 0;

  const [promoPriceStr, setPromoPriceStr] = useState(String(suggested || ''));
  const [durationHours, setDurationHours] = useState(12);

  const promoPriceIqd = parseInt(promoPriceStr, 10);
  const valid =
    Number.isFinite(promoPriceIqd) &&
    promoPriceIqd > 0 &&
    defaultOriginalPriceIqd > 0 &&
    promoPriceIqd < defaultOriginalPriceIqd &&
    durationHours >= 1 &&
    durationHours <= 48;

  const ordersAffordable = Math.floor(walletBalanceIqd / 1000);
  const discountPct =
    defaultOriginalPriceIqd > 0 && valid
      ? Math.round(
          ((defaultOriginalPriceIqd - promoPriceIqd) / defaultOriginalPriceIqd) * 100,
        )
      : 0;

  const mutation = useMutation({
    mutationFn: async (body: { promoPriceIqd: number; durationHours: number }) =>
      (await api.post('/plant/promos', body)).data,
    onSuccess,
    onError: (err) => {
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'تعذّر إنشاء العرض',
      );
    },
  });

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Megaphone size={20} className="text-primary-600" />
            عرض ترويجي جديد
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            سيُرسل إشعار فوري لكل زبائنك ويُفعَّل سعر العرض حتى تنتهي المدّة أو ينفد الرصيد.
          </p>
        </div>

        {/* Promo price input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            سعر العرض (د.ع)
          </label>
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
            <Tag size={18} className="text-primary-600 shrink-0" />
            <input
              type="number"
              min={1}
              value={promoPriceStr}
              onChange={(e) => setPromoPriceStr(e.target.value)}
              className="flex-1 outline-none text-base font-bold text-slate-900 bg-transparent"
              placeholder={String(suggested || 'مثلاً 700')}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            السعر العادي حالياً:{' '}
            <span className="font-bold text-slate-700">
              {n(defaultOriginalPriceIqd)} د.ع
            </span>
            {valid && (
              <span className="text-emerald-600 font-bold ms-2">— خصم {discountPct}%</span>
            )}
          </p>
          {promoPriceStr &&
            Number.isFinite(promoPriceIqd) &&
            defaultOriginalPriceIqd > 0 &&
            promoPriceIqd >= defaultOriginalPriceIqd && (
              <p className="text-[11px] text-red-600 font-bold mt-1">
                سعر العرض يجب أن يكون أقل من السعر العادي
              </p>
            )}
        </div>

        {/* Duration slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700">المدّة</label>
            <span className="text-sm font-bold text-primary-700">
              {durationHours} ساعة
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={48}
            step={1}
            value={durationHours}
            onChange={(e) => setDurationHours(parseInt(e.target.value, 10))}
            className="w-full accent-primary-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>1 ساعة</span>
            <span>12</span>
            <span>24</span>
            <span>48 ساعة</span>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl bg-primary-50 border border-primary-100 p-3 text-xs text-primary-900 space-y-1">
          <p>
            سيكلّفك <span className="font-bold">1,000 د.ع</span> لكل طلب يتمّ خلال العرض.
          </p>
          <p>
            رصيدك الحالي{' '}
            <span className="font-bold">{n(walletBalanceIqd)} د.ع</span> — يكفي لـ{' '}
            <span className="font-bold">{n(ordersAffordable)}</span> طلب كحدّ أقصى.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-medium"
          >
            إلغاء
          </button>
          <button
            onClick={() => mutation.mutate({ promoPriceIqd, durationHours })}
            disabled={!valid || mutation.isPending}
            className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {mutation.isPending ? 'جارٍ الإنشاء...' : 'إنشاء العرض'}
          </button>
        </div>
      </div>
    </div>
  );
}
