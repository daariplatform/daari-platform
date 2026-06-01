import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth-store';
import { DEMO_HISTORY, DEMO_SEARCH_CUSTOMERS, DEMO_TASKS } from './demo-data';
import type { CustomerProfile, RefillOrder } from './types';

export const queryKeys = {
  me: ['me'] as const,
  myDriverProfile: ['driver', 'me'] as const,
  myTodayTasks: ['driver', 'today'] as const,
  myAvailableOrders: ['driver', 'available'] as const,
  myVendorProfile: ['vendor', 'me'] as const,
  myVendorWallet: ['vendor', 'wallet'] as const,
  myHistory: ['worker', 'history'] as const,
  myPerf: (period: 'week' | 'month') => ['driver', 'me', 'perf', period] as const,
  customerSearch: (q: string) => ['customers', 'search', q] as const,
  myCashSummary: ['driver', 'me', 'cash-summary'] as const,
  myCashHandovers: ['driver', 'me', 'cash-handovers'] as const,
  myEarnings: (period: 'week' | 'month') =>
    ['driver', 'me', 'earnings', period] as const,
  myShiftSummary: ['driver', 'me', 'shift-summary'] as const,
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

/**
 * The pool of orders this driver can CLAIM (still PENDING + unassigned in the
 * tenant). Polled every 20s so freshly-placed orders appear without a manual
 * refresh. Same `DriverTask` shape as today's tasks.
 */
export function useAvailableOrders() {
  const demo = useAuth((s) => s.demoMode);
  return useQuery({
    queryKey: queryKeys.myAvailableOrders,
    queryFn: async () => {
      if (demo) return [] as DriverTask[];
      return (await api.get<DriverTask[]>('/orders/me/available')).data;
    },
    staleTime: 8_000,
    refetchInterval: demo ? false : 20_000,
  });
}

/**
 * Claim an offered order (first-come). On success the order is ASSIGNED to
 * this driver; a 409 means another driver beat them to it — the screen shows
 * a friendly message and the pool refreshes.
 */
export function useClaimOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) =>
      (await api.post<DriverTask>(`/orders/${orderId}/claim`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myAvailableOrders });
      qc.invalidateQueries({ queryKey: queryKeys.myTodayTasks });
    },
    onError: () => {
      // Pool likely changed (someone claimed it) — refresh so the card vanishes.
      qc.invalidateQueries({ queryKey: queryKeys.myAvailableOrders });
    },
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

/**
 * Driver profile — full row from `Driver` table including base salary,
 * commission per refill, vehicle plate, status, current GPS. Used by the
 * worker profile screen to show "you earn X per refill" + ride status.
 */
export interface DriverProfile {
  id: string;
  tenantId: string;
  userId: string;
  vehiclePlate: string | null;
  status: 'OFFLINE' | 'ONLINE' | 'ON_TRIP' | 'BREAK';
  isActive: boolean;
  baseSalaryIqd: number | null;
  commissionPerRefillIqd: number | null;
  joinDate: string | null;
  /** Tanks currently loaded on the van (full / empty). Backend returns these
   * on GET /drivers/me; the van-inventory screen lets the driver adjust them. */
  tanksFullOnVan?: number | null;
  tanksEmptyOnVan?: number | null;
}

export function useMyDriverProfile() {
  const demo = useAuth((s) => s.demoMode);
  return useQuery({
    queryKey: [...queryKeys.myDriverProfile, demo],
    queryFn: async () => {
      if (demo) {
        return {
          id: 'demo-driver',
          tenantId: 'demo-tenant',
          userId: 'demo-user',
          vehiclePlate: '12345 بغداد',
          status: 'ONLINE' as const,
          isActive: true,
          baseSalaryIqd: 500_000,
          commissionPerRefillIqd: 250,
          joinDate: '2026-01-15',
          tanksFullOnVan: 18,
          tanksEmptyOnVan: 6,
        } satisfies DriverProfile;
      }
      return (await api.get<DriverProfile>('/drivers/me')).data;
    },
    staleTime: 60_000,
  });
}

/**
 * My-perf for the worker profile screen. Backend `/drivers/me/perf`
 * returns the same shape as the manager-facing `/drivers/:id/perf`:
 * `{ completedOrders, revenueIqd, bonusIqd, avgCompletionMin,
 * customerRating, fullName }`. Falls back to a deterministic demo set
 * when the driver is signed in via the demo account.
 */
