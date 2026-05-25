'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { iqd } from '@/lib/format';
import { fmtDate } from '@/lib/format';
import {
  ArrowRight, Phone, MapPin, Calendar, Receipt, Wallet,
  Database, AlertTriangle, CheckCircle,
} from 'lucide-react';
import Link from 'next/link';

interface CustomerDetail {
  id: string;
  fullName: string;
  phone: string;
  whatsapp?: string;
  district: string;
  addressLine: string;
  status: string;
  balanceIqd: number;
  totalRefills: number;
  lastRefillAt?: string;
  createdAt: string;
  notes?: string;
  tanks: Array<{ id: string; qrCode: string; capacity: string }>;
  recentOrders?: Array<{
    id: string;
    requestedAt: string;
    status: string;
    priceIqd: number;
    driver?: { user: { fullName: string } };
  }>;
  payments?: Array<{
    id: string;
    amountIqd: number;
    method: string;
    createdAt: string;
  }>;
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'نشط', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  AT_RISK: { label: 'في خطر', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  INACTIVE: { label: 'متوقف', cls: 'bg-slate-100 text-slate-700 ring-slate-200' },
  CHURNED: { label: 'فقدنا الزبون', cls: 'bg-red-50 text-red-700 ring-red-200' },
  PENDING_APPROVAL: { label: 'بانتظار الموافقة', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
};

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery<CustomerDetail>({
    queryKey: ['customer', params.id],
    queryFn: async () => (await api.get(`/customers/${params.id}`)).data,
    enabled: !!params.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-slate-100 animate-pulse rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-40 bg-slate-100 animate-pulse rounded-2xl" />
          <div className="h-40 bg-slate-100 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }
  if (!data) return <p>الزبون غير موجود</p>;

  const status = statusBadge[data.status] ?? statusBadge.INACTIVE;
  const balanceOk = data.balanceIqd >= 0;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowRight size={16} /> رجوع
      </button>

      {/* Hero card */}
      <div className="bg-gradient-to-br from-aqua-700 via-aqua-600 to-aqua-500 rounded-3xl p-6 text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{data.fullName}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ring-1 ${status.cls}`}>
                  {status.label}
                </span>
              </div>
              <p className="text-cyan-100 text-sm mt-1 flex items-center gap-1.5">
                <Phone size={14} /> <span dir="ltr">{data.phone}</span>
              </p>
              <p className="text-cyan-100 text-sm mt-1 flex items-center gap-1.5">
                <MapPin size={14} /> {data.district} — {data.addressLine}
              </p>
              <p className="text-cyan-100 text-xs mt-2 flex items-center gap-1.5">
                <Calendar size={12} /> عميل منذ {fmtDate(data.createdAt)}
              </p>
            </div>
            <div className="text-left">
              <p className="text-cyan-100 text-xs">{balanceOk ? 'الرصيد المتبقي' : 'متأخّر عليه'}</p>
              <p className="text-3xl font-bold mt-1">
                {balanceOk ? iqd(data.balanceIqd) : iqd(-data.balanceIqd)}
              </p>
              {balanceOk ? (
                <span className="text-xs text-emerald-200 flex items-center gap-1 mt-1 justify-end">
                  <CheckCircle size={12} /> لا توجد متأخرات
                </span>
              ) : (
                <span className="text-xs text-amber-200 flex items-center gap-1 mt-1 justify-end">
                  <AlertTriangle size={12} /> يحتاج تحصيل
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-white/5" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={Receipt} label="إجمالي التعبئات" value={data.totalRefills} tint="#0891b2" />
        <Stat icon={Database} label="عدد الخزانات" value={data.tanks?.length ?? 0} tint="#8b5cf6" />
        <Stat
          icon={Wallet}
          label="آخر تعبئة"
          value={data.lastRefillAt ? fmtDate(data.lastRefillAt) : '—'}
          tint="#f59e0b"
        />
        <Stat
          icon={Phone}
          label="واتساب"
          value={data.whatsapp ?? '—'}
          tint="#25D366"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">آخر الطلبات</h2>
            <span className="text-xs text-slate-500">{data.recentOrders?.length ?? 0} طلب</span>
          </div>
          <div className="space-y-2">
            {(data.recentOrders ?? []).slice(0, 8).map((o) => (
              <Link
                key={o.id}
                href={`/dashboard/orders/${o.id}` as any}
                className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium">{fmtDate(o.requestedAt)}</p>
                  <p className="text-xs text-slate-500">
                    {o.driver?.user.fullName ?? 'لم يُسنَد بعد'}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-aqua-700">{iqd(o.priceIqd)}</p>
                  <p className="text-[10px] text-slate-500">{o.status}</p>
                </div>
              </Link>
            ))}
            {(!data.recentOrders || data.recentOrders.length === 0) && (
              <p className="text-center text-sm text-slate-400 py-6">لا طلبات بعد</p>
            )}
          </div>
        </div>

        {/* Payments */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">آخر الدفعات</h2>
            <span className="text-xs text-slate-500">{data.payments?.length ?? 0} دفعة</span>
          </div>
          <div className="space-y-2">
            {(data.payments ?? []).slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{fmtDate(p.createdAt)}</p>
                  <p className="text-xs text-slate-500">{p.method}</p>
                </div>
                <p className="text-sm font-bold text-emerald-700">{iqd(p.amountIqd)}</p>
              </div>
            ))}
            {(!data.payments || data.payments.length === 0) && (
              <p className="text-center text-sm text-slate-400 py-6">لا دفعات بعد</p>
            )}
          </div>
        </div>
      </div>

      {/* Tanks + Notes */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">الخزانات</h2>
          {data.tanks?.length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد خزانات</p>
          ) : (
            <div className="space-y-2">
              {data.tanks?.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Database size={20} className="text-aqua-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t.capacity === 'L500' ? '٥٠٠ لتر' : '٣٥٠ لتر'}</p>
                    <p className="text-xs text-slate-500 font-mono" dir="ltr">{t.qrCode}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">ملاحظات</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap min-h-[6rem]">
            {data.notes || 'لا توجد ملاحظات'}
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon, label, value, tint,
}: { icon: any; label: string; value: number | string; tint: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
        style={{ backgroundColor: `${tint}15`, color: tint }}
      >
        <Icon size={20} />
      </div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold mt-1" style={{ color: tint }}>{value}</p>
    </div>
  );
}
