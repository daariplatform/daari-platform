import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import NetInfo from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/auth-store';
import { useMyTodayTasks, type DriverTask } from '@/lib/queries';
import { pendingCount } from '@/lib/offline-queue';
import { WorkerHeader } from '@/components/WorkerHeader';

const kindEmoji: Record<DriverTask['kind'], string> = {
  REFILL: '💧',
  TANK_DELIVERY: '📦',
  TANK_RECLAIM: '↩️',
};
const kindLabel: Record<DriverTask['kind'], string> = {
  REFILL: 'تعبئة',
  TANK_DELIVERY: 'توصيل خزان',
  TANK_RECLAIM: 'سحب خزان',
};

export default function Home() {
  const { currentMode } = useAuth();
  const { data: tasks, isLoading } = useMyTodayTasks();
  const [queued, setQueued] = useState(0);
  const [online] = useState(true); // wire to NetInfo in production

  useEffect(() => {
    pendingCount().then(setQueued);
    const t = setInterval(() => pendingCount().then(setQueued), 5_000);
    return () => clearInterval(t);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <WorkerHeader online={online} queuedCount={queued} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0891b2" />
        </View>
      ) : currentMode === 'driver' ? (
        <DriverHome tasks={tasks ?? []} />
      ) : (
        <VendorHome />
      )}
    </SafeAreaView>
  );
}

function DriverHome({ tasks }: { tasks: DriverTask[] }) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'COMPLETED').length;
  const active = tasks.find((t) => t.status === 'EN_ROUTE');
  const others = tasks.filter((t) => t.status !== 'EN_ROUTE' && t.status !== 'COMPLETED');

  return (
    <ScrollView className="flex-1 px-4 -mt-2" contentContainerStyle={{ paddingBottom: 24 }}>
      {/* Progress card */}
      <View className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="font-bold">جولة اليوم</Text>
          <Text className="text-xs text-slate-500">
            {done} / {total} مهمة
          </Text>
        </View>
        <View className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <View
            className="h-full bg-aqua-500"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </View>
      </View>

      {/* Active task */}
      {active && (
        <Link href={`/task/${active.id}`} asChild>
          <Pressable className="bg-aqua-600 rounded-2xl p-4 mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-white/80 text-[11px] font-bold bg-white/20 px-2 py-1 rounded-full">
                قيد التنفيذ
              </Text>
              <Text className="text-white/80 text-[11px]">⏰ {active.scheduledFor ?? 'الآن'}</Text>
            </View>
            <Text className="text-white text-2xl">
              {kindEmoji[active.kind]} {kindLabel[active.kind]}
            </Text>
            <Text className="text-white font-bold text-lg mt-1">
              {active.customer.fullName}
            </Text>
            <Text className="text-aqua-100 text-xs">
              {active.customer.district} • {active.customer.addressLine}
            </Text>
            <View className="bg-white rounded-xl py-3 mt-3">
              <Text className="text-aqua-700 font-bold text-center">
                افتح المهمة ←
              </Text>
            </View>
          </Pressable>
        </Link>
      )}

      <Text className="text-xs font-bold text-slate-600 mb-2 px-1">المهام القادمة</Text>
      {others.map((t) => (
        <Link key={t.id} href={`/task/${t.id}`} asChild>
          <Pressable className="bg-white rounded-2xl shadow-sm p-3.5 mb-2.5">
            <View className="flex-row items-center gap-3">
              <View
                className={`w-11 h-11 rounded-xl ${
                  t.kind === 'TANK_RECLAIM' ? 'bg-danger-50' : 'bg-aqua-50'
                } items-center justify-center`}
              >
                <Text className="text-xl">{kindEmoji[t.kind]}</Text>
              </View>
              <View className="flex-1">
                <Text className="font-bold text-sm">{t.customer.fullName}</Text>
                <Text className="text-[11px] text-slate-500">
                  {t.customer.district} • {kindLabel[t.kind]}
                </Text>
              </View>
              <Text className="text-slate-300">←</Text>
            </View>
          </Pressable>
        </Link>
      ))}

      {/* Walk-in button */}
      <Link href="/walkin" asChild>
        <Pressable className="bg-white border-2 border-dashed border-aqua-300 rounded-2xl py-4 mt-4">
          <Text className="text-aqua-700 font-bold text-center">
            + بيع فوري أو تسجيل زبون جديد
          </Text>
          <Text className="text-slate-500 text-[10px] text-center mt-0.5">
            للزبون الذي لم يطلب من التطبيق
          </Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

function VendorHome() {
  return (
    <ScrollView className="flex-1 px-4 -mt-2" contentContainerStyle={{ paddingBottom: 24 }}>
      <View className="bg-white rounded-2xl shadow-sm p-4 mb-3 items-center">
        <Text className="text-4xl mb-2">🛺</Text>
        <Text className="font-bold text-slate-900">وضع البائع</Text>
        <Text className="text-xs text-slate-500 text-center mt-1">
          ستظهر الطلبات القريبة منك هنا عند توفّرها
        </Text>
      </View>
      <View className="bg-white rounded-2xl shadow-sm p-4">
        <Text className="text-xs text-slate-500 text-center">
          لا توجد طلبات حالياً. أبقِ التطبيق مفتوحاً لاستقبال إشعارات الطلبات.
        </Text>
      </View>
    </ScrollView>
  );
}
