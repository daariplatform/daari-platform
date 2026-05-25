/**
 * Settings screen — تغيير كلمة المرور، اللغة، حذف الحساب، خروج، about.
 * متاحة من Profile.
 * حذف الحساب: متطلب Apple/Google لتجنّب رفض النشر.
 */

import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

export default function Settings() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showChangePwd, setShowChangePwd] = useState(false);

  return (
    <View className="flex-1 bg-slate-50">
      <SafeAreaView edges={['top']}>
        <View className="px-5 pt-4 pb-3 flex-row-reverse items-center justify-between">
          <Text className="text-2xl font-bold">الإعدادات</Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'white',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#0f172a',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 4,
            }}
          >
            <Ionicons name="arrow-forward" size={20} color="#0f172a" />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* الحساب */}
        <Section title="الحساب">
          <Row
            icon="person"
            label="الاسم"
            value={user?.fullName ?? '—'}
            chevron={false}
            tint="#0891b2"
          />
          <Row
            icon="call"
            label="رقم الهاتف"
            value={user?.phone ?? '—'}
            chevron={false}
            tint="#0891b2"
          />
          <Row
            icon="key"
            label="تغيير كلمة المرور"
            onPress={() => setShowChangePwd(true)}
            tint="#f59e0b"
          />
        </Section>

        {/* التفضيلات */}
        <Section title="التفضيلات">
          <Row
            icon="language"
            label="اللغة"
            value="العربية"
            chevron={true}
            onPress={() => Alert.alert('قريباً', 'دعم اللغة الإنجليزية قادم في تحديث قريب')}
            tint="#06b6d4"
          />
          <Row
            icon="notifications"
            label="الإشعارات"
            value="مُفعّلة"
            chevron={true}
            onPress={() => Linking.openSettings()}
            tint="#06b6d4"
          />
        </Section>

        {/* الدعم */}
        <Section title="الدعم والمساعدة">
          <Row
            icon="logo-whatsapp"
            label="واتساب الدعم"
            onPress={() => Linking.openURL('https://wa.me/9647700000000')}
            tint="#25D366"
          />
          <Row
            icon="help-circle"
            label="الأسئلة الشائعة"
            onPress={() => Linking.openURL('https://phi-bit.com/daari/faq')}
            tint="#06b6d4"
          />
          <Row
            icon="document-text"
            label="الشروط والأحكام"
            onPress={() => Linking.openURL('https://daari-admin.phi-bit.com/legal/terms')}
            tint="#94a3b8"
          />
          <Row
            icon="shield-checkmark"
            label="سياسة الخصوصية"
            onPress={() => Linking.openURL('https://daari-admin.phi-bit.com/legal/privacy')}
            tint="#94a3b8"
          />
        </Section>

        {/* الخروج / حذف الحساب */}
        <Section title="">
          <Row
            icon="log-out"
            label="تسجيل الخروج"
            onPress={() => {
              Alert.alert('تسجيل الخروج', 'متأكد؟', [
                { text: 'لا', style: 'cancel' },
                {
                  text: 'خروج',
                  style: 'destructive',
                  onPress: () => {
                    logout();
                    router.replace('/(auth)/login');
                  },
                },
              ]);
            }}
            tint="#64748b"
          />
          <Row
            icon="trash"
            label="حذف الحساب"
            onPress={() => {
              Alert.alert(
                'حذف الحساب',
                'سيتم حذف بياناتك نهائياً ولا يمكن استرجاعها. متأكد؟',
                [
                  { text: 'لا', style: 'cancel' },
                  {
                    text: 'حذف',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await api.delete('/customers/me');
                        Alert.alert('تم الحذف', 'تم حذف حسابك بنجاح');
                        logout();
                        router.replace('/(auth)/login');
                      } catch (err: any) {
                        Alert.alert('خطأ', err?.response?.data?.message ?? 'فشل الحذف');
                      }
                    },
                  },
                ],
              );
            }}
            tint="#dc2626"
          />
        </Section>

        <Text className="text-center text-xs text-slate-400 mt-6 mb-2">
          الإصدار 1.0.0 • Phi-Bit
        </Text>
      </ScrollView>

      {showChangePwd && (
        <ChangePasswordModal onClose={() => setShowChangePwd(false)} />
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-4">
      {title.length > 0 && (
        <Text className="text-xs font-bold text-slate-500 px-5 mb-2">{title}</Text>
      )}
      <View
        style={{
          backgroundColor: 'white',
          marginHorizontal: 16,
          borderRadius: 18,
          overflow: 'hidden',
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  chevron = true,
  tint = '#0891b2',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  tint?: string;
}) {
  const Content = (
    <View className="flex-row-reverse items-center px-4 py-3.5 border-b border-slate-50">
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: `${tint}15`,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 12,
        }}
      >
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text className="text-base font-medium text-slate-800 flex-1 text-right">{label}</Text>
      {value && <Text className="text-sm text-slate-500 ml-2">{value}</Text>}
      {chevron && onPress && (
        <Ionicons name="chevron-back" size={18} color="#cbd5e1" />
      )}
    </View>
  );
  if (!onPress) return Content;
  return (
    <Pressable onPress={onPress} android_ripple={{ color: '#f1f5f9' }}>
      {Content}
    </Pressable>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const mutation = useMutation({
    mutationFn: async () =>
      (await api.post('/auth/change-password', { currentPassword: current, newPassword: next })).data,
    onSuccess: () => {
      Alert.alert('تم', 'تم تغيير كلمة المرور بنجاح');
      onClose();
    },
    onError: (err: any) => {
      Alert.alert('خطأ', err?.response?.data?.message ?? 'فشل التغيير');
    },
  });

  const canSubmit = current.length >= 6 && next.length >= 6 && next === confirm;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0, bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <MotiView
        from={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring' }}
        style={{ backgroundColor: 'white', borderRadius: 24, padding: 22 }}
      >
        <Text className="text-lg font-bold mb-1 text-right">تغيير كلمة المرور</Text>
        <Text className="text-xs text-slate-500 mb-4 text-right">
          أدخل كلمة المرور الحالية والجديدة (٦ أحرف على الأقل)
        </Text>

        <TextInput
          value={current}
          onChangeText={setCurrent}
          placeholder="كلمة المرور الحالية"
          placeholderTextColor="#cbd5e1"
          secureTextEntry
          style={{
            borderWidth: 1.5,
            borderColor: '#e2e8f0',
            backgroundColor: '#f8fafc',
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            textAlign: 'right',
            marginBottom: 10,
          }}
        />
        <TextInput
          value={next}
          onChangeText={setNext}
          placeholder="كلمة المرور الجديدة"
          placeholderTextColor="#cbd5e1"
          secureTextEntry
          style={{
            borderWidth: 1.5,
            borderColor: '#e2e8f0',
            backgroundColor: '#f8fafc',
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            textAlign: 'right',
            marginBottom: 10,
          }}
        />
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          placeholder="تأكيد كلمة المرور الجديدة"
          placeholderTextColor="#cbd5e1"
          secureTextEntry
          style={{
            borderWidth: 1.5,
            borderColor: confirm.length > 0 && confirm !== next ? '#ef4444' : '#e2e8f0',
            backgroundColor: '#f8fafc',
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            textAlign: 'right',
            marginBottom: 6,
          }}
        />
        {confirm.length > 0 && confirm !== next && (
          <Text className="text-[11px] text-red-600 text-right mb-2">
            كلمتا المرور غير متطابقتين
          </Text>
        )}

        <View className="flex-row gap-2 mt-4">
          <Pressable
            onPress={onClose}
            disabled={mutation.isPending}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: '#e2e8f0',
              alignItems: 'center',
            }}
          >
            <Text className="font-medium text-slate-700">إلغاء</Text>
          </Pressable>
          <Pressable
            onPress={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: canSubmit ? '#0891b2' : '#cbd5e1',
              alignItems: 'center',
            }}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-bold text-white">تغيير</Text>
            )}
          </Pressable>
        </View>
      </MotiView>
    </View>
  );
}
