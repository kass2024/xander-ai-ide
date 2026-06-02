import React from 'react';
import { Files, Search, GitBranch } from 'lucide-react';
import { FileExplorer } from './FileExplorer';
import { SearchPanel } from './SearchPanel';
import { GitPanel } from './GitPanel';
import type { FileItem } from '../types';

export type RightPanelTab = 'explorer' | 'search' | 'git';

interface RightSidebarProps {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  projectPath: string | null;
  workspaceName: string;
  files: FileItem[];
  loading: boolean;
  expandedFolders: Set<string>;
  loadingDirs: Set<string>;
  onFileSelect: (file: FileItem) => void;
  onFolderToggle: (path: string) => void;
  onRefresh: () => void;
  onOpenFile: (path: string) => void;
}

const TABS: Array<{ id: RightPanelTab; label: string; icon: typeof Files }> = [
  { id: 'explorer', label: 'Explorer', icon: Files },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'git', label: 'Git', icon: GitBranch },
];

export function RightSidebar({
  activeTab,
  onTabChange,
  projectPath,
  workspaceName,
  files,
  loading,
  expandedFolders,
  loadingDirs,
  onFileSelect,
  onFolderToggle,
  onRefresh,
  onOpenFile,
}: RightSidebarProps) {
  return (
    <div className="h-full flex flex-col bg-[var(--vscode-sideBar-background)] border-l border-[var(--vscode-sideBar-border)]">
      <div className="flex items-center border-b border-[var(--vscode-sideBar-border)] shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors ${
              activeTab === id
                ? 'text-[var(--vscode-foreground)] border-b-2 border-[var(--vscode-focusBorder)]'
                : 'text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]'
            }`}
            title={label}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'explorer' && (
          <FileExplorer
            files={files}
            loading={loading}
            onFileSelect={onFileSelect}
            expandedFolders={expandedFolders}
            onFolderToggle={onFolderToggle}
            loadingDirs={loadingDirs}
            workspaceName={workspaceName}
            projectPath={projectPath}
            onRefresh={onRefresh}
          />
        )}
        {activeTab === 'search' && (
          <SearchPanel projectPath={projectPath} onOpenFile={onOpenFile} />
        )}
        {activeTab === 'git' && <GitPanel projectPath={projectPath} />}
      </div>
    </div>
  );
}
