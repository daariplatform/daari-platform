'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { History, Filter } from 'lucide-react';
import { useState } from 'react';

interface AuditEntry {
  id: string;
  actorName: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  before: any;
  after: any;
  metadata: any;
  createdAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  'stock.update': 'تحديث المخزون',
  'promo.send': 'إرسال عرض ترويجي',
  'customer.approve': 'موافقة على زبون',
  'settings.update': 'تعديل الإعدادات',
  'tank.assign': 'تعيين خزان',
  'tank.reclaim': 'سحب خزان',
};

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState('');

  const { data, isLoading } = useQuery<AuditEntry[]>({
    queryKey: ['audit-log', actionFilter],
    queryFn: async () =>
      (
        await api.get('/plant/audit-log', {
          params: actionFilter ? { action: actionFilter } : {},
        })
      ).data,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History size={26} className="text-slate-700" />
            سجل التعديلات
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            من غيّر السعر، من وافق على زبون، من سحب خزاناً... كل شيء موثّق
          </p>
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">كل الأحداث</option>
          {Object.entries(ACTION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-right px-4 py-3">الوقت</th>
              <th className="text-right px-4 py-3">المستخدم</th>
              <th className="text-right px-4 py-3">الإجراء</th>
              <th className="text-right px-4 py-3">العنصر</th>
              <th className="text-right px-4 py-3">التفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-400">
                  جاري التحميل...
                </td>
              </tr>
            )}
            {data?.map((e) => (
              <tr key={e.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleString('ar-IQ')}
                </td>
                <td className="px-4 py-3 font-medium" dir="ltr">
                  {e.actorName}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs bg-sky-50 text-sky-700 font-bold">
                    {ACTION_LABEL[e.action] ?? e.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{e.entityType ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500 font-mono max-w-md truncate">
                  {summarise(e.before, e.after)}
                </td>
              </tr>
            ))}
            {data?.length === 0 && !isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                  لا يوجد سجلات بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function summarise(before: any, after: any): string {
  if (!before && !after) return '—';
  if (!before) return `أنشئ: ${stringify(after).slice(0, 80)}`;
  if (!after) return `حُذف: ${stringify(before).slice(0, 80)}`;
  // Find changed fields
  const changes: string[] = [];
  for (const key of Object.keys(after)) {
    if (typeof after[key] === 'object') continue;
    if (before[key] !== after[key]) {
      changes.push(`${key}: ${before[key]} → ${after[key]}`);
    }
  }
  return changes.length > 0 ? changes.join(', ').slice(0, 120) : 'لا تغييرات مرئية';
}

function stringify(o: any): string {
  try {
    return JSON.stringify(o);
  } catch {
    return String(o);
  }
}
