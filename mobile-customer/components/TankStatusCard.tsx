import { View, Text } from 'react-native';
import { daysBetween } from '@/lib/format';

interface Props {
  lastRefillAt: string | null;
  capacity: number;
  qrCode: string;
}

const REMINDER_DAYS = 25;
const WARNING_DAYS = 35;
const RECLAIM_DAYS = 45;

/**
 * Shows a tank icon that visually empties as days pass, plus a coloured
 * progress bar matching the backend's customer-health thresholds.
 */
export function TankStatusCard({ lastRefillAt, capacity, qrCode }: Props) {
  const days = lastRefillAt ? daysBetween(lastRefillAt) : RECLAIM_DAYS;
  const health =
    days < REMINDER_DAYS
      ? {
          label: `خزانك ممتلئ (${REMINDER_DAYS - days} يوم على التذكير)`,
          color: 'text-leaf-600',
          bar: 'bg-aqua-500',
        }
      : days < WARNING_DAYS
        ? {
            label: `حان وقت التعبئة (مر ${days} يوم)`,
            color: 'text-warn-600',
            bar: 'bg-warn-500',
          }
        : {
            label: `تنبيه: قد يُسحَب الخزان! مر ${days} يوم`,
            color: 'text-danger-600',
            bar: 'bg-danger-500',
          };
  const pct = Math.max(8, Math.min(100, 100 - (days / RECLAIM_DAYS) * 100));
  const fillPct = Math.max(10, 100 - (days / 30) * 100);

  return (
    <View className="bg-white rounded-2xl shadow-sm p-4">
      <View className="flex-row items-center gap-3 mb-3">
        <View className="w-14 h-16 bg-aqua-700 rounded-xl overflow-hidden justify-end">
          <View className="bg-aqua-400" style={{ height: `${fillPct}%` }} />
        </View>
        <View className="flex-1">
          <Text className="text-xs text-slate-500">آخر تعبئة</Text>
          <Text className="font-bold text-slate-900 text-base">منذ {days} يوم</Text>
          <Text className={`text-[11px] font-bold mt-0.5 ${health.color}`}>{health.label}</Text>
        </View>
      </View>
      <View className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <View className={`h-full ${health.bar}`} style={{ width: `${pct}%` }} />
      </View>
      <View className="flex-row justify-between mt-1.5">
        <Text className="text-[11px] text-slate-500">اليوم</Text>
        <Text className="text-[11px] text-slate-500">{RECLAIM_DAYS} يوم (سحب الخزان)</Text>
      </View>
      <Text className="text-[10px] text-slate-400 mt-2 text-right">
        {capacity} لتر • {qrCode}
      </Text>
    </View>
  );
}
