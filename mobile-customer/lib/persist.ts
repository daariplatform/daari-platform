/**
 * React Query persistence — keeps the most recent server responses in
 * AsyncStorage so the user sees their data instantly on cold-start, even
 * before the network round-trip completes (or while offline).
 *
 * Pairs with `<PersistQueryClientProvider>` in app/_layout.tsx.
 *
 * Persistence rules (see `shouldPersistQuery` below):
 *   - Whitelist user-facing reads only (profile, orders, notifications, history).
 *   - Mutations are NEVER persisted — replaying a stale write is dangerous.
 *   - Max age 24h — beyond that we drop the cache to avoid showing very
 *     old prices/statuses on next launch.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query } from '@tanstack/react-query';

export const CACHE_KEY = 'daari-rq-cache-v1';
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
  ['customer', 'me'],            // useMyProfile
  ['customer', 'orders'],        // useMyOrders
  ['customer', 'active-promo'],  // useActivePromo — discounted price visible on cold-start
  ['notifications'],             // notifications inbox
  ['order'],                     // ['order', id] — single order detail
];

function keyMatchesPrefix(queryKey: readonly unknown[], prefix: string[]): boolean {
  if (queryKey.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (queryKey[i] !== prefix[i]) return false;
  }
  return true;
}

export function shouldPersistQuery(query: Query): boolean {
  // Don't persist failed queries — empty / error state on cold-start is
  // worse than no state at all (the UI thinks data has loaded).
  if (query.state.status !== 'success') return false;
  const key = query.queryKey as readonly unknown[];
  return PERSIST_PREFIXES.some((p) => keyMatchesPrefix(key, p));
}
