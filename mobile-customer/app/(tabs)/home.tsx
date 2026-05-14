import { ScrollView, View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMyProfile, useCreateRefillOrder } from '@/lib/queries';
import { iqd } from '@/lib/format';
import { TankStatusCard } from '@/components/TankStatusCard';
import { PartnerAds } from '@/components/PartnerAds';

export default function Home() {
  const { data: profile, isLoading } = useMyProfile();
  const createOrder = useCreateRefillOrder();

  async function requestRefill() {
    if (!profile) return;
    try {
      await createOrder.mutateAsync(profile.id);
      Alert.alert('تم إرسال طلبك للمعمل ✓', 'سيصل السائق خلال ساعة');
    } catch (err: any) {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'حاول مرة أخرى');
    }
  }

  if (isLoading || !profile) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator color="#0891b2" size="large" />
      </SafeAreaView>
    );
  }

  const tank = profile.tanks[0];

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Hero */}
        <View className="bg-aqua-600 pt-2 pb-8 px-5">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-aqua-100 text-xs">مرحباً</Text>
              <Text className="text-white font-bold text-lg">{profile.fullName}</Text>
            </View>
            <Pressable className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
              <Text className="text-white text-base">🔔</Text>
            </Pressable>
          </View>
          {tank && (
            <View className="bg-white/15 rounded-2xl p-4 mt-3">
              <Text className="text-aqua-100 text-xs">معمل النقاء — {profile.district}</Text>
              <Text className="text-white font-bold text-base">
                خزان {tank.capacity === 'L500' ? '٥٠٠' : '٣٥٠'} لتر
              </Text>
            </View>
          )}
        </View>

        <View className="px-4 -mt-4">
          {/* Tank status */}
          {tank && (
            <TankStatusCard
              lastRefillAt={tank.lastRefillAt}
              capacity={tank.capacity === 'L500' ? 500 : 350}
              qrCode={tank.qrCode}
            />
          )}

          {/* Big order button */}
          <Pressable
            onPress={requestRefill}
            disabled={createOrder.isPending}
            className={`w-full rounded-2xl py-5 mt-3 items-center ${
              createOrder.isPending ? 'bg-aqua-400' : 'bg-aqua-600'
            }`}
            style={{
              shadowColor: '#0891b2',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            {createOrder.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text className="text-3xl mb-1">💧</Text>
                <Text className="text-white font-bold text-lg">اطلب تعبئة الآن</Text>
                <Text className="text-aqua-100 text-xs mt-0.5">
                  {iqd(1000)} • السائق سيصل خلال ساعة
                </Text>
              </>
            )}
          </Pressable>

          {/* Quick stats */}
          <View className="flex-row gap-3 mt-3">
            <View className="flex-1 bg-white rounded-2xl shadow-sm p-4">
              <Text className="text-xs text-slate-500">إجمالي تعبئاتي</Text>
              <Text className="text-2xl font-bold text-aqua-700 mt-1">{profile.totalRefills}</Text>
              <Text className="text-[10px] text-slate-400 mt-0.5">منذ بداية الاشتراك</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl shadow-sm p-4">
              <Text className="text-xs text-slate-500">حسابي مع المعمل</Text>
              <Text
                className={`text-2xl font-bold mt-1 ${
                  profile.balanceIqd >= 0 ? 'text-leaf-600' : 'text-danger-600'
                }`}
              >
                {profile.balanceIqd >= 0 ? 'مدفوع' : iqd(-profile.balanceIqd)}
              </Text>
              <Text className="text-[10px] text-slate-400 mt-0.5">
                {profile.balanceIqd >= 0 ? 'لا توجد متأخرات' : 'متأخر عليك'}
              </Text>
            </View>
          </View>

          <PartnerAds onClick={(id) => Alert.alert(`فتح إعلان ${id}`)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
