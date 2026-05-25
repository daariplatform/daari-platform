'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';

interface Tank {
  id: string;
  serialNumber: string;
  qrCode: string;
  capacity: 'L350' | 'L500';
  status: 'IN_PLANT' | 'ASSIGNED' | 'AT_RISK' | 'RECLAIMED' | 'DAMAGED';
  lastRefillAt: string | null;
  customer: { id: string; fullName: string; phone: string; district: string } | null;
}

interface Customer {
  id: string;
  fullName: string;
  phone: string;
  district: string;
  tanks: { id: string; qrCode: string }[];
}

const STATUS_LABEL: Record<string, string> = {
  IN_PLANT: 'في المعمل',
  ASSIGNED: 'موزّع',
  AT_RISK: 'في خطر',
  RECLAIMED: 'مسحوب',
  DAMAGED: 'تالف',
};

const STATUS_COLOR: Record<string, string> = {
  IN_PLANT: 'bg-slate-100 text-slate-700',
  ASSIGNED: 'bg-emerald-50 text-emerald-700',
  AT_RISK: 'bg-amber-50 text-amber-700',
  RECLAIMED: 'bg-blue-50 text-blue-700',
  DAMAGED: 'bg-red-50 text-red-700',
};

interface TanksPage {
  items: Tank[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 50;

export default function TanksPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [assignFor, setAssignFor] = useState<Tank | null>(null);

  const { data: pageData, isLoading } = useQuery<TanksPage>({
    queryKey: ['tanks', page],
    queryFn: async () =>
      (await api.get('/tanks', { params: { page, pageSize: PAGE_SIZE } })).data,
  });
  const data = pageData?.items;
  const totalPages = pageData?.totalPages ?? 0;

  const createMutation = useMutation<Tank, unknown, CreateTankForm>({
    mutationFn: async (form) => (await api.post('/tanks', form)).data,
    onSuccess: () => {
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ['tanks'] });
    },
  });

  const assignMutation = useMutation<Tank, unknown, { tank: Tank; customerId: string }>({
    mutationFn: async ({ tank, customerId }) =>
      (await api.post(`/tanks/${tank.id}/assign`, { customerId })).data,
    onSuccess: () => {
      setAssignFor(null);
      qc.invalidateQueries({ queryKey: ['tanks'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) =>
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'فشل التعيين',
      ),
  });

  const reclaimMutation = useMutation<Tank, unknown, Tank>({
    mutationFn: async (tank) => (await api.post(`/tanks/${tank.id}/reclaim`, {})).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tanks'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الخزانات</h1>
          <p className="text-slate-500">جرد كامل بحالة كل خزان</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-sky-600 text-white px-4 py-2 hover:bg-sky-700 text-sm font-medium"
        >
          + خزان جديد
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-right px-4 py-3">الرقم التسلسلي</th>
              <th className="text-right px-4 py-3">QR</th>
              <th className="text-right px-4 py-3">السعة</th>
              <th className="text-right px-4 py-3">الحالة</th>
              <th className="text-right px-4 py-3">الزبون</th>
              <th className="text-right px-4 py-3">آخر تعبئة</th>
              <th className="text-right px-4 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400">
                  جاري التحميل…
                </td>
              </tr>
            )}
            {data?.map((t) => (
              <tr key={t.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{t.serialNumber}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs px-2 py-0.5 bg-sky-50 text-sky-700 rounded border border-sky-200">
                    {t.qrCode}
                  </span>
                </td>
                <td className="px-4 py-3">{t.capacity === 'L500' ? '٥٠٠ لتر' : '٣٥٠ لتر'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${STATUS_COLOR[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {t.customer ? (
                    <div>
                      <div className="font-medium">{t.customer.fullName}</div>
                      <div className="text-[11px] text-slate-500" dir="ltr">
                        {t.customer.phone}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(t.lastRefillAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1 items-end">
                    {t.status === 'IN_PLANT' && (
                      <button
                        onClick={() => setAssignFor(t)}
                        className="text-xs text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded font-medium whitespace-nowrap"
                      >
                        ↗ تعيين لزبون
                      </button>
                    )}
                    {t.status === 'ASSIGNED' && (
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `استرجاع الخزان ${t.qrCode} من ${t.customer?.fullName}؟ سيُعاد إلى المعمل ولن يستطيع الزبون طلب تعبئة بعدها.`,
                            )
                          ) {
                            reclaimMutation.mutate(t);
                          }
                        }}
                        disabled={reclaimMutation.isPending}
                        className="text-xs text-red-700 hover:text-red-900 disabled:opacity-50"
                      >
                        ⏎ سحب من الزبون
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">
                  لا يوجد خزانات بعد — اضغط &quot;+ خزان جديد&quot; للبدء.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div
            dir="rtl"
            className="flex items-center justify-center gap-4 px-4 py-3 border-t bg-slate-50 text-sm"
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              « السابق
            </button>
            <span className="text-slate-600">
              صفحة {page} من {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              التالي »
            </button>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTankModal
          onSubmit={(form) => createMutation.mutate(form)}
          onCancel={() => setShowCreate(false)}
          isPending={createMutation.isPending}
          error={
            createMutation.isError
              ? (createMutation.error as { response?: { data?: { message?: string } } })?.response
                  ?.data?.message ?? 'فشل الإنشاء'
              : null
          }
        />
      )}

      {assignFor && (
        <AssignTankModal
          tank={assignFor}
          onSubmit={(customerId) => assignMutation.mutate({ tank: assignFor, customerId })}
          onCancel={() => setAssignFor(null)}
          isPending={assignMutation.isPending}
        />
      )}
    </div>
  );
}

interface CreateTankForm {
  serialNumber: string;
  capacity: 'L350' | 'L500';
  qrCode?: string;
}

function CreateTankModal({
  onSubmit,
  onCancel,
  isPending,
  error,
}: {
  onSubmit: (form: CreateTankForm) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<CreateTankForm>({
    serialNumber: '',
    capacity: 'L350',
    qrCode: '',
  });

  const canSubmit = form.serialNumber.length >= 2;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4" dir="rtl">
        <div>
          <h3 className="text-lg font-bold">إضافة خزان جديد</h3>
          <p className="text-xs text-slate-500 mt-1">
            سجّل الخزان في المعمل. بعد الحفظ يمكنك تعيينه لزبون من قائمة الخزانات.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              الرقم التسلسلي للخزان
            </label>
            <input
              value={form.serialNumber}
              onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              placeholder="مثال: T-1024 أو SN-2026-001"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              رقم الـ QR على الملصق (اختياري)
            </label>
            <input
              value={form.qrCode}
              onChange={(e) => setForm({ ...form, qrCode: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono"
              placeholder="اتركه فاضي ليُولّد تلقائياً، أو اكتب T-1024"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              💡 الأرقام القصيرة (T-1, T-2) أسهل للسائق وأرخص في طباعة الملصقات.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">السعة</label>
            <div className="flex gap-2">
              {(['L350', 'L500'] as const).map((cap) => (
                <button
                  key={cap}
                  type="button"
                  onClick={() => setForm({ ...form, capacity: cap })}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium ${
                    form.capacity === cap
                      ? 'bg-sky-50 border-sky-400 text-sky-700'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  {cap === 'L500' ? '٥٠٠ لتر' : '٣٥٠ لتر'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-medium"
          >
            إلغاء
          </button>
          <button
            onClick={() =>
              onSubmit({
                serialNumber: form.serialNumber,
                capacity: form.capacity,
                qrCode: form.qrCode?.trim() || undefined,
              })
            }
            disabled={!canSubmit || isPending}
            className="flex-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {isPending ? 'جارٍ الحفظ...' : 'إضافة الخزان'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignTankModal({
  tank,
  onSubmit,
  onCancel,
  isPending,
}: {
  tank: Tank;
  onSubmit: (customerId: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [search, setSearch] = useState('');

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ['customers', 'assign-search', search],
    queryFn: async () => {
      // /customers now returns { items, total, page, pageSize, totalPages }.
      // The assign-tank modal only needs the first 200 candidates for picking,
      // so we request a larger pageSize and read .items.
      const res = await api.get('/customers', {
        params: { search: search || undefined, page: 1, pageSize: 200 },
      });
      return res.data?.items ?? [];
    },
  });

  // Only customers WITHOUT a tank yet — prevent double-assignment.
  const available = useMemo(
    () => (customers ?? []).filter((c) => !c.tanks || c.tanks.length === 0),
    [customers],
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4" dir="rtl">
        <div>
          <h3 className="text-lg font-bold">
            تعيين الخزان <span className="font-mono text-sky-700">{tank.qrCode}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            اختر زبوناً ليصبح هذا الخزان مرتبطاً بحسابه. الزبائن الذين لديهم خزان بالفعل مخفيون.
          </p>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو الهاتف..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2"
          autoFocus
        />

        <div className="max-h-80 overflow-y-auto border border-slate-100 rounded-lg">
          {isLoading && (
            <div className="p-6 text-center text-slate-400 text-sm">جارٍ البحث...</div>
          )}
          {!isLoading && available.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-sm">
              لا يوجد زبائن بدون خزان مطابقون للبحث.
            </div>
          )}
          {available.map((c) => (
            <button
              key={c.id}
              onClick={() => onSubmit(c.id)}
              disabled={isPending}
              className="w-full text-right px-3 py-3 hover:bg-sky-50 border-b border-slate-100 last:border-0 disabled:opacity-50"
            >
              <div className="font-medium text-sm">{c.fullName}</div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2" dir="ltr">
                <span>{c.phone}</span>
                <span>· {c.district}</span>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          disabled={isPending}
          className="w-full px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-medium"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
