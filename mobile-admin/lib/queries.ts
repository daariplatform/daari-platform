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

/**
 * Shape returned by GET /plant/usage. Field names mirror the backend
 * (plant.controller.ts `usage()`) — DO NOT rename here without updating
 * the API or this will silently break the subscription pane.
 */
export interface UsageState {
  plan: 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  status: string;
  opsThisMonth: number;
  /** Backend names this `opsLimit`; aliased here for consumer clarity. */
  opsLimit: number;
  /** Pre-computed by the backend; equals (opsThisMonth/opsLimit)*100 clamped. */
  usagePercent: number;
  monthlyPriceIqd: number;
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

// ────────────────────────────────────────────────────────────────────
// Promo campaigns + wallet
// ────────────────────────────────────────────────────────────────────

/**
 * Promo wallet + price-discount campaign system.
 *
 * Money flow:
 *   - Plant owner asks Ahmed to top up their promo wallet (off-platform).
 *   - Owner creates a campaign with a discounted price + window (1–48h).
 *   - On every order that completes at the promo price, 1,000 د.ع is
 *     deducted from the wallet. When the wallet hits zero, the backend
 *     auto-flips status → OUT_OF_BUDGET.
 *   - Owner can pause early; no refunds.
 *
 * Live stats refetch on a 60s interval so the "active campaign" card
 * shows fresh order/revenue numbers without a manual pull-to-refresh.
 */

export type PromoCampaignStatus =
  | 'ACTIVE'
  | 'PAUSED_BY_OWNER'
  | 'EXPIRED'
  | 'OUT_OF_BUDGET';

export interface PromoCampaign {
  id: string;
  originalPriceIqd: number;
  promoPriceIqd: number;
  costPerOrderIqd: number;
  startAt: string;
  endAt: string;
  status: PromoCampaignStatus;
  walletBalanceAtStartIqd: number;
  pushSentCount: number;
  pushFailedCount: number;
  orderCount: number;
  totalDeductedIqd: number;
  totalRevenueIqd: number;
  createdAt: string;
}

export interface PromosListResult {
  walletBalanceIqd: number;
  campaigns: PromoCampaign[];
}

export function usePromos() {
  return useQuery({
    queryKey: ['plant', 'promos'],
    queryFn: async () => (await api.get<PromosListResult>('/plant/promos')).data,
    refetchInterval: 60_000,
  });
}

export function useCreatePromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { promoPriceIqd: number; durationHours: number }) => {
      const { data } = await api.post<PromoCampaign>('/plant/promos', input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plant', 'promos'] }),
  });
}

export function usePausePromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<PromoCampaign>(`/plant/promos/${id}/pause`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plant', 'promos'] }),
  });
}

// ────────────────────────────────────────────────────────────────────
// Tanks — operations management (CRUD + assign/reclaim + inventory)
// ────────────────────────────────────────────────────────────────────

export interface TankRow {
  id: string;
  qrCode: string;
  serialNumber: string;
  capacity: 'L350' | 'L500';
  status: 'IN_PLANT' | 'ASSIGNED' | 'AT_RISK' | 'RECLAIMED' | 'DAMAGED';
  customerId: string | null;
  customerName?: string;
}

