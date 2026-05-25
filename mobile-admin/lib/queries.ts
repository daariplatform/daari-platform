/**
 * Plant-admin queries. All read endpoints scope to the current tenant via
 * the JWT — the backend's TenantGuard ensures cross-tenant leaks can't
 * happen on the server side; the URLs here look "global" but resolve
 * to "for my plant only".
 *
 * Query keys mirror the persist whitelist in lib/persist.ts. Don't add a
 * new key here without checking PERSIST_PREFIXES.
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';
import type {
  CustomerProfile,
  RefillOrder,
  RefillOrderStatus,
} from './types';

// ────────────────────────────────────────────────────────────────────
// Plant home — KPIs, alerts, summaries
// ────────────────────────────────────────────────────────────────────

export interface PlantKpis {
  todayRevenueIqd: number;
  todayCompletedOrders: number;
  todayPendingOrders: number;
  activeDrivers: number;
  pendingLeadsCount: number;
  stockLevelLiters: number;
  stockCapacityLiters: number;
  stockLow: boolean;
  opsThisMonth: number;
  planLimit: number;
  nearLimit: boolean;
  overLimit: boolean;
}

export function usePlantKpis() {
  return useQuery({
    queryKey: ['plant', 'kpis'],
    queryFn: async () => {
      const { data } = await api.get<PlantKpis>('/plant/kpis');
      return data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ────────────────────────────────────────────────────────────────────
// Stock
// ────────────────────────────────────────────────────────────────────

export interface StockState {
  currentLiters: number;
  capacityLiters: number;
  lowThresholdLiters: number;
  lastRefillAt: string | null;
}

export function usePlantStock() {
  return useQuery({
    queryKey: ['plant', 'stock'],
    queryFn: async () => {
      const { data } = await api.get<StockState>('/plant/stock');
      return data;
    },
  });
}

export function useRefillStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (topUpLiters: number) => {
      // Backend's POST /plant/stock takes additive topUpLiters (it adds to
      // current + records lastTopUpAt). currentLiters override is for
      // physical inventory only — we never expose that from the app.
      const { data } = await api.post('/plant/stock', { topUpLiters });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plant', 'stock'] });
      qc.invalidateQueries({ queryKey: ['plant', 'kpis'] });
    },
  });
}

/** Update stock thresholds (capacity, low-water alarm). */
export function useUpdateStockSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { capacityLiters?: number; lowThresholdLiters?: number }) => {
      const { data } = await api.post('/plant/stock', input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plant', 'stock'] });
    },
  });
}

// ────────────────────────────────────────────────────────────────────
// Orders
// ────────────────────────────────────────────────────────────────────

export interface OrdersListResult {
  items: RefillOrder[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useOrdersList(opts: {
  status?: RefillOrderStatus;
  page?: number;
  pageSize?: number;
}) {
  const { status, page = 1, pageSize = 50 } = opts;
  return useQuery({
    queryKey: ['orders', 'list', status ?? 'all', page, pageSize],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize };
      if (status) params.status = status;
      const { data } = await api.get<OrdersListResult>('/orders', { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useOrderDetail(orderId: string | undefined) {
  return useQuery({
    queryKey: ['orders', 'detail', orderId],
    queryFn: async () => {
      const { data } = await api.get<RefillOrder>(`/orders/${orderId}`);
      return data;
    },
    enabled: !!orderId,
  });
}

export function useCreateWalkinOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      customerName?: string;
      phone?: string;
      liters: number;
      priceIqd: number;
      paidAmountIqd?: number;
    }) => {
      const { data } = await api.post('/orders/walkin-refill', input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', 'list'] });
      qc.invalidateQueries({ queryKey: ['plant', 'kpis'] });
      qc.invalidateQueries({ queryKey: ['plant', 'stock'] });
    },
  });
}

export function useAssignDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { orderId: string; driverId: string }) => {
      const { data } = await api.post(`/orders/${input.orderId}/assign`, {
        driverId: input.driverId,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['plant', 'kpis'] });
    },
  });
}

// ────────────────────────────────────────────────────────────────────
// Customers
// ────────────────────────────────────────────────────────────────────

export interface CustomersListResult {
  items: CustomerProfile[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useCustomersList(opts: { page?: number; pageSize?: number; search?: string }) {
  const { page = 1, pageSize = 50, search } = opts;
  return useQuery({
    queryKey: ['customers', 'list', page, pageSize, search ?? ''],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize };
      if (search) params.search = search;
      const { data } = await api.get<CustomersListResult>('/customers', { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export interface PendingLead extends CustomerProfile {
  createdAt: string;
}

export function usePendingLeads() {
  return useQuery({
    queryKey: ['customers', 'pending-leads'],
    queryFn: async () => {
      // Reuse the paginated /customers list with the status filter; we don't
      // expect more than a couple dozen pending leads at any time so a single
      // page of 100 is fine. If a plant ever exceeds that, the dashboard's
      // sidebar pending counter will tell them faster than scrolling here.
      const { data } = await api.get<CustomersListResult>('/customers', {
        params: { status: 'PENDING_APPROVAL', page: 1, pageSize: 100 },
      });
      return data.items as PendingLead[];
    },
    refetchInterval: 60_000,
  });
}

export interface ApprovedLeadResponse {
  customer: CustomerProfile;
  /** One-time temporary password generated for the customer. Surface in UI for copy/share. */
  tempPassword: string;
}

export function useApproveLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (customerId: string) => {
      const { data } = await api.post<ApprovedLeadResponse>(
        `/customers/${customerId}/approve`,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['plant', 'kpis'] });
    },
  });
}

export function useCustomerDetail(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customers', 'detail', customerId],
    queryFn: async () => {
      const { data } = await api.get<CustomerProfile>(`/customers/${customerId}`);
      return data;
    },
    enabled: !!customerId,
  });
}

// ────────────────────────────────────────────────────────────────────
// Drivers
// ────────────────────────────────────────────────────────────────────

export interface DriverSummary {
  id: string;
  fullName: string;
  phone: string;
  isOnline: boolean;
  activeOrderId: string | null;
}

export interface DriversListResult {
  items: DriverSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useDriversList() {
  return useQuery({
    queryKey: ['drivers', 'list'],
    queryFn: async () => {
      const { data } = await api.get<DriversListResult>('/drivers', {
        params: { page: 1, pageSize: 100 },
      });
      return data;
    },
  });
}

// ────────────────────────────────────────────────────────────────────
// Subscription + plan
// ────────────────────────────────────────────────────────────────────

export interface UsageState {
  plan: 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  status: string;
  opsThisMonth: number;
  monthlyOpsLimit: number;
  nearLimit: boolean;
  overLimit: boolean;
  trialEndsAt?: string | null;
}

export function useSubscription() {
  return useQuery({
    queryKey: ['plant', 'subscription'],
    queryFn: async () => {
      const { data } = await api.get<UsageState>('/plant/usage');
      return data;
    },
  });
}
