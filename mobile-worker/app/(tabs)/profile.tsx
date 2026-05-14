import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-store';
import { stopShiftTracking } from '@/lib/location';

export default function Profile() {
  const router = useRouter();
  const { user, capabilities, logout } = useAuth();
  const hasBoth = capabilities.includes('driver') && capabilities.includes('vendor');

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="bg-slate-900 rounded-2xl p-5 items-center">
          <View className="w-20 h-20 rounded-full bg-aqua-600 items-center justify-center mb-2">
            <Text className="text-4xl">👤</Text>
          </View>
          <Text className="text-white font-bold text-lg">{user?.phone}</Text>
          <View className="flex-row gap-2 mt-3">
            {capabilities.map((c) => (
              <View key={c} className="bg-white/10 px-2 py-1 rounded-full">
                <Text className="text-white text-[10px] font-bold">{c}</Text>
              </View>
            ))}
          </View>
        </View>

        {!hasBoth && capabilities.includes('driver') && (
          <Pressable
            onPress={() => router.push('/(auth)/vendor-signup')}
            className="bg-warn-500 rounded-2xl py-4 mt-3"
          >
            <Text className="text-white font-bold text-center">+ سجّل كبائع مستقل أيضاً</Text>
          </Pressable>
        )}

        <Pressable className="bg-white rounded-2xl py-4 shadow-sm mt-3 flex-row items-center justify-center gap-2">
          <Text className="font-bold">⚙️ الإعدادات</Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            await stopShiftTracking();
            await logout();
            router.replace('/(auth)/role');
          }}
          className="bg-white rounded-2xl py-4 shadow-sm mt-3"
        >
          <Text className="text-danger-600 font-bold text-center">↩️ تسجيل خروج</Text>
        </Pressable>

        <Pressable
          onPress={() =>
            Alert.alert(
              'سياسة الخصوصية',
              'موقعك يُسجَّل فقط أثناء وردية العمل لتأكيد التعبئات. لا نشاركه مع أي طرف خارجي.',
            )
          }
          className="mt-6"
        >
          <Text className="text-slate-400 text-xs text-center underline">
            سياسة الخصوصية والشروط
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
