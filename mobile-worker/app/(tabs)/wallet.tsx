import { ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { DEMO_SALARY } from '@/lib/demo-data';
import { iqd, iqdShort } from '@/lib/format';

export default function Wallet() {
  const { currentMode, demoMode } = useAuth();
  const driver = useQuery({
    queryKey: ['driver', 'salary-preview', demoMode],
    queryFn: async () => {
      if (demoMode) return DEMO_SALARY;
      return (await api.get('/drivers/me/salary-preview')).data;
    },
    enabled: currentMode === 'driver',
  });
  const vendor = useQuery({
    queryKey: ['vendor', 'wallet', demoMode],
    queryFn: async () => {
      if (demoMode)
        return { balanceIqd: 178_400, totalDeliveries: 62, rating: 4.8 };
      return (await api.get('/vendors/me/wallet')).data;
    },
    enabled: currentMode === 'vendor',
  });

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="bg-slate-900 px-4 py-4">
        <Text className="text-white font-bold text-lg">محفظتي</Text>
        <Text className="text-slate-400 text-xs">
          {currentMode === 'driver' ? 'الدخل المتوقع هذا الشهر' : 'الرصيد القابل للسحب'}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        {currentMode === 'driver' ? (
          driver.isLoading ? (
            <ActivityIndicator color="#0891b2" />
          ) : (
            <DriverWallet data={driver.data} />
          )
        ) : vendor.isLoading ? (
          <ActivityIndicator color="#0891b2" />
        ) : (
          <VendorWallet data={vendor.data} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DriverWallet({ data }: any) {
  const base = data?.baseSalaryIqd ?? 500_000;
  const commission = data?.commissionIqd ?? 0;
  const bonus = data?.performanceBonusIqd ?? 0;
  const net = base + commission + bonus;
  return (
    <>
      <View className="bg-aqua-600 rounded-2xl p-5 mb-3">
        <Text className="text-aqua-100 text-xs">الدخل المتوقع هذا الشهر</Text>
        <Text className="text-white font-bold text-3xl mt-1">{iqd(net)}</Text>
        <Text className="text-aqua-100 text-xs mt-1">يُدفع نهاية الشهر</Text>
      </View>
      <View className="bg-white rounded-2xl shadow-sm">
        <Row label="الراتب الأساسي" value={iqd(base)} />
        <Row label="عمولة التعبئات" value={iqd(commission)} highlight="text-leaf-600" />
        <Row label="مكافآت أداء" value={iqd(bonus)} highlight="text-warn-600" last />
      </View>
    </>
  );
}

function VendorWallet({ data }: any) {
  const balance = data?.balanceIqd ?? 0;
  const totalDeliveries = data?.totalDeliveries ?? 0;
  return (
    <>
      <View className="bg-warn-500 rounded-2xl p-5 mb-3">
        <Text className="text-amber-100 text-xs">رصيد محفظتي</Text>
        <Text className="text-white font-bold text-3xl mt-1">{iqd(balance)}</Text>
        <Text className="text-amber-100 text-xs mt-1">قابل للسحب الآن</Text>
      </View>
      <View className="flex-row gap-3 mb-3">
        <View className="flex-1 bg-white rounded-2xl shadow-sm p-4">
          <Text className="text-xs text-slate-500">إجمالي التوصيلات</Text>
          <Text className="text-2xl font-bold text-aqua-700 mt-1">{totalDeliveries}</Text>
        </View>
      </View>
    </>
  );
}

function Row({
  label,
  value,
  highlight,
  last,
}: {
  label: string;
  value: string;
  highlight?: string;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row justify-between items-center px-4 py-3 ${
        last ? '' : 'border-b border-slate-100'
      }`}
    >
      <Text className="text-slate-500 text-sm">{label}</Text>
      <Text className={`font-bold text-sm ${highlight ?? 'text-slate-900'}`}>{value}</Text>
    </View>
  );
}
