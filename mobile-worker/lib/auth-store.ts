import { create } from 'zustand';
import { api } from './api';
import { clearTokens, getAccessToken, setTokens } from './tokens';
import type { Capability, MeResponse } from './types';

type WorkerMode = 'driver' | 'vendor';

interface AuthState {
  loading: boolean;
  hydrating: boolean;
  user: MeResponse | null;
  capabilities: Capability[];
  currentMode: WorkerMode | null;
  /** True when we're showing seeded mock data because no backend is reachable. */
  demoMode: boolean;
  hydrate: () => Promise<void>;
  loginWithPassword: (phone: string, password: string) => Promise<void>;
  loginWithOtp: (phone: string, otp: string, fullName?: string) => Promise<void>;
  loginAsDemo: (mode: WorkerMode) => void;
  setMode: (mode: WorkerMode) => void;
  logout: () => Promise<void>;
}

function pickDefaultMode(caps: Capability[]): WorkerMode | null {
  if (caps.includes('driver')) return 'driver';
  if (caps.includes('vendor')) return 'vendor';
  return null;
}

export const useAuth = create<AuthState>((set) => ({
  loading: false,
  hydrating: true,
  user: null,
  capabilities: [],
  currentMode: null,
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
        currentMode: pickDefaultMode(data.capabilities),
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
        currentMode: pickDefaultMode(me.data.capabilities),
      });
    } finally {
      set({ loading: false });
    }
  },

  async loginWithOtp(phone, otp, fullName) {
    set({ loading: true });
    try {
      const { data } = await api.post('/auth/login/otp', { phone, otp, fullName });
      await setTokens(data.accessToken, data.refreshToken);
      const me = await api.get<MeResponse>('/auth/me');
      set({
        user: me.data,
        capabilities: me.data.capabilities,
        currentMode: pickDefaultMode(me.data.capabilities),
      });
    } finally {
      set({ loading: false });
    }
  },

  /**
   * Skips backend entirely and shows the demo dataset. Both 'driver' and
   * 'vendor' capabilities are granted so the user can flip the mode
   * switcher inside the worker UI.
   */
  loginAsDemo(mode) {
    set({
      demoMode: true,
      currentMode: mode,
      capabilities: ['driver', 'vendor'],
      user: {
        id: 'demo-worker',
        phone: '07700000002',
        role: 'DRIVER',
        tenantId: 'demo-tenant',
        capabilities: ['driver', 'vendor'],
      },
    });
  },

  setMode(mode) {
    set({ currentMode: mode });
  },

  async logout() {
    await clearTokens();
    set({ user: null, capabilities: [], currentMode: null, demoMode: false });
  },
}));