export interface TanksListResult {
  items: TankRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TankInventory {
  inPlant: number;
  assigned: number;
  atRisk: number;
  reclaimed: number;
  damaged: number;
}

export function useTanks(opts: { page?: number; pageSize?: number; status?: string }) {
  const { page = 1, pageSize = 50, status } = opts;
  return useQuery({
    queryKey: ['tanks', 'list', page, pageSize, status ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize };
      if (status) params.status = status;
      const { data } = await api.get<TanksListResult>('/tanks', { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useTankInventory() {
  return useQuery({
    queryKey: ['tanks', 'inventory'],
    queryFn: async () => {
      const { data } = await api.get<TankInventory>('/tanks/inventory');
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCreateTank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      capacity: 'L350' | 'L500';
      qrCode: string;
      serialNumber: string;
    }) => {
      const { data } = await api.post<TankRow>('/tanks', input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tanks'] });
    },
  });
}

export function useAssignTank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tankId: string; customerId: string }) => {
      const { data } = await api.post<TankRow>(`/tanks/${input.tankId}/assign`, {
        customerId: input.customerId,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tanks'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useReclaimTank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tankId: string; reason: string; notes?: string }) => {
      const { data } = await api.post<TankRow>(`/tanks/${input.tankId}/reclaim`, {
        reason: input.reason,
        notes: input.notes,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tanks'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

// ────────────────────────────────────────────────────────────────────
// Drivers — admin (CRUD + live tracking + performance)
//
// `useDriversList` already exists above (lightweight, used by other
// screens). `useDriversAdmin` is the paginated CRUD version used by
// the operations management screen — keep both, the lighter list is
// still useful for the assign-driver picker.
// ────────────────────────────────────────────────────────────────────

export interface DriverRow {
  id: string;
  fullName: string;
  phone: string;
  status: string;
  lastLocationAt: string | null;
  isOnline: boolean;
}

export interface DriversAdminListResult {
  items: DriverRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DriverPerf {
  completedOrders: number;
  revenue: number;
  bonus: number;
  avgCompletionMin: number;
}

export interface LiveDriver {
  id: string;
  fullName: string;
  lat: number;
  lng: number;
  lastSeen: string;
  activeOrderId: string | null;
}

export function useDriversAdmin(opts: { page?: number; pageSize?: number }) {
  const { page = 1, pageSize = 50 } = opts;
  return useQuery({
    queryKey: ['drivers', 'list', page, pageSize],
    queryFn: async () => {
      const { data } = await api.get<DriversAdminListResult>('/drivers', {
        params: { page, pageSize },
      });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useDriverPerf(driverId: string | undefined, period: 'week' | 'month') {
  return useQuery({
    queryKey: ['drivers', 'perf', driverId, period],
    queryFn: async () => {
      const { data } = await api.get<DriverPerf>(`/drivers/${driverId}/perf`, {
        params: { period },
      });
      return data;
    },
    enabled: !!driverId,
  });
}

export function useDriversLive() {
  return useQuery({
    queryKey: ['drivers', 'live'],
    queryFn: async () => {
      const { data } = await api.get<LiveDriver[]>('/drivers/live');
      return data;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useCreateDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      phone: string;
      fullName: string;
      baseCommissionPct: number;
      salaryIqd: number;
    }) => {
      const { data } = await api.post<DriverRow>('/drivers', input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
}

export function useUpdateDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      driverId: string;
      status?: string;
      salaryIqd?: number;
      baseCommissionPct?: number;
    }) => {
      const { driverId, ...patch } = input;
      const { data } = await api.patch<DriverRow>(`/drivers/${driverId}`, patch);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
}

export function useDeleteDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (driverId: string) => {
      const { data } = await api.delete(`/drivers/${driverId}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
}

// ────────────────────────────────────────────────────────────────────
// Notifications inbox
// ────────────────────────────────────────────────────────────────────

/**
 * Inbox of system notifications surfaced to the plant admin (low-stock
 * alarms, new-lead approvals, system broadcasts). Same payload that push
 * tries to deliver, but persisted server-side so the admin can catch up
 * if their device was off or they cleared the notification tray.
 */
export interface InboxNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  data: Record<string, any>;
}

export interface InboxResult {
  items: InboxNotification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  unreadCount: number;
}

export function useNotificationsInbox(opts: {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}) {
  const { page = 1, pageSize = 50, unreadOnly = false } = opts;
  return useQuery({
    queryKey: ['notifications', 'inbox', page, pageSize, unreadOnly],
    queryFn: async () => {
      const { data } = await api.get<InboxResult>('/notifications/inbox', {
        params: { page, pageSize, unreadOnly },
      });
      return data;
    },
    placeholderData: keepPreviousData,
    // Refetch quietly every minute so the unread dot stays current while
    // the admin is on this screen.
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/notifications/${id}/mark-read`);
      return data;
    },
    // Optimistic patch: we flip readAt locally on every cached inbox page
    // so the bold-title + teal-dot states clear instantly. The server
    // round-trip is fire-and-forget from the user's perspective.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['notifications', 'inbox'] });
      const snapshots = qc.getQueriesData<InboxResult>({
        queryKey: ['notifications', 'inbox'],
      });
      snapshots.forEach(([key, value]) => {
        if (!value) return;
        let unreadDelta = 0;
        const nextItems = value.items.map((n) => {
          if (n.id === id && !n.readAt) {
            unreadDelta = 1;
            return { ...n, readAt: new Date().toISOString() };
          }
          return n;
        });
        qc.setQueryData<InboxResult>(key, {
          ...value,
          items: nextItems,
          unreadCount: Math.max(0, (value.unreadCount ?? 0) - unreadDelta),
        });
      });
      return { snapshots };
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshots.forEach(([key, value]) => qc.setQueryData(key, value));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'inbox'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/notifications/mark-all-read');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'inbox'] });
    },
  });
}

// ────────────────────────────────────────────────────────────────────
// Audit log
// ────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  before: any;
  after: any;
  createdAt: string;
}

export interface AuditListResult {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useAuditLog(opts: {
  page?: number;
  pageSize?: number;
  actor?: string;
  action?: string;
}) {
  const { page = 1, pageSize = 50, actor, action } = opts;
  return useQuery({
    queryKey: ['plant', 'audit', page, pageSize, actor ?? 'all', action ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize };
      if (actor) params.actor = actor;
      if (action) params.action = action;
      const { data } = await api.get<AuditListResult>('/plant/audit-log', { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

// ────────────────────────────────────────────────────────────────────
// Team management
// ────────────────────────────────────────────────────────────────────

export type TeamRole = 'OWNER' | 'MANAGER' | 'ACCOUNTANT';

export interface TeamMember {
  id: string;
  fullName: string;
  phone: string;
  role: TeamRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface InvitedTeamMember {
  user: TeamMember;
  tempPassword: string;
}

export function useTeam() {
  return useQuery({
    queryKey: ['plant', 'team'],
    queryFn: async () => {
      const { data } = await api.get<TeamMember[]>('/plant/team');
      return data;
    },
  });
}

export function useInviteTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      phone: string;
      fullName: string;
      role: 'MANAGER' | 'ACCOUNTANT';
    }) => {
      const { data } = await api.post<InvitedTeamMember>('/plant/team', input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plant', 'team'] }),
  });
}

export function useUpdateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      isActive?: boolean;
      role?: 'MANAGER' | 'ACCOUNTANT';
    }) => {
      const { userId, ...patch } = input;
      const { data } = await api.patch<TeamMember>(`/plant/team/${userId}`, patch);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plant', 'team'] }),
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.delete(`/plant/team/${userId}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plant', 'team'] }),
  });
}

// ────────────────────────────────────────────────────────────────────
// Home dashboard — trends + insights + activity feed
//
// These three power the upgraded home screen (sparkline section,
// "نظرة سريعة" insight cards, "آخر النشاط" feed). All three degrade to
// empty/null on 404 so the home renders correctly even if the backend
// endpoints haven't shipped yet.
// ────────────────────────────────────────────────────────────────────

/**
 * 7-day revenue trend, one entry per day, oldest → newest. Backed by
 * `GET /plant/reports/revenue-7d`. The home sparkline is the only current
 * consumer; we keep a 5-min stale window because trend data doesn't need
 * to be second-fresh and we want to avoid refetch thrash when the user
 * bounces between tabs.
 */
export interface RevenueDay {
  date: string;
  revenueIqd: number;
  orders: number;
}

export function useRevenue7d() {
  return useQuery({
    queryKey: ['plant', 'revenue-7d'],
    queryFn: async (): Promise<RevenueDay[]> => {
      try {
        const { data } = await api.get<RevenueDay[]>('/plant/reports/revenue-7d');
        return Array.isArray(data) ? data : [];
      } catch (err: any) {
        // Backend may not yet expose this; treat 404 as "no data" so the
        // home dashboard degrades to an empty sparkline + "—" stats
        // instead of an error banner.
        if (err?.response?.status === 404) return [];
        throw err;
      }
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Daily "نظرة سريعة" tiles — best driver, top customer, peak hour, weekly
 * growth. Refetches once a minute so the values feel live without
 * hammering the API.
 */
export interface DailyInsights {
  bestDriver: { id: string; fullName: string; completedOrders: number } | null;
  topCustomer: { id: string; fullName: string; totalSpendIqd: number } | null;
  peakHourToday: number | null;
  growthVsLastWeekPct: number;
}

export function useDailyInsights() {
  return useQuery({
    queryKey: ['plant', 'insights'],
    queryFn: async (): Promise<DailyInsights | null> => {
      try {
        const { data } = await api.get<DailyInsights>('/plant/reports/insights');
        return data;
      } catch (err: any) {
        if (err?.response?.status === 404) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

/**
 * Activity feed — last N events across the plant (orders, leads, stock,
 * drivers). Used by the home dashboard's "آخر النشاط" section. We refetch
 * every minute so the feed stays close to real-time without needing a
 * WebSocket.
 */
export interface ActivityEvent {
  id: string;
  kind: 'order' | 'lead' | 'stock' | 'driver';
  title: string;
  subtitle: string;
  createdAt: string;
  deeplink?: string;
}

export function useActivityFeed(limit = 8) {
  return useQuery({
    queryKey: ['plant', 'activity', limit],
    queryFn: async (): Promise<ActivityEvent[]> => {
      try {
        const { data } = await api.get<ActivityEvent[]>('/plant/activity-feed', {
          params: { limit },
        });
        return Array.isArray(data) ? data : [];
      } catch (err: any) {
        if (err?.response?.status === 404) return [];
        throw err;
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ────────────────────────────────────────────────────────────────────
// Accounting — P&L summary, transactions, expense recording
// ────────────────────────────────────────────────────────────────────

/**
 * Accounting period selector. Mirrors the values the backend accepts as the
 * `?period=` query param on `/accounting/summary`. Keep this union in sync
 * with the controller — anything else triggers a 400.
 */
export type AccountingPeriod = 'today' | 'week' | 'month' | 'year';

export interface AccountingSummary {
  revenue: number;
  expenses: number;
  netProfit: number;
  /** Growth percent vs the previous comparable period. May be negative. */
  growthPct: number;
}

export function useAccountingSummary(period: AccountingPeriod) {
  return useQuery({
    queryKey: ['accounting', 'summary', period],
    queryFn: async () => {
      const { data } = await api.get<AccountingSummary>('/accounting/summary', {
        params: { period },
      });
      return data;
    },
    staleTime: 30_000,
  });
}

export type AccountingTxKind = 'sale' | 'expense' | 'salary';
export type AccountingTxFilter = 'all' | AccountingTxKind;

export interface AccountingTransaction {
  id: string;
  kind: AccountingTxKind;
  /** Signed amount: positive for sales, negative for expenses/salaries. */
  amountIqd: number;
  note: string | null;
  createdAt: string;
  /** Driver name on sales, owner name on expenses, etc. — optional. */
  actorName?: string | null;
}

export interface AccountingTransactionsResult {
  items: AccountingTransaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useAccountingTransactions(opts: {
  kind?: AccountingTxFilter;
  page?: number;
  pageSize?: number;
}) {
  const { kind = 'all', page = 1, pageSize = 50 } = opts;
  return useQuery({
    queryKey: ['accounting', 'transactions', kind, page, pageSize],
    queryFn: async () => {
      const { data } = await api.get<AccountingTransactionsResult>(
        '/accounting/transactions',
        { params: { kind, page, pageSize } },
      );
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { amountIqd: number; category: string; note?: string }) => {
      const { data } = await api.post<AccountingTransaction>('/accounting/expense', input);
      return data;
    },
    onSuccess: () => {
      // Expenses invalidate every cached accounting view + the home KPIs
      // (net-profit ripples up). We DO NOT invalidate orders — expenses are
      // a separate ledger and shouldn't refetch the order list pointlessly.
      qc.invalidateQueries({ queryKey: ['accounting'] });
      qc.invalidateQueries({ queryKey: ['plant', 'kpis'] });
    },
  });
}

// ────────────────────────────────────────────────────────────────────
// Reports — top customers/drivers, peak hours
//
// `useRevenue7d` (the 7-day revenue trend) lives in the "Home dashboard"
// section above — same endpoint, with a 404-safe fallback so the home
// sparkline degrades gracefully when the backend hasn't shipped yet.
// Reusing it from here keeps both consumers on the same cache entry.
// ────────────────────────────────────────────────────────────────────

export interface TopCustomer {
  id: string;
  fullName: string;
  totalSpendIqd: number;
  orderCount: number;
}

// Backend ships these rows with `customerId` + `spentIqd` (groupBy semantics),
// not `id` + `totalSpendIqd`. Normalize at the edge so all UI consumers get
// the camel shape they expect — this also stabilizes `key={c.id}` in lists
// (otherwise key=undefined → React warnings + reconciliation bugs).
interface TopCustomerWire {
  customerId: string;
  fullName: string;
  phone: string | null;
  district: string | null;
  spentIqd: number;
  orderCount: number;
}

export function useTopCustomers(limit = 5) {
  return useQuery({
    queryKey: ['plant', 'reports', 'top-customers', limit],
    queryFn: async () => {
      const { data } = await api.get<TopCustomerWire[]>('/plant/reports/top-customers', {
        params: { limit },
      });
      return data.map<TopCustomer>((r) => ({
        id: r.customerId,
        fullName: r.fullName,
        totalSpendIqd: r.spentIqd,
        orderCount: r.orderCount,
      }));
    },
    staleTime: 60_000,
  });
}

export interface TopDriver {
  id: string;
  fullName: string;
  completedOrders: number;
  revenueIqd: number;
}

// Backend returns `driverId` + extra fields; normalize for the list UI.
interface TopDriverWire {
  driverId: string;
  fullName: string;
  phone: string | null;
  vehiclePlate: string | null;
  completedOrders: number;
  revenueIqd: number;
  bonusIqd: number;
}

export function useTopDrivers(limit = 5) {
  return useQuery({
    queryKey: ['plant', 'reports', 'top-drivers', limit],
    queryFn: async () => {
      const { data } = await api.get<TopDriverWire[]>('/plant/reports/top-drivers', {
        params: { limit },
      });
      return data.map<TopDriver>((r) => ({
        id: r.driverId,
        fullName: r.fullName,
        completedOrders: r.completedOrders,
        revenueIqd: r.revenueIqd,
      }));
    },
    staleTime: 60_000,
  });
}

export interface PeakHourBucket {
  /** 0..23 — hour of day in plant's local timezone (backend already converts). */
  hour: number;
  orderCount: number;
}

export function usePeakHours() {
  return useQuery({
    queryKey: ['plant', 'reports', 'peak-hours'],
    queryFn: async () => {
      const { data } = await api.get<PeakHourBucket[]>('/plant/reports/peak-hours');
      return data;
    },
    staleTime: 60_000,
  });
}

// ────────────────────────────────────────────────────────────────────
// Onboarding wizard — shown on first launch to brand-new plants
//
// The dashboard with all zeros looks broken to a brand-new owner; instead
// we run a 5-step "set up your plant" flow that primes name/city/coords,
// refill price, working hours, and pushes the owner to add their first
// customer + first driver. After completing (or explicitly skipping) the
// backend flips a flag and the root layout stops redirecting here.
// ────────────────────────────────────────────────────────────────────

export interface OnboardingStatus {
  plantInfoComplete: boolean;
  firstCustomerAdded: boolean;
  firstDriverHired: boolean;
  refillPriceSet: boolean;
  workingHoursSet: boolean;
  allComplete: boolean;
  skipped: boolean;
}

export function useOnboardingStatus() {
  return useQuery({
    queryKey: ['plant', 'onboarding'],
    queryFn: async () => {
      const { data } = await api.get<OnboardingStatus>('/plant/onboarding/status');
      return data;
    },
    staleTime: 60_000,
    // Don't retry — if the backend route is missing on an older deploy we
    // let the redirect logic treat the empty response as "no redirect needed"
    // rather than blocking the user behind retry storms.
    retry: 0,
  });
}

export function useSkipOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/plant/onboarding/skip');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plant', 'onboarding'] });
    },
  });
}

/**
 * Patch tenant-owned settings (name, city, coverage coords, price, hours).
 * Backend exposes this at `/tenants/me/settings` (verified against
 * tenants.controller.ts). The onboarding spec said `/tenants/me` but
 * that route doesn't exist — using the real one.
 */
export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<{
        name: string;
        city: string;
        coverageLng: number;
        coverageLat: number;
        refillPriceIqd: number;
        workingHoursStart: string;
        workingHoursEnd: string;
      }>,
    ) => {
      const { data } = await api.patch('/tenants/me/settings', input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plant', 'onboarding'] });
      qc.invalidateQueries({ queryKey: ['plant-settings'] });
    },
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      fullName: string;
      phone: string;
      district: string;
      addressLine: string;
      locationLng?: number;
      locationLat?: number;
    }) => {
      const { data } = await api.post<CustomerProfile>('/customers', input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['plant', 'kpis'] });
      qc.invalidateQueries({ queryKey: ['plant', 'onboarding'] });
    },
  });
}
