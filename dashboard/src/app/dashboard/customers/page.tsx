'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { useState } from 'react';

interface Customer {
  id: string;
  fullName: string;
  phone: string;
  district: string;
  status: 'ACTIVE' | 'AT_RISK' | 'INACTIVE' | 'CHURNED';
  lastRefillAt: string | null;
  totalRefills: number;
  tanks: { id: string; qrCode: string; capacity: string }[];
}

const STATUS: Record<string, { label: string; klass: string }> = {
  ACTIVE: { label: 'نشط', klass: 'bg-emerald-50 text-emerald-700' },
  AT_RISK: { label: 'في خطر', klass: 'bg-amber-50 text-amber-700' },
  INACTIVE: { label: 'متوقف', klass: 'bg-slate-100 text-slate-700' },
  CHURNED: { label: 'فقدنا الزبون', klass: 'bg-red-50 text-red-700' },
};

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const { data } = useQuery<Customer[]>({
    queryKey: ['customers', search],
    queryFn: async () => (await api.get('/customers', { params: { search: search || undefined } })).data,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الزبائن</h1>
          <p className="text-slate-500">إدارة قاعدة الزبائن وحالاتهم</p>
        </div>
        <input
          placeholder="بحث بالاسم أو الهاتف"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 w-64"
        />
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
