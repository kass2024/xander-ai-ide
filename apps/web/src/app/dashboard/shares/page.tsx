"use client";

import { useState, useEffect } from "react";
import apiClient from "@/lib/api";
import { 
  Share2, 
  Plus, 
  Copy, 
  Eye, 
  EyeOff, 
  Trash2, 
  Calendar, 
  MessageSquare, 
  Users, 
  Globe,
  Lock,
  Unlock,
  ExternalLink,
  CheckCircle,
  XCircle
} from "lucide-react";

interface ConversationShare {
  id: string;
  title: string;
  description?: string;
  shareUrl: string;
  shareToken: string;
  isPublic: boolean;
  password?: string;
  expiresAt?: string;
  createdAt: string;
  lastAccessed?: string;
  accessCount: number;
  maxAccess?: number;
  messagesCount: number;
}

export default function SharesPage() {
  const [shares, setShares] = useState<ConversationShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newShareTitle, setNewShareTitle] = useState('');
  const [newShareDescription, setNewShareDescription] = useState('');
  const [newSharePassword, setNewSharePassword] = useState('');
  const [newShareIsPublic, setNewShareIsPublic] = useState(false);
  const [newShareExpiry, setNewShareExpiry] = useState('7');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchShares();
  }, []);

  const fetchShares = async () => {
    try {
      setShares([]);
    } catch (error) {
      console.error('Failed to fetch shares:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShare = async () => {
    if (!newShareTitle.trim()) {
      alert('Please enter a title for the share');
      return;
    }

    try {
      // TODO: Call API to create share
      // const newShare = await apiClient.createShare({
      //   title: newShareTitle,
      //   description: newShareDescription,
      //   isPublic: newShareIsPublic,
      //   password: newSharePassword || undefined,
      //   expiresAt: newShareExpiry ? new Date(Date.now() + parseInt(newShareExpiry) * 24 * 60 * 60 * 1000).toISOString() : undefined
      // });

      // Mock new share creation
      const newShare: ConversationShare = {
        id: Date.now().toString(),
        title: newShareTitle,
        description: newShareDescription,
        shareUrl: `https://xander-ai-ide.app/share/${Math.random().toString(36).substr(2, 6)}`,
        shareToken: Math.random().toString(36).substr(2, 6),
        isPublic: newShareIsPublic,
        password: newSharePassword || undefined,
        expiresAt: newShareExpiry ? new Date(Date.now() + parseInt(newShareExpiry) * 24 * 60 * 60 * 1000).toISOString() : undefined,
        createdAt: new Date().toISOString(),
        accessCount: 0,
        messagesCount: 0
      };

      setShares([newShare, ...shares]);
      setShowCreateModal(false);
      setNewShareTitle('');
      setNewShareDescription('');
      setNewSharePassword('');
      setNewShareIsPublic(false);
      setNewShareExpiry('7');
    } catch (error) {
      console.error('Failed to create share:', error);
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    if (!confirm('Are you sure you want to delete this share?')) {
      return;
    }

    try {
      // TODO: Call API to delete share
      // await apiClient.deleteShare(shareId);
      
      setShares(shares.filter(share => share.id !== shareId));
    } catch (error) {
      console.error('Failed to delete share:', error);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const toggleTokenVisibility = (shareId: string) => {
    const newVisibleTokens = new Set(visibleTokens);
    if (newVisibleTokens.has(shareId)) {
      newVisibleTokens.delete(shareId);
    } else {
      newVisibleTokens.add(shareId);
    }
    setVisibleTokens(newVisibleTokens);
  };

  const isShareExpired = (share: ConversationShare) => {
    return share.expiresAt && new Date(share.expiresAt) < new Date();
  };

  const getAccessPercentage = (share: ConversationShare) => {
    if (!share.maxAccess) return 100;
    return Math.round((share.accessCount / share.maxAccess) * 100);
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

  const getDaysUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading conversation shares...</p>
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Conversation Shares</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Share your AI conversations with others securely
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Share
            </button>
          </div>
        </div>

        {/* Share Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <Share2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm text-blue-600 font-medium">+2</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{shares.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Shares</div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm text-green-600 font-medium">+25%</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {shares.reduce((sum, share) => sum + share.accessCount, 0)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Access</div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <Globe className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-sm text-purple-600 font-medium">Public</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {shares.filter(s => s.isPublic).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Public Shares</div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                <Lock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-sm text-orange-600 font-medium">Private</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {shares.filter(s => !s.isPublic).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Private Shares</div>
          </div>
        </div>

        {/* Shares List */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Share
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Access
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Visibility
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {shares.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      No shared conversations yet. Share AI chats from the desktop app — links will appear here.
                    </td>
                  </tr>
                ) : shares.map((share) => (
                  <tr key={share.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4">
                      <div className="flex items-start">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                          <MessageSquare className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {share.title}
                          </p>
                          {share.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                              {share.description}
                            </p>
                          )}
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs text-gray-400">
                              {share.messagesCount} messages
                            </span>
                            {share.password && (
                              <span className="text-xs text-orange-600 dark:text-orange-400">
                                <Lock className="w-3 h-3 inline mr-1" />
                                Protected
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {share.accessCount} {share.maxAccess && `/ ${share.maxAccess}`}
                      </div>
                      {share.maxAccess && (
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-1">
                          <div 
                            className={`h-1 rounded-full ${
                              getAccessPercentage(share) >= 80 ? 'bg-green-500' :
                              getAccessPercentage(share) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${getAccessPercentage(share)}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {share.isPublic ? (
                          <>
                            <Globe className="w-4 h-4 text-green-600 mr-2" />
                            <span className="text-sm text-green-600 dark:text-green-400">Public</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 text-orange-600 mr-2" />
                            <span className="text-sm text-orange-600 dark:text-orange-400">Private</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {formatDate(share.createdAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {share.expiresAt ? (
                        <div>
                          <span className={`text-sm ${
                            isShareExpired(share) ? 'text-red-600' : 'text-gray-900 dark:text-white'
                          }`}>
                            {formatDate(share.expiresAt)}
                          </span>
                          {!isShareExpired(share) && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {getDaysUntilExpiry(share.expiresAt)} days left
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">Never</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleCopyUrl(share.shareUrl)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Copy URL"
                        >
                          {copiedUrl === share.shareUrl ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => toggleTokenVisibility(share.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Show token"
                        >
                          {visibleTokens.has(share.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <a
                          href={share.shareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Visit share"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDeleteShare(share.id)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {visibleTokens.has(share.id) && (
                        <div className="absolute z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 mt-8 ml-8">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Share Token:</p>
                          <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {share.shareToken}
                          </code>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Share Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Create New Share
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newShareTitle}
                    onChange={(e) => setNewShareTitle(e.target.value)}
                    placeholder="e.g., React Hooks Tutorial"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={newShareDescription}
                    onChange={(e) => setNewShareDescription(e.target.value)}
                    placeholder="Brief description of the conversation"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Visibility
                  </label>
                  <button
                    onClick={() => setNewShareIsPublic(!newShareIsPublic)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      newShareIsPublic ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        newShareIsPublic ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                {!newShareIsPublic && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password (optional)
                    </label>
                    <input
                      type="password"
                      value={newSharePassword}
                      onChange={(e) => setNewSharePassword(e.target.value)}
                      placeholder="Leave empty for no password"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Expires in
                  </label>
                  <select
                    value={newShareExpiry}
                    onChange={(e) => setNewShareExpiry(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                    <option value="">Never</option>
                  </select>
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
                  onClick={handleCreateShare}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Share
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
