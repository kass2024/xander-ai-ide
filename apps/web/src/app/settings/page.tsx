"use client";

import { useState } from "react";
import { 
  User, 
  Bell, 
  Shield, 
  CreditCard, 
  Globe, 
  Palette,
  Database,
  Key,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Camera,
  Save,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Plus,
  X,
  Check,
  AlertTriangle,
  Info,
  HelpCircle,
  FileText,
  Zap,
  Code,
  MessageSquare,
  BarChart3,
  Smartphone
} from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'data', label: 'Data & Privacy', icon: Database }
  ];

  const handleSave = async () => {
    setIsLoading(true);
    setSaveMessage('');
    
    // Simulate save operation
    setTimeout(() => {
      setIsLoading(false);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    }, 1000);
  };

  const renderProfileTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Personal Information</h3>
          
          <div className="flex items-center space-x-6 mb-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                <User className="w-12 h-12 text-white" />
              </div>
              <button className="absolute bottom-0 right-0 p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700">
                <Camera className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
            
            <div>
              <h4 className="text-lg font-medium text-slate-900 dark:text-white">John Developer</h4>
              <p className="text-slate-600 dark:text-slate-400">john@xander.ai</p>
              <button className="mt-2 text-sm text-blue-600 hover:text-blue-500">
                Change avatar
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                defaultValue="John Developer"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                defaultValue="john@xander.ai"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Phone
              </label>
              <input
                type="tel"
                defaultValue="+1 (555) 123-4567"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Location
              </label>
              <input
                type="text"
                defaultValue="San Francisco, CA"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Bio
            </label>
            <textarea
              rows={4}
              defaultValue="Full-stack developer passionate about AI and building innovative solutions."
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Professional Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Company
              </label>
              <input
                type="text"
                defaultValue="Xander AI"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Job Title
              </label>
              <input
                type="text"
                defaultValue="Senior Developer"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Website
              </label>
              <input
                type="url"
                defaultValue="https://johndeveloper.dev"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                GitHub
              </label>
              <input
                type="text"
                defaultValue="johndeveloper"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Notification Preferences</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-slate-900 dark:text-white">Email Notifications</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">Receive email updates about your account</p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6"></span>
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-slate-900 dark:text-white">Push Notifications</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">Receive push notifications in your browser</p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 dark:bg-slate-700">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1"></span>
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-slate-900 dark:text-white">AI Completion Alerts</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">Get notified when AI completions are ready</p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6"></span>
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-slate-900 dark:text-white">Project Updates</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">Receive updates about your projects</p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6"></span>
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-slate-900 dark:text-white">Marketing Emails</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">Receive product updates and announcements</p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 dark:bg-slate-700">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1"></span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Notification Frequency</h3>
          
          <div className="space-y-3">
            <label className="flex items-center space-x-3">
              <input type="radio" name="frequency" defaultChecked className="text-blue-600" />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Real-time</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Get notifications as they happen</div>
              </div>
            </label>
            
            <label className="flex items-center space-x-3">
              <input type="radio" name="frequency" className="text-blue-600" />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Daily Digest</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Get a summary once per day</div>
              </div>
            </label>
            
            <label className="flex items-center space-x-3">
              <input type="radio" name="frequency" className="text-blue-600" />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Weekly Summary</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Get a summary once per week</div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Password</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Current Password
              </label>
              <input
                type="password"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                New Password
              </label>
              <input
                type="password"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Update Password
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Two-Factor Authentication</h3>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium text-slate-900 dark:text-white">Enable 2FA</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">Add an extra layer of security to your account</p>
            </div>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 dark:bg-slate-700">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1"></span>
            </button>
          </div>
          
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Two-factor authentication adds an extra layer of security by requiring a code from your mobile device when signing in.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Active Sessions</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">Chrome on Windows</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">192.168.1.1 • Last active 2 minutes ago</div>
                </div>
              </div>
              <button className="text-red-600 hover:text-red-700 text-sm">
                Sign Out
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">Safari on iPhone</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">192.168.1.2 • Last active 1 hour ago</div>
                </div>
              </div>
              <button className="text-red-600 hover:text-red-700 text-sm">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileTab();
      case 'notifications':
        return renderNotificationsTab();
      case 'security':
        return renderSecurityTab();
      default:
        return (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Coming Soon</h3>
              <p className="text-slate-600 dark:text-slate-400">
                This settings section is currently under development.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Manage your account settings and preferences
          </p>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
          
          {/* Main Content */}
          <div className="flex-1">
            {saveMessage && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                <span className="text-green-800 dark:text-green-200">{saveMessage}</span>
              </div>
            )}
            
            {renderContent()}
            
            {/* Save Button */}
            <div className="mt-8 flex justify-end">
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
