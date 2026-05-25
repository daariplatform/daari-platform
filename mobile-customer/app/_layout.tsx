import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/lib/auth-store';
import { ensureRTL } from '@/lib/i18n';
import { initSentry, Sentry } from '@/lib/sentry';
import { registerForPushNotifications, setupNotificationListener } from '@/lib/push';

// Initialize Sentry before anything else — no-op if EXPO_PUBLIC_SENTRY_DSN
// is not set, so dev / demo profiles stay quiet.
initSentry();

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function RootLayoutInner() {
  const router = useRouter();
  const segments = useSegments();
  const { hydrating, user, hydrate } = useAuth();

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

  // 4. Register for push notifications after login.
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
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ presentation: 'modal' }} />
      </Stack>
    </QueryClientProvider>
  );
}

// Sentry.wrap auto-captures unhandled JS errors and React error boundaries.
// When SENTRY_DSN is unset it returns the component unchanged.
export default Sentry.wrap(RootLayoutInner);
