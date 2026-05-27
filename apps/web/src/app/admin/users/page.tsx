"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { DashboardShell } from "@/components/DashboardShell";
import apiClient from "@/lib/api";
import { Users, Mail, Calendar, CheckCircle, XCircle } from "lucide-react";

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
  isActive: boolean;
  role?: string;
}

function AdminUsersContent() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.getAdminUsers()
      .then((res) => setUsers((res.users || []) as unknown as AdminUser[]))
      .catch((err) => setError(err instanceof Error ? err.message : 'Access denied'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/dashboard" className="text-blue-600">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
        <Users className="w-8 h-8 text-blue-600" /> User Management
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">{users.length} users from backend</p>

      <div className="bg-white dark:bg-gray-900 rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-6 py-4">
                  <div className="font-medium">{user.fullName || '—'}</div>
                  <div className="text-xs text-gray-500">{user.role || 'USER'}</div>
                </td>
                <td className="px-6 py-4 flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" />{user.email}</td>
                <td className="px-6 py-4">
                  {user.isActive ? (
                    <span className="flex items-center text-green-600 text-sm"><CheckCircle className="w-4 h-4 mr-1" />Active</span>
                  ) : (
                    <span className="flex items-center text-red-600 text-sm"><XCircle className="w-4 h-4 mr-1" />Inactive</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AuthGuard>
      <DashboardShell>
        <AdminUsersContent />
      </DashboardShell>
    </AuthGuard>
  );
}
