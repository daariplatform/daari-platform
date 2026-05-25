import '../global.css';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/lib/auth-store';
import { ensureRTL } from '@/lib/i18n';
import { flush } from '@/lib/offline-queue';
import { initSentry, Sentry } from '@/lib/sentry';
import { startShiftTracking } from '@/lib/location';
import { registerForPushNotifications, setupNotificationListener } from '@/lib/push';
import { persister, shouldPersistQuery, CACHE_MAX_AGE_MS } from '@/lib/persist';
import { OfflineBanner } from '@/components/OfflineBanner';
import {
  POSTHOG_API_KEY,
  POSTHOG_OPTIONS,
  identifyUser,
  resetUser,
  useScreenTracking,
  track,
} from '@/lib/posthog';

// Initialize Sentry before anything else — no-op if EXPO_PUBLIC_SENTRY_DSN
// is not set, so dev / demo profiles stay quiet.
initSentry();

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      gcTime: CACHE_MAX_AGE_MS,
    },
  },
});

function RootLayoutInner() {
  const router = useRouter();
  const segments = useSegments();
  const { hydrating, user, hydrate } = useAuth();
  const ph = usePostHog();

  useScreenTracking();

  useEffect(() => {
    ensureRTL();
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Drain the offline queue on every mount + on a slow interval.
  useEffect(() => {
    flush().catch(() => {});
    const t = setInterval(() => {
      flush().catch(() => {});
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  // ابدأ background GPS tracking تلقائياً لو السائق مسجّل دخول.
  // هذا يغطّي حالة إعادة فتح التطبيق بعد إغلاقه — الـ login screen
  // يبدأها أول مرة فقط؛ هنا نضمنها للجلسات اللاحقة.
  useEffect(() => {
    if (user && !hydrating) {
      startShiftTracking().catch(() => {});
    }
  }, [user, hydrating]);

  useEffect(() => {
    if (hydrating) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      // مرحلة ١: السائق فقط. الـ vendor (بائع مستقل) مؤجَّل للمرحلة القادمة،
      // فنذهب مباشرة لشاشة تسجيل دخول السائق (لا role picker).
      router.replace('/(auth)/driver-login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
    SplashScreen.hideAsync().catch(() => {});
  }, [hydrating, user, segments]);

  // PostHog identity sync — fires on login + logout (but skips demo users).
  useEffect(() => {
    if (hydrating) return;
    if (user && user.id && !user.id.startsWith('demo-')) {
      identifyUser(ph, user.id, {
        phone: user.phone,
        role: user.role,
        tenantId: user.tenantId,
      });
      track(ph, 'login_success', { role: user.role, tenantId: user.tenantId });
    } else if (!user) {
      resetUser(ph);
    }
  }, [user, hydrating, ph]);

  // Register push token + listen for taps. New-order notifications get
  // routed to the matching task detail screen, completion notifications
  // go to history.
  useEffect(() => {
    if (!user) return;
    registerForPushNotifications().catch((err) =>
      console.warn('[push] registration failed:', err),
    );
    const unsub = setupNotificationListener(
      (notif) => console.log('[push] fg:', notif.request.content.title),
      (response) => {
        const data = response.notification.request.content.data as {
          orderId?: string;
          kind?: string;
        };
        if (data?.orderId && data.kind === 'new-order') {
          router.push(`/task/${data.orderId}` as any);
        }
      },
    );
    return unsub;
  }, [user, router]);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="task/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="walkin" options={{ presentation: 'modal' }} />
      </Stack>
    </View>
  );
}

function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE_MS,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
        buster: 'v1',
      }}
    >
      <PostHogProvider
        apiKey={POSTHOG_API_KEY}
        options={POSTHOG_OPTIONS}
        autocapture={false}
      >
        <RootLayoutInner />
      </PostHogProvider>
    </PersistQueryClientProvider>
  );
}

// Sentry.wrap auto-captures unhandled JS errors and React error boundaries.
// When SENTRY_DSN is unset it returns the component unchanged.
export default Sentry.wrap(RootLayout);
