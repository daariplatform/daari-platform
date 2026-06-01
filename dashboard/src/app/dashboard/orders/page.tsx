'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate, iqd } from '@/lib/format';
import {
  Truck,
  UserCheck,
  X,
  Phone,
  MapPin,
  Clock,
  ChevronDown,
  Eye,
  XCircle,
} from 'lucide-react';

interface Order {
  id: string;
  status: string;
  kind: string;
  priceIqd: number;
  paidAmountIqd: number;
  requestedAt: string;
  completedAt: string | null;
  // Walk-in counter sales have customer=null + walkinBuyerName instead.
  // The previous type pretended customer was always present which crashed
  // the page in production the moment a walk-in landed in the list.
  customer: { id: string; fullName: string; phone: string; district: string } | null;
  walkinBuyerName?: string | null;
  walkinBuyerPhone?: string | null;
  driver: { id: string; user: { fullName: string } } | null;
  tank: { qrCode: string; capacity: string } | null;
}

/** Display name for an order's buyer — works for both registered customers
 *  and anonymous walk-ins. Always returns a non-empty string. */
function buyerName(o: Order): string {
  return o.customer?.fullName ?? o.walkinBuyerName ?? 'زبون عابر';
}

function buyerDistrict(o: Order): string {
  return o.customer?.district ?? '—';
}

interface Driver {
  id: string;
  status: 'OFFLINE' | 'AVAILABLE' | 'ON_ROUTE' | 'BREAK';
  user: { fullName: string; phone: string };
  todayDeliveries?: number;
}

const STATUS: Record<string, { label: string; klass: string; col: number }> = {
  PENDING: { label: 'قيد الانتظار', klass: 'bg-amber-50 text-amber-700 ring-amber-200', col: 0 },
  ASSIGNED: { label: 'مُسنَد', klass: 'bg-blue-50 text-blue-700 ring-blue-200', col: 1 },
  EN_ROUTE: { label: 'في الطريق', klass: 'bg-orange-50 text-orange-700 ring-orange-200', col: 2 },
  COMPLETED: { label: 'مكتمل', klass: 'bg-emerald-50 text-emerald-700 ring-emerald-200', col: 3 },
  CANCELLED: { label: 'ملغى', klass: 'bg-red-50 text-red-700 ring-red-200', col: -1 },
  FAILED: { label: 'فشل', klass: 'bg-red-50 text-red-700 ring-red-200', col: -1 },
};

