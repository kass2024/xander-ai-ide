"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import apiClient from "@/lib/api";
import { mapToDashboardUser } from "@/lib/user-mapper";
import { useAuthStore } from "@/stores/authStore";
import { User, Calendar, Activity, Edit3, Save, X, CreditCard, Award, Zap } from "lucide-react";

export default function ProfilePage() {
  const { user: authUser, refreshUser } = useAuthStore();
  const [profile, setProfile] = useState(authUser);
  const [stats, setStats] = useState({ totalTokensUsed: 0, totalRequests: 0 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [me, subscription, usage, analytics] = await Promise.all([
          apiClient.getProfile(),
          apiClient.getCurrentSubscription(),
          apiClient.getUserUsage(),
          apiClient.getAnalytics(),
        ]);
        const mapped = mapToDashboardUser(
          me as Record<string, unknown>,
          subscription as Record<string, unknown>,
          analytics as Record<string, unknown>,
        );
        setProfile(mapped);
        setEditName(mapped.name);
        const monthly = (usage as { monthly?: { tokensUsed?: number; requests?: number } })?.monthly;
        setStats({
          totalTokensUsed: monthly?.tokensUsed ?? 0,
          totalRequests: monthly?.requests ?? 0,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    await apiClient.updateProfile({ fullName: editName });
    await refreshUser();
    setProfile((p) => p ? { ...p, name: editName } : p);
    setEditing(false);
  };

  if (loading || !profile) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Profile</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">Manage your account — synced with desktop IDE</p>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
            <div>
              {editing ? (
                <div className="flex gap-2 items-center">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
                  <button onClick={handleSave} className="p-2 text-green-600"><Save className="w-4 h-4" /></button>
                  <button onClick={() => setEditing(false)} className="p-2 text-gray-500"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{profile.name}</h2>
                  <p className="text-gray-600 dark:text-gray-400">{profile.email}</p>
                  <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">{profile.plan.toUpperCase()}</span>
                </>
              )}
            </div>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="p-2 text-gray-500 hover:text-gray-900"><Edit3 className="w-4 h-4" /></button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Member since</p>
              <p className="font-medium">{new Date(profile.joinDate).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Last login</p>
              <p className="font-medium">{profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleDateString() : '—'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4 text-center">
          <Zap className="w-6 h-6 mx-auto mb-2 text-purple-600" />
          <p className="text-2xl font-bold">{stats.totalTokensUsed.toLocaleString()}</p>
          <p className="text-sm text-gray-500">Tokens (month)</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4 text-center">
          <CreditCard className="w-6 h-6 mx-auto mb-2 text-orange-600" />
          <p className="text-2xl font-bold">{stats.totalRequests}</p>
          <p className="text-sm text-gray-500">Requests</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4 text-center">
          <Award className="w-6 h-6 mx-auto mb-2 text-green-600" />
          <p className="text-2xl font-bold">{profile.streak}</p>
          <p className="text-sm text-gray-500">Day streak</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4 text-center">
          <Activity className="w-6 h-6 mx-auto mb-2 text-blue-600" />
          <p className="text-2xl font-bold">{profile.linesWritten.toLocaleString()}</p>
          <p className="text-sm text-gray-500">Lines written</p>
        </div>
      </div>

      <Link href="/dashboard/manage-plan" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        Upgrade Plan
      </Link>
    </div>
  );
}
