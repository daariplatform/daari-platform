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

// Initialize Sentry before anything else — no-op if EXPO_PUBLIC_SENTRY_DSN
// is not set, so dev / demo profiles stay quiet.
initSentry();

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Required so persisted queries survive a cold-start. Without this
      // React Query GCs caches older than 5 min and the rehydrated cache
      // is discarded before any screen reads it.
      gcTime: CACHE_MAX_AGE_MS,
    },
  },
});

function RootLayoutInner() {
  const router = useRouter();
  const segments = useSegments();
  const { hydrating, user, hydrate } = useAuth();
  const ph = usePostHog();

  // Auto-track screen_view on every route change.
  useScreenTracking();

  // 1. Set RTL on first mount before any rendering.
  useEffect(() => {
    ensureRTL();
  }, []);

  // 2. Restore auth session.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 3. Once hydrated, route based on auth state.
  useEffect(() => {
    if (hydrating) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      // Land on welcome — opens two paths (existing-customer login OR
      // discover-a-plant signup). This is the entry point for viral growth.
      router.replace('/(auth)/welcome' as any);
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
    SplashScreen.hideAsync().catch(() => {});
  }, [hydrating, user, segments]);

  // 4. Identify the user in PostHog whenever the auth state changes.
  // Demo logins are intentionally NOT identified — we don't want fake
  // sessions polluting the per-user funnel.
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
      // On logout — reset so the next login starts a fresh identity.
      resetUser(ph);
    }
  }, [user, hydrating, ph]);

  // 5. Register for push notifications after login.
  useEffect(() => {
    if (!user) return;
    registerForPushNotifications().catch((err) => console.warn('[push] registration failed:', err));
    const unsub = setupNotificationListener(
      (notif) => console.log('[push] received in fg:', notif.request.content.title),
      (response) => {
        // Tap → route based on payload
        const data = response.notification.request.content.data as { orderId?: string };
        if (data?.orderId) router.push(`/order/${data.orderId}` as any);
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
        <Stack.Screen name="onboarding" options={{ presentation: 'modal' }} />
      </Stack>
    </View>
  );
}

function RootLayout() {
  // PersistQueryClientProvider rehydrates the cache from AsyncStorage BEFORE
  // any child query runs, so screens see persisted data instantly. Once
  // online, each query refetches in the background per its `staleTime`.
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE_MS,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
        // Bump if the on-disk shape ever changes — older caches get nuked.
        buster: 'v1',
      }}
    >
      <PostHogProvider
        apiKey={POSTHOG_API_KEY}
        options={POSTHOG_OPTIONS}
        // PostHog is a soft-dependency — even with an empty key, the SDK
        // is safe to mount and noops on capture(). This means a misconfigured
        // .env never breaks the app.
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
