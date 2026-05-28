import { create } from 'zustand';
import { api, registerSessionExpiredHandler } from './api';
import { clearTokens, getAccessToken, setTokens } from './tokens';
import type { Capability, MeResponse } from './types';

/**
 * Admin-side roles the app accepts. Drivers (DRIVER) and customers
 * (CUSTOMER) use their own dedicated apps — let them through here would
 * confuse them with a UI that shows zero data for their role. PLATFORM_ADMIN
 * is the Phi-Bit super-user (Ahmed), useful for support sessions.
 */
const ADMIN_ROLES = new Set(['OWNER', 'MANAGER', 'ACCOUNTANT', 'PLATFORM_ADMIN']);

export class WrongRoleError extends Error {
  constructor(public role: string) {
    super(`دور "${role}" غير مخوّل للوصول إلى تطبيق المعمل`);
    this.name = 'WrongRoleError';
  }
}

interface AuthState {
  loading: boolean;
  hydrating: boolean;
  user: MeResponse | null;
  capabilities: Capability[];
  /** Shown when no backend reachable AND dev profile lets us. */
  demoMode: boolean;
  hydrate: () => Promise<void>;
  loginWithPassword: (phone: string, password: string) => Promise<void>;
  loginAsDemo: () => void;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  loading: false,
  hydrating: true,
  user: null,
  capabilities: [],
  demoMode: false,

  async hydrate() {
    set({ hydrating: true });
    try {
      const token = await getAccessToken();
      if (!token) {
        set({ hydrating: false, user: null });
        return;
      }
      const { data } = await api.get<MeResponse>('/auth/me');
      // Belt-and-suspenders: if a non-admin session somehow survives (e.g.
      // the user re-installed after a role change on the backend), reject.
      if (!ADMIN_ROLES.has(data.role)) {
        await clearTokens();
        set({ hydrating: false, user: null });
        return;
      }
      set({
        user: data,
        capabilities: data.capabilities,
        hydrating: false,
      });
    } catch {
      await clearTokens();
      set({ hydrating: false, user: null });
    }
  },

  async loginWithPassword(phone, password) {
    set({ loading: true });
    try {
      const { data } = await api.post('/auth/login', { phone, password });
      await setTokens(data.accessToken, data.refreshToken);
      const me = await api.get<MeResponse>('/auth/me');
      if (!ADMIN_ROLES.has(me.data.role)) {
        // Clean up — this user authenticated successfully but isn't for
        // this app. Bounce them and clear the token so they don't get
        // mid-app crashes from missing data.
        await clearTokens();
        throw new WrongRoleError(me.data.role);
      }
      set({
        user: me.data,
        capabilities: me.data.capabilities,
        demoMode: false,
      });
    } finally {
      set({ loading: false });
    }
  },

  /**
   * Dev-only: skip the backend and show seeded plant-admin data so designers
   * can iterate on the UI without a running API. Gated in login screen.
   */
  loginAsDemo() {
    set({
      demoMode: true,
      capabilities: ['plant_admin'],
      user: {
        id: 'demo-admin',
        phone: '07700000003',
        role: 'OWNER',
        tenantId: 'demo-tenant',
        capabilities: ['plant_admin'],
      },
    });
  },

  async logout() {
    await clearTokens();
    // Drop the biometric-enabled flag too — otherwise the next person
    // to pick up this device would land on the password screen and be
    // offered a Face ID prompt that bypasses their own login. The
    // active user must explicitly re-enable after logging in again.
    const { disableBiometricUnlock } = await import('./biometric');
    await disableBiometricUnlock();
    set({ user: null, capabilities: [], demoMode: false });
  },
}));

registerSessionExpiredHandler(async () => {
  await useAuth.getState().logout();
});
