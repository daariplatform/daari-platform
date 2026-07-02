'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';

interface NotificationLog {
  id: string;
  kind: string;
  channel: 'WHATSAPP' | 'SMS' | 'PUSH';
  recipient: string;
  body: string;
  status: 'QUEUED' | 'SENT' | 'FAILED' | 'DELIVERED' | 'READ';
  errorMsg: string | null;
  sentAt: string | null;
  createdAt: string;
}

const STATUS: Record<NotificationLog['status'], { label: string; klass: string }> = {
  QUEUED: { label: 'في الطابور', klass: 'bg-slate-100 text-slate-700' },
  SENT: { label: 'مُرسل', klass: 'bg-sky-50 text-sky-700' },
  DELIVERED: { label: 'وصل', klass: 'bg-emerald-50 text-emerald-700' },
  READ: { label: 'مقروء', klass: 'bg-emerald-50 text-emerald-700' },
  FAILED: { label: 'فشل', klass: 'bg-red-50 text-red-700' },
};
// Fallback for any status value outside the known union — prevents a bad row
// from throwing `undefined.klass` and white-screening the table.
const STATUS_FALLBACK = { label: '—', klass: 'bg-slate-100 text-slate-700' };

const KIND_LABELS: Record<string, string> = {
  REFILL_REMINDER: 'تذكير تعبئة',
  REFILL_WARNING: 'تنبيه سحب الخزان',
  ORDER_ASSIGNED: 'تم تعيين سائق',
  ORDER_COMPLETED: 'تأكيد تعبئة',
};

export default function NotificationsPage() {
  const { data, isLoading } = useQuery<NotificationLog[]>({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/notifications')).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">سجل التنبيهات</h1>
        <p className="text-slate-500">آخر رسائل WhatsApp / SMS / Push المُرسلة للزبائن.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-right px-4 py-3">النوع</th>
              <th className="text-right px-4 py-3">القناة</th>
              <th className="text-right px-4 py-3">المستلم</th>
              <th className="text-right px-4 py-3">الحالة</th>
              <th className="text-right px-4 py-3">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  جارٍ التحميل...
                </td>
              </tr>
            )}
            {data?.map((n) => (
              <tr key={n.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{KIND_LABELS[n.kind] ?? n.kind}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-wide">{n.channel}</td>
                <td className="px-4 py-3" dir="ltr">{n.recipient}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${(STATUS[n.status] ?? STATUS_FALLBACK).klass}`}>
                    {(STATUS[n.status] ?? STATUS_FALLBACK).label}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {fmtDate(n.sentAt ?? n.createdAt)}
                </td>
              </tr>
            ))}
            {data?.length === 0 && !isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                  لا توجد تنبيهات بعد. التذكيرات الشهرية تبدأ تلقائياً عند الزبائن المؤهلين.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
