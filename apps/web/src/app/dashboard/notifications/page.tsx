"use client";

import { useState, useEffect } from "react";
import apiClient from "@/lib/api";
import { Bell, Check, X, Info, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import type { AppNotification } from "@/lib/types";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    apiClient.getNotifications()
      .then((res) => {
        const mapped = (res.notifications || []).map((n) => ({
          id: String(n.id),
          type: (n.type as AppNotification['type']) || 'info',
          title: String(n.title || 'Notification'),
          message: String(n.message || ''),
          timestamp: String(n.timestamp || n.createdAt || new Date().toISOString()),
          read: Boolean(n.read),
          actionUrl: n.actionUrl ? String(n.actionUrl) : undefined,
        }));
        setNotifications(mapped);
      })
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  const markAsRead = async (id: string) => {
    await apiClient.markNotificationAsRead(id).catch(() => {});
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const filtered = notifications.filter((n) =>
    filter === 'unread' ? !n.read : filter === 'read' ? n.read : true,
  );
  const unreadCount = notifications.filter((n) => !n.read).length;

  const icon = (type: string) => {
    if (type === 'success') return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (type === 'warning') return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    if (type === 'error') return <XCircle className="w-5 h-5 text-red-500" />;
    return <Info className="w-5 h-5 text-blue-500" />;
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="text-gray-600 dark:text-gray-400">Account updates from billing and usage</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={() => notifications.filter((n) => !n.read).forEach((n) => markAsRead(n.id))}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center">
            <Check className="w-4 h-4 mr-2" /> Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        {(['all', 'unread', 'read'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-sm capitalize ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
            {f} {f === 'unread' ? `(${unreadCount})` : ''}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Bell className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p>No notifications yet. Billing events and usage alerts will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => (
            <div key={n.id} className={`border rounded-lg p-4 ${!n.read ? 'border-l-4 border-l-blue-600' : ''}`}>
              <div className="flex justify-between">
                <div className="flex gap-3">
                  {icon(n.type)}
                  <div>
                    <h3 className="font-medium">{n.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(n.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                {!n.read && (
                  <button onClick={() => markAsRead(n.id)} className="text-gray-400 hover:text-gray-600"><Check className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
