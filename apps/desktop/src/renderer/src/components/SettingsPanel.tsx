import React, { useEffect, useState } from 'react';
import {
  X, User, CreditCard, Zap, Check, ArrowRight, ExternalLink,
  Settings, Bot, Puzzle, Shield, RefreshCw, LogOut, LogIn
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useBillingStore } from '../stores/billingStore';
import apiClient, { configureApiClient, type Plan } from '../lib/api';
import { getWebBaseUrl, PRODUCTION_API_URL } from '../lib/apiConfig';

interface SettingsPanelProps {
  onClose: () => void;
  initialTab?: string;
}

const NAV_ITEMS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'plan', label: 'Plan & Usage', icon: CreditCard },
  { id: 'models', label: 'Models', icon: Bot },
  { id: 'rules', label: 'Rules', icon: Shield },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
];

export function SettingsPanel({ onClose, initialTab = 'general' }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [cloudOnline, setCloudOnline] = useState<boolean | null>(null);
  const [planMessage, setPlanMessage] = useState('');
  const [aiModels, setAiModels] = useState<Array<{ id: string; name: string; description: string; tier?: string }>>([]);

  const { user, isAuthenticated, loading: authLoading, error: authError, login, logout, loadSession } = useAuthStore();
  const { subscription, plans, usage, loading: billingLoading, fetchAll, changePlan } = useBillingStore();

  const checkCloud = async () => {
    configureApiClient();
    try {
      const res = await fetch(`${PRODUCTION_API_URL}/health`);
      setCloudOnline(res.ok);
    } catch {
      setCloudOnline(false);
    }
  };

  useEffect(() => {
    configureApiClient();
    void checkCloud();
    loadSession().then(() => fetchAll());
    if (apiClient.getToken()) {
      apiClient.getModels().then((r) => setAiModels(r.models || [])).catch(() => {});
    }

    const onFocus = () => {
      if (apiClient.getToken()) {
        fetchAll();
        apiClient.getModels().then((r) => setAiModels(r.models || [])).catch(() => {});
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(loginEmail.trim(), loginPassword);
      void fetchAll();
    } catch {
      /* authError shown in form */
    }
  };

  const handlePlanChange = async (planId: string) => {
    try {
      await changePlan(planId, billingCycle);
      setPlanMessage(`Plan updated to ${planId}. Synced with web dashboard.`);
      setTimeout(() => setPlanMessage(''), 4000);
    } catch {
      setPlanMessage('Plan change failed. Make sure you are logged in.');
    }
  };

  const currentPlanId = (subscription?.plan as { id?: string })?.id || 'free';
  const currentPlanName = subscription?.plan?.name || 'Free';
  const planPrice = subscription?.plan?.price ?? 0;

  const getPlanPrice = (plan: Plan) =>
    billingCycle === 'year' ? Math.round(plan.price * 10) : plan.price;

  const renderGeneral = () => (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold text-[var(--vscode-foreground)] mb-1">General</h2>
        <p className="text-sm text-[var(--vscode-descriptionForeground)]">
          Manage your account and IDE preferences
        </p>
      </div>

      {isAuthenticated && (
        <div className="rounded-lg border border-[var(--vscode-border)] bg-[var(--vscode-input-background)] px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-[var(--vscode-descriptionForeground)]">
            Xander Cloud · <span className="font-mono text-xs">{PRODUCTION_API_URL}</span>
          </span>
          {cloudOnline === true && <span className="text-green-400">● Online</span>}
          {cloudOnline === false && <span className="text-red-400">● Offline</span>}
          {cloudOnline === null && <span className="opacity-50">Checking…</span>}
        </div>
      )}

      {!isAuthenticated ? (
        <div className="rounded-lg border border-[var(--vscode-border)] bg-[var(--vscode-input-background)] p-6">
          <h3 className="text-base font-medium mb-4 flex items-center gap-2">
            <LogIn className="w-4 h-4" /> Sign in to sync with web
          </h3>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[var(--vscode-editor-background)] border border-[var(--vscode-input-border)] text-sm"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[var(--vscode-editor-background)] border border-[var(--vscode-input-border)] text-sm"
              required
            />
            {authError && <p className="text-sm text-red-400">{authError}</p>}
            <button
              type="submit"
              disabled={authLoading}
              className="px-4 py-2 bg-[var(--vscode-button-background)] text-white rounded text-sm hover:bg-[var(--vscode-button-hoverBackground)]"
            >
              {authLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--vscode-border)] p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-medium">{user?.fullName || user?.email}</p>
              <p className="text-sm text-[var(--vscode-descriptionForeground)]">{user?.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-[var(--vscode-badge-background)]">
                {currentPlanName} Plan
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.electronAPI?.openExternal(`${getWebBaseUrl()}/dashboard`)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-[var(--vscode-border)] rounded hover:bg-[var(--vscode-list-hoverBackground)]"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open Web Dashboard
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-[var(--vscode-list-hoverBackground)] rounded"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[var(--vscode-border)] p-5">
        <h3 className="font-medium mb-3">Account & Billing</h3>
        <p className="text-sm text-[var(--vscode-descriptionForeground)] mb-3">
          Manage your account and billing on the web dashboard.
        </p>
        <button
          onClick={() => window.electronAPI?.openExternal(`${getWebBaseUrl()}/dashboard/manage-plan`)}
          className="px-4 py-2 text-sm bg-[var(--vscode-button-background)] text-white rounded hover:bg-[var(--vscode-button-hoverBackground)]"
        >
          Manage Account
        </button>
      </div>

      <div className="rounded-lg border border-[var(--vscode-border)] p-5 space-y-4">
        <h3 className="font-medium">Layout</h3>
        <label className="flex items-center justify-between text-sm">
          <span>Status Bar</span>
          <input type="checkbox" defaultChecked className="accent-blue-500" />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span>AI Chat Panel</span>
          <input type="checkbox" defaultChecked className="accent-blue-500" />
        </label>
      </div>
    </div>
  );

  const renderPlanUsage = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--vscode-foreground)] mb-1">Plan & Usage</h2>
          <p className="text-sm text-[var(--vscode-descriptionForeground)]">
            Synced with web dashboard and backend
          </p>
        </div>
        <button
          onClick={() => fetchAll()}
          disabled={billingLoading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-[var(--vscode-border)] rounded hover:bg-[var(--vscode-list-hoverBackground)]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${billingLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {planMessage && (
        <div className="p-3 rounded bg-green-900/30 border border-green-700 text-green-300 text-sm">
          {planMessage}
        </div>
      )}

      {!isAuthenticated && (
        <div className="p-4 rounded border border-yellow-700/50 bg-yellow-900/20 text-yellow-200 text-sm">
          Sign in under General to sync your plan with the web app.
        </div>
      )}

      {/* Current subscription */}
      <div className="rounded-lg border border-blue-700/40 bg-blue-900/20 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Current Plan: {currentPlanName}</h3>
            <p className="text-sm text-[var(--vscode-descriptionForeground)] mt-1">
              {subscription?.status === 'ACTIVE'
                ? `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                : 'No active subscription'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">${planPrice}<span className="text-sm font-normal">/mo</span></p>
          </div>
        </div>
      </div>

      {/* Usage stats */}
      {usage && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Tokens Used', value: usage.totalUsage.tokensUsed, limit: usage.limits.tokens },
            { label: 'Requests', value: usage.totalUsage.requests, limit: usage.limits.requests },
            { label: 'Cost', value: `$${usage.totalUsage.cost.toFixed(2)}`, limit: `$${usage.limits.cost}` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-[var(--vscode-border)] p-4">
              <p className="text-xs text-[var(--vscode-descriptionForeground)]">{stat.label}</p>
              <p className="text-xl font-bold mt-1">{stat.value}</p>
              <div className="mt-2 h-1.5 bg-[var(--vscode-input-background)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: typeof stat.value === 'number' && typeof stat.limit === 'number'
                      ? `${Math.min(100, (stat.value / stat.limit) * 100)}%`
                      : '30%',
                  }}
                />
              </div>
              <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-1">Limit: {stat.limit}</p>
            </div>
          ))}
        </div>
      )}

      {/* Billing cycle toggle */}
      <div className="flex justify-center">
        <div className="inline-flex bg-[var(--vscode-input-background)] rounded-lg p-1 border border-[var(--vscode-border)]">
          {(['month', 'year'] as const).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              className={`px-4 py-1.5 text-sm rounded-md capitalize ${
                billingCycle === cycle
                  ? 'bg-[var(--vscode-button-background)] text-white'
                  : 'text-[var(--vscode-descriptionForeground)] hover:text-white'
              }`}
            >
              {cycle === 'year' ? 'Yearly (Save 17%)' : 'Monthly'}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(plans.length ? plans : []).map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const price = getPlanPrice(plan);
          return (
            <div
              key={plan.id}
              className={`rounded-xl border-2 p-5 ${
                plan.popular ? 'border-blue-500' : 'border-[var(--vscode-border)]'
              }`}
            >
              {plan.popular && (
                <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Most Popular</span>
              )}
              <h3 className="text-lg font-bold mt-2">{plan.name}</h3>
              <p className="text-2xl font-bold mt-1">
                ${price}<span className="text-sm font-normal text-[var(--vscode-descriptionForeground)]">/{billingCycle}</span>
              </p>
              <div className="mt-4">
                {isCurrent ? (
                  <button className="w-full py-2 text-sm bg-[var(--vscode-input-background)] rounded cursor-default">
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handlePlanChange(plan.id)}
                    disabled={billingLoading || !isAuthenticated}
                    className="w-full py-2 text-sm bg-[var(--vscode-button-background)] text-white rounded hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {billingLoading ? 'Switching...' : <>Switch to {plan.name} <ArrowRight className="w-3.5 h-3.5" /></>}
                  </button>
                )}
              </div>
              <ul className="mt-4 space-y-1.5">
                {plan.features.slice(0, 4).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[var(--vscode-descriptionForeground)]">
                    <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Upgrade banner */}
      {currentPlanName === 'Free' && (
        <div className="rounded-lg border border-[var(--vscode-border)] p-5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" /> Upgrade to Pro
            </h3>
            <p className="text-sm text-[var(--vscode-descriptionForeground)] mt-1">
              Unlock premium models, unlimited Tab completions, and priority support.
            </p>
          </div>
          <button
            onClick={() => handlePlanChange('pro')}
            disabled={!isAuthenticated}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Upgrade
          </button>
        </div>
      )}
    </div>
  );

  const renderModels = () => (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-1">AI Models</h2>
      <p className="text-sm text-[var(--vscode-descriptionForeground)] mb-6">
        Models available on your plan. Select models in the AI chat panel. Inline autocomplete uses the fast model.
      </p>
      {!isAuthenticated ? (
        <p className="text-sm text-yellow-500">Sign in to load models from the backend.</p>
      ) : aiModels.length === 0 ? (
        <p className="text-sm text-[var(--vscode-descriptionForeground)]">Loading models...</p>
      ) : (
        <div className="space-y-3">
          {aiModels.map((m) => (
            <div key={m.id} className="p-4 rounded-lg border border-[var(--vscode-border)]">
              <div className="flex items-center justify-between">
                <span className="font-medium">{m.name}</span>
                {m.tier && (
                  <span className="text-xs px-2 py-0.5 rounded bg-[var(--vscode-badge-background)]">{m.tier}</span>
                )}
              </div>
              <p className="text-sm text-[var(--vscode-descriptionForeground)] mt-1">{m.description}</p>
              <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-2 font-mono">{m.id}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderPlaceholder = (title: string, hint?: string) => (
    <div className="flex flex-col items-center justify-center h-64 text-[var(--vscode-descriptionForeground)]">
      <p className="text-lg font-medium text-[var(--vscode-foreground)]">{title}</p>
      <p className="text-sm mt-2">{hint || 'Coming soon'}</p>
    </div>
  );

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[var(--vscode-editor-background)]">
      {/* Settings header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--vscode-border)]">
        <h1 className="text-lg font-semibold">Xander Settings</h1>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-[var(--vscode-list-hoverBackground)]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar nav */}
        <nav className="w-52 border-r border-[var(--vscode-border)] py-4 px-2 space-y-0.5 shrink-0">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md text-left transition-colors ${
                activeTab === id
                  ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-white'
                  : 'text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          {activeTab === 'general' && renderGeneral()}
          {activeTab === 'plan' && renderPlanUsage()}
          {activeTab === 'models' && renderModels()}
          {activeTab === 'rules' && renderPlaceholder('Rules', 'Custom AI rules for your workspace — available in a future update.')}
          {activeTab === 'plugins' && renderPlaceholder('Plugins', 'Extension marketplace — available in a future update.')}
        </div>
      </div>
    </div>
  );
}
