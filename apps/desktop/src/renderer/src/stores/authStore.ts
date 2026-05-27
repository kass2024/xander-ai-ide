import { create } from 'zustand';
import apiClient from '../lib/api';

interface User {
  id: string;
  email: string;
  fullName?: string;
  role?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!apiClient.getToken(),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const result = await apiClient.login(email, password);
      set({
        user: result.user as User,
        isAuthenticated: true,
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Login failed',
        loading: false,
      });
      throw err;
    }
  },

  logout: () => {
    apiClient.clearToken();
    set({ user: null, isAuthenticated: false, error: null });
  },

  loadSession: async () => {
    if (!apiClient.getToken()) return;
    set({ loading: true });
    try {
      const user = await apiClient.getProfile();
      set({ user: user as User, isAuthenticated: true, loading: false });
    } catch {
      apiClient.clearToken();
      set({ user: null, isAuthenticated: false, loading: false });
    }
  },
}));
