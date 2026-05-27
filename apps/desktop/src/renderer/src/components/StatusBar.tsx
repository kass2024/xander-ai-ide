import React from 'react';
import { GitBranch, AlertCircle, CheckCircle, X } from 'lucide-react';

interface StatusBarProps {
  currentFile?: string;
  language?: string;
  encoding?: string;
  lineEnding?: string;
  gitBranch?: string;
  gitStatus?: 'clean' | 'dirty' | 'syncing';
  cursorPosition?: { line: number; column: number };
  indentSize?: number;
  problems?: { errors: number; warnings: number };
  workspaceName?: string;
  aiStatus?: string;
  planName?: string;
  onPlanClick?: () => void;
}

export function StatusBar({
  currentFile = '',
  language = 'plaintext',
  encoding = 'UTF-8',
  lineEnding = 'LF',
  gitBranch = 'main',
  gitStatus = 'clean',
  cursorPosition = { line: 1, column: 1 },
  indentSize = 4,
  problems = { errors: 0, warnings: 0 },
  workspaceName = '',
  aiStatus = 'disconnected',
  planName = 'Free',
  onPlanClick,
}: StatusBarProps) {
  const getStatusIcon = () => {
    if (problems.errors > 0) {
      return <AlertCircle className="w-3 h-3 text-red-500" />;
    }
    if (problems.warnings > 0) {
      return <AlertCircle className="w-3 h-3 text-yellow-500" />;
    }
    return <CheckCircle className="w-3 h-3 text-green-500" />;
  };

  const getGitStatusColor = () => {
    switch (gitStatus) {
      case 'dirty': return 'text-yellow-500';
      case 'syncing': return 'text-blue-500';
      default: return 'text-green-500';
    }
  };

  return (
    <div className="h-7 bg-[var(--vscode-statusBar-background)] flex items-center justify-between px-3 text-[11px] text-[var(--vscode-statusBar-foreground)] border-t border-[var(--vscode-statusBar-border)]">
      {/* Left side */}
      <div className="flex items-center space-x-4">
        {/* File info */}
        {currentFile && (
          <div className="flex items-center space-x-2 hover:bg-[var(--vscode-statusBarItem-hoverBackground)] px-2 py-1 rounded transition-all duration-150 cursor-pointer">
            <span className="font-medium">{currentFile.split('\\').pop() || currentFile}</span>
            {language && <span className="text-[var(--vscode-statusBar-foreground)] opacity-80">{language}</span>}
          </div>
        )}
        
        {/* Git branch */}
        <div className={`flex items-center space-x-1.5 ${getGitStatusColor()} hover:bg-[var(--vscode-statusBarItem-hoverBackground)] px-2 py-1 rounded transition-all duration-150 cursor-pointer`}>
          <GitBranch className="w-3.5 h-3.5" />
          <span className="font-medium">{gitBranch}</span>
        </div>
        
        {/* Problems */}
        {(problems.errors > 0 || problems.warnings > 0) && (
          <div className="flex items-center space-x-1.5 hover:bg-[var(--vscode-statusBarItem-hoverBackground)] px-2 py-1 rounded transition-all duration-150 cursor-pointer">
            {getStatusIcon()}
            <span className="font-medium">{problems.errors} {problems.errors === 1 ? 'error' : 'errors'}, {problems.warnings} {problems.warnings === 1 ? 'warning' : 'warnings'}</span>
          </div>
        )}
        
        {/* AI Status */}
        <div className="flex items-center space-x-1.5 hover:bg-[var(--vscode-statusBarItem-hoverBackground)] px-2 py-1 rounded transition-all duration-150 cursor-pointer">
          <div className={`w-2 h-2 rounded-full ${
            aiStatus === 'connected' ? 'bg-green-400' : 
            aiStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-400'
          }`}></div>
          <span className="font-medium">{aiStatus}</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-4">
        {/* Plan badge */}
        <button
          onClick={onPlanClick}
          className="flex items-center space-x-1.5 hover:bg-[var(--vscode-statusBarItem-hoverBackground)] px-2 py-1 rounded transition-all duration-150 cursor-pointer"
        >
          <span className="font-medium">{planName} Plan</span>
        </button>

        {/* Cursor position */}
        <div className="flex items-center space-x-1.5 hover:bg-[var(--vscode-statusBarItem-hoverBackground)] px-2 py-1 rounded transition-all duration-150 cursor-pointer">
          <span className="font-medium">Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
        </div>
        
        {/* Spaces */}
        <div className="flex items-center space-x-1.5 hover:bg-[var(--vscode-statusBarItem-hoverBackground)] px-2 py-1 rounded transition-all duration-150 cursor-pointer">
          <span className="font-medium">Spaces: {indentSize}</span>
        </div>
        
        {/* Encoding */}
        <div className="flex items-center space-x-1.5 hover:bg-[var(--vscode-statusBarItem-hoverBackground)] px-2 py-1 rounded transition-all duration-150 cursor-pointer">
          <span className="font-medium">{encoding}</span>
        </div>
        
        {/* Line ending */}
        <div className="flex items-center space-x-1.5 hover:bg-[var(--vscode-statusBarItem-hoverBackground)] px-2 py-1 rounded transition-all duration-150 cursor-pointer">
          <span className="font-medium">{lineEnding}</span>
        </div>
        
        {/* Notifications */}
        <div className="flex items-center space-x-1.5 hover:bg-[var(--vscode-statusBarItem-hoverBackground)] px-2 py-1 rounded transition-all duration-150 cursor-pointer">
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="font-medium">0</span>
        </div>
      </div>
    </div>
  );
}
