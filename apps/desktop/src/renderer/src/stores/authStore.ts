import { create } from 'zustand';
import apiClient, { ApiError } from '../lib/api';
import {
  saveCachedUser,
  loadCachedUser,
  clearCachedUser,
  type CachedUser,
} from '../lib/authPersistence';

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
  ensureSession: () => Promise<boolean>;
}

function userFromProfile(profile: Record<string, unknown>): User {
  return {
    id: String(profile.id),
    email: String(profile.email),
    fullName: profile.fullName as string | undefined,
    role: profile.role as string | undefined,
  };
}

function applyCached(set: (p: Partial<AuthState>) => void): CachedUser | null {
  const cached = loadCachedUser();
  if (cached && apiClient.getToken()) {
    set({ user: cached, isAuthenticated: true });
  }
  return cached;
}

async function verifyProfile(): Promise<User | null> {
  const profile = await apiClient.getProfile();
  const user = userFromProfile(profile);
  saveCachedUser(user);
  return user;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: loadCachedUser(),
  isAuthenticated: !!apiClient.getToken(),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const result = await apiClient.login(email, password);
      const user = result.user as User;
      saveCachedUser(user);
      set({
        user,
        isAuthenticated: true,
        loading: false,
        error: null,
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
    clearCachedUser();
    set({ user: null, isAuthenticated: false, error: null });
  },

  loadSession: async () => {
    apiClient.syncTokenFromStorage();
    if (!apiClient.getToken()) {
      clearCachedUser();
      set({ user: null, isAuthenticated: false, loading: false });
      return;
    }

    applyCached(set);
    set({ loading: true, isAuthenticated: true });

    try {
      const user = await verifyProfile();
      set({ user, isAuthenticated: true, loading: false, error: null });
    } catch {
      await apiClient.tryRefreshToken();
      try {
        const user = await verifyProfile();
        set({ user, isAuthenticated: true, loading: false, error: null });
        return;
      } catch {
        /* Stay signed in — only manual Sign Out clears session */
        set({
          user: loadCachedUser(),
          isAuthenticated: true,
          loading: false,
        });
      }
    }
  },

  ensureSession: async () => {
    apiClient.syncTokenFromStorage();
    if (!apiClient.getToken()) {
      set({ user: null, isAuthenticated: false });
      return false;
    }

    applyCached(set);
    set({ isAuthenticated: true });

    try {
      const user = await verifyProfile();
      set({ user, isAuthenticated: true, error: null });
      return true;
    } catch (err) {
      if (err instanceof ApiError && !err.invalidateSession) {
        return true;
      }
      const refreshed = await apiClient.tryRefreshToken();
      if (refreshed) {
        try {
          const user = await verifyProfile();
          set({ user, isAuthenticated: true, error: null });
          return true;
        } catch (retryErr) {
          if (retryErr instanceof ApiError && !retryErr.invalidateSession) {
            return true;
          }
        }
      }
      return true;
    }
  },
}));
