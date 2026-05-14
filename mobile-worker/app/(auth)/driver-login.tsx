import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-store';

export default function DriverLogin() {
  const router = useRouter();
  const { loginWithPassword, loading } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [hidden, setHidden] = useState(true);

  async function onSubmit() {
    try {
      await loginWithPassword(phone, password);
      router.replace('/(tabs)/home');
    } catch (err: any) {
      Alert.alert('فشل تسجيل الدخول', err?.response?.data?.message ?? 'تحقق من بياناتك');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-10 pb-8">
          <Pressable onPress={() => router.back()} className="self-start mb-6">
            <Text className="text-slate-300">→ رجوع</Text>
          </Pressable>

          <View className="items-center mb-8">
            <Text className="text-5xl mb-2">🚛</Text>
            <Text className="text-white text-2xl font-bold">سائق معمل</Text>
            <Text className="text-slate-400 text-xs mt-1">تسجيل دخول بالبيانات من المعمل</Text>
          </View>

          <View className="bg-white rounded-3xl p-6">
            <Text className="text-slate-700 text-sm mb-2 text-right">رقم الهاتف</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="07XXXXXXXXX"
              keyboardType="phone-pad"
              maxLength={11}
              className="border border-slate-200 rounded-xl px-4 py-3 text-base bg-slate-50 text-right mb-4"
            />
            <Text className="text-slate-700 text-sm mb-2 text-right">كلمة المرور</Text>
            <View className="flex-row items-center border border-slate-200 rounded-xl bg-slate-50 px-4">
              <Pressable onPress={() => setHidden((h) => !h)}>
                <Text className="text-slate-400 text-xs">{hidden ? 'عرض' : 'إخفاء'}</Text>
              </Pressable>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={hidden}
                className="flex-1 py-3 text-base text-right"
              />
            </View>

            <Pressable
              onPress={onSubmit}
              disabled={loading || !phone || password.length < 6}
              className={`mt-5 rounded-xl py-4 items-center ${
                loading || !phone || password.length < 6 ? 'bg-slate-300' : 'bg-aqua-600'
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">دخول</Text>
              )}
            </Pressable>
          </View>

          <View className="bg-slate-800 rounded-xl p-3 mt-5">
            <Text className="text-slate-300 text-[11px] leading-5 text-right">
              💡 لم تستلم بيانات الدخول؟ تواصل مع صاحب معملك ليفتح لك حساباً من اللوحة.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
