import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth-store';
import { DEMO_HISTORY, DEMO_SEARCH_CUSTOMERS, DEMO_TASKS } from './demo-data';
import type { CustomerProfile, RefillOrder } from './types';

export const queryKeys = {
  me: ['me'] as const,
  myDriverProfile: ['driver', 'me'] as const,
  myTodayTasks: ['driver', 'today'] as const,
  myVendorProfile: ['vendor', 'me'] as const,
  myVendorWallet: ['vendor', 'wallet'] as const,
  myHistory: ['worker', 'history'] as const,
  customerSearch: (q: string) => ['customers', 'search', q] as const,
};

export interface DriverTask {
  id: string;
  status: 'PENDING' | 'ASSIGNED' | 'EN_ROUTE' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  kind: 'REFILL' | 'TANK_DELIVERY' | 'TANK_RECLAIM';
  customer: {
    id: string;
    fullName: string;
    phone: string;
    district: string;
    addressLine: string;
    locationLng: number | null;
    locationLat: number | null;
  };
  tank: { id: string; qrCode: string; capacity: string } | null;
  scheduledFor: string | null;
  priceIqd: number;
}

export function useMyTodayTasks() {
  const demo = useAuth((s) => s.demoMode);
  return useQuery({
    queryKey: [...queryKeys.myTodayTasks, demo],
    queryFn: async () => {
      if (demo) return DEMO_TASKS;
      return (await api.get<DriverTask[]>('/orders/me/today')).data;
    },
    staleTime: 30_000,
    refetchInterval: demo ? false : 60_000,
  });
}

export function useCustomerSearch(q: string) {
  const demo = useAuth((s) => s.demoMode);
  return useQuery({
    queryKey: [...queryKeys.customerSearch(q), demo],
    queryFn: async () => {
      if (demo) {
        const needle = q.toLowerCase();
        return DEMO_SEARCH_CUSTOMERS.filter(
          (c) =>
            c.fullName.toLowerCase().includes(needle) ||
            c.phone.includes(q) ||
            c.tanks.some((t) => t.qrCode.toLowerCase().includes(needle)),
        ) as unknown as CustomerProfile[];
      }
      return (await api.get<CustomerProfile[]>('/customers', { params: { search: q } })).data;
    },
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}

/** History tab — uses demo dataset when offline. */
export function useMyHistory() {
  const demo = useAuth((s) => s.demoMode);
  return useQuery({
    queryKey: [...queryKeys.myHistory, demo],
    queryFn: async () => {
      if (demo) return DEMO_HISTORY;
      return (await api.get('/orders/me/history', { params: { limit: 100 } })).data;
    },
  });
}

export interface CompleteRefillBody {
  paymentMethod: 'CASH' | 'ZAINCASH' | 'ASIA_HAWALA' | 'CREDIT';
  paidAmountIqd: number;
  proofPhotoUrl: string;
  completionLng: number;
  completionLat: number;
}

export function useCompleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, body }: { orderId: string; body: CompleteRefillBody }) => {
      const { data } = await api.post(`/orders/${orderId}/complete`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myTodayTasks }),
  });
}

export interface ReclaimBody extends CompleteRefillBody {
  reclaimReason:
    | 'NON_COMPLIANCE'
    | 'MAINTENANCE'
    | 'CUSTOMER_MOVED'
    | 'CUSTOMER_CANCELLED'
    | 'TANK_DAMAGED'
    | 'OTHER';
  reclaimNotes?: string;
}

export function useReclaimTank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, body }: { orderId: string; body: ReclaimBody }) => {
      const { data } = await api.post(`/orders/${orderId}/complete`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myTodayTasks }),
  });
}

export interface WalkinRefillBody {
  customerId: string;
  paymentMethod: 'CASH' | 'ZAINCASH';
  paidAmountIqd: number;
  proofPhotoUrl: string;
  completionLng: number;
  completionLat: number;
}

export function useWalkinRefill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: WalkinRefillBody) => {
      const { data } = await api.post('/orders/walkin-refill', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myHistory }),
  });
}

export function useUploadProofPhoto() {
  return useMutation({
    mutationFn: async (uri: string) => {
      const form = new FormData();
      form.append('photo', { uri, name: 'proof.jpg', type: 'image/jpeg' } as any);
      const { data } = await api.post<{ url: string }>('/uploads/proof', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.url;
    },
  });
}

export interface RegisterNewCustomerBody {
  fullName: string;
  phone: string;
  district: string;
  addressLine: string;
  locationLng: number;
  locationLat: number;
  notes?: string;
}

export function useRegisterCustomerByDriver() {
  return useMutation({
    mutationFn: async (body: RegisterNewCustomerBody) => {
      const { data } = await api.post('/customers/register-by-driver', body);
      return data;
    },
  });
}
