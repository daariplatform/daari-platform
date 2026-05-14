import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth-store';
import { DEMO_ORDERS, DEMO_PROFILE } from './demo-data';
import type { CustomerProfile, RefillOrder, NearestPlant } from './types';

export const queryKeys = {
  me: ['me'] as const,
  myProfile: ['customer', 'me'] as const,
  myOrders: ['customer', 'orders'] as const,
  nearestPlant: (lng: number, lat: number) => ['plant', 'nearest', lng, lat] as const,
};

export function useMyProfile() {
  const demo = useAuth((s) => s.demoMode);
  return useQuery({
    queryKey: [...queryKeys.myProfile, demo],
    queryFn: async () => {
      if (demo) return DEMO_PROFILE;
      return (await api.get<CustomerProfile>('/customers/me')).data;
    },
    staleTime: 60_000,
  });
}

export function useMyOrders() {
  const demo = useAuth((s) => s.demoMode);
  return useQuery({
    queryKey: [...queryKeys.myOrders, demo],
    queryFn: async () => {
      if (demo) return DEMO_ORDERS;
      return (await api.get<RefillOrder[]>('/orders/me')).data;
    },
    staleTime: 30_000,
  });
}

export function useNearestPlant(lng: number | null, lat: number | null) {
  return useQuery({
    queryKey: queryKeys.nearestPlant(lng ?? 0, lat ?? 0),
    queryFn: async () =>
      (await api.get<NearestPlant>('/tenants/nearest', { params: { lng, lat } })).data,
    enabled: lng != null && lat != null,
    staleTime: 5 * 60_000,
  });
}

export function useCreateRefillOrder() {
  const qc = useQueryClient();
  const demo = useAuth((s) => s.demoMode);
  return useMutation({
    mutationFn: async (customerId: string) => {
      if (demo) {
        // Pretend the order was placed instantly.
        await new Promise((r) => setTimeout(r, 600));
        return { id: 'r-demo-' + Date.now(), status: 'PENDING' };
      }
      const { data } = await api.post('/orders', { customerId });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myOrders });
      qc.invalidateQueries({ queryKey: queryKeys.myProfile });
    },
  });
}
