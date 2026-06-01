/**
 * Wallet / loyalty feature.
 *
 * `GET /customers/me` now returns `loyaltyPoints` (and already returns
 * `balanceIqd`). We extend the profile read locally so the wallet screen
 * can show both without a second endpoint.
 *
 * Payment history is derived from `GET /orders/me` (paid orders only) —
 * no dedicated payments endpoint exists yet.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../auth-store';
import { DEMO_PROFILE } from '../demo-data';
import type { CustomerProfile } from '../types';

/** Profile augmented with the loyalty fields the wallet screen needs. */
export interface WalletProfile extends CustomerProfile {
  loyaltyPoints: number;
}

/** Points needed to unlock the next reward (one free refill). */
export const REWARD_THRESHOLD = 100;

export function useWallet() {
  const demo = useAuth((s) => s.demoMode);
  return useQuery<WalletProfile>({
    // Separate key from useMyProfile so the wallet's loyalty fields don't
    // collide with the home screen's leaner profile cache shape.
    queryKey: ['customer', 'wallet', demo],
    queryFn: async () => {
      if (demo) return { ...DEMO_PROFILE, loyaltyPoints: 65 };
      const { data } = await api.get<WalletProfile>('/customers/me');
      // Backend may omit loyaltyPoints until deployed — default to 0.
      return { ...data, loyaltyPoints: data.loyaltyPoints ?? 0 };
    },
    staleTime: 15_000,
    refetchOnMount: 'always',
  });
}
