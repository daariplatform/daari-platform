'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { iqd } from '@/lib/format';
import { Database, Users, Truck, AlertCircle, ClipboardList, TrendingUp } from 'lucide-react';

interface Stats {
  tankCount: number;
  customerCount: number;
  driverCount: number;
  todaysRefills: number;
  atRiskCustomers: number;
  monthRevenueIqd: number;
}

export default function DashboardHome() {
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: async () => (await api.get('/tenants/me/stats')).data,
  });

  if (isLoading) return <p>جاري تحميل البيانات…</p>;
  if (!data) return null;

  const cards = [
    { label: 'إجمالي الخزانات', value: data.tankCount, icon: Database, color: 'bg-blue-50 text-blue-700' },
    { label: 'الزبائن النشطون', value: data.customerCount, icon: Users, color: 'bg-emerald-50 text-emerald-700' },
    { label: 'السائقون', value: data.driverCount, icon: Truck, color: 'bg-violet-50 text-violet-700' },
    { label: 'تعبئات اليوم', value: data.todaysRefills, icon: ClipboardList, color: 'bg-amber-50 text-amber-700' },
    { label: 'زبائن في خطر', value: data.atRiskCustomers, icon: AlertCircle, color: 'bg-red-50 text-red-700' },
    { label: 'إيراد الشهر', value: iqd(data.monthRevenueIqd), icon: TrendingUp, color: 'bg-primary-50 text-primary-700' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">لوحة الرئيسية</h1>
        <p className="text-slate-500">نظرة عامة على عمل المعمل اليوم</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.color}`}>
                <Icon size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-500">{c.label}</p>
                <p className="text-2xl font-bold mt-1">{c.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
