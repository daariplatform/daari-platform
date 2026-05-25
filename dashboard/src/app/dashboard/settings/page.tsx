'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { iqd } from '@/lib/format';
import { Save, MapPin, Clock, Phone, Tag, Truck, Settings as SettingsIcon } from 'lucide-react';

interface PlantSettings {
  name: string;
  ownerName?: string;
  ownerPhone?: string;
  city?: string;
  refillPriceIqd: number;
  deliveryFeeIqd: number;
  freeDeliveryThresholdIqd?: number;
  coverageKm: number;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  refillBonusIqd: number;
  newCustomerBonusIqd: number;
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<PlantSettings>({
    queryKey: ['plant-settings'],
    queryFn: async () => (await api.get('/tenants/me/settings')).data,
  });

  const [form, setForm] = useState<PlantSettings | null>(null);

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  const saveMutation = useMutation({
    mutationFn: async (payload: PlantSettings) =>
      (await api.patch('/tenants/me/settings', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plant-settings'] });
      alert('تم حفظ الإعدادات بنجاح');
    },
    onError: (err: any) => alert(err?.response?.data?.message ?? 'فشل الحفظ'),
  });

  if (isLoading || !form) {
    return <div className="h-64 bg-slate-100 animate-pulse rounded-2xl" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إعدادات المعمل</h1>
        <p className="text-slate-500 text-sm mt-1">عدّل أسعار التعبئة، ساعات العمل، نطاق التوصيل والمكافآت</p>
      </div>

      {/* معلومات أساسية */}
      <Section title="معلومات المعمل" icon={SettingsIcon}>
        <Field label="اسم المعمل" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field
          label="اسم المالك"
          value={form.ownerName ?? ''}
          onChange={(v) => setForm({ ...form, ownerName: v })}
        />
        <Field
          label="هاتف المالك"
          value={form.ownerPhone ?? ''}
          onChange={(v) => setForm({ ...form, ownerPhone: v })}
          ltr
        />
        <Field label="المدينة" value={form.city ?? ''} onChange={(v) => setForm({ ...form, city: v })} />
      </Section>

      {/* الأسعار */}
      <Section title="الأسعار" icon={Tag}>
        <Field
          label="سعر التعبئة (د.ع)"
          type="number"
          value={String(form.refillPriceIqd)}
          onChange={(v) => setForm({ ...form, refillPriceIqd: Number(v) || 0 })}
        />
        <Field
          label="رسوم التوصيل (د.ع)"
          type="number"
          value={String(form.deliveryFeeIqd)}
          onChange={(v) => setForm({ ...form, deliveryFeeIqd: Number(v) || 0 })}
        />
        <Field
          label="حد التوصيل المجاني (د.ع)"
          type="number"
          value={String(form.freeDeliveryThresholdIqd ?? 0)}
          onChange={(v) => setForm({ ...form, freeDeliveryThresholdIqd: Number(v) || undefined })}
          hint="إذا كان الطلب أعلى من هذا، التوصيل مجاناً. اتركه 0 لإلغاء"
        />
      </Section>

      {/* نطاق التوصيل */}
      <Section title="نطاق التوصيل" icon={MapPin}>
        <Field
          label="نصف القطر (كم)"
          type="number"
          value={String(form.coverageKm)}
          onChange={(v) => setForm({ ...form, coverageKm: Number(v) || 1 })}
          hint="أقصى مسافة تخدمها من المعمل"
        />
      </Section>

      {/* ساعات العمل */}
      <Section title="ساعات العمل" icon={Clock}>
        <Field
          label="ساعة البدء"
          value={form.workingHoursStart ?? '08:00'}
          onChange={(v) => setForm({ ...form, workingHoursStart: v })}
          hint="مثال: 08:00"
        />
        <Field
          label="ساعة الانتهاء"
          value={form.workingHoursEnd ?? '22:00'}
          onChange={(v) => setForm({ ...form, workingHoursEnd: v })}
          hint="مثال: 22:00"
        />
      </Section>

      {/* المكافآت */}
      <Section title="المكافآت والولاء" icon={Truck}>
        <Field
          label="مكافأة التعبئة (د.ع)"
          type="number"
          value={String(form.refillBonusIqd)}
          onChange={(v) => setForm({ ...form, refillBonusIqd: Number(v) || 0 })}
          hint="نقاط/مال تُمنح للزبون لكل تعبئة"
        />
        <Field
          label="مكافأة زبون جديد (د.ع)"
          type="number"
          value={String(form.newCustomerBonusIqd)}
          onChange={(v) => setForm({ ...form, newCustomerBonusIqd: Number(v) || 0 })}
          hint="مكافأة أول طلب من الزبائن الجدد"
        />
      </Section>

      <div className="sticky bottom-4 z-10">
        <button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          className="w-full px-6 py-4 bg-aqua-600 hover:bg-aqua-700 text-white rounded-xl font-bold shadow-lg shadow-aqua-200 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save size={18} />
          {saveMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ كل التغييرات'}
        </button>
      </div>
    </div>
  );
}

function Section({
  title, icon: Icon, children,
}: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Icon size={18} className="text-aqua-600" />
        {title}
      </h2>
      <div className="grid md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', hint, ltr = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
  ltr?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={ltr ? 'ltr' : undefined}
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-600/30 focus:border-aqua-600"
      />
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