export interface DriverPerf {
  completedOrders: number;
  revenueIqd: number;
  bonusIqd: number;
  avgCompletionMin: number | null;
  customerRating: number | null;
  fullName: string;
}

export function useMyPerf(period: 'week' | 'month' = 'month') {
  const demo = useAuth((s) => s.demoMode);
  return useQuery({
    queryKey: [...queryKeys.myPerf(period), demo],
    queryFn: async () => {
      if (demo) {
        return {
          completedOrders: 47,
          revenueIqd: 47_000,
          bonusIqd: 11_750,
          avgCompletionMin: 12,
          customerRating: 4.8,
          fullName: 'سائق تجريبي',
        } satisfies DriverPerf;
      }
      const { data } = await api.get<DriverPerf>('/drivers/me/perf', {
        params: { period },
      });
      return data;
    },
    staleTime: 60_000,
  });
}

/** Change password for the currently-logged-in driver. Uses /auth/change-password. */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (body: { currentPassword: string; newPassword: string }) => {
      const { data } = await api.post('/auth/change-password', body);
      return data;
    },
  });
}

export interface CompleteRefillBody {
  // Cash-only by business rule; kept as a union for backend compatibility.
  paymentMethod: 'CASH' | 'ZAINCASH' | 'ASIA_HAWALA' | 'CREDIT';
  paidAmountIqd: number;
  /** Optional — tank photo proof was dropped to save storage/bandwidth. */
  proofPhotoUrl?: string;
  completionLng: number;
  completionLat: number;
  /**
   * Optional QR scanned at the door. Backend CompleteOrderDto accepts it and
   * (when present) enforces a strict match against the order's tank QR — see
   * orders.controller.ts `CompleteOrderDto.qrCode`. Omit if the driver
   * couldn't scan; backend still completes.
   */
  qrCode?: string;
}

export function useCompleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, body }: { orderId: string; body: CompleteRefillBody }) => {
      const { data } = await api.post(`/orders/${orderId}/complete`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myTodayTasks });
      qc.invalidateQueries({ queryKey: queryKeys.myHistory });
    },
  });
}

/**
 * Driver hits "ابدأ الجولة" — transitions the order from ASSIGNED → EN_ROUTE.
 * The customer's app picks up the new status on its next poll (every 15s)
 * and shows the "السائق متجه إليك" badge.
 */
export function useStartOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await api.post(`/orders/${orderId}/start`);
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
  paymentMethod: 'CASH' | 'ZAINCASH' | 'ASIA_HAWALA' | 'CREDIT';
  paidAmountIqd: number;
  /** Optional — tank photo proof was dropped to save storage/bandwidth. */
  proofPhotoUrl?: string;
  completionLng: number;
  completionLat: number;
  /**
   * Liters the driver actually pumped. Audit finding: backend stamps this
   * into the priceIqd line — without it, revenue was always wrong (defaulted
   * to the hardcoded 1000 IQD). Backend WalkinRefillDto accepts `walkinLiters`
   * (IsInt, Min 1). See orders.controller.ts L75.
   */
  walkinLiters?: number;
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

/* ──────────────────────────────────────────────────────────────────────────
 * CASH RECONCILIATION / HANDOVER
 * The driver collects cash on every refill; at the end of the day they hand
 * it over to the plant. These three endpoints surface what's been collected
 * today, what's still pending, and the running ledger of handovers.
 * Endpoints may 404 until the backend deploys — callers fall back gracefully.
 * ────────────────────────────────────────────────────────────────────────── */

export interface CashSummary {
  collectedTodayIqd: number;
  handedOverTodayIqd: number;
  pendingIqd: number;
}

export function useMyCashSummary() {
  const demo = useAuth((s) => s.demoMode);
  return useQuery({
    queryKey: [...queryKeys.myCashSummary, demo],
    queryFn: async () => {
      if (demo) {
        return {
          collectedTodayIqd: 47_000,
          handedOverTodayIqd: 30_000,
          pendingIqd: 17_000,
        } satisfies CashSummary;
      }
      return (await api.get<CashSummary>('/drivers/me/cash-summary')).data;
    },
    staleTime: 30_000,
  });
}

