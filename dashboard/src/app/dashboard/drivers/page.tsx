'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { CredentialsModal } from '@/components/credentials-modal';
import { fmtDate } from '@/lib/format';

interface Driver {
  id: string;
  status: 'OFFLINE' | 'AVAILABLE' | 'ON_ROUTE' | 'BREAK';
  vehiclePlate: string | null;
  baseSalaryIqd: number;
  commissionPerRefillIqd: number;
  hiredAt: string;
  user: {
    fullName: string;
    phone: string;
    isActive: boolean;
  };
}

interface CreateDriverResponse extends Driver {
  tempPassword: string;
}

interface ResetPasswordResponse {
  ok: true;
  tempPassword: string;
}

interface DriversPage {
  items: Driver[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 50;

const STATUS: Record<Driver['status'], { label: string; klass: string }> = {
  AVAILABLE: { label: 'متاح', klass: 'bg-emerald-50 text-emerald-700' },
  ON_ROUTE: { label: 'في جولة', klass: 'bg-sky-50 text-sky-700' },
  BREAK: { label: 'استراحة', klass: 'bg-amber-50 text-amber-700' },
  OFFLINE: { label: 'غير متصل', klass: 'bg-slate-100 text-slate-700' },
};

export default function DriversPage() {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [credentials, setCredentials] = useState<{
    phone: string;
    password: string;
    fullName: string;
  } | null>(null);

  const qc = useQueryClient();
  const { data: pageData } = useQuery<DriversPage>({
    queryKey: ['drivers', page],
    queryFn: async () =>
      (await api.get('/drivers', { params: { page, pageSize: PAGE_SIZE } })).data,
  });
  const data = pageData?.items;
  const totalPages = pageData?.totalPages ?? 0;

  const createMutation = useMutation<CreateDriverResponse, unknown, CreateDriverForm>({
    mutationFn: async (form) => (await api.post('/drivers', form)).data,
    onSuccess: (created) => {
      setCredentials({
        phone: created.user.phone,
        password: created.tempPassword,
        fullName: created.user.fullName,
      });
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  const resetMutation = useMutation<ResetPasswordResponse, unknown, Driver>({
    mutationFn: async (driver) =>
      (await api.post(`/drivers/${driver.id}/reset-password`, {})).data,
    onSuccess: (res, driver) => {
      setCredentials({
        phone: driver.user.phone,
        password: res.tempPassword,
        fullName: driver.user.fullName,
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">السائقون</h1>
          <p className="text-slate-500">إدارة سائقي المعمل ورواتبهم</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg text-sm font-medium"
        >
          + إضافة سائق
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-right px-4 py-3">الاسم</th>
              <th className="text-right px-4 py-3">الهاتف</th>
              <th className="text-right px-4 py-3">المركبة</th>
              <th className="text-right px-4 py-3">الحالة</th>
              <th className="text-right px-4 py-3">الراتب الأساسي</th>
              <th className="text-right px-4 py-3">عمولة التعبئة</th>
              <th className="text-right px-4 py-3">تاريخ التعيين</th>
              <th className="text-right px-4 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((d) => (
              <tr key={d.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{d.user.fullName}</td>
                <td className="px-4 py-3" dir="ltr">{d.user.phone}</td>
                <td className="px-4 py-3">{d.vehiclePlate ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${STATUS[d.status].klass}`}>
                    {STATUS[d.status].label}
                  </span>
                </td>
                <td className="px-4 py-3">{d.baseSalaryIqd.toLocaleString('ar-IQ')} د.ع</td>
                <td className="px-4 py-3">{d.commissionPerRefillIqd.toLocaleString('ar-IQ')} د.ع</td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(d.hiredAt)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => {
                      if (confirm(`إعادة تعيين كلمة المرور لـ ${d.user.fullName}؟`)) {
                        resetMutation.mutate(d);
                      }
                    }}
                    disabled={resetMutation.isPending}
                    className="text-xs text-aqua-700 hover:text-aqua-900 disabled:opacity-50"
                  >
                    🔑 إعادة تعيين
                  </button>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">
                  لا يوجد سائقون بعد — اضغط &quot;إضافة سائق&quot; للبدء.
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
        <CreateDriverModal
          onSubmit={(form) => createMutation.mutate(form)}
          onCancel={() => setShowCreate(false)}
          isPending={createMutation.isPending}
          error={
            createMutation.isError
              ? (createMutation.error as { response?: { data?: { message?: string } } })
                  ?.response?.data?.message ?? 'فشل الإنشاء'
              : null
          }
        />
      )}

      <CredentialsModal
        credentials={credentials}
        onClose={() => setCredentials(null)}
        role="driver"
      />
    </div>
  );
}

interface CreateDriverForm {
  fullName: string;
  phone: string;
  vehiclePlate?: string;
  baseSalaryIqd?: number;
  commissionPerRefillIqd?: number;
}

function CreateDriverModal({
  onSubmit,
  onCancel,
  isPending,
  error,
}: {
  onSubmit: (form: CreateDriverForm) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    vehiclePlate: '',
    baseSalary: '',
    commission: '',
  });

  const canSubmit = form.fullName.length >= 2 && /^07\d{9}$/.test(form.phone);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4" dir="rtl">
        <div>
          <h3 className="text-lg font-bold">إضافة سائق جديد</h3>
          <p className="text-xs text-slate-500 mt-1">
            سيتم إنشاء حساب دخول له تلقائياً وسنعرض كلمة المرور مرة واحدة.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">الاسم الكامل</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              placeholder="مثال: علي عبدالله"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              رقم الهاتف (يُستخدم للدخول)
            </label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
              dir="ltr"
              maxLength={11}
              placeholder="07XXXXXXXXX"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              رقم اللوحة (اختياري)
            </label>
            <input
              value={form.vehiclePlate}
              onChange={(e) => setForm({ ...form, vehiclePlate: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              placeholder="مثال: بغداد 123456"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                الراتب الأساسي (د.ع/شهر)
              </label>
              <input
                value={form.baseSalary}
                onChange={(e) =>
                  setForm({ ...form, baseSalary: e.target.value.replace(/\D/g, '') })
                }
                dir="ltr"
                placeholder="500000"
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                عمولة لكل تعبئة (د.ع)
              </label>
              <input
                value={form.commission}
                onChange={(e) =>
                  setForm({ ...form, commission: e.target.value.replace(/\D/g, '') })
                }
                dir="ltr"
                placeholder="200"
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
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
                fullName: form.fullName,
                phone: form.phone,
                vehiclePlate: form.vehiclePlate || undefined,
                baseSalaryIqd: form.baseSalary ? parseInt(form.baseSalary, 10) : undefined,
                commissionPerRefillIqd: form.commission
                  ? parseInt(form.commission, 10)
                  : undefined,
              })
            }
            disabled={!canSubmit || isPending}
            className="flex-1 px-4 py-2 bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {isPending ? 'جارٍ الإنشاء...' : 'إنشاء وعرض كلمة المرور'}
          </button>
        </div>
      </div>
    </div>
  );
}
