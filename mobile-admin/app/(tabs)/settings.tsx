import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { usePostHog } from 'posthog-react-native';

import { useAuth } from '@/lib/auth-store';
import { useSubscription } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import { track } from '@/lib/posthog';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'مالك المعمل',
  MANAGER: 'مدير',
  ACCOUNTANT: 'محاسب',
  PLATFORM_ADMIN: 'مسؤول المنصّة',
};

const PLAN_LABELS: Record<string, string> = {
  STARTER: 'Starter (مجاناً)',
  PRO: 'Pro',
  BUSINESS: 'Business',
  ENTERPRISE: 'Enterprise',
};

/**
 * Settings — account info, subscription summary, about section, logout.
 * Upgrade flow is a placeholder alert per spec (real billing is offline
 * for now); the support phone is pulled from app.json's developer.extra.
 */
export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const subQuery = useSubscription();
  const ph = usePostHog();

  const version =
    (Constants.expoConfig as any)?.version ?? Constants.expoConfig?.version ?? '0.1.0';
  const supportPhone =
    (Constants.expoConfig?.extra as any)?.developer?.supportPhone ?? '+964 0000 000 000';

  function onUpgrade() {
    Alert.alert(
      'ترقية الخطة',
      `للترقية تواصل مع فريق داري على:\n${supportPhone}`,
      [
        { text: 'إغلاق', style: 'cancel' },
        {
          text: 'اتصال',
          onPress: () => Linking.openURL(`tel:${supportPhone.replace(/\s+/g, '')}`),
        },
      ],
    );
  }

  function onLogout() {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من تسجيل الخروج؟', [
      { text: 'تراجع', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          try {
            track(ph, 'logout');
          } catch {
            /* ignore */
          }
          await logout();
        },
      },
    ]);
  }

  const usage = subQuery.data;
  const usagePct =
    usage && usage.opsLimit > 0
      ? Math.min(100, Math.round((usage.opsThisMonth / usage.opsLimit) * 100))
      : 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 12,
            backgroundColor: '#fff',
            borderBottomWidth: 1,
            borderBottomColor: '#e2e8f0',
          }}
        >
          <Text
            style={{ fontSize: 22, fontWeight: '900', color: '#0f172a', textAlign: 'right' }}
          >
            الإعدادات
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
        {/* Account */}
        <Section icon="person" title="حسابي">
          <Row label="رقم الهاتف" value={user?.phone ?? '—'} />
          <Row label="الدور" value={ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? '—'} />
        </Section>

        {/* Subscription */}
        <Section icon="workspace-premium" title="الاشتراك">
          {subQuery.isLoading && (
            <>
              <Skeleton height={20} style={{ marginBottom: 8 }} />
              <Skeleton height={14} width="60%" style={{ marginBottom: 8 }} />
              <Skeleton height={12} borderRadius={999} />
            </>
          )}

          {usage && (
            <>
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>الخطة الحالية</Text>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: '#0f172a', marginTop: 2 }}>
                    {PLAN_LABELS[usage.plan] ?? usage.plan}
                  </Text>
                </View>
                {usage.overLimit && (
                  <View
                    style={{
                      backgroundColor: '#fee2e2',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ color: '#991b1b', fontWeight: '800', fontSize: 10 }}>
                      تجاوزت الحد
                    </Text>
                  </View>
                )}
                {!usage.overLimit && usage.nearLimit && (
                  <View
                    style={{
                      backgroundColor: '#fef3c7',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ color: '#92400e', fontWeight: '800', fontSize: 10 }}>
                      قارب الحد
                    </Text>
                  </View>
                )}
              </View>

              <Text style={{ fontSize: 12, color: '#475569', textAlign: 'right' }}>
                {(usage.opsThisMonth ?? 0).toLocaleString('en-US')} من{' '}
                {(usage.opsLimit ?? 0).toLocaleString('en-US')} عملية هذا الشهر
              </Text>

              <View
                style={{
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: '#e2e8f0',
                  overflow: 'hidden',
                  marginTop: 8,
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${usagePct}%`,
                    backgroundColor: usage.overLimit
                      ? '#ef4444'
                      : usage.nearLimit
                        ? '#f59e0b'
                        : '#0284c7',
                  }}
                />
              </View>

              <Pressable
                onPress={onUpgrade}
                style={({ pressed }) => ({
                  marginTop: 14,
                  borderRadius: 14,
                  overflow: 'hidden',
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <LinearGradient
                  colors={['#0ea5e9', '#0284c7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingVertical: 12,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <MaterialIcons name="arrow-upward" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                    ترقية الخطة
                  </Text>
                </LinearGradient>
              </Pressable>
            </>
          )}

          {subQuery.isError && (
            <Text style={{ fontSize: 12, color: '#dc2626', textAlign: 'right' }}>
              تعذّر تحميل بيانات الاشتراك
            </Text>
          )}
        </Section>

        {/* About */}
        <Section icon="info-outline" title="حول التطبيق">
          <Row label="الإصدار" value={version} />
          <Pressable
            onPress={() => Linking.openURL('https://daari-admin.phi-bit.com/legal/terms')}
            style={({ pressed }) => ({
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 10,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0284c7' }}>
              الشروط والخصوصية
            </Text>
            <MaterialIcons name="open-in-new" size={18} color="#0284c7" />
          </Pressable>
        </Section>

        {/* Logout */}
        <Pressable
          onPress={onLogout}
          style={({ pressed }) => ({
            marginTop: 8,
            backgroundColor: '#ef4444',
            borderRadius: 18,
            paddingVertical: 14,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: pressed ? 0.85 : 1,
            shadowColor: '#ef4444',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 4,
          })}
        >
          <MaterialIcons name="logout" size={22} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
            تسجيل الخروج
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: MaterialIconName;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <MaterialIcons name={icon} size={18} color="#0284c7" />
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
      }}
    >
      <Text style={{ fontSize: 12, color: '#64748b' }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>{value}</Text>
    </View>
  );
}
