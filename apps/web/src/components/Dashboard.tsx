"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import apiClient from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { ArrowUpRight, Activity } from "lucide-react";

interface ContributionData {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [contributions, setContributions] = useState<ContributionData[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('3months');
  const [usageSummary, setUsageSummary] = useState<{ requests?: number; tokensUsed?: number; cost?: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [contributionsData, usage] = await Promise.all([
          apiClient.getContributions(selectedPeriod),
          apiClient.getUsage().catch(() => null),
        ]);
        setContributions((contributionsData || []) as ContributionData[]);
        const total = (usage as { totalUsage?: { requests?: number; tokensUsed?: number; cost?: number } })?.totalUsage;
        setUsageSummary(total || null);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedPeriod]);

  if (loading || !user) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{user.name}</h1>
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                {user.plan.toUpperCase()}
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
            <p className="text-sm text-gray-500 mt-1">Billing & quota sync with Xander AI IDE desktop</p>
          </div>
          <div className="text-right">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{user.streak} day streak</span>
              <span className="text-sm text-gray-500">(record {user.recordStreak})</span>
            </div>
            <Link href="/dashboard/manage-plan" className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              Manage Plan
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-sm text-gray-500">Requests (period)</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{usageSummary?.requests ?? 0}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-sm text-gray-500">Tokens used</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{(usageSummary?.tokensUsed ?? 0).toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-sm text-gray-500">Cost</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">${(usageSummary?.cost ?? 0).toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5" /> Account Activity
          </h2>
          <Link href="/dashboard/usage" className="text-sm text-blue-600 hover:text-blue-700 flex items-center">
            View usage <ArrowUpRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">Contribution activity</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1 bg-white dark:bg-gray-800"
            >
              <option value="3months">Last 3 months</option>
              <option value="6months">Last 6 months</option>
              <option value="1year">Last year</option>
            </select>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {user.linesWritten.toLocaleString()} lines written by Xander AI IDE
          </h3>

          {contributions.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              No activity yet. Use Xander AI IDE to start building your contribution graph.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {contributions.slice(0, 120).map((c, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-sm ${
                    c.level === 0 ? 'bg-gray-100 dark:bg-gray-800' :
                    c.level === 1 ? 'bg-green-200 dark:bg-green-900' :
                    c.level === 2 ? 'bg-green-300 dark:bg-green-700' :
                    c.level === 3 ? 'bg-green-400 dark:bg-green-600' : 'bg-green-500'
                  }`}
                  title={`${c.date}: ${c.count}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
