import { create } from 'zustand';
import apiClient from '@/lib/api';
import { mapToDashboardUser } from '@/lib/user-mapper';
import type { AuthUser, DashboardUser } from '@/lib/types';

interface AuthState {
  user: DashboardUser | null;
  authUser: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  authUser: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      set({ initialized: true, user: null, authUser: null });
      return;
    }
    apiClient.setToken(token);
    try {
      await get().refreshUser();
    } catch {
      apiClient.clearToken();
      set({ user: null, authUser: null });
    } finally {
      set({ initialized: true });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const result = await apiClient.login(email, password);
      apiClient.setToken(result.access_token);
      set({
        authUser: result.user,
        user: mapToDashboardUser(result.user as unknown as Record<string, unknown>),
      });
      await get().refreshUser();
    } finally {
      set({ loading: false });
    }
  },

  register: async (email, password, fullName) => {
    set({ loading: true });
    try {
      await apiClient.register(email, password, fullName);
    } finally {
      set({ loading: false });
    }
  },

  logout: () => {
    apiClient.clearToken();
    set({ user: null, authUser: null });
  },

  refreshUser: async () => {
    const [me, subscription, analytics] = await Promise.all([
      apiClient.getMe(),
      apiClient.getCurrentSubscription().catch(() => null),
      apiClient.getAnalytics().catch(() => null),
    ]);
    set({
      authUser: me as unknown as AuthUser,
      user: mapToDashboardUser(
        me as Record<string, unknown>,
        subscription as Record<string, unknown> | null,
        analytics as Record<string, unknown> | null,
      ),
    });
  },
}));
