import { DashboardUser, PlanTier } from './types';

function normalizePlan(slug?: string | null): PlanTier {
  if (!slug) return 'free';
  const s = slug.toLowerCase();
  if (s.includes('enterprise')) return 'enterprise';
  if (s.includes('pro')) return 'pro';
  return 'free';
}

export function mapToDashboardUser(
  user: Record<string, unknown>,
  subscription?: Record<string, unknown> | null,
  analytics?: Record<string, unknown> | null,
): DashboardUser {
  const planObj = subscription?.plan as Record<string, unknown> | undefined;
  const streakData = analytics?.streakData as { current?: number; record?: number } | undefined;

  return {
    id: String(user.id),
    name: String(user.fullName || user.name || user.email || 'User'),
    email: String(user.email),
    avatar: user.avatar ? String(user.avatar) : undefined,
    plan: normalizePlan(String(user.plan || planObj?.id || planObj?.slug || 'free')),
    role: user.role ? String(user.role) : undefined,
    streak: Number(user.currentStreak ?? streakData?.current ?? 0),
    recordStreak: Number(user.recordStreak ?? streakData?.record ?? 0),
    linesWritten: Number(user.totalLinesWritten ?? analytics?.totalLinesWritten ?? 0),
    totalLines: Number(user.totalLinesWritten ?? analytics?.totalLinesWritten ?? 0),
    joinDate: String(user.createdAt || user.joinDate || new Date().toISOString()),
    lastLoginAt: user.lastLoginAt ? String(user.lastLoginAt) : undefined,
  };
}
