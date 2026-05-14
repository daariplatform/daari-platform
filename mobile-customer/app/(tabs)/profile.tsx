import { ScrollView, View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-store';
import { useMyProfile } from '@/lib/queries';
import { iqd } from '@/lib/format';

export default function Profile() {
  const router = useRouter();
  const { logout } = useAuth();
  const { data: profile, isLoading } = useMyProfile();

  if (isLoading || !profile) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator color="#0891b2" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="bg-aqua-600 rounded-2xl p-5 items-center">
          <View className="w-20 h-20 rounded-full bg-white/20 items-center justify-center mb-2">
            <Text className="text-4xl">👤</Text>
          </View>
          <Text className="text-white font-bold text-lg">{profile.fullName}</Text>
          <Text className="text-aqua-100 text-xs mt-0.5">{profile.phone}</Text>
        </View>

        <View className="bg-white rounded-2xl shadow-sm mt-3">
          <Row label="العنوان" value={profile.addressLine} />
          <Row label="المنطقة" value={profile.district} />
          <Row
            label="إجمالي التعبئات"
            value={String(profile.totalRefills)}
            highlight="text-aqua-700"
          />
          <Row
            label="الرصيد"
            value={profile.balanceIqd === 0 ? 'مدفوع' : iqd(profile.balanceIqd)}
            highlight={profile.balanceIqd >= 0 ? 'text-leaf-600' : 'text-danger-600'}
            last
          />
        </View>

        {profile.acceptedTermsAt && (
          <View className="bg-leaf-50 border border-leaf-200 rounded-2xl p-4 mt-3 flex-row gap-2">
            <Text className="text-leaf-600 text-lg">📝</Text>
            <View className="flex-1">
              <Text className="font-bold text-sm text-leaf-800 text-right">عقدك موقّع</Text>
              <Text className="text-[11px] text-leaf-700 text-right">
                وقّعتَ شروط الخدمة في {new Date(profile.acceptedTermsAt).toLocaleDateString('ar-IQ')}
              </Text>
            </View>
          </View>
        )}

        <Pressable
          onPress={() =>
            Alert.alert('انتقلت لبيت جديد؟', 'فعّل GPS عند البيت الجديد وسنحدّث عنوانك تلقائياً')
          }
          className="bg-white rounded-2xl py-4 shadow-sm mt-3 flex-row items-center justify-center gap-2"
        >
          <Text className="text-warn-600 font-bold">📦 انتقلت لبيت جديد</Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            await logout();
            router.replace('/(auth)/login');
          }}
          className="bg-white rounded-2xl py-4 shadow-sm mt-3"
        >
          <Text className="text-danger-600 font-bold text-center">↩️ تسجيل خروج</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
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
