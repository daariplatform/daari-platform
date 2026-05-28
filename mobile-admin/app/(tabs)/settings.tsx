import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth-store';
import { useSubscription } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import { trackLogoutSafe } from '@/lib/posthog';
import { Button, Card, StatusChip, useToast } from '@/components/ui';
import { theme } from '@/lib/theme';

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
 *
 * NOTE on Alert.alert vs Toast: the two remaining Alert.alert calls
 * (onUpgrade / onLogout) are confirmation prompts that genuinely need a
 * blocking choice (تراجع / خروج, إغلاق / اتصال). Toasts can't ask for
 * input. We *do* use the new toast hook for the post-logout confirmation
 * because that's a one-way notification, not a choice.
 */
export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const subQuery = useSubscription();
  const toast = useToast();

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
          // trackLogoutSafe is a no-op when POSTHOG_API_KEY is empty —
          // it short-circuits BEFORE touching usePostHog(), so we never
          // hit the "called without a PostHog client" warning in dev
          // builds that have no analytics key configured.
          await trackLogoutSafe();
          toast.show({
            title: 'تم تسجيل الخروج',
            tone: 'info',
            duration: 1500,
          });
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
    <View style={{ flex: 1, backgroundColor: theme.color.surface.page }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.color.surface.card }}>
        <View
          style={{
            paddingHorizontal: theme.space.lg,
            paddingTop: theme.space.sm + 2,
            paddingBottom: theme.space.md,
            backgroundColor: theme.color.surface.card,
            borderBottomWidth: 1,
            borderBottomColor: theme.color.border.subtle,
          }}
        >
          <Text
            style={{
              ...theme.font.displaySm,
              color: theme.color.text.primary,
              textAlign: 'right',
            }}
          >
            الإعدادات
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{
          padding: theme.space.md + 2,
          paddingBottom: theme.space['3xl'] - 2,
        }}
      >
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
              <Skeleton height={12} borderRadius={theme.radius.pill} />
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
                  <Text style={{ fontSize: 11, color: theme.color.text.secondary }}>
                    الخطة الحالية
                  </Text>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '900',
                      color: theme.color.text.primary,
                      marginTop: 2,
                    }}
                  >
                    {PLAN_LABELS[usage.plan] ?? usage.plan}
                  </Text>
                </View>
                {usage.overLimit && (
                  <StatusChip label="تجاوزت الحد" tone="danger" size="sm" />
                )}
                {!usage.overLimit && usage.nearLimit && (
                  <StatusChip label="قارب الحد" tone="warning" size="sm" />
                )}
              </View>

              <Text
                style={{
                  fontSize: 12,
                  color: theme.color.raw.slate[600],
                  textAlign: 'right',
                }}
              >
                {(usage.opsThisMonth ?? 0).toLocaleString('en-US')} من{' '}
                {(usage.opsLimit ?? 0).toLocaleString('en-US')} عملية هذا الشهر
              </Text>

              <View
                style={{
                  height: 10,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.color.border.subtle,
                  overflow: 'hidden',
                  marginTop: theme.space.sm,
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${usagePct}%`,
                    backgroundColor: usage.overLimit
                      ? theme.color.state.danger.solid
                      : usage.nearLimit
                        ? theme.color.state.warning.solid
                        : theme.color.accent.primary,
                  }}
                />
              </View>

              <Button
                label="ترقية الخطة"
                icon="arrow-upward"
                onPress={onUpgrade}
                fullWidth
                style={{ marginTop: theme.space.md + 2 }}
              />
            </>
          )}

          {subQuery.isError && (
            <Text
              style={{
                fontSize: 12,
                color: theme.color.state.danger.solid,
                textAlign: 'right',
              }}
            >
              تعذّر تحميل بيانات الاشتراك
            </Text>
          )}
        </Section>

        {/* Promos shortcut */}
        <Section icon="campaign" title="العروض">
          <Pressable
            onPress={() => router.push('/promos' as any)}
            style={({ pressed }) => ({
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 4,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '800',
                  color: theme.color.text.primary,
                }}
              >
                إدارة العروض الترويجية
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.color.text.secondary,
                  marginTop: 2,
                }}
              >
                أنشئ عرض خصم وتابع رصيد المحفظة
              </Text>
            </View>
            <MaterialIcons name="chevron-left" size={22} color={theme.color.accent.primary} />
          </Pressable>
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
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: theme.color.accent.primary,
              }}
            >
              الشروط والخصوصية
            </Text>
            <MaterialIcons name="open-in-new" size={18} color={theme.color.accent.primary} />
          </Pressable>
        </Section>

        {/* Logout — shared danger Button replaces the previous bespoke
            red Pressable. Same visual weight, same shadow, but now
            consistent with every other destructive action in the app. */}
        <Button
          label="تسجيل الخروج"
          icon="logout"
          variant="danger"
          size="lg"
          fullWidth
          onPress={onLogout}
          style={{ marginTop: theme.space.sm }}
        />
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
    <Card
      variant="flat"
      padding="md"
      style={{
        borderRadius: theme.radius['2xl'] - 2,
        marginBottom: theme.space.md,
      }}
    >
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: theme.space.sm,
          marginBottom: theme.space.md,
        }}
      >
        <MaterialIcons name={icon} size={18} color={theme.color.accent.primary} />
        <Text style={{ fontSize: 13, fontWeight: '800', color: theme.color.text.primary }}>
          {title}
        </Text>
      </View>
      {children}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.space.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.color.raw.slate[100],
      }}
    >
      <Text style={{ fontSize: 12, color: theme.color.text.secondary }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.color.text.primary }}>
        {value}
      </Text>
    </View>
  );
}
