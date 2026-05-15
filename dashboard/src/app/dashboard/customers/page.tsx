'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { useState } from 'react';
import { CredentialsModal } from '@/components/credentials-modal';

interface Customer {
  id: string;
  fullName: string;
  phone: string;
  district: string;
  status: 'ACTIVE' | 'AT_RISK' | 'INACTIVE' | 'CHURNED' | 'PENDING_APPROVAL';
  lastRefillAt: string | null;
  totalRefills: number;
  tanks: { id: string; qrCode: string; capacity: string }[];
}

interface CreateCustomerResponse extends Customer {
  /** Plain-text password — present only in the create / approve / reset responses. */
  tempPassword: string;
}

interface ResetPasswordResponse {
  ok: true;
  tempPassword: string;
}

const STATUS: Record<string, { label: string; klass: string }> = {
  ACTIVE: { label: 'نشط', klass: 'bg-emerald-50 text-emerald-700' },
  AT_RISK: { label: 'في خطر', klass: 'bg-amber-50 text-amber-700' },
  INACTIVE: { label: 'متوقف', klass: 'bg-slate-100 text-slate-700' },
  CHURNED: { label: 'فقدنا الزبون', klass: 'bg-red-50 text-red-700' },
  PENDING_APPROVAL: { label: 'بانتظار الموافقة', klass: 'bg-sky-50 text-sky-700' },
};

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [credentials, setCredentials] = useState<{
    phone: string;
    password: string;
    fullName: string;
  } | null>(null);

  const qc = useQueryClient();
  const { data } = useQuery<Customer[]>({
    queryKey: ['customers', search],
    queryFn: async () =>
      (await api.get('/customers', { params: { search: search || undefined } })).data,
  });

  const createMutation = useMutation<CreateCustomerResponse, unknown, CreateCustomerForm>({
    mutationFn: async (form) => (await api.post('/customers', form)).data,
    onSuccess: (created) => {
      setCredentials({
        phone: created.phone,
        password: created.tempPassword,
        fullName: created.fullName,
      });
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const resetMutation = useMutation<ResetPasswordResponse, unknown, Customer>({
    mutationFn: async (customer) =>
      (await api.post(`/customers/${customer.id}/reset-password`, {})).data,
    onSuccess: (res, customer) => {
      setCredentials({
        phone: customer.phone,
        password: res.tempPassword,
        fullName: customer.fullName,
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الزبائن</h1>
          <p className="text-slate-500">إدارة قاعدة الزبائن وحالاتهم</p>
        </div>
        <div className="flex gap-2">
          <input
            placeholder="بحث بالاسم أو الهاتف"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-lg px-3 py-2 w-64"
          />
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg text-sm font-medium whitespace-nowrap"
          >
            + إضافة زبون
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-right px-4 py-3">الاسم</th>
              <th className="text-right px-4 py-3">الهاتف</th>
              <th className="text-right px-4 py-3">المنطقة</th>
              <th className="text-right px-4 py-3">الحالة</th>
              <th className="text-right px-4 py-3">عدد التعبئات</th>
              <th className="text-right px-4 py-3">آخر تعبئة</th>
              <th className="text-right px-4 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{c.fullName}</td>
                <td className="px-4 py-3" dir="ltr">{c.phone}</td>
                <td className="px-4 py-3">{c.district}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${STATUS[c.status].klass}`}>
                    {STATUS[c.status].label}
                  </span>
                </td>
                <td className="px-4 py-3">{c.totalRefills}</td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(c.lastRefillAt)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => {
                      if (confirm(`إعادة تعيين كلمة المرور لـ ${c.fullName}؟`)) {
                        resetMutation.mutate(c);
                      }
                    }}
                    disabled={resetMutation.isPending}
                    className="text-xs text-aqua-700 hover:text-aqua-900 disabled:opacity-50"
                  >
                    🔑 إعادة تعيين كلمة المرور
                  </button>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">
                  لا يوجد زبائن بعد — اضغط &quot;إضافة زبون&quot; للبدء.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateCustomerModal
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
        role="customer"
      />
    </div>
  );
}

interface CreateCustomerForm {
  fullName: string;
  phone: string;
  whatsapp?: string;
  district: string;
  addressLine: string;
}

function CreateCustomerModal({
  onSubmit,
  onCancel,
  isPending,
  error,
}: {
  onSubmit: (form: CreateCustomerForm) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<CreateCustomerForm>({
    fullName: '',
    phone: '',
    whatsapp: '',
    district: '',
    addressLine: '',
  });

  const canSubmit =
    form.fullName.length >= 2 &&
    /^07\d{9}$/.test(form.phone) &&
    form.district.length >= 2 &&
    form.addressLine.length >= 2;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4" dir="rtl">
        <div>
          <h3 className="text-lg font-bold">إضافة زبون جديد</h3>
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
              placeholder="مثال: أحمد علي حسن"
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
              واتساب (اختياري، نفس الهاتف افتراضياً)
            </label>
            <input
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value.replace(/\D/g, '') })}
              dir="ltr"
              maxLength={11}
              placeholder="07XXXXXXXXX"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">المنطقة</label>
            <input
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              placeholder="مثال: الكرادة"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">العنوان التفصيلي</label>
            <input
              value={form.addressLine}
              onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              placeholder="مثال: شارع 14 — قرب جامع الحسين"
            />
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
            onClick={() => onSubmit({ ...form, whatsapp: form.whatsapp || undefined })}
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
