"use client";

import { useState } from "react";
import { 
  Send, 
  Mic, 
  Paperclip, 
  Settings, 
  Sparkles, 
  Code, 
  FileText, 
  MessageSquare,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Zap
} from "lucide-react";

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  code?: string;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hello! I\'m your AI assistant. I can help you with coding, debugging, documentation, and more. What would you like to work on today?',
      timestamp: '10:00 AM'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'I understand you want to work on that. Let me help you with the best approach...',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        code: `// Example code
function optimizeComponent(component) {
  return React.memo(component);
}`
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">AI Assistant</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Powered by GPT-4</p>
          </div>
        </div>
        <button className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
              <div className={`px-4 py-3 rounded-lg ${
                message.type === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
              }`}>
                <p className="text-sm">{message.content}</p>
                {message.code && (
                  <div className="mt-2 p-3 bg-slate-800 dark:bg-slate-900 rounded-md">
                    <pre className="text-xs text-green-400 overflow-x-auto">
                      {message.code}
                    </pre>
                  </div>
                )}
              </div>
              <div className={`flex items-center space-x-2 mt-1 text-xs text-slate-500 ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}>
                <span>{message.timestamp}</span>
                {message.type === 'assistant' && (
                  <>
                    <button className="p-1 hover:text-slate-700 dark:hover:text-slate-300">
                      <Copy className="w-3 h-3" />
                    </button>
                    <button className="p-1 hover:text-slate-700 dark:hover:text-slate-300">
                      <ThumbsUp className="w-3 h-3" />
                    </button>
                    <button className="p-1 hover:text-slate-700 dark:hover:text-slate-300">
                      <ThumbsDown className="w-3 h-3" />
                    </button>
                    <button className="p-1 hover:text-slate-700 dark:hover:text-slate-300">
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 dark:bg-slate-700 px-4 py-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about coding, debugging, or documentation..."
              className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 border-0 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>
          <div className="flex items-center space-x-1">
            <button className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
              <Paperclip className="w-4 h-4" />
            </button>
            <button 
              className={`p-2 ${isRecording ? 'text-red-600' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              onClick={() => setIsRecording(!isRecording)}
            >
              <Mic className="w-4 h-4" />
            </button>
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center space-x-2 mt-2">
          <button className="px-3 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center">
            <Code className="w-3 h-3 mr-1" />
            Code
          </button>
          <button className="px-3 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center">
            <FileText className="w-3 h-3 mr-1" />
            Document
          </button>
          <button className="px-3 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center">
            <MessageSquare className="w-3 h-3 mr-1" />
            Explain
          </button>
          <button className="px-3 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center">
            <Zap className="w-3 h-3 mr-1" />
            Optimize
          </button>
        </div>
      </div>
    </div>
  );
}
