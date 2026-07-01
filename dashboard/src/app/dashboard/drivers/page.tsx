'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { CredentialsModal } from '@/components/credentials-modal';
import { fmtDate, iqd } from '@/lib/format';
import { Star } from 'lucide-react';
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

interface Driver {
  id: string;
  status: 'OFFLINE' | 'AVAILABLE' | 'ON_ROUTE' | 'ON_BREAK';
  vehiclePlate: string | null;
  baseSalaryIqd: number;
  commissionPerRefillIqd: number;
  hiredAt: string;
  user: {
    fullName: string;
    phone: string;
    isActive: boolean;
  };
}

interface CreateDriverResponse extends Driver {
  tempPassword: string;
}

interface ResetPasswordResponse {
  ok: true;
  tempPassword: string;
}

interface DriversPage {
  items: Driver[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 50;

// Keys MUST match the Prisma DriverStatus enum exactly (OFFLINE / AVAILABLE /
// ON_ROUTE / ON_BREAK). The enum value is `ON_BREAK`, not `BREAK` — a driver
// taking a break used to blow up the whole table via `undefined.klass`.
const STATUS: Record<Driver['status'], { label: string; klass: string }> = {
  AVAILABLE: { label: 'متاح', klass: 'bg-emerald-50 text-emerald-700' },
  ON_ROUTE: { label: 'في جولة', klass: 'bg-sky-50 text-sky-700' },
  ON_BREAK: { label: 'استراحة', klass: 'bg-amber-50 text-amber-700' },
  OFFLINE: { label: 'غير متصل', klass: 'bg-slate-100 text-slate-700' },
};

export default function DriversPage() {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [credentials, setCredentials] = useState<{
    phone: string;
    password: string;
    fullName: string;
  } | null>(null);

  const qc = useQueryClient();
  const { data: pageData } = useQuery<DriversPage>({
    queryKey: ['drivers', page],
    queryFn: async () =>
      (await api.get('/drivers', { params: { page, pageSize: PAGE_SIZE } })).data,
  });
  const data = pageData?.items;
  const totalPages = pageData?.totalPages ?? 0;

  const createMutation = useMutation<CreateDriverResponse, unknown, CreateDriverForm>({
    mutationFn: async (form) => (await api.post('/drivers', form)).data,
    onSuccess: (created) => {
      setCredentials({
        phone: created.user.phone,
        password: created.tempPassword,
        fullName: created.user.fullName,
      });
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  const resetMutation = useMutation<ResetPasswordResponse, unknown, Driver>({
    mutationFn: async (driver) =>
      (await api.post(`/drivers/${driver.id}/reset-password`, {})).data,
    onSuccess: (res, driver) => {
      setCredentials({
        phone: driver.user.phone,
        password: res.tempPassword,
        fullName: driver.user.fullName,
      });
    },
  });

  // Soft-fire — PATCHes /drivers/:id with isActive=false. The backend
  // marks the user inactive (so they can't log in anymore) and the driver
  // record stays for accounting history. Audit found this was a dead
  // workflow: "إضافة سائق" worked but there was no way to remove one.
  const fireMutation = useMutation({
    mutationFn: async (driverId: string) =>
      (await api.patch(`/drivers/${driverId}`, { isActive: false })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drivers'] }),
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'فشل فصل السائق';
      alert(msg);
    },
  });

  // Edit — opens the same modal with prefilled values, switches to PATCH.
  const [editing, setEditing] = useState<Driver | null>(null);
  const editMutation = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: Partial<CreateDriverForm>;
    }) => (await api.patch(`/drivers/${id}`, body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers'] });
      setEditing(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'فشل التحديث';
      alert(msg);
    },
  });

  // Performance — opens the `/drivers/:id/perf?period=month` summary in
  // a modal so the admin can see completedOrders + revenue + bonus
  // without leaving the page.
  const [perfDriver, setPerfDriver] = useState<Driver | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">السائقون</h1>
          <p className="text-slate-500">إدارة سائقي المعمل ورواتبهم</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg text-sm font-medium"
        >
          + إضافة سائق
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-right px-4 py-3">الاسم</th>
              <th className="text-right px-4 py-3">الهاتف</th>
              <th className="text-right px-4 py-3">المركبة</th>
              <th className="text-right px-4 py-3">الحالة</th>
              <th className="text-right px-4 py-3">الراتب الأساسي</th>
              <th className="text-right px-4 py-3">عمولة التعبئة</th>
              <th className="text-right px-4 py-3">تاريخ التعيين</th>
              <th className="text-right px-4 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((d) => (
              <tr key={d.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{d.user.fullName}</td>
                <td className="px-4 py-3" dir="ltr">{d.user.phone}</td>
                <td className="px-4 py-3">{d.vehiclePlate ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs ${(STATUS[d.status] ?? STATUS.OFFLINE).klass}`}
                  >
                    {(STATUS[d.status] ?? STATUS.OFFLINE).label}
                  </span>
                </td>
                <td className="px-4 py-3">{d.baseSalaryIqd.toLocaleString('ar-IQ')} د.ع</td>
                <td className="px-4 py-3">{d.commissionPerRefillIqd.toLocaleString('ar-IQ')} د.ع</td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(d.hiredAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setPerfDriver(d)}
                      className="text-xs text-emerald-700 hover:text-emerald-900"
                    >
                      📊 أداء
                    </button>
                    <button
                      onClick={() => setEditing(d)}
                      className="text-xs text-blue-700 hover:text-blue-900"
                    >
                      ✏️ تعديل
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`إعادة تعيين كلمة المرور لـ ${d.user.fullName}؟`)) {
                          resetMutation.mutate(d);
                        }
                      }}
                      disabled={resetMutation.isPending}
                      className="text-xs text-aqua-700 hover:text-aqua-900 disabled:opacity-50"
                    >
                      🔑 إعادة تعيين
                    </button>
                    {d.user.isActive && (
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `فصل السائق ${d.user.fullName}؟ سيُمنع من تسجيل الدخول وتبقى سجلاته للمحاسبة.`,
                            )
                          ) {
                            fireMutation.mutate(d.id);
                          }
                        }}
                        disabled={fireMutation.isPending}
                        className="text-xs text-red-700 hover:text-red-900 disabled:opacity-50"
                      >
                        ⛔ فصل
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">
                  لا يوجد سائقون بعد — اضغط &quot;إضافة سائق&quot; للبدء.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div
            dir="rtl"
            className="flex items-center justify-center gap-4 px-4 py-3 border-t bg-slate-50 text-sm"
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
      </div>

      {showCreate && (
        <CreateDriverModal
          onSubmit={(form) => createMutation.mutate(form)}
          onCancel={() => setShowCreate(false)}
          isPending={createMutation.isPending}
          error={
            createMutation.isError
              ? (createMutation.error as { response?: { data?: { message?: string } } })
                  ?.response?.data?.message ?? 'فشل الإنشاء'
              : null
          }
        />
      )}

      <CredentialsModal
        credentials={credentials}
        onClose={() => setCredentials(null)}
        role="driver"
      />

      {editing && (
        <EditDriverModal
          driver={editing}
          isPending={editMutation.isPending}
          onSubmit={(body) =>
            editMutation.mutate({ id: editing.id, body })
          }
          onCancel={() => setEditing(null)}
        />
      )}

      {perfDriver && (
        <DriverPerfModal
          driver={perfDriver}
          onClose={() => setPerfDriver(null)}
        />
      )}
    </div>
  );
}

function EditDriverModal({
  driver,
  isPending,
  onSubmit,
  onCancel,
}: {
  driver: Driver;
  isPending: boolean;
  onSubmit: (body: Partial<CreateDriverForm>) => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState(driver.user.fullName);
  const [vehiclePlate, setVehiclePlate] = useState(driver.vehiclePlate ?? '');
  const [baseSalary, setBaseSalary] = useState(String(driver.baseSalaryIqd));
  const [commission, setCommission] = useState(
    String(driver.commissionPerRefillIqd),
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
        dir="rtl"
      >
        <h3 className="text-lg font-bold">تعديل بيانات السائق</h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              الاسم الكامل
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              رقم اللوحة
            </label>
            <input
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                الراتب الأساسي
              </label>
              <input
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value.replace(/\D/g, ''))}
                dir="ltr"
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                عمولة التعبئة
              </label>
              <input
                value={commission}
                onChange={(e) => setCommission(e.target.value.replace(/\D/g, ''))}
                dir="ltr"
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-medium"
          >
            إلغاء
          </button>
          <button
            onClick={() =>
              onSubmit({
                fullName,
                vehiclePlate: vehiclePlate || undefined,
                baseSalaryIqd: baseSalary ? parseInt(baseSalary, 10) : undefined,
                commissionPerRefillIqd: commission
                  ? parseInt(commission, 10)
                  : undefined,
              })
            }
            disabled={isPending}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {isPending ? 'جارٍ الحفظ…' : 'احفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DriverPerf {
  fullName: string;
  completedOrders: number;
  revenueIqd: number;
  bonusIqd: number;
  avgCompletionMin: number | null;
  customerRating: number | null;
  // Added by the backend ratings feature. `avgRating` is the genuine 1..5
  // average (null when the driver has no ratings yet); `ratingCount` is the
  // sample size. Optional on the type so older API responses still parse.
  avgRating?: number | null;
  ratingCount?: number;
}

interface DriverRating {
  stars: number;
  comment: string | null;
  createdAt: string;
  customerName: string | null;
}

function DriverPerfModal({
  driver,
  onClose,
}: {
  driver: Driver;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'perf' | 'ratings'>('perf');
  const [period, setPeriod] = useState<'week' | 'month'>('month');
  const { data, isLoading } = useQuery<DriverPerf>({
    queryKey: ['driver-perf', driver.id, period],
    queryFn: async () =>
      (
        await api.get(`/drivers/${driver.id}/perf`, {
          params: { period },
        })
      ).data,
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        dir="rtl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">أداء {driver.user.fullName}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        {/* Average rating banner — shows the genuine 1..5 star average and
            sample size from /drivers/:id/perf. Period-scoped like the rest
            of the modal; shows "—" when the driver has no ratings yet. */}
        <div className="bg-amber-50 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-amber-700">متوسط تقييم الزبائن</p>
            <StarRow value={data?.avgRating ?? null} />
          </div>
          <div className="text-left">
            <p className="text-lg font-bold text-amber-700">
              {data?.avgRating != null
                ? data.avgRating.toLocaleString('ar-IQ')
                : '—'}
            </p>
            <p className="text-[11px] text-amber-600">
              {(data?.ratingCount ?? 0).toLocaleString('ar-IQ')} تقييم
            </p>
          </div>
        </div>

        {/* Top-level tabs: performance metrics vs. the ratings list. */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['perf', 'ratings'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-3 py-1 rounded text-xs font-bold ${
                tab === t ? 'bg-white shadow-sm text-aqua-700' : 'text-slate-500'
              }`}
            >
              {t === 'perf' ? 'الأداء' : 'التقييمات'}
            </button>
          ))}
        </div>

        {tab === 'perf' ? (
          <>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {(['week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`flex-1 px-3 py-1 rounded text-xs font-bold ${
                    period === p
                      ? 'bg-white shadow-sm text-aqua-700'
                      : 'text-slate-500'
                  }`}
                >
                  {p === 'week' ? 'هذا الأسبوع' : 'هذا الشهر'}
                </button>
              ))}
            </div>

            {isLoading ? (
              <p className="text-center text-slate-500 py-6">جاري التحميل…</p>
            ) : data ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <PerfTile
                    label="مهام مكتملة"
                    value={data.completedOrders.toLocaleString('ar-IQ')}
                  />
                  <PerfTile
                    label="الإيراد المُحصَّل"
                    value={iqd(data.revenueIqd)}
                  />
                  <PerfTile
                    label="بونص + عمولات"
                    value={iqd(data.bonusIqd)}
                  />
                  <PerfTile
                    label="متوسط وقت التعبئة"
                    value={
                      data.avgCompletionMin != null
                        ? `${data.avgCompletionMin} دقيقة`
                        : '—'
                    }
                  />
                </div>

                {/* Lightweight earnings/performance bar — compares the
                    headline figures for the selected period at a glance.
                    Reuses the already-loaded /perf data, so no extra fetch. */}
                <div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    ملخّص بصري ({period === 'week' ? 'هذا الأسبوع' : 'هذا الشهر'})
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={[
                        {
                          name: 'مهام',
                          value: data.completedOrders,
                          kind: 'count' as const,
                        },
                        {
                          name: 'إيراد',
                          value: data.revenueIqd,
                          kind: 'iqd' as const,
                        },
                        {
                          name: 'بونص',
                          value: data.bonusIqd,
                          kind: 'iqd' as const,
                        },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} width={28} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid #e2e8f0',
                        }}
                        formatter={(value: number | string) =>
                          (value as number).toLocaleString('ar-IQ')
                        }
                      />
                      <Bar
                        dataKey="value"
                        fill="#0891b2"
                        radius={[8, 8, 0, 0]}
                        name="القيمة"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : null}
          </>
        ) : (
          <DriverRatingsTab driverId={driver.id} />
        )}
      </div>
    </div>
  );
}

/**
 * "التقييمات" tab — loads recent star ratings from GET /drivers/:id/ratings
 * (may 404 until the backend deploys the endpoint; we degrade to a friendly
 * empty/error state). Rendered as a clean list of star rows + optional
 * comment + customer name + date.
 */
function DriverRatingsTab({ driverId }: { driverId: string }) {
  const { data, isLoading, isError } = useQuery<DriverRating[]>({
    queryKey: ['driver-ratings', driverId],
    queryFn: async () => (await api.get(`/drivers/${driverId}/ratings`)).data,
    retry: false,
  });

  if (isLoading) {
    return <p className="text-center text-slate-500 py-6">جاري التحميل…</p>;
  }
  if (isError) {
    return (
      <p className="text-center text-slate-400 text-sm py-6">
        تعذّر تحميل التقييمات حالياً.
      </p>
    );
  }
  if (!data || data.length === 0) {
    return (
      <p className="text-center text-slate-400 text-sm py-6">
        لا توجد تقييمات بعد.
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto">
      {data.map((r, i) => (
        <div key={i} className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <StarRow value={r.stars} />
            <span className="text-[11px] text-slate-400">
              {fmtDate(r.createdAt)}
            </span>
          </div>
          {r.comment && (
            <p className="text-sm text-slate-700 mt-1.5">{r.comment}</p>
          )}
          <p className="text-[11px] text-slate-500 mt-1">
            {r.customerName ?? 'زبون'}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Renders 5 stars filled up to `value` (rounded). `value` of null renders
 * empty/muted stars — used for the "no ratings yet" case.
 */
function StarRow({ value }: { value: number | null }) {
  const filled = value != null ? Math.round(value) : 0;
  return (
    <div className="flex items-center gap-0.5 mt-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={14}
          className={
            value != null && s <= filled
              ? 'fill-amber-400 text-amber-400'
              : 'text-slate-300'
          }
        />
      ))}
    </div>
  );
}

function PerfTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-sm font-bold mt-1">{value}</p>
    </div>
  );
}

interface CreateDriverForm {
  fullName: string;
  phone: string;
  vehiclePlate?: string;
  baseSalaryIqd?: number;
  commissionPerRefillIqd?: number;
}

function CreateDriverModal({
  onSubmit,
  onCancel,
  isPending,
  error,
}: {
  onSubmit: (form: CreateDriverForm) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    vehiclePlate: '',
    baseSalary: '',
    commission: '',
  });

  const canSubmit = form.fullName.length >= 2 && /^07\d{9}$/.test(form.phone);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4" dir="rtl">
        <div>
          <h3 className="text-lg font-bold">إضافة سائق جديد</h3>
          <p className="text-xs text-slate-500 mt-1">
            سيتم إنشاء حساب دخول له تلقائياً وسنعرض كلمة المرور مرة واحدة.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">الاسم الكامل</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              placeholder="مثال: علي عبدالله"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              رقم الهاتف (يُستخدم للدخول)
            </label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
              dir="ltr"
              maxLength={11}
              placeholder="07XXXXXXXXX"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              رقم اللوحة (اختياري)
            </label>
            <input
              value={form.vehiclePlate}
              onChange={(e) => setForm({ ...form, vehiclePlate: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              placeholder="مثال: بغداد 123456"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                الراتب الأساسي (د.ع/شهر)
              </label>
              <input
                value={form.baseSalary}
                onChange={(e) =>
                  setForm({ ...form, baseSalary: e.target.value.replace(/\D/g, '') })
                }
                dir="ltr"
                placeholder="500000"
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                عمولة لكل تعبئة (د.ع)
              </label>
              <input
                value={form.commission}
                onChange={(e) =>
                  setForm({ ...form, commission: e.target.value.replace(/\D/g, '') })
                }
                dir="ltr"
                placeholder="200"
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-medium"
          >
            إلغاء
          </button>
          <button
            onClick={() =>
              onSubmit({
                fullName: form.fullName,
                phone: form.phone,
                vehiclePlate: form.vehiclePlate || undefined,
                baseSalaryIqd: form.baseSalary ? parseInt(form.baseSalary, 10) : undefined,
                commissionPerRefillIqd: form.commission
                  ? parseInt(form.commission, 10)
                  : undefined,
              })
            }
            disabled={!canSubmit || isPending}
            className="flex-1 px-4 py-2 bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {isPending ? 'جارٍ الإنشاء...' : 'إنشاء وعرض كلمة المرور'}
          </button>
        </div>
      </div>
    </div>
  );
}
