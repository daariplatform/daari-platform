'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { iqd } from '@/lib/format';

interface Order {
  id: string;
  status: string;
  kind: string;
  priceIqd: number;
  paidAmountIqd: number;
  requestedAt: string;
  completedAt: string | null;
  customer: { fullName: string; phone: string; district: string };
  driver: { id: string; user: { fullName: string } } | null;
  tank: { qrCode: string; capacity: string } | null;
}

const STATUS: Record<string, { label: string; klass: string }> = {
  PENDING: { label: 'قيد الانتظار', klass: 'bg-slate-100 text-slate-700' },
  ASSIGNED: { label: 'مُسنَد', klass: 'bg-blue-50 text-blue-700' },
  EN_ROUTE: { label: 'في الطريق', klass: 'bg-amber-50 text-amber-700' },
  COMPLETED: { label: 'مكتمل', klass: 'bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: 'ملغى', klass: 'bg-red-50 text-red-700' },
  FAILED: { label: 'فشل', klass: 'bg-red-50 text-red-700' },
};

export default function OrdersPage() {
  const { data } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: async () => (await api.get('/orders')).data,
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الطلبات</h1>
        <p className="text-slate-500">يتم تحديثها تلقائياً كل ١٥ ثانية</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-right px-4 py-3">الزبون</th>
              <th className="text-right px-4 py-3">المنطقة</th>
              <th className="text-right px-4 py-3">السائق</th>
              <th className="text-right px-4 py-3">الحالة</th>
              <th className="text-right px-4 py-3">المبلغ</th>
              <th className="text-right px-4 py-3">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((o) => (
              <tr key={o.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{o.customer.fullName}</td>
                <td className="px-4 py-3">{o.customer.district}</td>
                <td className="px-4 py-3 text-slate-600">
                  {o.driver?.user.fullName ?? <span className="text-slate-400">غير مُسنَد</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${STATUS[o.status]?.klass ?? ''}`}>
                    {STATUS[o.status]?.label ?? o.status}
                  </span>
                </td>
                <td className="px-4 py-3">{iqd(o.priceIqd)}</td>
                <td className="px-4 py-3 text-slate-500">
                  {fmtDate(o.completedAt ?? o.requestedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
