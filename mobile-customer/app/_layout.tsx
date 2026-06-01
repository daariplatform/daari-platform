import '../global.css';
import { useEffect, useState } from 'react';
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
import { hasSeenIntro } from '@/lib/features/intro';
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
  // null = not yet checked; true/false once AsyncStorage is read.
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);

  // Auto-track screen_view on every route change.
  useScreenTracking();

  // Read the first-run intro flag once on mount.
  useEffect(() => {
    hasSeenIntro().then(setIntroSeen);
  }, []);

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
    if (hydrating || introSeen === null) return;
    const inAuthGroup = segments[0] === '(auth)';
    const onIntro = segments[0] === 'intro';
    if (!user && !inAuthGroup) {
      // Land on welcome — opens two paths (existing-customer login OR
      // discover-a-plant signup). This is the entry point for viral growth.
      router.replace('/(auth)/welcome' as any);
    } else if (user && inAuthGroup) {
      // Authenticated but coming from auth: show the one-time intro carousel
      // to first-run users before the tabs; everyone else goes home.
      if (introSeen) {
        router.replace('/(tabs)/home');
      } else {
        // Re-read the flag right before navigating — the intro screen marks
        // it on completion, and our in-memory `introSeen` may be stale.
        hasSeenIntro().then((seen) => {
          if (seen) setIntroSeen(true);
          router.replace(seen ? '/(tabs)/home' : ('/intro' as any));
        });
      }
    } else if (user && !introSeen && !onIntro && segments[0] === '(tabs)') {
      // Safety net — a first-run user who somehow landed on the tabs (e.g.
      // already-hydrated session, no auth redirect) still sees the intro once.
      // Re-read the flag so a freshly-completed intro doesn't bounce back.
      hasSeenIntro().then((seen) => {
        if (seen) {
          setIntroSeen(true);
        } else {
          router.replace('/intro' as any);
        }
      });
    }
    SplashScreen.hideAsync().catch(() => {});
  }, [hydrating, user, segments, introSeen]);

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
        const data = response.notification.request.content.data as {
          orderId?: string;
          kind?: string;
        };
        // Promo push lands the customer on home — the active-promo CTA
        // morph is what we want them to see, no dedicated screen exists.
        if (data?.kind === 'promo') {
          router.push('/(tabs)/home');
          return;
        }
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
        <Stack.Screen name="intro" />
        <Stack.Screen name="addresses" options={{ animation: 'slide_from_left' }} />
        <Stack.Screen name="schedules" options={{ animation: 'slide_from_left' }} />
        <Stack.Screen name="wallet" options={{ animation: 'slide_from_left' }} />
        <Stack.Screen name="support" options={{ animation: 'slide_from_left' }} />
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
      {/* PostHog is a soft-dependency. posthog-react-native (v4) console.errors
          "You must pass your PostHog project's api key" when apiKey is empty,
          which pops a full-screen LogBox in __DEV__. usePostHog() ALSO errors
          if no provider is mounted. So we always mount the provider, but when
          no key is configured we pass a placeholder key + `disabled: true` —
          the SDK then no-ops (zero network) without erroring, and usePostHog()
          keeps working everywhere. In production a real key enables it. */}
      <PostHogProvider
        apiKey={POSTHOG_API_KEY || 'phc_disabled_no_key'}
        options={{ ...POSTHOG_OPTIONS, disabled: !POSTHOG_API_KEY }}
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
