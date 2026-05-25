'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import type { LiveDriver, RoutePoint } from './LiveMap';
import { AlertTriangle, MapPin, Phone, Truck, Clock, RefreshCw } from 'lucide-react';

// Leaflet يستخدم `window` لذلك يجب تحميله dynamic بدون SSR
const LiveMap = dynamic(() => import('./LiveMap').then((m) => m.LiveMap), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-xl">
      <div className="text-slate-400 text-sm">جارٍ تحميل الخريطة...</div>
    </div>
  ),
});

const POLL_INTERVAL_MS = 15_000;

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'متاح',
  ON_ROUTE: 'في جولة',
  BREAK: 'استراحة',
  OFFLINE: 'غير متصل',
  ON_BREAK: 'استراحة',
};

const STATUS_CLASS: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700',
  ON_ROUTE: 'bg-sky-50 text-sky-700',
  BREAK: 'bg-amber-50 text-amber-700',
  ON_BREAK: 'bg-amber-50 text-amber-700',
  OFFLINE: 'bg-slate-100 text-slate-700',
};

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function LiveTrackingPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [date, setDate] = useState(todayStr());

  // قائمة السائقين — تحديث كل ١٥ ثانية
  const { data: drivers, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery<LiveDriver[]>({
    queryKey: ['drivers', 'live'],
    queryFn: async () => (await api.get('/drivers/live')).data,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  // مسار السائق المختار لليوم المحدد
  const { data: route } = useQuery<{ points: RoutePoint[]; totalKm: number }>({
    queryKey: ['drivers', selectedId, 'route', date],
    queryFn: async () =>
      (await api.get(`/drivers/${selectedId}/route`, { params: { date } })).data,
    enabled: !!selectedId,
  });

  const list = useMemo(() => drivers ?? [], [drivers]);

  const stats = useMemo(() => {
    const total = list.length;
    const positioned = list.filter((d) => d.currentLat != null && d.currentLng != null).length;
    const onRoute = list.filter((d) => d.status === 'ON_ROUTE').length;
    const inactive = list.filter((d) => d.inactive).length;
    return { total, positioned, onRoute, inactive };
  }, [list]);

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('ar-IQ', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  const selected = list.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="space-y-4" dir="rtl">
      {/* العنوان + إحصائيات */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="text-sky-600" size={26} />
            تتبع السائقين المباشر
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            مواقع آنية + مسارات تاريخية — تحديث تلقائي كل ١٥ ثانية
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          تحديث الآن
        </button>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="إجمالي السائقين" value={stats.total} color="slate" />
        <StatCard label="مع موقع نشط" value={stats.positioned} color="sky" />
        <StatCard label="في جولة الآن" value={stats.onRoute} color="emerald" />
        <StatCard label="غير نشط" value={stats.inactive} color="red" icon={stats.inactive > 0} />
      </div>

      {/* الخريطة + القائمة الجانبية */}
      <div className="grid grid-cols-[1fr_320px] gap-4" style={{ height: 'calc(100vh - 280px)' }}>
        {/* الخريطة */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-slate-400">
              جارٍ التحميل...
            </div>
          ) : (
            <LiveMap
              drivers={list}
              selectedRoute={route?.points ?? null}
              selectedDriverId={selectedId}
              onSelectDriver={(id) => setSelectedId(id)}
            />
          )}
        </div>

        {/* قائمة جانبية */}
        <div className="bg-white rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>السائقون ({list.length})</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                مباشر · {lastUpdate}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y">
            {list.length === 0 && !isLoading && (
              <div className="p-6 text-center text-sm text-slate-400">
                لا يوجد سائقون مسجّلون.
              </div>
            )}
            {list.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`w-full text-right p-3 hover:bg-slate-50 transition ${
                  selectedId === d.id ? 'bg-sky-50 border-r-4 border-sky-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate flex items-center gap-1.5">
                      {d.inactive && (
                        <AlertTriangle size={14} className="text-red-500 shrink-0" />
                      )}
                      {d.fullName}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1" dir="ltr">
                      <Phone size={11} />
                      {d.phone}
                    </div>
                    {d.vehiclePlate && (
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Truck size={11} />
                        {d.vehiclePlate}
                      </div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      d.inactive
                        ? 'bg-red-50 text-red-700'
                        : STATUS_CLASS[d.status] ?? STATUS_CLASS.OFFLINE
                    }`}
                  >
                    {d.inactive ? 'غير نشط' : STATUS_LABEL[d.status] ?? d.status}
                  </span>
                </div>

                {d.lastSeenMinutesAgo != null && (
                  <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                    <Clock size={10} />
                    {d.lastSeenMinutesAgo === 0
                      ? 'الآن'
                      : `قبل ${d.lastSeenMinutesAgo} دقيقة`}
                  </div>
                )}
                {d.currentLat == null && (
                  <div className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                    <MapPin size={10} />
                    لا يوجد موقع
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* لوحة معلومات السائق المختار */}
          {selected && (
            <div className="border-t bg-slate-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">
                  مسار {selected.fullName}
                </span>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕ إلغاء
                </button>
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded px-2 py-1.5"
              />
              {route && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white rounded p-2">
                    <div className="text-slate-500">نقاط GPS</div>
                    <div className="font-bold text-sky-600">{route.points.length}</div>
                  </div>
                  <div className="bg-white rounded p-2">
                    <div className="text-slate-500">المسافة</div>
                    <div className="font-bold text-sky-600">{route.totalKm} كم</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: 'slate' | 'sky' | 'emerald' | 'red';
  icon?: boolean;
}) {
  const colorMap = {
    slate: 'text-slate-700',
    sky: 'text-sky-600',
    emerald: 'text-emerald-600',
    red: 'text-red-600',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="text-xs text-slate-500 flex items-center gap-1">
        {icon && <AlertTriangle size={12} className="text-red-500" />}
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${colorMap[color]}`}>{value}</div>
    </div>
  );
}
