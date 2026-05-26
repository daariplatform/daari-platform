/**
 * React Query persistence — keeps the most recent server responses in
 * AsyncStorage so the plant admin sees today's KPIs + orders + customers
 * instantly on cold-start, even before the network round-trip completes.
 *
 * Pairs with `<PersistQueryClientProvider>` in app/_layout.tsx.
 *
 * Persistence rules (see `shouldPersistQuery` below):
 *   - Whitelist read-side dashboard queries only.
 *   - Mutations are NEVER persisted — replaying a stale write would
 *     double-approve a lead or duplicate a walk-in.
 *   - Max age 24h — past that we drop the cache to avoid showing
 *     yesterday's order list at the top on next launch.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query } from '@tanstack/react-query';

export const CACHE_KEY = 'daari-admin-rq-cache-v1';
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: CACHE_KEY,
  throttleTime: 1_000,
});

/**
 * Whitelist of query keys we want to survive an app cold-start.
 * Anything not listed is rebuilt from scratch on next launch.
 */
const PERSIST_PREFIXES: string[][] = [
  ['plant', 'kpis'],
  ['plant', 'stock'],
  ['plant', 'subscription'],
  ['plant', 'driver-performance'],
  ['plant', 'promos'],
  ['orders', 'list'],
  ['orders', 'detail'],
  ['customers', 'list'],
  ['customers', 'pending-leads'],
  ['customers', 'detail'],
  ['drivers', 'list'],
];

function keyMatchesPrefix(queryKey: readonly unknown[], prefix: string[]): boolean {
  if (queryKey.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (queryKey[i] !== prefix[i]) return false;
  }
  return true;
}

export function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false;
  const key = query.queryKey as readonly unknown[];
  return PERSIST_PREFIXES.some((p) => keyMatchesPrefix(key, p));
}
