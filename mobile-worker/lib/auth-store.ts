import { create } from 'zustand';
import { api, registerSessionExpiredHandler } from './api';
import { clearTokens, getAccessToken, setTokens } from './tokens';
import type { Capability, MeResponse } from './types';

/**
 * Driver-only auth store. The vendor mode (بائع مستقل) is deferred to
 * phase 2 — when it returns, re-introduce WorkerMode + ModeSwitcher.
 */
interface AuthState {
  loading: boolean;
  hydrating: boolean;
  user: MeResponse | null;
  capabilities: Capability[];
  /** True when we're showing seeded mock data because no backend is reachable. */
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
      set({
        user: me.data,
        capabilities: me.data.capabilities,
        // طفي demo mode بعد الدخول الحقيقي — كانت bug إذا الـ user دخل
        // demo أول ثم login حقيقي، الـ queries كانت لسه ترجع demo data.
        demoMode: false,
      });
    } finally {
      set({ loading: false });
    }
  },

  /**
   * Skips backend entirely and shows the demo dataset for a driver.
   * Visible only in dev builds (gated in login screen via EXPO_PUBLIC_DEMO_MODE / __DEV__).
   */
  loginAsDemo() {
    set({
      demoMode: true,
      capabilities: ['driver'],
      user: {
        id: 'demo-worker',
        phone: '07700000002',
        role: 'DRIVER',
        tenantId: 'demo-tenant',
        capabilities: ['driver'],
      },
    });
  },

  async logout() {
    await clearTokens();
    set({ user: null, capabilities: [], demoMode: false });
  },
}));

// Wire api.ts's 401-refresh-fails callback to our logout(). Without this
// the token would be cleared but `user` would stay in the store, leaving
// the app stuck on inner screens that 401 on every call. After logout,
// _layout's redirect effect kicks in and pushes the user back to login.
registerSessionExpiredHandler(async () => {
  await useAuth.getState().logout();
});
