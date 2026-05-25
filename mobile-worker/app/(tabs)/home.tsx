import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-store';
import { useMyTodayTasks, type DriverTask } from '@/lib/queries';
import { pendingCount } from '@/lib/offline-queue';
import { WorkerHeader } from '@/components/WorkerHeader';
import { SkeletonCard } from '@/components/Skeleton';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const kindIcon: Record<DriverTask['kind'], IconName> = {
  REFILL: 'water-drop',
  TANK_DELIVERY: 'inventory-2',
  TANK_RECLAIM: 'undo',
};
const kindLabel: Record<DriverTask['kind'], string> = {
  REFILL: 'تعبئة',
  TANK_DELIVERY: 'توصيل خزان',
  TANK_RECLAIM: 'سحب خزان',
};
const kindColor: Record<DriverTask['kind'], { bg: string; fg: string }> = {
  REFILL: { bg: '#e0f2fe', fg: '#0284c7' },
  TANK_DELIVERY: { bg: '#dbeafe', fg: '#1d4ed8' },
  TANK_RECLAIM: { bg: '#fef2f2', fg: '#dc2626' },
};

export default function Home() {
  const { data: tasks, isLoading } = useMyTodayTasks();
  const [queued, setQueued] = useState(0);
  const [online] = useState(true); // wire to NetInfo in production

  useEffect(() => {
    pendingCount().then(setQueued);
    const t = setInterval(() => pendingCount().then(setQueued), 5_000);
    return () => clearInterval(t);
  }, []);

  return (
    <View className="flex-1 bg-slate-50">
      {/* Header يدير الـ top safe-area داخلياً (مع gradient extending إلى status bar) */}
      <WorkerHeader online={online} queuedCount={queued} />

      {isLoading ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 14 }}>
          <SkeletonCard height={68} />
          <SkeletonCard height={150} />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <DriverHome tasks={tasks ?? []} />
      )}
    </View>
  );
}

function DriverHome({ tasks }: { tasks: DriverTask[] }) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'COMPLETED').length;
  const active = tasks.find((t) => t.status === 'EN_ROUTE');
  const others = tasks.filter((t) => t.status !== 'EN_ROUTE' && t.status !== 'COMPLETED');

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        paddingBottom: 24,
        paddingTop: 14,
        // الـ padding يجب يكون هنا (مش className) عشان يطبّق على المحتوى
        // المتمرّر. className="px-4" على الـ ScrollView العام يخلّي فراغ
        // غير متناسق في RTL لأن النسخة الـ ScrollView ما تدير padding
        // افتراضي على المحتوى.
        paddingHorizontal: 12,
      }}
    >
      {/* Progress card — يظهر فقط عند وجود مهام (يخفّف الفراغ في الأيام الفارغة) */}
      {total > 0 && (
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 14,
            marginBottom: 12,
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <View className="flex-row-reverse items-center justify-between mb-2">
            <Text className="font-bold text-slate-900 text-sm">جولة اليوم</Text>
            <Text className="text-xs text-slate-500 font-bold">
              {done} / {total} مهمة
            </Text>
          </View>
          <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <View
              className="h-full bg-aqua-600"
              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
            />
          </View>
        </View>
      )}

      {/* Active task — featured prominent card with sky gradient */}
      {active && (
        <Link href={`/task/${active.id}`} asChild>
          <Pressable
            style={{
              backgroundColor: '#0284c7',
              borderRadius: 22,
              padding: 16,
              marginBottom: 12,
              shadowColor: '#0369a1',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 14,
              elevation: 6,
            }}
          >
            <View className="flex-row-reverse items-center justify-between mb-2">
              <View className="flex-row-reverse items-center gap-1.5 bg-white/20 px-2.5 py-1 rounded-full">
                <MaterialIcons name="schedule" size={12} color="#fff" />
                <Text className="text-white text-[11px] font-bold">قيد التنفيذ</Text>
              </View>
              <Text className="text-sky-100 text-[11px]">
                {active.scheduledFor ?? 'الآن'}
              </Text>
            </View>
            <View className="flex-row-reverse items-center gap-2 mt-1">
              <MaterialIcons name={kindIcon[active.kind]} size={28} color="#fff" />
              <Text className="text-white text-xl font-bold">{kindLabel[active.kind]}</Text>
            </View>
            <Text className="text-white font-bold text-lg mt-1 text-right">
              {active.customer.fullName}
            </Text>
            <Text className="text-sky-100 text-xs text-right">
              {active.customer.district} · {active.customer.addressLine}
            </Text>
            <View className="bg-white rounded-xl py-3 mt-3 flex-row-reverse items-center justify-center gap-2">
              <Text className="text-aqua-700 font-bold">افتح المهمة</Text>
              <MaterialIcons name="chevron-left" size={20} color="#0284c7" />
            </View>
          </Pressable>
        </Link>
      )}

      {/* Section title: يظهر فقط لما في مهام للعرض */}
      {(others.length > 0 || active) && (
        <View className="flex-row-reverse items-center gap-1.5 mb-2 px-1">
          <MaterialIcons name="list" size={18} color="#0284c7" />
          <Text className="text-sm font-bold text-slate-700">المهام القادمة</Text>
        </View>
      )}
      {others.length === 0 && !active && (
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            paddingVertical: 28,
            paddingHorizontal: 16,
            alignItems: 'center',
            marginBottom: 12,
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              backgroundColor: '#ecfdf5',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <MaterialIcons name="check-circle" size={36} color="#10b981" />
          </View>
          <Text className="text-slate-900 text-base font-bold">جولة اليوم خلصت</Text>
          <Text className="text-slate-500 text-xs mt-1">ما عندك مهام أخرى الآن</Text>
        </View>
      )}
      {others.map((t) => {
        const c = kindColor[t.kind];
        return (
          <Link key={t.id} href={`/task/${t.id}`} asChild>
            <Pressable
              style={{
                backgroundColor: '#fff',
                borderRadius: 18,
                padding: 14,
                marginBottom: 10,
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 1,
              }}
            >
              <View className="flex-row-reverse items-center gap-3">
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: c.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons name={kindIcon[t.kind]} size={24} color={c.fg} />
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text className="font-bold text-sm text-slate-900">{t.customer.fullName}</Text>
                  <Text className="text-[11px] text-slate-500">
                    {t.customer.district} · {kindLabel[t.kind]}
                  </Text>
                </View>
                <MaterialIcons name="chevron-left" size={22} color="#cbd5e1" />
              </View>
            </Pressable>
          </Link>
        );
      })}

      {/* Walk-in / register customer — solid card matching others' styling */}
      <Link href="/walkin" asChild>
        <Pressable
          style={{
            marginTop: 4,
            backgroundColor: '#fff',
            borderWidth: 1.5,
            borderColor: '#bae6fd',
            borderRadius: 16,
            paddingVertical: 14,
            paddingHorizontal: 14,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 10,
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: '#e0f2fe',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialIcons name="add" size={24} color="#0284c7" />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text className="text-aqua-700 font-bold text-sm">بيع فوري أو زبون جديد</Text>
            <Text className="text-slate-500 text-[11px] mt-0.5">
              للزبون الذي لم يطلب من التطبيق
            </Text>
          </View>
          <MaterialIcons name="chevron-left" size={22} color="#0284c7" />
        </Pressable>
      </Link>
    </ScrollView>
  );
}

