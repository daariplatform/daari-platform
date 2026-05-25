import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-store';
import { stopShiftTracking } from '@/lib/location';

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <View className="flex-1 bg-slate-50">
      {/* Sky gradient header */}
      <LinearGradient
        colors={['#38bdf8', '#0ea5e9', '#0284c7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          paddingBottom: 24,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <SafeAreaView edges={['top']}>
          <View className="px-4 pt-2 items-center">
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                backgroundColor: 'rgba(255,255,255,0.22)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.35)',
              }}
            >
              <MaterialIcons name="local-shipping" size={48} color="#fff" />
            </View>
            <Text className="text-white font-bold text-lg mt-3">
              {user?.phone || 'مستخدم'}
            </Text>
            <View className="bg-white/22 px-3 py-1 rounded-full mt-2">
              <Text className="text-white text-[11px] font-bold">سائق معمل</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: 32,
          paddingTop: 14,
          paddingHorizontal: 12,
        }}
      >
        <ActionRow
          icon="settings"
          iconBg="#e0f2fe"
          iconFg="#0284c7"
          label="الإعدادات"
          color="#0f172a"
          onPress={() => Alert.alert('قريباً', 'صفحة الإعدادات قيد التطوير')}
        />

        <ActionRow
          icon="logout"
          iconBg="#fef2f2"
          iconFg="#dc2626"
          label="تسجيل خروج"
          color="#dc2626"
          onPress={async () => {
            await stopShiftTracking();
            await logout();
            router.replace('/(auth)/driver-login');
          }}
        />

        <Pressable
          onPress={() =>
            Alert.alert(
              'سياسة الخصوصية',
              'موقعك يُسجَّل فقط أثناء وردية العمل لتأكيد التعبئات. لا نشاركه مع أي طرف خارجي.',
            )
          }
          className="mt-6"
        >
          <Text className="text-slate-400 text-[11px] text-center underline">
            سياسة الخصوصية والشروط
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/**
 * Single profile row — consistent styling matching customer app's profile.
 */
function ActionRow({
  icon,
  iconBg,
  iconFg,
  label,
  color,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  iconBg: string;
  iconFg: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 14,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 10,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
        marginBottom: 12,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name={icon} size={20} color={iconFg} />
      </View>
      <Text style={{ flex: 1, color, fontWeight: '700', fontSize: 13, textAlign: 'right' }}>
        {label}
      </Text>
      <MaterialIcons name="chevron-left" size={22} color="#94a3b8" />
    </Pressable>
  );
}