interface OrdersPage {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface DriversPageResponse {
  items: Driver[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 50;

const COLUMNS: { key: string; title: string; statuses: string[]; color: string }[] = [
  { key: 'pending', title: 'قيد الانتظار', statuses: ['PENDING'], color: '#f59e0b' },
  { key: 'assigned', title: 'مُسنَد', statuses: ['ASSIGNED'], color: '#2563eb' },
  { key: 'enroute', title: 'في الطريق', statuses: ['EN_ROUTE'], color: '#ea580c' },
  { key: 'completed', title: 'مكتمل اليوم', statuses: ['COMPLETED'], color: '#059669' },
];

export default function OrdersPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [page, setPage] = useState(1);

  const { data: ordersPage } = useQuery<OrdersPage>({
    queryKey: ['orders', page],
    queryFn: async () =>
      (await api.get('/orders', { params: { page, pageSize: PAGE_SIZE } })).data,
    refetchInterval: 15_000,
  });
  const orders = ordersPage?.items;
  const totalPages = ordersPage?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الطلبات</h1>
          <p className="text-slate-500 text-sm mt-1">يتم التحديث تلقائياً كل ١٥ ثانية</p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setView('kanban')}
            className={`px-4 py-1.5 rounded text-sm font-medium ${
              view === 'kanban' ? 'bg-white shadow-sm text-aqua-700' : 'text-slate-500'
            }`}
          >
            لوحة (Kanban)
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-4 py-1.5 rounded text-sm font-medium ${
              view === 'list' ? 'bg-white shadow-sm text-aqua-700' : 'text-slate-500'
            }`}
          >
            قائمة
          </button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colOrders = (orders ?? []).filter((o) => col.statuses.includes(o.status));
            return (
              <div key={col.key} className="bg-slate-50 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                    <h3 className="font-bold text-sm">{col.title}</h3>
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: col.color }}
                  >
                    {colOrders.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  {colOrders.map((o) => (
                    <OrderCard key={o.id} order={o} onAssign={() => setAssigningOrder(o)} />
                  ))}
                  {colOrders.length === 0 && (
                    <p className="text-center text-xs text-slate-400 py-6">لا توجد طلبات</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <OrdersTable orders={orders} onAssign={setAssigningOrder} />
          {totalPages > 1 && (
            <div
              dir="rtl"
              className="flex items-center justify-center gap-4 px-4 py-3 mt-3 bg-white rounded-2xl shadow-sm text-sm"
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                « السابق
              </button>
              <span className="text-slate-600">
                صفحة {page} من {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                التالي »
              </button>
            </div>
          )}
        </>
      )}

      {assigningOrder && (
        <AssignDriverModal
          order={assigningOrder}
          onClose={() => setAssigningOrder(null)}
        />
      )}
    </div>
  );
}

function OrderCard({ order, onAssign }: { order: Order; onAssign: () => void }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
      <Link
        href={`/dashboard/orders/${order.id}` as any}
        className="block hover:opacity-80"
      >
        <div className="flex items-start justify-between mb-2">
          <p className="font-bold text-sm">{buyerName(order)}</p>
          <p className="text-sm font-bold text-aqua-700">{iqd(order.priceIqd)}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
          <MapPin size={11} /> {buyerDistrict(order)}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
          <Phone size={11} />{' '}
          <span dir="ltr">
            {order.customer?.phone ?? order.walkinBuyerPhone ?? '—'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400 mb-3">
          <Clock size={11} /> {fmtDate(order.requestedAt)}
        </div>
      </Link>
      {order.driver ? (
        <div className="bg-blue-50 rounded-lg p-2 flex items-center gap-2">
          <Truck size={14} className="text-blue-600" />
          <span className="text-xs font-medium text-blue-700">{order.driver.user.fullName}</span>
        </div>
      ) : (
        <button
          onClick={onAssign}
          className="w-full bg-aqua-50 hover:bg-aqua-100 text-aqua-700 text-xs font-bold rounded-lg py-2 flex items-center justify-center gap-1.5"
        >
          <UserCheck size={14} /> تعيين سائق
        </button>
      )}
    </div>
  );
}

function OrdersTable({ orders, onAssign }: { orders?: Order[]; onAssign: (o: Order) => void }) {
  const qc = useQueryClient();
  // Inline cancel — reuses the backend `/orders/:id/cancel` route that
  // already gates by capability. Prompts for a reason so the customer
  // sees something better than "تم الإلغاء". Keeps the row in place
  // so the plant can audit; row re-rendering pulls the new status.
  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.post(`/orders/${id}/cancel`, { reason })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'تعذّر الإلغاء';
      alert(msg);
    },
  });

  return (
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
            <th className="text-right px-4 py-3">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {orders?.map((o) => {
            const canCancel = o.status !== 'COMPLETED' && o.status !== 'CANCELLED';
            return (
              <tr key={o.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{buyerName(o)}</td>
                <td className="px-4 py-3">{buyerDistrict(o)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {o.driver?.user.fullName ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ring-1 ${
                      STATUS[o.status]?.klass ?? ''
                    }`}
                  >
                    {STATUS[o.status]?.label ?? o.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-bold">{iqd(o.priceIqd)}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {fmtDate(o.completedAt ?? o.requestedAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {/* Detail page — wired through the new
                        /dashboard/orders/[id] route. Was previously a
                        404 because the page didn't exist. */}
                    <Link
                      href={`/dashboard/orders/${o.id}` as any}
                      className="text-xs text-aqua-700 hover:text-aqua-900 font-medium flex items-center gap-1"
                    >
                      <Eye size={13} /> تفاصيل
                    </Link>
                    {!o.driver && o.status === 'PENDING' && (
                      <button
                        onClick={() => onAssign(o)}
                        className="text-xs text-blue-700 hover:text-blue-900 font-medium"
                      >
                        تعيين سائق
                      </button>
                    )}
                    {canCancel && (
                      <button
                        onClick={() => {
                          const reason = window.prompt(
                            'سبب الإلغاء؟',
                            'تم الإلغاء من قِبَل المعمل',
                          );
                          if (reason === null) return;
                          cancelMutation.mutate({
                            id: o.id,
                            reason: reason || 'تم الإلغاء من قِبَل المعمل',
                          });
                        }}
                        disabled={cancelMutation.isPending}
                        className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1 disabled:opacity-50"
                      >
                        <XCircle size={13} /> إلغاء
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AssignDriverModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const qc = useQueryClient();
  // /drivers returns { items, total, ... } — pull the first 200 (more than
  // any plant will realistically have) so the assign modal can pick freely.
  const { data: drivers } = useQuery<Driver[]>({
    queryKey: ['drivers', 'assign-modal'],
    queryFn: async () => {
      const res = await api.get<DriversPageResponse>('/drivers', {
        params: { page: 1, pageSize: 200 },
      });
      return res.data?.items ?? [];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (driverId: string) =>
      (await api.post(`/orders/${order.id}/assign`, { driverId })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      onClose();
    },
    onError: (err: any) => alert(err?.response?.data?.message ?? 'فشل التعيين'),
  });

  const available = (drivers ?? []).filter((d) => d.status === 'AVAILABLE');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" dir="rtl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">تعيين سائق</h3>
            <p className="text-xs text-slate-500 mt-1">
              للطلب من {buyerName(order)} • {buyerDistrict(order)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {available.length === 0 ? (
          <div className="bg-amber-50 rounded-lg p-4 text-center">
            <p className="text-amber-700 text-sm font-medium">لا يوجد سائقون متاحون الآن</p>
            <p className="text-xs text-amber-600 mt-1">
              {drivers?.length ?? 0} سائق غير متاح ({(drivers ?? []).filter((d) => d.status === 'ON_ROUTE').length} في جولة)
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {available.map((d) => (
              <button
                key={d.id}
                onClick={() => assignMutation.mutate(d.id)}
                disabled={assignMutation.isPending}
                className="w-full text-right p-3 rounded-lg border border-slate-200 hover:border-aqua-600 hover:bg-aqua-50 transition flex items-center justify-between disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Truck size={18} className="text-emerald-700" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{d.user.fullName}</p>
                    <p className="text-xs text-slate-500">
                      <span className="text-emerald-600">متاح</span>
                      {d.todayDeliveries !== undefined && ` • ${d.todayDeliveries} توصيلة اليوم`}
                    </p>
                  </div>
                </div>
                <ChevronDown size={16} className="text-slate-400 rotate-90" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
