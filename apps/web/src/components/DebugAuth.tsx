"use client";

import { useState } from "react";

export default function DebugAuth() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testRegisterAPI = async () => {
    setIsLoading(true);
    addLog("🔵 Starting registration test...");
    
    try {
      const testData = {
        fullName: "Frontend Test User",
        email: `frontend${Date.now()}@test.com`,
        password: "test123"
      };
      
      addLog(`📝 Sending: ${JSON.stringify(testData)}`);
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      });
      
      addLog(`📡 Response status: ${response.status}`);
      
      const result = await response.json();
      addLog(`📋 Response data: ${JSON.stringify(result)}`);
      
      if (response.ok) {
        addLog("✅ Registration successful!");
        
        // Test if user appears in list
        setTimeout(async () => {
          addLog("🔍 Checking users list...");
          const usersResponse = await fetch('/api/users');
          const usersData = await usersResponse.json();
          addLog(`👥 Users count: ${usersData.total}`);
          addLog(`📋 Users: ${JSON.stringify(usersData.users.map((u: { id: string; email: string }) => ({ id: u.id, email: u.email })))}`);
        }, 1000);
        
      } else {
        addLog(`❌ Registration failed: ${result.message}`);
      }
      
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testDuplicateEmail = async () => {
    setIsLoading(true);
    addLog("🔵 Testing duplicate email...");
    
    try {
      const testData = {
        fullName: "Duplicate Test User",
        email: "frontend@test.com", // This should already exist
        password: "test456"
      };
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      });
      
      const result = await response.json();
      
      if (response.status === 409) {
        addLog("✅ Duplicate email prevented correctly!");
      } else {
        addLog(`❌ Duplicate email NOT prevented. Status: ${response.status}`);
      }
      
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">
          🔧 Auth Debug Tool
        </h1>
        
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
            Test Registration
          </h2>
          <div className="flex gap-4 mb-4">
            <button
              onClick={testRegisterAPI}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Testing..." : "Test Register New User"}
            </button>
            <button
              onClick={testDuplicateEmail}
              disabled={isLoading}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {isLoading ? "Testing..." : "Test Duplicate Email"}
            </button>
            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
            >
              Clear Logs
            </button>
          </div>
        </div>
        
        <div className="bg-slate-900 dark:bg-black rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Debug Logs
          </h2>
          <div className="font-mono text-sm text-green-400 space-y-1 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-slate-400">No logs yet. Click a test button to start.</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="whitespace-pre-wrap break-words">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-400 mb-2">
            How to Use:
          </h3>
          <ol className="list-decimal list-inside text-blue-800 dark:text-blue-300 space-y-1">
            <li>Click "Test Register New User" to test registration</li>
            <li>Watch the logs to see API calls and responses</li>
            <li>Check if user appears in the users list</li>
            <li>Click "Test Duplicate Email" to verify email uniqueness</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
