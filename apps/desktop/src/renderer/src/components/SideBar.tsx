import React from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, File, FileText, Plus } from 'lucide-react';

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  type: string;
  children?: FileItem[];
}

interface SideBarProps {
  activeView: string;
  files: FileItem[];
  loading: boolean;
  onFileSelect: (file: FileItem) => Promise<void>;
  expandedFolders: Set<string>;
  onFolderToggle: (path: string) => void;
}

export function SideBar({ activeView, files, loading, onFileSelect, expandedFolders, onFolderToggle }: SideBarProps) {
  const toggleFolder = (path: string) => {
    onFolderToggle(path);
  };

  const renderFileTree = (items: FileItem[], depth = 0) => {
    return items.map((item) => {
      const isExpanded = expandedFolders.has(item.path);
      const paddingLeft = depth * 12;

      if (item.isDirectory) {
        return (
          <div key={item.path}>
            <div
              className="flex items-center py-1 px-2 hover:bg-[#2a2d2e] cursor-pointer transition-colors"
              style={{ paddingLeft: `${paddingLeft + 8}px` }}
              onClick={() => toggleFolder(item.path)}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 mr-1 text-[#cccccc]" />
              ) : (
                <ChevronRight className="w-3 h-3 mr-1 text-[#cccccc]" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 mr-2 text-[#e8a87d]" />
              ) : (
                <Folder className="w-4 h-4 mr-2 text-[#e8a87d]" />
              )}
              <span className="text-sm text-[#cccccc]">{item.name}</span>
            </div>
            {isExpanded && item.children && (
              <div>{renderFileTree(item.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      return (
        <div
          key={item.path}
          className="flex items-center py-1 px-2 hover:bg-[#2a2d2e] cursor-pointer transition-colors"
          style={{ paddingLeft: `${paddingLeft + 20}px` }}
          onClick={() => onFileSelect(item)}
        >
          <FileText className="w-4 h-4 mr-2 text-[#cccccc]" />
          <span className="text-sm text-[#cccccc]">{item.name}</span>
        </div>
      );
    });
  };

  const renderExplorer = () => (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="p-2 border-b border-[#2a2d2e]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#cccccc] uppercase">Explorer</span>
          <div className="flex space-x-1">
            <button className="p-1 hover:bg-[#2a2d2e] rounded">
              <Plus className="w-3 h-3 text-[#cccccc]" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="text-center py-4">
            <div className="text-sm text-[#cccccc]">Loading...</div>
          </div>
        ) : (
          renderFileTree(files)
        )}
      </div>
    </div>
  );

  const renderSearch = () => (
    <div className="flex-1 overflow-hidden flex flex-col p-4">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search files..."
          className="w-full px-3 py-2 bg-[#2a2d2e] text-[#cccccc] border border-[#3e3e3e] rounded focus:outline-none focus:border-[#007acc]"
        />
      </div>
      <div className="text-sm text-[#858585] text-center py-8">
        No search results
      </div>
    </div>
  );

  const renderGit = () => (
    <div className="flex-1 overflow-hidden flex flex-col p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[#cccccc] mb-2">Source Control</h3>
        <div className="space-y-2">
          <div className="text-sm text-[#858585]">No changes</div>
        </div>
      </div>
    </div>
  );

  const renderAI = () => (
    <div className="flex-1 overflow-hidden flex flex-col p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[#cccccc] mb-2">AI Assistant</h3>
        <div className="space-y-2">
          <button className="w-full text-left px-3 py-2 bg-[#2a2d2e] text-[#cccccc] rounded hover:bg-[#3e3e3e] transition-colors">
            Start new chat
          </button>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeView) {
      case 'explorer':
        return renderExplorer();
      case 'search':
        return renderSearch();
      case 'git':
        return renderGit();
      case 'ai':
        return renderAI();
      default:
        return renderExplorer();
    }
  };

  return (
    <div className="w-64 bg-[#252526] flex flex-col border-r border-[#3e3e3e]">
      {renderContent()}
    </div>
  );
}
