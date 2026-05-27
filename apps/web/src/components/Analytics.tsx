"use client";

import { useState } from "react";
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  TrendingUp, 
  TrendingDown,
  Users,
  Zap,
  Code,
  MessageSquare,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  Activity,
  Clock,
  Target,
  Award,
  Globe
} from "lucide-react";

interface AnalyticsData {
  period: string;
  metrics: {
    tokens: number;
    completions: number;
    users: number;
    messages: number;
  };
  trends: {
    tokens: number;
    completions: number;
    users: number;
    messages: number;
  };
}

export default function Analytics() {
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('tokens');

  const analyticsData: Record<string, AnalyticsData> = {
    '24h': {
      period: 'Last 24 hours',
      metrics: {
        tokens: 1247,
        completions: 89,
        users: 12,
        messages: 156
      },
      trends: {
        tokens: 15.3,
        completions: 8.7,
        users: -2.1,
        messages: 22.4
      }
    },
    '7d': {
      period: 'Last 7 days',
      metrics: {
        tokens: 8542,
        completions: 623,
        users: 45,
        messages: 892
      },
      trends: {
        tokens: 12.5,
        completions: 8.2,
        users: 15.8,
        messages: 18.9
      }
    },
    '30d': {
      period: 'Last 30 days',
      metrics: {
        tokens: 34256,
        completions: 2487,
        users: 128,
        messages: 3567
      },
      trends: {
        tokens: 28.4,
        completions: 31.2,
        users: 42.1,
        messages: 25.7
      }
    }
  };

  const currentData = analyticsData[selectedPeriod];

  const metricCards = [
    {
      key: 'tokens',
      label: 'AI Tokens Used',
      value: currentData.metrics.tokens.toLocaleString(),
      icon: Zap,
      color: 'blue',
      format: 'number'
    },
    {
      key: 'completions',
      label: 'Code Completions',
      value: currentData.metrics.completions.toLocaleString(),
      icon: Code,
      color: 'purple',
      format: 'number'
    },
    {
      key: 'users',
      label: 'Active Users',
      value: currentData.metrics.users.toLocaleString(),
      icon: Users,
      color: 'green',
      format: 'number'
    },
    {
      key: 'messages',
      label: 'AI Messages',
      value: currentData.metrics.messages.toLocaleString(),
      icon: MessageSquare,
      color: 'orange',
      format: 'number'
    }
  ];

  const chartData = [
    { name: 'Mon', tokens: 1200, completions: 89, users: 12, messages: 156 },
    { name: 'Tue', tokens: 1456, completions: 102, users: 15, messages: 189 },
    { name: 'Wed', tokens: 1389, completions: 95, users: 14, messages: 178 },
    { name: 'Thu', tokens: 1567, completions: 112, users: 16, messages: 201 },
    { name: 'Fri', tokens: 1234, completions: 87, users: 13, messages: 167 },
    { name: 'Sat', tokens: 987, completions: 67, users: 10, messages: 134 },
    { name: 'Sun', tokens: 1109, completions: 75, users: 11, messages: 145 }
  ];

  const topProjects = [
    { name: 'Xander AI Core', usage: 3421, change: 12.5 },
    { name: 'Web Dashboard', usage: 2156, change: 8.3 },
    { name: 'Mobile App', usage: 1876, change: -2.1 },
    { name: 'API Services', usage: 1089, change: 15.7 }
  ];

  const getTrendIcon = (trend: number) => {
    return trend > 0 ? (
      <TrendingUp className="w-4 h-4 text-green-600" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-600" />
    );
  };

  const getTrendColor = (trend: number) => {
    return trend > 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h2>
          <p className="text-slate-600 dark:text-slate-400">Track your AI usage and performance metrics</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          
          <button className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg">
            <Filter className="w-4 h-4" />
          </button>
          
          <button className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          const trend = currentData.trends[metric.key as keyof typeof currentData.trends];
          
          return (
            <div key={metric.key} className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 bg-${metric.color}-100 dark:bg-${metric.color}-900/20 rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 text-${metric.color}-600 dark:text-${metric.color}-400`} />
                </div>
                <div className="flex items-center space-x-1">
                  {getTrendIcon(trend)}
                  <span className={`text-sm font-medium ${getTrendColor(trend)}`}>
                    {Math.abs(trend)}%
                  </span>
                </div>
              </div>
              
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                {metric.value}
              </div>
              
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {metric.label}
              </div>
              
              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {selectedPeriod === '24h' && 'vs yesterday'}
                {selectedPeriod === '7d' && 'vs last week'}
                {selectedPeriod === '30d' && 'vs last month'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Usage Trends</h3>
              <div className="flex items-center space-x-2">
                {metricCards.map((metric) => (
                  <button
                    key={metric.key}
                    onClick={() => setSelectedMetric(metric.key)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      selectedMetric === metric.key
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {metric.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {/* Chart Placeholder */}
            <div className="h-80 bg-slate-50 dark:bg-slate-900 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400 mb-2">Interactive chart visualization</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Showing {metricCards.find(m => m.key === selectedMetric)?.label.toLowerCase()} over {currentData.period.toLowerCase()}
                </p>
              </div>
            </div>
            
            {/* Chart Legend */}
            <div className="flex items-center justify-center space-x-6 mt-6">
              {chartData.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Projects */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Top Projects</h3>
          </div>
          
          <div className="p-6 space-y-4">
            {topProjects.map((project, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">{index + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{project.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{project.usage.toLocaleString()} tokens</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-1">
                  {getTrendIcon(project.change)}
                  <span className={`text-sm font-medium ${getTrendColor(project.change)}`}>
                    {Math.abs(project.change)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white">Success Rate</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">AI completion accuracy</p>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">94.2%</div>
          <div className="flex items-center space-x-1 mt-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-600">+3.1% from last period</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white">Avg Response Time</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">AI processing speed</p>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">1.2s</div>
          <div className="flex items-center space-x-1 mt-2">
            <TrendingDown className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-600">-0.3s from last period</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white">User Satisfaction</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">Based on feedback</p>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">4.8/5</div>
          <div className="flex items-center space-x-1 mt-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-600">+0.2 from last period</span>
          </div>
        </div>
      </div>
    </div>
  );
}
