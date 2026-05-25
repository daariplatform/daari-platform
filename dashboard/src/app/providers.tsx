'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect, useState } from 'react';
import { initPostHog } from '@/lib/posthog';
import { PostHogPageView } from '@/components/PostHogPageView';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  }));

  useEffect(() => {
    initPostHog();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </QueryClientProvider>
  );
}
