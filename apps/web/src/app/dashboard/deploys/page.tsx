"use client";

import { useState, useEffect } from "react";
import apiClient from "@/lib/api";
import { 
  Rocket, 
  Plus, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ExternalLink, 
  Settings, 
  Trash2,
  GitBranch,
  Activity,
  Calendar,
  Server,
  Globe,
  Shield
} from "lucide-react";

interface Deployment {
  id: string;
  name: string;
  project: string;
  branch: string;
  commit: string;
  status: 'pending' | 'building' | 'deployed' | 'failed';
  url?: string;
  createdAt: string;
  deployedAt?: string;
  logs?: string[];
  environment: 'development' | 'staging' | 'production';
}

export default function DeploysPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);

  useEffect(() => {
    fetchDeployments();
  }, []);

  const fetchDeployments = async () => {
    try {
      setDeployments([]);
    } catch (error) {
      console.error('Failed to fetch deployments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deployed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'building': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'deployed': return <CheckCircle className="w-4 h-4" />;
      case 'building': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getEnvironmentColor = (environment: string) => {
    switch (environment) {
      case 'production': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'staging': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
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

  const handleRedeploy = async (deploymentId: string) => {
    try {
      // TODO: Call API to redeploy
      // await apiClient.redeploy(deploymentId);
      
      setDeployments(deployments.map(d => 
        d.id === deploymentId 
          ? { ...d, status: 'building', deployedAt: undefined, logs: ['Starting redeployment...'] }
          : d
      ));
    } catch (error) {
      console.error('Failed to redeploy:', error);
    }
  };

  const handleDeleteDeployment = async (deploymentId: string) => {
    if (!confirm('Are you sure you want to delete this deployment?')) {
      return;
    }

    try {
      // TODO: Call API to delete deployment
      // await apiClient.deleteDeployment(deploymentId);
      
      setDeployments(deployments.filter(d => d.id !== deploymentId));
    } catch (error) {
      console.error('Failed to delete deployment:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading deployments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Deployments</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage and monitor your application deployments
              </p>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              New Deployment
            </button>
          </div>
        </div>

        {/* Deployment Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <Rocket className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm text-green-600 font-medium">+2</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">12</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Deployments</div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <Server className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm text-blue-600 font-medium">Active</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">3</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Active Deployments</div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-sm text-orange-600 font-medium">95%</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">95%</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Success Rate</div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-sm text-purple-600 font-medium">Secure</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">HTTPS</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">All Deployments</div>
          </div>
        </div>

        {/* Deployments List */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Deployment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Environment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Deployed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {deployments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      No deployments yet. Cloud deploys from the desktop IDE are coming soon.
                    </td>
                  </tr>
                ) : deployments.map((deployment) => (
                  <tr key={deployment.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" onClick={() => setSelectedDeployment(deployment)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <Rocket className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {deployment.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {deployment.commit}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {deployment.project}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <GitBranch className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {deployment.branch}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEnvironmentColor(deployment.environment)}`}>
                        {deployment.environment}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center ${getStatusColor(deployment.status)}`}>
                          {getStatusIcon(deployment.status)}
                          <span className="ml-1 capitalize">{deployment.status}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {deployment.deployedAt ? formatDate(deployment.deployedAt) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {deployment.url && (
                          <a
                            href={deployment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="Visit deployment"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRedeploy(deployment.id);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Redeploy"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDeployment(deployment.id);
                          }}
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

        {/* Deployment Details Modal */}
        {selectedDeployment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {selectedDeployment.name}
                </h2>
                <button
                  onClick={() => setSelectedDeployment(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Project</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {selectedDeployment.project}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Branch</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {selectedDeployment.branch}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Commit</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                    {selectedDeployment.commit}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Environment</p>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEnvironmentColor(selectedDeployment.environment)}`}>
                    {selectedDeployment.environment}
                  </span>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Deployment Logs</h3>
                <div className="bg-gray-900 dark:bg-black rounded-lg p-4 font-mono text-sm text-gray-300 max-h-64 overflow-y-auto">
                  {selectedDeployment.logs?.map((log, index) => (
                    <div key={index} className="mb-1">
                      <span className="text-gray-400">[{formatDate(selectedDeployment.createdAt)}]</span> {log}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setSelectedDeployment(null)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Close
                </button>
                {selectedDeployment.url && (
                  <a
                    href={selectedDeployment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Visit Deployment
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
