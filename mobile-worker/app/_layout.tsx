import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/lib/auth-store';
import { ensureRTL } from '@/lib/i18n';
import { flush } from '@/lib/offline-queue';
import { initSentry, Sentry } from '@/lib/sentry';
import { startShiftTracking } from '@/lib/location';
import { registerForPushNotifications, setupNotificationListener } from '@/lib/push';

// Initialize Sentry before anything else — no-op if EXPO_PUBLIC_SENTRY_DSN
// is not set, so dev / demo profiles stay quiet.
initSentry();

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

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
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="task/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="walkin" options={{ presentation: 'modal' }} />
      </Stack>
    </QueryClientProvider>
  );
}

// Sentry.wrap auto-captures unhandled JS errors and React error boundaries.
// When SENTRY_DSN is unset it returns the component unchanged.
export default Sentry.wrap(RootLayoutInner);