export interface CashHandover {
  id: string;
  amountIqd: number;
  note: string | null;
  status: 'PENDING' | 'CONFIRMED';
  createdAt: string;
  confirmedAt: string | null;
}

export function useMyCashHandovers() {
  const demo = useAuth((s) => s.demoMode);
  return useQuery({
    queryKey: [...queryKeys.myCashHandovers, demo],
    queryFn: async () => {
      if (demo) {
        return [
          {
            id: 'ho1',
            amountIqd: 30_000,
            note: 'تسليم الصباح',
            status: 'CONFIRMED' as const,
            createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
            confirmedAt: new Date(Date.now() - 4.5 * 3600_000).toISOString(),
          },
          {
            id: 'ho2',
            amountIqd: 42_000,
            note: null,
            status: 'CONFIRMED' as const,
            createdAt: new Date(Date.now() - 28 * 3600_000).toISOString(),
            confirmedAt: new Date(Date.now() - 27 * 3600_000).toISOString(),
          },
          {
            id: 'ho3',
            amountIqd: 12_000,
            note: 'متبقّي من أمس',
            status: 'PENDING' as const,
            createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
            confirmedAt: null,
          },
        ] satisfies CashHandover[];
      }
      return (await api.get<CashHandover[]>('/drivers/me/cash-handovers')).data;
    },
    staleTime: 30_000,
  });
}

export function useCashHandover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { amountIqd: number; note?: string }) => {
      const { data } = await api.post('/drivers/me/cash-handover', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myCashSummary });
      qc.invalidateQueries({ queryKey: queryKeys.myCashHandovers });
    },
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * EARNINGS OVER TIME
 * Daily series (continuous, zero-filled, ascending) of commission + bonus so
 * the earnings screen can draw a bar chart + animated totals.
 * ────────────────────────────────────────────────────────────────────────── */

export interface EarningsDay {
  date: string; // ISO date (YYYY-MM-DD)
  completedOrders: number;
  commissionIqd: number;
  bonusIqd: number;
}

/** Build a deterministic, zero-filled ascending demo series of `days` length. */
function demoEarnings(days: number): EarningsDay[] {
  const out: EarningsDay[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    // Pseudo-random but stable per day-of-month so the chart looks lively
    // without flickering between renders.
    const seed = (d.getDate() * 37) % 11;
    const isFriday = d.getDay() === 5; // lighter day
    const orders = isFriday ? Math.max(0, seed - 6) : 4 + seed;
    out.push({
      date: d.toISOString().slice(0, 10),
      completedOrders: orders,
      commissionIqd: orders * 250,
      bonusIqd: orders > 8 ? 2_000 : 0,
    });
  }
  return out;
}

export function useMyEarnings(period: 'week' | 'month' = 'week') {
  const demo = useAuth((s) => s.demoMode);
  return useQuery({
    queryKey: [...queryKeys.myEarnings(period), demo],
    queryFn: async () => {
      if (demo) return demoEarnings(period === 'week' ? 7 : 30);
      const { data } = await api.get<EarningsDay[]>('/drivers/me/earnings', {
        params: { period },
      });
      return data;
    },
    staleTime: 60_000,
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * END-OF-SHIFT SUMMARY
 * ────────────────────────────────────────────────────────────────────────── */

export interface ShiftSummary {
  completedOrders: number;
  collectedCashIqd: number;
  byKind: Partial<Record<'REFILL' | 'TANK_DELIVERY' | 'TANK_RECLAIM', number>>;
}

export function useMyShiftSummary() {
  const demo = useAuth((s) => s.demoMode);
  return useQuery({
    queryKey: [...queryKeys.myShiftSummary, demo],
    queryFn: async () => {
      if (demo) {
        return {
          completedOrders: 14,
          collectedCashIqd: 17_000,
          byKind: { REFILL: 11, TANK_DELIVERY: 2, TANK_RECLAIM: 1 },
        } satisfies ShiftSummary;
      }
      return (await api.get<ShiftSummary>('/drivers/me/shift-summary')).data;
    },
    staleTime: 30_000,
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * VAN TANK INVENTORY
 * ────────────────────────────────────────────────────────────────────────── */

export function useUpdateVanInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      tanksFullOnVan: number;
      tanksEmptyOnVan: number;
    }) => {
      const { data } = await api.post('/drivers/me/van-inventory', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myDriverProfile });
    },
  });
}
