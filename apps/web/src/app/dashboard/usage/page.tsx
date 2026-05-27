"use client";

import { useState, useEffect } from "react";
import apiClient from "@/lib/api";
import { BarChart3, TrendingUp, TrendingDown, Zap, Code, MessageSquare, Calendar, Download, CreditCard, RefreshCw } from "lucide-react";

interface UsageResponse {
  period?: string;
  dailyUsage?: UsageData[];
  totalUsage?: {
    tokensUsed: number;
    requests: number;
    cost: number;
  };
  limits?: {
    tokens: number;
    requests: number;
    cost: number;
  };
  quota?: {
    daily: {
      used: number;
      limit: number;
      resetTime: string;
    };
    weekly: {
      used: number;
      limit: number;
      resetTime: string;
    };
    extraBalance: {
      balance: number;
      currency: string;
    };
    autoRecharge: {
      enabled: boolean;
      threshold: number;
      amount: number;
    };
    billingCycle: {
      nextBillingDate: string;
      daysRemaining: number;
    };
  };
}

interface UsageData {
  date: string;
  tokensUsed: number;
  requests: number;
  cost: number;
}

interface CurrentUsage {
  period: string;
  tokensUsed: number;
  tokensLimit: number;
  requestsUsed: number;
  requestsLimit: number;
  costUsed: number;
  costLimit: number;
}

interface UsageQuota {
  daily: {
    used: number;
    limit: number;
    resetTime: string;
  };
  weekly: {
    used: number;
    limit: number;
    resetTime: string;
  };
  extraBalance: {
    balance: number;
    currency: string;
  };
  autoRecharge: {
    enabled: boolean;
    threshold: number;
    amount: number;
  };
  billingCycle: {
    nextBillingDate: string;
    daysRemaining: number;
  };
}

