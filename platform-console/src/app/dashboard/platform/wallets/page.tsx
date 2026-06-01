'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Wallet,
  Plus,
  ShieldAlert,
  Building2,
  Search,
  History as HistoryIcon,
} from 'lucide-react';

interface MeShape {
  id: string;
  phone: string;
  role: string;
  tenantId: string | null;
}

interface TenantBalance {
  id: string;
  name: string;
  city: string | null;
  ownerName: string | null;
  promoWalletIqd: number;
  status: string;
  plan: string;
}

interface WalletTopup {
  id: string;
  tenantId: string;
  amountIqd: number;
  balanceAfterIqd: number;
  source: TopupSource;
  reference: string | null;
  note: string | null;
  recordedById: string;
  createdAt: string;
}

type TopupSource = 'CASH' | 'BANK_TRANSFER' | 'ZAINCASH' | 'ASIACELL' | 'OTHER';

const SOURCE_LABEL: Record<TopupSource, string> = {
  CASH: 'كاش',
  BANK_TRANSFER: 'تحويل بنكي',
  ZAINCASH: 'زين كاش',
  ASIACELL: 'آسياسيل',
  OTHER: 'أخرى',
};

function n(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('en-US');
}

export default function PlatformWalletsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [topupTenant, setTopupTenant] = useState<TenantBalance | null>(null);

  // Gate: only PLATFORM_ADMIN gets through. Anyone else gets a 403 panel and
  // a way back to the home dashboard. The backend would 403 the data fetch
  // too, but a friendly client gate is clearer than a silent empty table.
  const meQuery = useQuery<MeShape>({
    queryKey: ['auth-me'],
    queryFn: async () => (await api.get<MeShape>('/auth/me')).data,
    staleTime: 5 * 60 * 1000,
  });
  const isPlatformAdmin = meQuery.data?.role === 'PLATFORM_ADMIN';

  const walletsQuery = useQuery<TenantBalance[]>({
    queryKey: ['platform', 'wallets'],
    queryFn: async () => (await api.get<TenantBalance[]>('/platform/wallets')).data,
    enabled: isPlatformAdmin,
    refetchInterval: 60_000,
  });

  const filtered = useMemo(() => {
    const list = walletsQuery.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.city ?? '').toLowerCase().includes(q) ||
        (t.ownerName ?? '').toLowerCase().includes(q),
    );
  }, [walletsQuery.data, query]);

  if (meQuery.isLoading) {
    return <div className="h-32 bg-slate-100 animate-pulse rounded-2xl" />;
  }

  if (meQuery.data && !isPlatformAdmin) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-white border border-red-200 rounded-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 mx-auto mb-3 flex items-center justify-center">
          <ShieldAlert size={28} className="text-red-600" />
        </div>
        <h2 className="font-bold text-slate-900">صفحة مخصّصة لإدارة المنصّة</h2>
        <p className="text-sm text-slate-500 mt-2">
          هذه الصفحة لطاقم داري فقط. ارجع إلى لوحة معملك.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-bold"
        >
          العودة للوحة
        </button>
      </div>
    );
  }

  const totalBalance = filtered.reduce((sum, t) => sum + (t.promoWalletIqd ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet size={22} className="text-primary-600" />
          محافظ المعامل
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          إدارة رصيد محفظة العروض لكل معمل. لا توجد إعادة استرداد — التزويد نهائي.
        </p>
      </div>

      {/* Aggregate */}
      <div
        className="rounded-3xl p-6 text-white"
        style={{
          background: 'linear-gradient(135deg, #14b8a6 0%, #0e9384 50%, #0c7a6e 100%)',
        }}
      >
        <p className="text-teal-50 text-sm flex items-center gap-2">
          <Wallet size={16} />
          مجموع الأرصدة الحالية
        </p>
        <p className="text-4xl font-bold mt-2">
          {n(totalBalance)} <span className="text-base font-semibold opacity-80">د.ع</span>
        </p>
        <p className="text-teal-50 text-xs mt-2">
          {filtered.length} معمل {query ? 'مطابق للبحث' : ''}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث باسم المعمل أو المدينة أو المالك"
          className="w-full pe-10 ps-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500"
        />
      </div>

      {/* Tenants table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {walletsQuery.isLoading ? (
          <div className="h-48 bg-slate-50 animate-pulse" />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 size={36} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              {query ? 'لا نتائج لهذا البحث' : 'لا توجد معامل بعد'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-right px-4 py-3 font-semibold">المعمل</th>
                  <th className="text-right px-4 py-3 font-semibold">المدينة</th>
                  <th className="text-right px-4 py-3 font-semibold">المالك</th>
                  <th className="text-right px-4 py-3 font-semibold">الخطّة</th>
                  <th className="text-right px-4 py-3 font-semibold">الرصيد الحالي</th>
                  <th className="text-right px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold text-slate-900">{t.name}</td>
                    <td className="px-4 py-3 text-slate-600">{t.city ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{t.ownerName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{t.plan}</td>
                    <td
                      className={`px-4 py-3 font-bold ${
                        t.promoWalletIqd < 1000
                          ? 'text-red-600'
                          : t.promoWalletIqd < 5000
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                      }`}
                    >
                      {n(t.promoWalletIqd)} د.ع
                    </td>
                    <td className="px-4 py-3 text-left">
                      <button
                        onClick={() => setTopupTenant(t)}
                        className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                      >
                        <Plus size={14} />
                        شحن رصيد
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {topupTenant && (
        <TopupModal
          tenant={topupTenant}
          onClose={() => setTopupTenant(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['platform', 'wallets'] });
            qc.invalidateQueries({ queryKey: ['platform', 'wallets', topupTenant.id, 'topups'] });
            setTopupTenant(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Topup modal ───────────────────────────────────────────────────────
function TopupModal({
  tenant,
  onClose,
  onSuccess,
}: {
  tenant: TenantBalance;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amountStr, setAmountStr] = useState('');
  const [source, setSource] = useState<TopupSource>('CASH');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  const amount = parseInt(amountStr, 10);
  const valid = Number.isFinite(amount) && amount > 0 && amount <= 100_000_000;

  const topupsQuery = useQuery<WalletTopup[]>({
    queryKey: ['platform', 'wallets', tenant.id, 'topups'],
    queryFn: async () =>
      (await api.get<WalletTopup[]>(`/platform/wallets/${tenant.id}/topups`, {
        params: { limit: 10 },
      })).data,
  });

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/platform/wallets/topup', {
          tenantId: tenant.id,
          amountIqd: amount,
          source,
          reference: reference.trim() || undefined,
          note: note.trim() || undefined,
        })
      ).data,
    onSuccess,
    onError: (err) => {
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'تعذّر تنفيذ الشحن',
      );
    },
  });

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Wallet size={20} className="text-primary-600" />
            شحن رصيد محفظة العروض
          </h3>
          <p className="text-sm text-slate-700 mt-1">
            <span className="font-bold">{tenant.name}</span>
            {tenant.city && <span className="text-slate-500"> — {tenant.city}</span>}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            الرصيد الحالي:{' '}
            <span className="font-bold text-primary-700">
              {n(tenant.promoWalletIqd)} د.ع
            </span>
          </p>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            المبلغ (د.ع)
          </label>
          <input
            type="number"
            min={1}
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500"
            placeholder="مثلاً 50000"
          />
        </div>

        {/* Source */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">مصدر الشحن</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(SOURCE_LABEL) as TopupSource[]).map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`px-2 py-2 rounded-lg text-xs font-bold border ${
                  source === s
                    ? 'bg-primary-50 border-primary-400 text-primary-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {SOURCE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Reference */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            رقم المرجع (اختياري)
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={120}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500"
            placeholder="رقم الإيصال أو التحويل"
          />
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            ملاحظة (اختياري)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500 resize-none"
            placeholder="مثلاً: تحويل من حساب الوكيل في كركوك"
          />
        </div>

        {/* Recent topups */}
        <div>
          <h4 className="font-bold text-slate-700 text-xs mb-2 flex items-center gap-1.5">
            <HistoryIcon size={13} />
            آخر عمليات الشحن لهذا المعمل
          </h4>
          {topupsQuery.isLoading ? (
            <div className="h-16 bg-slate-50 animate-pulse rounded-lg" />
          ) : !topupsQuery.data || topupsQuery.data.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">لا توجد عمليات شحن سابقة</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {topupsQuery.data.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-bold text-primary-700">+{n(t.amountIqd)} د.ع</p>
                    <p className="text-slate-500 text-[10px] mt-0.5">
                      {SOURCE_LABEL[t.source]}
                      {t.reference && <span> · {t.reference}</span>}
                    </p>
                  </div>
                  <p className="text-slate-400 text-[10px]">
                    {new Date(t.createdAt).toLocaleString('en-US', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-medium"
          >
            إلغاء
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!valid || mutation.isPending}
            className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {mutation.isPending ? 'جارٍ الشحن...' : `شحن ${valid ? n(amount) + ' د.ع' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
