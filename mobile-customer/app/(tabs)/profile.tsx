import { ScrollView, View, Text, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-store';
import { useMyProfile } from '@/lib/queries';
import { api } from '@/lib/api';
import { iqd } from '@/lib/format';
import { Skeleton } from '@/components/Skeleton';

export default function Profile() {
  const router = useRouter();
  const { logout } = useAuth();
  const { data: profile, isLoading } = useMyProfile();

  if (isLoading || !profile) {
    // Skeleton placeholders تحاكي شكل بطاقة الـ profile (avatar + اسم + 4 صفوف).
    return (
      <View className="flex-1 bg-slate-50">
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
                }}
              />
              <View style={{ height: 14 }} />
              <View
                style={{
                  width: 140,
                  height: 18,
                  borderRadius: 6,
                  backgroundColor: 'rgba(255,255,255,0.30)',
                }}
              />
              <View style={{ height: 6 }} />
              <View
                style={{
                  width: 100,
                  height: 11,
                  borderRadius: 4,
                  backgroundColor: 'rgba(255,255,255,0.25)',
                }}
              />
            </View>
          </SafeAreaView>
        </LinearGradient>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
          <Skeleton height={52} borderRadius={14} />
          <Skeleton height={52} borderRadius={14} />
          <Skeleton height={52} borderRadius={14} />
          <Skeleton height={52} borderRadius={14} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      {/* Sky gradient header — يطابق الـ home */}
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
            {/* Avatar */}
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
              <MaterialIcons name="person" size={48} color="#fff" />
            </View>
            <Text className="text-white font-bold text-lg mt-3">{profile.fullName}</Text>
            <Text className="text-sky-100 text-xs mt-0.5">{profile.phone}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 14 }}
      >
        {/* Profile details card */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 18,
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 1,
            overflow: 'hidden',
          }}
        >
          <Row icon="place" label="العنوان" value={profile.addressLine} />
          <Row icon="map" label="المنطقة" value={profile.district} />
          <Row
            icon="local-drink"
            label="إجمالي التعبئات"
            value={profile.totalRefills.toLocaleString('ar-IQ')}
            highlight="#0284c7"
          />
          <Row
            icon={profile.balanceIqd === 0 ? 'verified' : 'account-balance-wallet'}
            label="الرصيد"
            value={profile.balanceIqd === 0 ? 'مدفوع' : iqd(profile.balanceIqd)}
            highlight={profile.balanceIqd >= 0 ? '#10b981' : '#dc2626'}
            last
          />
        </View>

        {/* Feature shortcuts — wallet, addresses, auto-refill, support */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 18,
            marginTop: 12,
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 1,
            overflow: 'hidden',
          }}
        >
          <NavRow
            icon="account-balance-wallet"
            tint="#0891b2"
            label="محفظتي ونقاطي"
            onPress={() => router.push('/wallet')}
          />
          <NavRow
            icon="place"
            tint="#7c3aed"
            label="عناويني المحفوظة"
            onPress={() => router.push('/addresses')}
          />
          <NavRow
            icon="repeat"
            tint="#059669"
            label="التعبئة التلقائية"
            onPress={() => router.push('/schedules')}
          />
          <NavRow
            icon="help-outline"
            tint="#d97706"
            label="المساعدة والدعم"
            onPress={() => router.push('/support')}
            last
          />
        </View>

        {/* Contract signed indicator */}
        {profile.acceptedTermsAt && (
          <View
            style={{
              backgroundColor: '#f0fdf4',
              borderColor: '#bbf7d0',
              borderWidth: 1,
              borderRadius: 14,
              padding: 12,
              marginTop: 12,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <MaterialIcons name="task-alt" size={22} color="#059669" />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={{ color: '#065f46', fontWeight: '700', fontSize: 12 }}>عقدك موقّع</Text>
              <Text style={{ color: '#047857', fontSize: 10, marginTop: 2 }}>
                وقّعت شروط الخدمة في{' '}
                {new Date(profile.acceptedTermsAt).toLocaleDateString('ar-IQ')}
              </Text>
            </View>
          </View>
        )}

        {/* Action: I moved — now genuinely wired to the backend's
            POST /customers/:id/move endpoint. Requests fresh GPS at
            the new address, then PATCHes the customer's location.
            Before this fix the button only showed an Alert. */}
        <Pressable
          onPress={() => {
            Alert.alert(
              'انتقلت لبيت جديد؟',
              'سنطلب موقعك الحالي عبر GPS لتحديث عنوانك. تأكّد أنك في البيت الجديد.',
              [
                { text: 'إلغاء', style: 'cancel' },
                {
                  text: 'تحديث الآن',
                  onPress: async () => {
                    try {
                      // Lazy-import expo-location so the bundle doesn't
                      // pay for it unless the user actually moves.
                      const Location = await import('expo-location');
                      const perm = await Location.requestForegroundPermissionsAsync();
                      if (perm.status !== 'granted') {
                        Alert.alert(
                          'تعذّر تحديد الموقع',
                          'السماح بالوصول للموقع مطلوب. فعّله من الإعدادات وحاول مرة ثانية.',
                        );
                        return;
                      }
                      const loc = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                      });
                      await api.post(`/customers/${profile.id}/move`, {
                        newLng: loc.coords.longitude,
                        newLat: loc.coords.latitude,
                      });
                      Alert.alert(
                        'تم التحديث',
                        'حُدّث عنوانك بنجاح. سيصلك السائق إلى الموقع الجديد في الطلبات القادمة.',
                      );
                    } catch (err: any) {
                      Alert.alert(
                        'خطأ',
                        err?.response?.data?.message ??
                          'تعذّر تحديث العنوان. حاول لاحقاً.',
                      );
                    }
                  },
                },
              ],
            );
          }}
          style={{
            backgroundColor: '#fff',
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 14,
            marginTop: 12,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 10,
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 4,
            elevation: 1,
          }}
        >
          <MaterialIcons name="move-up" size={22} color="#d97706" />
          <Text style={{ color: '#d97706', fontWeight: '700', fontSize: 13, flex: 1, textAlign: 'right' }}>
            انتقلت لبيت جديد
          </Text>
          <MaterialIcons name="chevron-left" size={22} color="#94a3b8" />
        </Pressable>

        {/* Logout */}
        <Pressable
          onPress={async () => {
            await logout();
            router.replace('/(auth)/login');
          }}
          style={{
            backgroundColor: '#fff',
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 14,
            marginTop: 12,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 10,
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 4,
            elevation: 1,
          }}
        >
          <MaterialIcons name="logout" size={22} color="#dc2626" />
          <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 13, flex: 1, textAlign: 'right' }}>
            تسجيل خروج
          </Text>
        </Pressable>

        {/* Delete account — App Store / Play Store legal requirement.
            Double-confirm because the action is destructive + irreversible. */}
        <Pressable
          onPress={() => {
            Alert.alert(
              'حذف الحساب',
              'سيتم حذف بياناتك الشخصية نهائياً. الطلبات المكتملة تبقى في سجل المعمل المحاسبي. لن تستطيع تسجيل الدخول بعد الحذف.',
              [
                { text: 'إلغاء', style: 'cancel' },
                {
                  text: 'تأكيد الحذف',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await api.delete('/auth/me');
                      await logout();
                      router.replace('/(auth)/login');
                      Alert.alert('تم الحذف', 'شكراً لاستخدامك داري.');
                    } catch (e: any) {
                      Alert.alert(
                        'فشل الحذف',
                        e?.response?.data?.message ?? 'حاول مرة أخرى',
                      );
                    }
                  },
                },
              ],
            );
          }}
          style={{
            marginTop: 16,
            paddingVertical: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#94a3b8', fontSize: 11, textDecorationLine: 'underline' }}>
            حذف حسابي نهائياً
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function NavRow({
  icon,
  label,
  tint,
  onPress,
  last,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  tint: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: '#f1f5f9',
      }}
    >
      <View
        style={{
          backgroundColor: `${tint}15`,
          width: 34,
          height: 34,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name={icon} size={19} color={tint} />
      </View>
      <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'right' }}>
        {label}
      </Text>
      <MaterialIcons name="chevron-left" size={22} color="#cbd5e1" />
    </Pressable>
  );
}

function Row({
  icon,
  label,
  value,
  highlight,
  last,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  value: string;
  highlight?: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: '#f1f5f9',
      }}
    >
      <View
        style={{
          backgroundColor: '#e0f2fe',
          width: 32,
          height: 32,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name={icon} size={18} color="#0284c7" />
      </View>
      <Text style={{ color: '#64748b', fontSize: 12, flex: 1, textAlign: 'right' }}>{label}</Text>
      <Text
        style={{
          color: highlight ?? '#0f172a',
          fontWeight: '900',
          fontSize: 13,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
