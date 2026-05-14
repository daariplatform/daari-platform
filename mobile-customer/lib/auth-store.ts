import { create } from 'zustand';
import { api } from './api';
import { clearTokens, getAccessToken, setTokens } from './tokens';
import type { Capability, MeResponse } from './types';

interface AuthState {
  loading: boolean;
  hydrating: boolean;
  user: MeResponse | null;
  capabilities: Capability[];
  /** True when we're showing seeded mock data because no backend is reachable. */
  demoMode: boolean;
  hydrate: () => Promise<void>;
  loginWithOtp: (phone: string, otp: string, fullName?: string) => Promise<void>;
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
      set({ user: data, capabilities: data.capabilities, hydrating: false });
    } catch {
      await clearTokens();
      set({ hydrating: false, user: null });
    }
  },

  async loginWithOtp(phone, otp, fullName) {
    set({ loading: true });
    try {
      const { data } = await api.post('/auth/login/otp', { phone, otp, fullName });
      await setTokens(data.accessToken, data.refreshToken);
      const me = await api.get<MeResponse>('/auth/me');
      set({ user: me.data, capabilities: me.data.capabilities });
    } finally {
      set({ loading: false });
    }
  },

  /**
   * Bypass the backend entirely — handy for showing the app on a phone
   * when there's no API yet. Queries detect demoMode and return seeded
   * data instead of making network calls.
   */
  loginAsDemo() {
    set({
      demoMode: true,
      user: {
        id: 'demo-customer',
        phone: '07710000001',
        role: 'CUSTOMER',
        tenantId: 'demo-tenant',
        capabilities: ['customer'],
      },
      capabilities: ['customer'],
    });
  },

  async logout() {
    await clearTokens();
    set({ user: null, capabilities: [], demoMode: false });
  },
}));
