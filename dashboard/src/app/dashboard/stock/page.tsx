'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Droplet, AlertTriangle, History } from 'lucide-react';

interface Stock {
  id: string;
  tenantId: string;
  currentLiters: number;
  capacityLiters: number;
  lowThresholdLiters: number;
  lastTopUpAt: string | null;
  lastTopUpLiters: number | null;
  updatedAt: string;
}

export default function StockPage() {
  const qc = useQueryClient();
  const [topUpLiters, setTopUpLiters] = useState('');
  const [editCapacity, setEditCapacity] = useState(false);
  const [editThreshold, setEditThreshold] = useState(false);
  const [capacityInput, setCapacityInput] = useState('');
  const [thresholdInput, setThresholdInput] = useState('');

  const { data, isLoading } = useQuery<Stock>({
    queryKey: ['plant-stock'],
    queryFn: async () => (await api.get('/plant/stock')).data,
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, number>) =>
      (await api.post('/plant/stock', body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plant-stock'] });
      setTopUpLiters('');
      setEditCapacity(false);
      setEditThreshold(false);
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-slate-100 animate-pulse rounded-2xl" />
      </div>
    );
  }

  const usagePct = Math.min(100, Math.round((data.currentLiters / data.capacityLiters) * 100));
  const isLow = data.currentLiters <= data.lowThresholdLiters;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">مخزون المياه</h1>
          <p className="text-slate-500 text-sm mt-1">
            ينخفض تلقائياً مع كل تعبئة، ويحدّث يدوياً عند التزويد
          </p>
        </div>
      </div>

      {/* Hero stock meter */}
      <div
        className="rounded-3xl p-6 text-white relative overflow-hidden"
        style={{
          background: isLow
            ? 'linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #ef4444 100%)'
            : 'linear-gradient(135deg, #0e7490 0%, #0891b2 50%, #06b6d4 100%)',
        }}
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-cyan-100 text-sm flex items-center gap-2">
                <Droplet size={16} />
                المخزون الحالي
              </p>
              <p className="text-5xl font-bold mt-1">
                {data.currentLiters.toLocaleString('ar-IQ')}
                <span className="text-xl mr-2 opacity-80">/ {data.capacityLiters.toLocaleString('ar-IQ')} لتر</span>
              </p>
            </div>
            {isLow && (
              <div className="bg-white/20 px-4 py-2 rounded-xl flex items-center gap-2">
                <AlertTriangle size={20} />
                <span className="font-bold">مخزون منخفض!</span>
              </div>
            )}
          </div>
          {/* Bar */}
          <div className="h-4 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="text-cyan-100 text-xs mt-2">
            {usagePct}% من السعة • تنبيه عند {data.lowThresholdLiters.toLocaleString('ar-IQ')} لتر
          </p>
        </div>
      </div>

      {/* Top up */}
      <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-200">
        <h2 className="font-bold text-slate-900 mb-3">تزويد المخزون</h2>
        <div className="flex gap-2">
          <input
            type="number"
            value={topUpLiters}
            onChange={(e) => setTopUpLiters(e.target.value)}
            placeholder="عدد اللترات (مثلاً 5000)"
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5"
          />
          <button
            onClick={() => {
              const n = parseInt(topUpLiters, 10);
              if (!n || n <= 0) return;
              updateMutation.mutate({ topUpLiters: n });
            }}
            disabled={!topUpLiters || updateMutation.isPending}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            + إضافة للمخزون
          </button>
        </div>
        {data.lastTopUpAt && (
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <History size={12} />
            آخر تزويد: {data.lastTopUpLiters?.toLocaleString('ar-IQ')} لتر بتاريخ {new Date(data.lastTopUpAt).toLocaleString('ar-IQ')}
          </p>
        )}
      </div>

      {/* Settings */}
      <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-200">
        <h2 className="font-bold text-slate-900 mb-4">الإعدادات</h2>
        <div className="space-y-3">
          <SettingRow
            label="السعة الإجمالية للخزانات"
            value={`${data.capacityLiters.toLocaleString('ar-IQ')} لتر`}
            isEditing={editCapacity}
            onEdit={() => {
              setEditCapacity(true);
              setCapacityInput(String(data.capacityLiters));
            }}
            onSave={() => {
              const n = parseInt(capacityInput, 10);
              if (!n || n <= 0) return;
              updateMutation.mutate({ capacityLiters: n });
            }}
            onCancel={() => setEditCapacity(false)}
            inputValue={capacityInput}
            onInputChange={setCapacityInput}
          />
          <SettingRow
            label="حدّ التنبيه (مخزون منخفض)"
            value={`${data.lowThresholdLiters.toLocaleString('ar-IQ')} لتر`}
            isEditing={editThreshold}
            onEdit={() => {
              setEditThreshold(true);
              setThresholdInput(String(data.lowThresholdLiters));
            }}
            onSave={() => {
              const n = parseInt(thresholdInput, 10);
              if (n == null || n < 0) return;
              updateMutation.mutate({ lowThresholdLiters: n });
            }}
            onCancel={() => setEditThreshold(false)}
            inputValue={thresholdInput}
            onInputChange={setThresholdInput}
          />
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  value,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  inputValue,
  onInputChange,
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  inputValue: string;
  onInputChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <div className="text-sm text-slate-600">{label}</div>
      {isEditing ? (
        <div className="flex gap-1">
          <input
            type="number"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 w-24 text-sm"
            autoFocus
          />
          <button
            onClick={onSave}
            className="text-xs text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded"
          >
            حفظ
          </button>
          <button
            onClick={onCancel}
            className="text-xs text-slate-600 hover:bg-slate-100 px-2 py-1 rounded"
          >
            إلغاء
          </button>
        </div>
      ) : (
        <button onClick={onEdit} className="text-sm font-bold text-sky-700 hover:underline">
          {value} ✏️
        </button>
      )}
    </div>
  );
}
