import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-store';

/**
 * First-launch role picker. A driver works for a plant and gets credentials
 * from the plant — they take the "login" path. A vendor signs up themselves
 * via OTP and then submits vehicle info for plant approval.
 *
 * The "demo" button at the bottom bypasses both flows and seeds the app
 * with mock data — useful before the backend is reachable.
 */
export default function RolePicker() {
  const router = useRouter();
  const loginAsDemo = useAuth((s) => s.loginAsDemo);

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <View className="flex-1 px-6 pt-10 pb-8 justify-between">
        <View>
          <View className="items-center mb-10">
            <Text className="text-6xl mb-2">🏠</Text>
            <Text className="text-white text-3xl font-bold">داري</Text>
            <Text className="text-slate-400 text-sm mt-1">للعاملين</Text>
          </View>

          <Text className="text-white text-xl font-bold text-center mb-1">من أنت؟</Text>
          <Text className="text-slate-400 text-xs text-center mb-6">اختر دورك للمتابعة</Text>

          <Pressable
            onPress={() => router.push('/(auth)/driver-login')}
            className="bg-aqua-600 rounded-2xl p-5 mb-3 flex-row items-center gap-3"
          >
            <View className="w-14 h-14 bg-white/20 rounded-2xl items-center justify-center">
              <Text className="text-3xl">🚛</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-base">سائق معمل</Text>
              <Text className="text-aqua-100 text-xs">
                المعمل أعطاني هاتفاً وكلمة مرور للدخول
              </Text>
            </View>
            <Text className="text-white text-xl">←</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(auth)/vendor-signup')}
            className="bg-warn-500 rounded-2xl p-5 flex-row items-center gap-3"
          >
            <View className="w-14 h-14 bg-white/20 rounded-2xl items-center justify-center">
              <Text className="text-3xl">🛺</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-base">بائع مستقل</Text>
              <Text className="text-amber-100 text-xs">
                أملك ستوتة أو تكتك وأبيع لحسابي
              </Text>
            </View>
            <Text className="text-white text-xl">←</Text>
          </Pressable>

          {/* Demo bypass — hidden in production builds via EAS env var.
              Only visible in dev/preview channels (EXPO_PUBLIC_DEMO_MODE=true). */}
          {process.env.EXPO_PUBLIC_DEMO_MODE === 'true' && (
            <Pressable
              onPress={() => {
                loginAsDemo('driver');
                router.replace('/(tabs)/home');
              }}
              className="mt-4 bg-white/10 rounded-xl py-3 items-center border border-white/30"
            >
              <Text className="text-white font-bold text-sm">
                🎬 تجربة بدون تسجيل (وضع العرض)
              </Text>
              <Text className="text-slate-300 text-[10px] mt-0.5">
                يعرض السائق والبائع مع بيانات وهمية
              </Text>
            </Pressable>
          )}
        </View>

        <Text className="text-slate-500 text-[11px] text-center leading-5">
          باستخدامك التطبيق توافق على الشروط والأحكام وسياسة الخصوصية
        </Text>
      </View>
    </SafeAreaView>
  );
}
