'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { HeartPulse, Server, Database, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

interface Health {
  api: string;
  db: string;
  generatedAt: string;
}

export default function HealthPage() {
  const healthQuery = useQuery<Health>({
    queryKey: ['platform', 'health'],
    queryFn: async () => (await api.get<Health>('/platform/health')).data,
    refetchInterval: 30_000,
  });

  const h = healthQuery.data;
  const apiOk = h?.api === 'ok';
  const dbOk = h?.db === 'ok';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <HeartPulse size={22} className="text-aqua-700" />
            صحة النظام
          </h1>
          <p className="text-sm text-slate-400 mt-1">حالة الخدمات الأساسية للمنصّة · فحص تلقائي كل 30 ثانية</p>
        </div>
        <button
          onClick={() => healthQuery.refetch()}
          disabled={healthQuery.isFetching}
          className="inline-flex items-center gap-2 text-[12.5px] font-bold text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={healthQuery.isFetching ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      {healthQuery.isError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          تعذّر الوصول إلى نقطة فحص الصحة — قد تكون الواجهة نفسها متوقفة.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ServiceCard
          loading={healthQuery.isLoading}
          ok={apiOk}
          icon={Server}
          title="واجهة الـ API"
          okText="تعمل وتستجيب (200)"
          downText="لا تستجيب"
        />
        <ServiceCard
          loading={healthQuery.isLoading}
          ok={dbOk}
          icon={Database}
          title="قاعدة البيانات (PostgreSQL)"
          okText="متصلة وصحّية"
          downText="غير متصلة"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 text-xs text-slate-400">
        آخر فحص:{' '}
        <span className="font-bold text-slate-600">
          {h?.generatedAt ? new Date(h.generatedAt).toLocaleString('en-US') : '—'}
        </span>
      </div>
    </div>
  );
}

function ServiceCard({
  loading,
  ok,
  icon: Icon,
  title,
  okText,
  downText,
}: {
  loading: boolean;
  ok: boolean;
  icon: any;
  title: string;
  okText: string;
  downText: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
          loading ? 'bg-slate-100 text-slate-400' : ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
        }`}
      >
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-slate-900 text-[15px]">{title}</div>
        <div className="text-[12.5px] text-slate-400 mt-0.5">
          {loading ? 'جارٍ الفحص…' : ok ? okText : downText}
        </div>
      </div>
      {!loading &&
        (ok ? (
          <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
        ) : (
          <XCircle size={22} className="text-red-500 shrink-0" />
        ))}
    </div>
  );
}
