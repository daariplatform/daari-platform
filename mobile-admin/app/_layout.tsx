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
import { initSentry, Sentry } from '@/lib/sentry';
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

/**
 * PostHog identity + screen tracker. Only mounted when EXPO_PUBLIC_POSTHOG_KEY
 * is set (PostHogProvider is conditional in RootLayout below). Extracting
 * this means RootLayoutInner never calls usePostHog() — which would log a
 * noisy "called without a PostHog client" warning whenever the provider is
 * absent.
 */
function PostHogTracker() {
  const { hydrating, user } = useAuth();
  const ph = usePostHog();

  useScreenTracking();

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

  return null;
}

function RootLayoutInner() {
  const router = useRouter();
  const segments = useSegments();
  const { hydrating, user, hydrate } = useAuth();

  useEffect(() => {
    ensureRTL();
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrating) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login' as any);
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
    SplashScreen.hideAsync().catch(() => {});
  }, [hydrating, user, segments]);

  useEffect(() => {
    if (!user) return;
    registerForPushNotifications().catch((err) =>
      console.warn('[push] registration failed:', err),
    );
    const unsub = setupNotificationListener(
      (notif) => console.log('[push] fg:', notif.request.content.title),
      (response) => {
        // Tap handlers — route based on payload kind.
        const data = response.notification.request.content.data as {
          orderId?: string;
          customerId?: string;
          kind?: string;
        };
        if (data?.kind === 'new-lead') {
          router.push('/(tabs)/customers' as any);
        } else if (data?.kind === 'new-order' && data?.orderId) {
          router.push(`/order/${data.orderId}` as any);
        } else if (data?.kind === 'low-stock') {
          router.push('/(tabs)/stock' as any);
        } else if (data?.orderId) {
          router.push(`/order/${data.orderId}` as any);
        }
      },
    );
    return unsub;
  }, [user, router]);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="order/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="customer/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="walkin" options={{ presentation: 'modal' }} />
        <Stack.Screen name="promos" options={{ presentation: 'card' }} />
        <Stack.Screen name="promo-create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="promo/[id]" options={{ presentation: 'card' }} />
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
      {POSTHOG_API_KEY ? (
        // PostHog throws "You must pass your project's api key" when apiKey
        // is empty AND usePostHog logs "called without a PostHog client"
        // when no provider exists. To dodge both, we render the provider
        // ONLY when a real key is configured, and isolate every PostHog
        // hook call into <PostHogTracker /> which lives inside this branch.
        <PostHogProvider
          apiKey={POSTHOG_API_KEY}
          options={POSTHOG_OPTIONS}
          autocapture={false}
        >
          <PostHogTracker />
          <RootLayoutInner />
        </PostHogProvider>
      ) : (
        <RootLayoutInner />
      )}
    </PersistQueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);
