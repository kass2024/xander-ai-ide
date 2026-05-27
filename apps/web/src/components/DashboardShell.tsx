"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  User, Bell, Settings, BarChart3, CreditCard, Zap, Shield, Rocket,
  ExternalLink, Download, Sparkles, LogOut, Monitor,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import apiClient from "@/lib/api";

function NavLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
        active
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <Icon className="w-4 h-4 mr-3" />
      {label}
    </Link>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, logout, refreshUser } = useAuthStore();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    refreshUser().catch(() => {});
    apiClient.getNotifications()
      .then((r) => setUnread(r.unreadCount || 0))
      .catch(() => setUnread(0));

    const onFocus = () => {
      refreshUser().catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshUser]);

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/dashboard" className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">Xander AI IDE</span>
            </Link>

            <div className="flex items-center space-x-3">
              <span className="hidden sm:inline text-sm text-gray-500 dark:text-gray-400">
                {user?.email}
              </span>
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                {(user?.plan || 'free').toUpperCase()}
              </span>
              <Link href="/dashboard/notifications" className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900">
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </Link>
              <button
                onClick={() => window.open('https://github.com/xander-ai-ide/releases', '_blank')}
                className="hidden md:flex px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Desktop App
              </button>
              <button onClick={handleLogout} className="p-2 text-gray-600 hover:text-red-600" title="Sign out">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-64 min-h-[calc(100vh-4rem)] border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
          <div className="p-4 space-y-6">
            <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-100 dark:border-blue-800">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white mb-1">
                <Monitor className="w-4 h-4" />
                Desktop Sync
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Sign in on Xander AI IDE with the same account — billing and quota sync automatically.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Account</h3>
              <nav className="space-y-1">
                <NavLink href="/dashboard/profile" icon={User} label="Profile" />
                <NavLink href="/dashboard/notifications" icon={Bell} label="Notifications" />
                <NavLink href="/dashboard/settings" icon={Settings} label="Settings" />
              </nav>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Billing</h3>
              <nav className="space-y-1">
                <NavLink href="/dashboard/usage" icon={BarChart3} label="Usage" />
                <NavLink href="/dashboard/credit-history" icon={CreditCard} label="Credit History" />
                <NavLink href="/dashboard/manage-plan" icon={Zap} label="Manage Plan" />
                <NavLink href="/dashboard/api-keys" icon={Shield} label="API Keys" />
              </nav>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Features</h3>
              <nav className="space-y-1">
                <NavLink href="/dashboard/deploys" icon={Rocket} label="Deploys" />
                <NavLink href="/dashboard/shares" icon={ExternalLink} label="Shares" />
              </nav>
            </div>

            {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Admin</h3>
                <nav className="space-y-1">
                  <NavLink href="/admin/users" icon={User} label="Users" />
                </nav>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
