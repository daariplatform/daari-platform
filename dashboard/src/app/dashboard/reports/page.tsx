'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { iqd } from '@/lib/format';
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis,
  CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { Download, Calendar, TrendingUp, ShoppingCart, Users, FileText, FileSpreadsheet } from 'lucide-react';

interface Report {
  range: 'day' | 'week' | 'month' | 'year';
  totalRevenue: number;
  totalOrders: number;
  newCustomers: number;
  refillsByDay: Array<{ date: string; refills: number; revenue: number }>;
  topCustomers: Array<{ id: string; name: string; refills: number; revenue: number }>;
  ordersByStatus: Array<{ status: string; count: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#059669',
  EN_ROUTE: '#ea580c',
  ASSIGNED: '#2563eb',
  PENDING: '#f59e0b',
  CANCELLED: '#dc2626',
  FAILED: '#991b1b',
};
const STATUS_AR: Record<string, string> = {
  COMPLETED: 'مكتمل',
  EN_ROUTE: 'في الطريق',
  ASSIGNED: 'مُسنَد',
  PENDING: 'قيد الانتظار',
  CANCELLED: 'ملغى',
  FAILED: 'فشل',
};

export default function ReportsPage() {
  const [range, setRange] = useState<'week' | 'month' | 'year'>('month');

  const { data, isLoading } = useQuery<Report>({
    queryKey: ['reports', range],
    queryFn: async () => (await api.get(`/tenants/me/reports?range=${range}`)).data,
  });

  // Export — wires the existing `/plant/reports/export` endpoint. The
  // backend builds a PDF (PDFKit) or XLSX (exceljs) on disk, then returns
  // a public uploads URL we open in a new tab. Default window matches the
  // currently-selected range to keep the export consistent with what
  // the user is looking at on screen.
  const exportMutation = useMutation({
    mutationFn: async (input: {
      type: 'pdf' | 'xlsx';
      report: 'revenue' | 'top-customers' | 'top-drivers' | 'cohort';
    }) => {
      const now = new Date();
      const from = new Date(now);
      if (range === 'week') from.setDate(from.getDate() - 7);
      else if (range === 'month') from.setMonth(from.getMonth() - 1);
      else from.setFullYear(from.getFullYear() - 1);
      const { data } = await api.post<{ url: string; expiresAt: string }>(
        '/plant/reports/export',
        {
          type: input.type,
          report: input.report,
          from: from.toISOString(),
          to: now.toISOString(),
        },
      );
      window.open(data.url, '_blank');
      return data;
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'فشل التصدير';
      alert(msg);
    },
  });

  if (isLoading) {
    return <div className="h-96 bg-slate-100 animate-pulse rounded-2xl" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">التقارير والتحليلات</h1>
          <p className="text-slate-500 text-sm mt-1">رؤية تفصيلية لأداء المعمل</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export menu — backend supports revenue / top-customers /
              top-drivers / cohort in PDF or XLSX. We surface the two most
              common (revenue + top-customers) as direct buttons; the
              picker covers the rest. */}
          <div className="flex gap-1">
            <button
              type="button"
              disabled={exportMutation.isPending}
              onClick={() =>
                exportMutation.mutate({ type: 'pdf', report: 'revenue' })
              }
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <FileText size={13} /> PDF
            </button>
            <button
              type="button"
              disabled={exportMutation.isPending}
              onClick={() =>
                exportMutation.mutate({ type: 'xlsx', report: 'revenue' })
              }
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <FileSpreadsheet size={13} /> Excel
            </button>
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(['week', 'month', 'year'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-1.5 rounded text-sm font-medium ${
                  range === r ? 'bg-white shadow-sm text-aqua-700' : 'text-slate-500'
                }`}
              >
                {r === 'week' ? 'أسبوع' : r === 'month' ? 'شهر' : 'سنة'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          icon={TrendingUp}
          label="إجمالي الإيرادات"
          value={iqd(data?.totalRevenue ?? 0)}
          color="#059669"
        />
        <KpiCard
          icon={ShoppingCart}
          label="إجمالي الطلبات"
          value={String(data?.totalOrders ?? 0)}
          color="#0891b2"
        />
        <KpiCard
          icon={Users}
          label="زبائن جدد"
          value={String(data?.newCustomers ?? 0)}
          color="#8b5cf6"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue/Orders bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Calendar size={18} className="text-aqua-600" />
              الأداء اليومي
            </h2>
            <button
              type="button"
              disabled={exportMutation.isPending}
              onClick={() =>
                exportMutation.mutate({ type: 'xlsx', report: 'revenue' })
              }
              className="text-xs text-aqua-700 flex items-center gap-1 hover:text-aqua-900 disabled:opacity-50"
            >
              <Download size={14} />{' '}
              {exportMutation.isPending ? 'جارٍ التصدير…' : 'تصدير Excel'}
            </button>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data?.refillsByDay ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                formatter={(value, name) =>
                  name === 'revenue' ? iqd(value as number) : value
                }
              />
              <Bar dataKey="refills" fill="#0891b2" radius={[8, 8, 0, 0]} name="تعبئات" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Order status pie */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">توزيع الحالات</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={(data?.ordersByStatus ?? []).map((s) => ({
                  ...s,
                  name: STATUS_AR[s.status] ?? s.status,
                }))}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={({ name, count }) => `${name}: ${count}`}
                labelLine={false}
              >
                {(data?.ordersByStatus ?? []).map((s) => (
                  <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top customers table */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-bold mb-4">أعلى ١٠ زبائن (حسب الإيراد)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-600 border-b border-slate-100">
              <tr>
                <th className="text-right py-2 px-2 font-medium">الترتيب</th>
                <th className="text-right py-2 px-2 font-medium">الاسم</th>
                <th className="text-right py-2 px-2 font-medium">عدد التعبئات</th>
                <th className="text-right py-2 px-2 font-medium">الإيراد</th>
              </tr>
            </thead>
            <tbody>
              {(data?.topCustomers ?? []).slice(0, 10).map((c, idx) => (
                <tr key={c.id} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="py-3 px-2">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-700'
                          : idx === 1
                          ? 'bg-slate-200 text-slate-700'
                          : idx === 2
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-medium">{c.name}</td>
                  <td className="py-3 px-2">{c.refills}</td>
                  <td className="py-3 px-2 font-bold text-aqua-700">{iqd(c.revenue)}</td>
                </tr>
              ))}
              {(!data?.topCustomers || data.topCustomers.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 text-sm">
                    لا توجد بيانات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, color,
}: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center gap-4">
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${color}15`, color }}
      >
        <Icon size={28} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}
