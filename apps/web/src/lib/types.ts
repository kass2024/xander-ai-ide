export type PlanTier = 'free' | 'pro' | 'enterprise';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string | null;
  role?: string;
  avatar?: string | null;
}

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan: PlanTier;
  role?: string;
  streak: number;
  recordStreak: number;
  linesWritten: number;
  totalLines: number;
  joinDate: string;
  lastLoginAt?: string;
}

export interface UserSettings {
  theme: string;
  language: string;
  autoSave: boolean;
  autoRecharge: boolean;
  notifications: boolean;
  aiModel: string;
  maxTokens: number;
}

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}
