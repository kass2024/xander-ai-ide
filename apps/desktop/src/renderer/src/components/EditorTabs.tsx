import React from 'react';
import { X, ChevronDown, FileText, Circle } from 'lucide-react';

interface OpenFile {
  id: string;
  name: string;
  content: string;
  language: string;
  isDirty?: boolean;
  isActive?: boolean;
}

interface EditorTabsProps {
  openFiles: OpenFile[];
  activeTab: string;
  onTabSelect: (fileId: string) => void;
  onTabClose: (fileId: string) => void;
}

export function EditorTabs({ 
  openFiles, 
  activeTab, 
  onTabSelect, 
  onTabClose 
}: EditorTabsProps) {
  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return FileText; // Simplified for now
  };

  const handleTabContextMenu = (e: React.MouseEvent, file: OpenFile) => {
    e.preventDefault();
    // Context menu for tabs
    console.log('Tab context menu', file);
  };

  return (
    <div className="flex items-center h-11 bg-[var(--vscode-editor-background)] border-b border-[var(--vscode-tab-border)]">
      {/* Tabs Container */}
      <div className="flex items-center flex-1 overflow-x-auto">
        {openFiles.map((file, index) => {
          const Icon = getFileIcon(file.name);
          const isActive = file.id === activeTab;
          const isFirst = index === 0;
          
          return (
            <div
              key={file.id}
              className={`group flex items-center h-full px-3 border-r border-[var(--vscode-tab-border)] cursor-pointer transition-all duration-200 relative min-w-0 max-w-[240px] ${
                isActive 
                  ? 'bg-[var(--vscode-tab-activeBackground)]' 
                  : 'bg-[var(--vscode-tab-inactiveBackground)] hover:bg-[var(--vscode-tab-hoverBackground)]'
              }`}
              onClick={() => onTabSelect(file.id)}
              onContextMenu={(e) => handleTabContextMenu(e, file)}
            >
              {/* File Icon */}
              <Icon className={`w-4 h-4 mr-2 flex-shrink-0 transition-colors duration-200 ${
                isActive ? 'text-[var(--vscode-tab-activeForeground)]' : 'text-[var(--vscode-tab-inactiveForeground)]'
              }`} />
              
              {/* File Name */}
              <span className={`text-[13px] truncate flex-1 min-w-0 font-medium transition-colors duration-200 ${
                isActive ? 'text-[var(--vscode-tab-activeForeground)]' : 'text-[var(--vscode-tab-inactiveForeground)]'
              }`}>
                {file.name}
              </span>
              
              {/* Dirty Indicator */}
              {file.isDirty && (
                <Circle className="w-2 h-2 mx-1.5 fill-current text-[var(--vscode-tab-activeForeground)] opacity-80" />
              )}
              
              {/* Close Button */}
              <button
                className={`w-5 h-5 flex items-center justify-center rounded-sm ml-1 transition-all duration-200 ${
                  isActive 
                    ? 'hover:bg-[rgba(255,255,255,0.1)]' 
                    : 'hover:bg-[rgba(255,255,255,0.05)]'
                } opacity-0 group-hover:opacity-100`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(file.id);
                }}
              >
                <X className={`w-3 h-3 transition-colors duration-200 ${
                  isActive ? 'text-[var(--vscode-tab-activeForeground)]' : 'text-[var(--vscode-tab-inactiveForeground)]'
                }`} />
              </button>
              
              {/* Active Tab Indicator */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--vscode-tab-activeBorderTop)]"></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tab Actions */}
      <div className="flex items-center px-2 border-l border-[var(--vscode-tab-border)]">
        <button className="p-1.5 hover:bg-[var(--vscode-list-hoverBackground)] rounded-sm transition-all duration-200">
          <ChevronDown className="w-3.5 h-3.5 text-[var(--vscode-tab-inactiveForeground)]" />
        </button>
      </div>
    </div>
  );
}
