'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { iqd } from '@/lib/format';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface PnL {
  from: string;
  to: string;
  revenueIqd: number;
  expensesIqd: number;
  salariesIqd: number;
  netIqd: number;
  completedOrders: number;
}

export default function AccountingPage() {
  const { data, isLoading } = useQuery<PnL>({
    queryKey: ['pnl'],
    queryFn: async () => (await api.get('/accounting/pnl')).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">المحاسبة</h1>
        <p className="text-slate-500">تقرير الأرباح والخسائر للشهر الحالي</p>
      </div>

      {isLoading && <p>جاري التحميل…</p>}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card icon={TrendingUp} color="bg-emerald-50 text-emerald-700" label="الإيرادات" value={iqd(data.revenueIqd)} />
          <Card icon={TrendingDown} color="bg-red-50 text-red-700" label="المصاريف" value={iqd(data.expensesIqd)} />
          <Card icon={Wallet} color="bg-violet-50 text-violet-700" label="الرواتب" value={iqd(data.salariesIqd)} />
          <Card
            icon={TrendingUp}
            color={data.netIqd >= 0 ? 'bg-primary-50 text-primary-700' : 'bg-red-50 text-red-700'}
            label="الصافي"
            value={iqd(data.netIqd)}
          />
        </div>
      )}
    </div>
  );
}

function Card({ icon: Icon, color, label, value }: any) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
      </div>
    </div>
  );
}