export default function UsagePage() {
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [currentUsage, setCurrentUsage] = useState<CurrentUsage | null>(null);
  const [usageQuota, setUsageQuota] = useState<UsageQuota | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("current");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsageData();
  }, [selectedPeriod]);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.getUsage<UsageResponse>(selectedPeriod);
      
      if (response) {
        setUsageData(response.dailyUsage || []);
        setCurrentUsage({
          period: response.period || 'Current Period',
          tokensUsed: response.totalUsage?.tokensUsed || 0,
          tokensLimit: response.limits?.tokens || 10000,
          requestsUsed: response.totalUsage?.requests || 0,
          requestsLimit: response.limits?.requests || 500,
          costUsed: response.totalUsage?.cost || 0,
          costLimit: response.limits?.cost || 20.00
        });
        
        if (response.quota) {
          setUsageQuota({
            daily: {
              used: response.quota.daily?.used ?? 0,
              limit: response.quota.daily?.limit ?? 1000,
              resetTime: response.quota.daily?.resetTime ?? '00:00 UTC',
            },
            weekly: {
              used: response.quota.weekly?.used ?? 0,
              limit: response.quota.weekly?.limit ?? 5000,
              resetTime: response.quota.weekly?.resetTime ?? 'Monday 00:00 UTC',
            },
            extraBalance: {
              balance: response.quota.extraBalance?.balance ?? 0,
              currency: response.quota.extraBalance?.currency ?? 'credits',
            },
            autoRecharge: {
              enabled: response.quota.autoRecharge?.enabled ?? false,
              threshold: response.quota.autoRecharge?.threshold ?? 1000,
              amount: response.quota.autoRecharge?.amount ?? 5000,
            },
            billingCycle: {
              nextBillingDate: response.quota.billingCycle?.nextBillingDate ?? '2026-06-01',
              daysRemaining: response.quota.billingCycle?.daysRemaining ?? 0,
            },
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch usage data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load usage. Sign in and ensure backend is running.');
      setUsageData([]);
      setCurrentUsage(null);
      setUsageQuota(null);
    } finally {
      setLoading(false);
    }
  };

  const generateMockUsageData = (): UsageData[] => {
    // Return empty data for new user
    return [];
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsageData();
    setRefreshing(false);
  };

  const handlePurchaseUsage = async () => {
    try {
      const response = await apiClient.purchaseUsage(5000);
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
        return;
      }
      if (response.success) {
        alert('Successfully purchased 5000 credits!');
        await fetchUsageData();
      }
    } catch (error) {
      console.error('Failed to purchase usage:', error);
      alert('Failed to purchase usage. Please try again.');
    }
  };

  const handleToggleAutoRecharge = async () => {
    try {
      const newStatus = !usageQuota?.autoRecharge.enabled;
      const response = await apiClient.updateAutoRecharge(newStatus, 1000, 5000);
      
      if (response.success) {
        if (usageQuota) {
          setUsageQuota({
            ...usageQuota,
            autoRecharge: response.autoRecharge
          });
        }
        alert(`Auto-recharge ${newStatus ? 'enabled' : 'disabled'} successfully!`);
      }
    } catch (error) {
      console.error('Failed to toggle auto-recharge:', error);
      alert('Failed to update auto-recharge settings. Please try again.');
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.round((used / limit) * 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage < 50) return "bg-green-500";
    if (percentage < 80) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Usage Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor your API usage, tokens consumed, and associated costs
          </p>
        </div>

        {/* Period Selector */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="current">Current Month</option>
                <option value="last">Last Month</option>
                <option value="3months">Last 3 Months</option>
                <option value="6months">Last 6 Months</option>
                <option value="year">Last Year</option>
              </select>
              <button 
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </button>
          </div>
        </div>

        {/* Xander AI IDE Usage Summary */}
        {usageQuota && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Xander AI IDE Usage Summary</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Next billing cycle</p>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {usageQuota.billingCycle.nextBillingDate}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">Days remaining</p>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {usageQuota.billingCycle.daysRemaining} days
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Usage Quotas */}
        {usageQuota && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Daily Quota */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Daily Quota</h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Resets at {usageQuota.daily.resetTime}
                </span>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Percentage remaining</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {Math.round(((usageQuota.daily.limit - usageQuota.daily.used) / usageQuota.daily.limit) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(usageQuota.daily.used / usageQuota.daily.limit) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {usageQuota.daily.used} of {usageQuota.daily.limit} used
                </span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {usageQuota.daily.limit - usageQuota.daily.used} remaining
                </span>
              </div>
            </div>

            {/* Weekly Quota */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Weekly Quota</h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Resets {usageQuota.weekly.resetTime}
                </span>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Percentage remaining</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {Math.round(((usageQuota.weekly.limit - usageQuota.weekly.used) / usageQuota.weekly.limit) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(usageQuota.weekly.used / usageQuota.weekly.limit) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {usageQuota.weekly.used} of {usageQuota.weekly.limit} used
                </span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {usageQuota.weekly.limit - usageQuota.weekly.used} remaining
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Extra Usage Balance and Auto Recharge */}
        {usageQuota && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Extra Usage Balance */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Extra Usage Balance</h3>
                <CreditCard className="w-5 h-5 text-gray-400" />
              </div>
              <div className="mb-4">
                <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                  {usageQuota.extraBalance.balance.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {usageQuota.extraBalance.currency}
                </p>
              </div>
              <button 
                onClick={handlePurchaseUsage}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Purchase usage
              </button>
            </div>

            {/* Auto Recharge */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Auto Recharge</h3>
                <div className={`w-3 h-3 rounded-full ${usageQuota.autoRecharge.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {usageQuota.autoRecharge.enabled 
                    ? `Auto recharge enabled: ${usageQuota.autoRecharge.amount} credits when balance drops below ${usageQuota.autoRecharge.threshold}`
                    : 'Auto recharge is currently off'
                  }
                </p>
              </div>
              <button 
                onClick={handleToggleAutoRecharge}
                className={`w-full px-4 py-2 rounded-lg flex items-center justify-center ${
                  usageQuota.autoRecharge.enabled 
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {usageQuota.autoRecharge.enabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        )}

        {/* Usage Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Daily Usage Trends</h2>
          
          <div className="h-64 flex items-end justify-between space-x-2">
            {usageData.slice(-30).map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-blue-500 dark:bg-blue-400 rounded-t"
                  style={{ height: `${(data.tokensUsed / 600) * 100}%` }}
                  title={`${data.date}: ${data.tokensUsed} tokens`}
                />
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 rotate-45 origin-left">
                  {new Date(data.date).getDate()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Usage Table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Detailed Usage</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-3 text-sm font-medium text-gray-900 dark:text-white">Date</th>
                  <th className="pb-3 text-sm font-medium text-gray-900 dark:text-white">Tokens Used</th>
                  <th className="pb-3 text-sm font-medium text-gray-900 dark:text-white">Requests</th>
                  <th className="pb-3 text-sm font-medium text-gray-900 dark:text-white">Cost</th>
                  <th className="pb-3 text-sm font-medium text-gray-900 dark:text-white">Model</th>
                </tr>
              </thead>
              <tbody>
                {usageData.slice(-10).reverse().map((data, index) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3 text-sm text-gray-900 dark:text-white">
                      {new Date(data.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-sm text-gray-900 dark:text-white">
                      {data.tokensUsed.toLocaleString()}
                    </td>
                    <td className="py-3 text-sm text-gray-900 dark:text-white">
                      {data.requests}
                    </td>
                    <td className="py-3 text-sm text-gray-900 dark:text-white">
                      ${data.cost.toFixed(2)}
                    </td>
                    <td className="py-3 text-sm text-gray-900 dark:text-white">
                      gpt-4-turbo
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
