'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';

interface Tank {
  id: string;
  serialNumber: string;
  qrCode: string;
  capacity: 'L350' | 'L500';
  status: string;
  lastRefillAt: string | null;
  customer: { fullName: string; phone: string; district: string } | null;
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

export default function TanksPage() {
  const { data, isLoading } = useQuery<Tank[]>({
    queryKey: ['tanks'],
    queryFn: async () => (await api.get('/tanks')).data,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الخزانات</h1>
          <p className="text-slate-500">جرد كامل بحالة كل خزان</p>
        </div>
        <button className="rounded-lg bg-primary-600 text-white px-4 py-2 hover:bg-primary-700">
          + خزان جديد
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-right px-4 py-3">الرقم</th>
              <th className="text-right px-4 py-3">QR</th>
              <th className="text-right px-4 py-3">السعة</th>
              <th className="text-right px-4 py-3">الحالة</th>
              <th className="text-right px-4 py-3">الزبون</th>
              <th className="text-right px-4 py-3">آخر تعبئة</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">
                  جاري التحميل…
                </td>
              </tr>
            )}
            {data?.map((t) => (
              <tr key={t.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{t.serialNumber}</td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{t.qrCode}</td>
                <td className="px-4 py-3">{t.capacity === 'L500' ? '٥٠٠ لتر' : '٣٥٠ لتر'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${STATUS_COLOR[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {t.customer ? (
                    <div>
                      <p>{t.customer.fullName}</p>
                      <p className="text-xs text-slate-500">{t.customer.district}</p>
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(t.lastRefillAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
