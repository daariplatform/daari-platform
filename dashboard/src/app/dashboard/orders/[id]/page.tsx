'use client';

/**
 * Order detail — the dashboard previously linked customer rows to
 * `/dashboard/orders/[id]` but the page returned 404 (no file existed).
 * Backend now exposes `GET /orders/:id` (OWNER/MANAGER/ACCOUNTANT) that
 * returns the full customer + driver + tank + proof + GPS shape this
 * page binds to.
 *
 * Inline actions:
 *  - Assign driver (delegates to the existing modal pattern on the list page)
 *  - Cancel (POST /orders/:id/cancel) — plant admin can cancel anything
 *    except COMPLETED. Hidden once finished.
 *  - Reassign (when an order has a driver but is still in flight)
 *  - View proof photo (link out — server-side image, no exfiltration risk)
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  MapPin,
  Phone,
  Truck,
  XCircle,
  Image as ImageIcon,
  Clock,
  UserCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, iqd } from '@/lib/format';

interface OrderDetail {
  id: string;
  status: string;
  kind: string;
  priceIqd: number;
  paidAmountIqd: number;
  paymentMethod: string;
  proofPhotoUrl: string | null;
  requestedAt: string;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  completionLat: number | null;
  completionLng: number | null;
  customer: {
    id: string;
    fullName: string;
    phone: string;
    district: string;
    addressLine: string;
    locationLat: number | null;
    locationLng: number | null;
  } | null;
  walkinBuyerName: string | null;
  walkinBuyerPhone: string | null;
  driver: {
    id: string;
    vehiclePlate: string | null;
    user: { fullName: string; phone: string };
  } | null;
  tank: { id: string; qrCode: string; capacity: string } | null;
}

interface Driver {
  id: string;
  status: 'OFFLINE' | 'AVAILABLE' | 'ON_ROUTE' | 'BREAK';
  user: { fullName: string };
}

const STATUS_LABEL: Record<string, { ar: string; klass: string }> = {
  PENDING: { ar: 'قيد الانتظار', klass: 'bg-amber-50 text-amber-700' },
  ASSIGNED: { ar: 'مُسنَد', klass: 'bg-blue-50 text-blue-700' },
  EN_ROUTE: { ar: 'في الطريق', klass: 'bg-orange-50 text-orange-700' },
  COMPLETED: { ar: 'مكتمل', klass: 'bg-emerald-50 text-emerald-700' },
  CANCELLED: { ar: 'ملغى', klass: 'bg-red-50 text-red-700' },
  FAILED: { ar: 'فشل', klass: 'bg-red-50 text-red-700' },
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params?.id;
  const [assignOpen, setAssignOpen] = useState(false);

  const { data: order, isLoading, error } = useQuery<OrderDetail>({
    queryKey: ['order', id],
    queryFn: async () => (await api.get(`/orders/${id}`)).data,
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: async (reason: string) =>
      (await api.post(`/orders/${id}/cancel`, { reason })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'تعذّر الإلغاء';
      alert(msg);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <p className="text-slate-500 mb-3">الطلب غير موجود أو ليس لديك صلاحية لعرضه.</p>
        <button
          onClick={() => router.back()}
          className="text-aqua-700 hover:text-aqua-900 font-bold text-sm"
        >
          → رجوع
        </button>
      </div>
    );
  }

  const buyerName =
    order.customer?.fullName ?? order.walkinBuyerName ?? 'زبون عابر';
  const buyerPhone = order.customer?.phone ?? order.walkinBuyerPhone;
  const status = STATUS_LABEL[order.status] ?? {
    ar: order.status,
    klass: 'bg-slate-100 text-slate-700',
  };
  const canCancel = order.status !== 'COMPLETED' && order.status !== 'CANCELLED';

  function onCancelClick() {
    const reason = window.prompt(
      'سبب الإلغاء؟ سيُظهر للزبون.',
      'تم الإلغاء من قِبَل المعمل',
    );
    if (reason === null) return;
    cancelMutation.mutate(reason || 'تم الإلغاء من قِبَل المعمل');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-aqua-700 hover:text-aqua-900 text-sm font-bold"
        >
          <ArrowRight size={16} />
          الطلبات
        </button>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${status.klass}`}
          >
            {status.ar}
          </span>
          {canCancel && (
            <button
              type="button"
              onClick={onCancelClick}
              disabled={cancelMutation.isPending}
              className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
            >
              <XCircle size={14} />
              إلغاء الطلب
            </button>
          )}
          {order.status === 'PENDING' && (
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              className="flex items-center gap-1.5 bg-aqua-600 hover:bg-aqua-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
            >
              <UserCheck size={14} />
              تعيين سائق
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Buyer */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-sm text-slate-500 mb-3">الزبون</h2>
          <p className="text-lg font-bold">{buyerName}</p>
          {buyerPhone && (
            <div className="flex items-center gap-1.5 mt-2 text-sm text-slate-600">
              <Phone size={13} />
              <span dir="ltr">{buyerPhone}</span>
            </div>
          )}
          {order.customer?.district && (
            <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-600">
              <MapPin size={13} />
              {order.customer.district}
            </div>
          )}
          {order.customer?.addressLine && (
            <p className="text-xs text-slate-500 mt-2">{order.customer.addressLine}</p>
          )}
        </div>

        {/* Driver */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-sm text-slate-500 mb-3">السائق</h2>
          {order.driver ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Truck size={18} className="text-blue-600" />
                <p className="text-lg font-bold">{order.driver.user.fullName}</p>
              </div>
              {order.driver.vehiclePlate && (
                <p className="text-xs text-slate-500">
                  لوحة: {order.driver.vehiclePlate}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-1" dir="ltr">
                {order.driver.user.phone}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400">لم يُسنَد سائق بعد</p>
          )}
        </div>

        {/* Money */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-sm text-slate-500 mb-3">المبلغ</h2>
          <p className="text-2xl font-bold text-aqua-700">
            {iqd(order.priceIqd)}
          </p>
          {order.paidAmountIqd > 0 && order.paidAmountIqd !== order.priceIqd && (
            <p className="text-xs text-slate-500 mt-1">
              المدفوع: {iqd(order.paidAmountIqd)}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-2">
            طريقة الدفع: {order.paymentMethod}
          </p>
          {order.tank && (
            <p className="text-xs text-slate-400 mt-2 font-mono">
              QR: {order.tank.qrCode}
            </p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="font-bold text-sm text-slate-500 mb-4 flex items-center gap-2">
          <Clock size={16} />
          الخط الزمني
        </h2>
        <ol className="space-y-3">
          <TimelineRow
            label="طُلِب"
            ts={order.requestedAt}
            color="#64748b"
          />
          {order.assignedAt && (
            <TimelineRow label="أُسنِد" ts={order.assignedAt} color="#2563eb" />
          )}
          {order.startedAt && (
            <TimelineRow
              label="بدأ السائق الجولة"
              ts={order.startedAt}
              color="#ea580c"
            />
          )}
          {order.completedAt && (
            <TimelineRow
              label="اكتمل"
              ts={order.completedAt}
              color="#059669"
            />
          )}
          {order.cancelledAt && (
            <TimelineRow
              label={`أُلغي${order.cancelReason ? ` — ${order.cancelReason}` : ''}`}
              ts={order.cancelledAt}
              color="#dc2626"
            />
          )}
        </ol>
      </div>

      {/* Proof + completion location */}
      {(order.proofPhotoUrl ||
        (order.completionLat && order.completionLng)) && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-sm text-slate-500 mb-3">إثبات التعبئة</h2>
          <div className="flex flex-wrap gap-3">
            {order.proofPhotoUrl && (
              <a
                href={order.proofPhotoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm font-medium"
              >
                <ImageIcon size={16} />
                صورة الإثبات
              </a>
            )}
            {order.completionLat && order.completionLng && (
              <a
                href={`https://www.google.com/maps?q=${order.completionLat},${order.completionLng}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm font-medium"
              >
                <MapPin size={16} />
                نقطة التعبئة على الخريطة
              </a>
            )}
          </div>
        </div>
      )}

      {assignOpen && order.status === 'PENDING' && (
        <AssignDriverModal
          orderId={order.id}
          onClose={() => setAssignOpen(false)}
        />
      )}
    </div>
  );
}

function TimelineRow({
  label,
  ts,
  color,
}: {
  label: string;
  ts: string;
  color: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 flex items-center justify-between">
        <span className="text-sm">{label}</span>
        <span className="text-xs text-slate-500">{fmtDate(ts)}</span>
      </div>
    </li>
  );
}

function AssignDriverModal({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: drivers } = useQuery<Driver[]>({
    queryKey: ['drivers', 'assign-modal'],
    queryFn: async () => {
      const res = await api.get<{ items: Driver[] }>('/drivers', {
        params: { page: 1, pageSize: 200 },
      });
      return res.data?.items ?? [];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (driverId: string) =>
      (await api.post(`/orders/${orderId}/assign`, { driverId })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order', orderId] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'فشل التعيين';
      alert(msg);
    },
  });

  const available = (drivers ?? []).filter((d) => d.status === 'AVAILABLE');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
        dir="rtl"
      >
        <h3 className="text-lg font-bold mb-4">تعيين سائق</h3>
        {available.length === 0 ? (
          <p className="text-amber-700 text-sm">لا يوجد سائقون متاحون الآن.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {available.map((d) => (
              <button
                key={d.id}
                onClick={() => assignMutation.mutate(d.id)}
                disabled={assignMutation.isPending}
                className="w-full text-right p-3 rounded-lg border border-slate-200 hover:border-aqua-600 hover:bg-aqua-50 disabled:opacity-50 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Truck size={18} className="text-emerald-700" />
                </div>
                <span className="font-bold text-sm flex-1">
                  {d.user.fullName}
                </span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-medium"
        >
          إغلاق
        </button>
      </div>
    </div>
  );
}
