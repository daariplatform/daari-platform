'use client';

import posthog from 'posthog-js';

let initialised = false;

export function initPostHog() {
  if (initialised || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    loaded: (ph) => {
      ph.register({ app: 'daari-platform-console' });
    },
  });
  initialised = true;
}

export function identifyPlantAdmin(userId: string, props: Record<string, unknown>) {
  if (!initialised) return;
  posthog.identify(userId, props);
}

export function trackEvent(event: string, props?: Record<string, unknown>) {
  if (!initialised) return;
  posthog.capture(event, props);
}

export function resetPostHog() {
  if (!initialised) return;
  posthog.reset();
}

export { posthog };
