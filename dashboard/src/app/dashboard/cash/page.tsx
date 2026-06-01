'use client';

/**
 * Cash handovers — drivers collect cash on COD refills and hand it over to
 * the plant. This page lets the plant track those handovers and confirm
 * receipt. Mirrors the backend `PlantCashController`:
 *   GET  /plant/cash-handovers?status=     (OWNER/MANAGER/ACCOUNTANT)
 *   POST /plant/cash-handovers/:id/confirm (OWNER/MANAGER only)
 *
 * ACCOUNTANT can read the list but the confirm button 403s for them, so we
 * still render the button and surface the backend's error gracefully rather
 * than hiding it (the role gate lives server-side as the source of truth).
 * A non-OWNER/MANAGER/ACCOUNTANT user gets a friendly access panel instead
 * of a silent empty table.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { iqd, fmtDate } from '@/lib/format';
import { Banknote, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';

interface MeShape {
  id: string;
  phone: string;
  role: string;
  tenantId: string | null;
}

type HandoverStatus = 'PENDING' | 'CONFIRMED';

interface CashHandover {
  id: string;
  driverId: string;
  driverName: string;
  amountIqd: number;
  note: string | null;
  status: HandoverStatus;
  createdAt: string;
  confirmedAt: string | null;
}

// Roles allowed to even see this page. The backend would 403 anyone else, so
// we gate client-side too for a clearer message.
const ALLOWED_ROLES = ['OWNER', 'MANAGER', 'ACCOUNTANT'];

export default function CashHandoversPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'PENDING' | 'CONFIRMED'>('PENDING');

  // Gate on role. OWNER/MANAGER/ACCOUNTANT can read; only OWNER/MANAGER can
  // confirm (enforced server-side; we surface the 403 on the confirm action).
  const meQuery = useQuery<MeShape>({
    queryKey: ['auth-me'],
    queryFn: async () => (await api.get<MeShape>('/auth/me')).data,
    staleTime: 5 * 60 * 1000,
  });
  const role = meQuery.data?.role ?? '';
  const canView = ALLOWED_ROLES.includes(role);
  const canConfirm = role === 'OWNER' || role === 'MANAGER';

  const {
    data,
    isLoading,
    isError,
  } = useQuery<CashHandover[]>({
    queryKey: ['cash-handovers', filter],
    queryFn: async () =>
      (
        await api.get('/plant/cash-handovers', {
          params: { status: filter },
        })
      ).data,
    enabled: canView,
    retry: false,
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/plant/cash-handovers/${id}/confirm`, {})).data,
    onSuccess: () => {
      // Confirming moves a row out of PENDING into CONFIRMED, so refresh both.
      qc.invalidateQueries({ queryKey: ['cash-handovers'] });
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      const msg =
        status === 403
          ? 'لا تملك صلاحية تأكيد الاستلام (للمالك أو المدير فقط).'
          : (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? 'فشل تأكيد الاستلام';
      alert(msg);
    },
  });

  const total = useMemo(
    () => (data ?? []).reduce((sum, h) => sum + (h.amountIqd ?? 0), 0),
    [data],
  );

  if (meQuery.isLoading) {
    return <div className="h-32 bg-slate-100 animate-pulse rounded-2xl" />;
  }

  if (meQuery.data && !canView) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-white border border-red-200 rounded-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 mx-auto mb-3 flex items-center justify-center">
          <ShieldAlert size={28} className="text-red-600" />
        </div>
        <h2 className="font-bold text-slate-900">صفحة مخصّصة للإدارة المالية</h2>
        <p className="text-sm text-slate-500 mt-2">
          تسليمات النقد متاحة للمالك والمدير والمحاسب فقط.
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote size={22} className="text-aqua-600" />
            تسليمات النقد
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            متابعة النقد المُحصَّل من السائقين وتأكيد استلامه في المعمل
          </p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['PENDING', 'CONFIRMED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium ${
                filter === s ? 'bg-white shadow-sm text-aqua-700' : 'text-slate-500'
              }`}
            >
              {s === 'PENDING' ? (
                <>
                  <Clock size={14} /> بانتظار التأكيد
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} /> مؤكَّدة
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Totals card */}
      <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            filter === 'PENDING'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          <Banknote size={24} />
        </div>
        <div>
          <p className="text-sm text-slate-500">
            {filter === 'PENDING'
              ? 'إجمالي النقد بانتظار الاستلام'
              : 'إجمالي النقد المؤكَّد'}
          </p>
          <p className="text-xl font-bold mt-1">{iqd(total)}</p>
        </div>
        <div className="mr-auto text-left">
          <p className="text-sm text-slate-500">عدد التسليمات</p>
          <p className="text-xl font-bold mt-1">
            {(data?.length ?? 0).toLocaleString('ar-IQ')}
          </p>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="h-64 bg-slate-100 animate-pulse rounded-2xl" />
      ) : isError ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-slate-400 text-sm">
          تعذّر تحميل التسليمات حالياً.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-right px-4 py-3">السائق</th>
                <th className="text-right px-4 py-3">المبلغ</th>
                <th className="text-right px-4 py-3">ملاحظة</th>
                <th className="text-right px-4 py-3">تاريخ التسليم</th>
                {filter === 'CONFIRMED' ? (
                  <th className="text-right px-4 py-3">تاريخ التأكيد</th>
                ) : (
                  <th className="text-right px-4 py-3">إجراء</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((h) => (
                <tr key={h.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{h.driverName}</td>
                  <td className="px-4 py-3 font-bold text-aqua-700">
                    {iqd(h.amountIqd)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{h.note ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {fmtDate(h.createdAt)}
                  </td>
                  {filter === 'CONFIRMED' ? (
                    <td className="px-4 py-3 text-xs text-emerald-700">
                      {h.confirmedAt ? fmtDate(h.confirmedAt) : '—'}
                    </td>
                  ) : (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `تأكيد استلام ${iqd(h.amountIqd)} من ${h.driverName}؟`,
                            )
                          ) {
                            confirmMutation.mutate(h.id);
                          }
                        }}
                        disabled={!canConfirm || confirmMutation.isPending}
                        title={
                          canConfirm
                            ? undefined
                            : 'للمالك أو المدير فقط'
                        }
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      >
                        <CheckCircle2 size={13} /> تأكيد الاستلام
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {(!data || data.length === 0) && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-400 text-sm"
                  >
                    {filter === 'PENDING'
                      ? 'لا توجد تسليمات بانتظار التأكيد.'
                      : 'لا توجد تسليمات مؤكَّدة بعد.'}
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
