"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import apiClient from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Settings as SettingsIcon, Bell, Shield, Save } from "lucide-react";
import type { UserSettings } from "@/lib/types";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'dark', language: 'en', autoSave: true, autoRecharge: false,
    notifications: true, aiModel: 'gpt-5.1', maxTokens: 4000,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiClient.getSettings()
      .then((s) => {
        setSettings({
          theme: String(s.theme || 'dark'),
          language: String(s.language || 'en'),
          autoSave: Boolean(s.autoSave ?? true),
          autoRecharge: Boolean(s.autoRecharge ?? false),
          notifications: Boolean(s.notifications ?? true),
          aiModel: String(s.aiModel || 'gpt-5.1'),
          maxTokens: Number(s.maxTokens ?? 4000),
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await apiClient.updateSettings(settings as unknown as Record<string, unknown>);
      if (settings.autoRecharge !== undefined) {
        await apiClient.updateAutoRecharge(settings.autoRecharge);
      }
      setMessage('Settings saved — desktop IDE will sync on next sign-in.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">Preferences sync with Xander AI IDE desktop</p>

      <div className="bg-white dark:bg-gray-900 rounded-xl border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><SettingsIcon className="w-5 h-5" /> Account</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Name</span><p className="font-medium">{user?.name}</p></div>
          <div><span className="text-gray-500">Email</span><p className="font-medium">{user?.email}</p></div>
          <div><span className="text-gray-500">Plan</span><p className="font-medium">{user?.plan?.toUpperCase()}</p></div>
          <div><span className="text-gray-500">Desktop token</span><p className="font-mono text-xs truncate">Same JWT as web login</p></div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border p-6 mb-6 space-y-4">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><Bell className="w-5 h-5" /> Preferences</h2>
        {(['theme', 'language', 'aiModel'] as const).map((key) => (
          <div key={key} className="flex justify-between items-center">
            <label className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
            <input
              value={String(settings[key])}
              onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
              className="px-3 py-1 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm w-40"
            />
          </div>
        ))}
        {(['autoSave', 'autoRecharge', 'notifications'] as const).map((key) => (
          <div key={key} className="flex justify-between items-center">
            <label className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
            <button
              onClick={() => setSettings({ ...settings, [key]: !settings[key] })}
              className={`w-11 h-6 rounded-full transition-colors ${settings[key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`block w-4 h-4 bg-white rounded-full transition-transform mx-1 ${settings[key] ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        ))}
        <div className="flex justify-between items-center">
          <label className="text-sm">Max tokens</label>
          <input type="number" value={settings.maxTokens}
            onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) || 4000 })}
            className="w-24 px-3 py-1 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><Shield className="w-5 h-5" /> Billing</h2>
        <Link href="/dashboard/manage-plan" className="text-blue-600 hover:underline text-sm">Manage subscription & Stripe portal →</Link>
      </div>

      {message && <p className="text-sm text-green-600 mb-4">{message}</p>}

      <button onClick={handleSave} disabled={saving}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center">
        <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
