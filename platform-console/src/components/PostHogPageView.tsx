'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { posthog } from '@/lib/posthog';

export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    let url = window.origin + pathname;
    if (searchParams && searchParams.toString()) url += `?${searchParams.toString()}`;
    posthog?.capture?.('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
