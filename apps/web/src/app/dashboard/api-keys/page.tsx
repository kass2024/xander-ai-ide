"use client";

import { useState, useEffect } from "react";
import apiClient from "@/lib/api";
import { 
  Shield, 
  Key, 
  Plus, 
  Copy, 
  Eye, 
  EyeOff, 
  Trash2, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings
} from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  permissions: string[];
  createdAt: string;
  lastUsed?: string;
  expiresAt?: string;
  isActive: boolean;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read']);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setApiKeys([]);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) {
      alert('Please enter a name for the API key');
      return;
    }

    try {
      // TODO: Call API to create key
      // const newKey = await apiClient.createApiKey({
      //   name: newKeyName,
      //   permissions: newKeyPermissions
      // });

      // Mock new key creation
      const newKey: ApiKey = {
        id: Date.now().toString(),
        name: newKeyName,
        key: `xander_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`,
        prefix: 'xander_',
        permissions: newKeyPermissions,
        createdAt: new Date().toISOString(),
        isActive: true
      };

      setApiKeys([newKey, ...apiKeys]);
      setShowCreateModal(false);
      setNewKeyName('');
      setNewKeyPermissions(['read']);
    } catch (error) {
      console.error('Failed to create API key:', error);
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) {
      return;
    }

    try {
      // TODO: Call API to delete key
      // await apiClient.deleteApiKey(keyId);
      
      setApiKeys(apiKeys.filter(key => key.id !== keyId));
    } catch (error) {
      console.error('Failed to delete API key:', error);
    }
  };

  const handleToggleKey = async (keyId: string) => {
    try {
      // TODO: Call API to toggle key
      // await apiClient.toggleApiKey(keyId);
      
      setApiKeys(apiKeys.map(key => 
        key.id === keyId ? { ...key, isActive: !key.isActive } : key
      ));
    } catch (error) {
      console.error('Failed to toggle API key:', error);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleKeyVisibility = (keyId: string) => {
    const newVisibleKeys = new Set(visibleKeys);
    if (newVisibleKeys.has(keyId)) {
      newVisibleKeys.delete(keyId);
    } else {
      newVisibleKeys.add(keyId);
    }
    setVisibleKeys(newVisibleKeys);
  };

  const getPermissionColor = (permissions: string[]) => {
    if (permissions.includes('delete')) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    if (permissions.includes('write')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading API keys...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">API Keys</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your API keys for accessing Xander AI IDE services
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create API Key
            </button>
          </div>
        </div>

        {/* API Keys List */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    API Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Permissions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {apiKeys.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      No API keys yet. Programmatic API access is coming soon — use the desktop app with your account login for now.
                    </td>
                  </tr>
                ) : apiKeys.map((apiKey) => (
                  <tr key={apiKey.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <Key className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {apiKey.name}
                          </p>
                          {apiKey.expiresAt && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Expires: {formatDate(apiKey.expiresAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {visibleKeys.has(apiKey.id) ? apiKey.key : apiKey.prefix + '•'.repeat(20)}
                        </code>
                        <button
                          onClick={() => toggleKeyVisibility(apiKey.id)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {visibleKeys.has(apiKey.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleCopyKey(apiKey.key)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {copiedKey === apiKey.key ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPermissionColor(apiKey.permissions)}`}>
                        {apiKey.permissions.join(', ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {formatDate(apiKey.createdAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {apiKey.lastUsed ? (
                        <span className="text-sm text-gray-900 dark:text-white">
                          {formatDate(apiKey.lastUsed)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">Never</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          apiKey.isActive ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {apiKey.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleKey(apiKey.id)}
                          className={`p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ${
                            apiKey.isActive ? 'hover:text-orange-600' : 'hover:text-green-600'
                          }`}
                          title={apiKey.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteApiKey(apiKey.id)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                Security Notice
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                API keys provide full access to your account. Keep them secure and never share them publicly. 
                Rotate your keys regularly and delete any that are no longer needed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Create New API Key
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Key Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Permissions
                </label>
                <div className="space-y-2">
                  {['read', 'write', 'delete'].map((permission) => (
                    <label key={permission} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newKeyPermissions.includes(permission)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewKeyPermissions([...newKeyPermissions, permission]);
                          } else {
                            setNewKeyPermissions(newKeyPermissions.filter(p => p !== permission));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {permission}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateApiKey}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
