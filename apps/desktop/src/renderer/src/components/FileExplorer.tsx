import React, { useState } from 'react';
import { joinPath, parentDir, pathSep } from '../lib/fileTree';
import { 
  ChevronDown, 
  ChevronRight, 
  Folder, 
  FolderOpen, 
  File, 
  FileText, 
  FileCode, 
  FileJson, 
  FileImage,
  FilePlus,
  RefreshCw,
  Search,
  MoreVertical,
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  AlertCircle
} from 'lucide-react';

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  type: string;
  children?: FileItem[];
  gitStatus?: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
}

interface FileExplorerProps {
  files: FileItem[];
  loading: boolean;
  loadingDirs?: Set<string>;
  onFileSelect: (file: FileItem) => Promise<void>;
  expandedFolders: Set<string>;
  onFolderToggle: (path: string) => void | Promise<void>;
  workspaceName?: string;
  projectPath?: string | null;
  onRefresh?: () => void;
}

export function FileExplorer({ 
  files, 
  loading, 
  loadingDirs,
  onFileSelect, 
  expandedFolders, 
  onFolderToggle,
  workspaceName = 'Untitled Workspace',
  projectPath,
  onRefresh,
}: FileExplorerProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileItem | null } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const getFileIcon = (item: FileItem) => {
    if (item.isDirectory) {
      return expandedFolders.has(item.path) ? FolderOpen : Folder;
    }

    const extension = item.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return FileCode;
      case 'json':
        return FileJson;
      case 'txt':
      case 'md':
        return FileText;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return FileImage;
      default:
        return File;
    }
  };

  const getGitStatusColor = (status?: string) => {
    switch (status) {
      case 'modified':
        return 'text-yellow-500';
      case 'added':
        return 'text-green-500';
      case 'deleted':
        return 'text-red-500';
      case 'renamed':
        return 'text-blue-500';
      case 'untracked':
        return 'text-gray-500';
      default:
        return '';
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleContextAction = async (action: string, item: FileItem | null) => {
    if (!item) return;
    closeContextMenu();
    const base = projectPath || '';
    try {
      switch (action) {
        case 'open': await onFileSelect(item); break;
        case 'delete': {
          if (!confirm(`Delete ${item.name}?`)) return;
          await window.electronAPI.deleteFile(item.path);
          onRefresh?.();
          break;
        }
        case 'rename': {
          const newName = prompt('New name:', item.name);
          if (!newName || newName === item.name) return;
          const parent = parentDir(item.path);
          await window.electronAPI.renamePath(item.path, joinPath(parent, newName));
          onRefresh?.();
          break;
        }
        case 'newFile': {
          const name = prompt('File name:', 'untitled.txt');
          if (!name) return;
          const path = item.isDirectory ? joinPath(item.path, name) : joinPath(parentDir(item.path), name);
          await window.electronAPI.createFile(path, '');
          onRefresh?.();
          break;
        }
        case 'newFolder': {
          const name = prompt('Folder name:', 'new-folder');
          if (!name) return;
          const path = item.isDirectory ? joinPath(item.path, name) : joinPath(parentDir(item.path), name);
          await window.electronAPI.createFolder(path);
          onRefresh?.();
          break;
        }
        case 'copyRelativePath': {
          if (projectPath) {
            const sep = pathSep(projectPath);
            const rel = item.path.startsWith(projectPath)
              ? item.path.slice(projectPath.length).replace(/^[/\\]/, '')
              : item.path;
            navigator.clipboard.writeText(rel);
          }
          break;
        }
        case 'copyPath':
          navigator.clipboard.writeText(item.path);
          break;
        case 'reveal':
          window.electronAPI.showItemInFolder(item.path);
          break;
      }
    } catch (err) {
      console.error('Context action failed:', err);
    }
  };

  const renderFileTree = (items: FileItem[], depth = 0) => {
    const filteredItems = searchQuery 
      ? items.filter(item => 
          item.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : items;

    return filteredItems.map((item) => {
      const isExpanded = expandedFolders.has(item.path);
      const isLoadingDir = loadingDirs?.has(item.path);
      const Icon = getFileIcon(item);
      const paddingLeft = depth * 16;

      if (item.isDirectory) {
        return (
          <div key={item.path}>
            <div
              className={`flex items-center py-1.5 px-2 hover:bg-[var(--vscode-list-hoverBackground)] cursor-pointer transition-all duration-150 group rounded-sm ${
                item.gitStatus ? getGitStatusColor(item.gitStatus) : ''
              }`}
              style={{ paddingLeft: `${paddingLeft + 8}px` }}
              onClick={() => onFolderToggle(item.path)}
              onContextMenu={(e) => handleContextMenu(e, item)}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 mr-1 text-[var(--vscode-foreground)] transition-transform duration-150" />
              ) : (
                <ChevronRight className="w-4 h-4 mr-1 text-[var(--vscode-foreground)] transition-transform duration-150" />
              )}
              <Icon className={`w-4 h-4 mr-2 transition-colors duration-150 ${
                item.isDirectory ? 'text-blue-400' : 'text-[var(--vscode-foreground)]'
              }`} />
              <span className="text-[13px] text-[var(--vscode-foreground)] flex-1 font-medium">{item.name}</span>
              {isLoadingDir && (
                <RefreshCw className="w-3 h-3 ml-1 animate-spin opacity-60" />
              )}
              
              {/* Git Status Icon */}
              {item.gitStatus && (
                <GitCommit className="w-3 h-3 ml-2 opacity-70" />
              )}
              
              {/* Context Menu Button */}
              <button
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--vscode-list-hoverBackground)] opacity-0 group-hover:opacity-100 transition-all duration-150"
                onClick={(e) => {
                  e.stopPropagation();
                  handleContextMenu(e, item);
                }}
              >
                <MoreVertical className="w-3 h-3" />
              </button>
            </div>
            {isExpanded && (
              <div className="ml-2 border-l border-[var(--vscode-tree-indentGuidesStroke)]">
                {item.children && item.children.length > 0
                  ? renderFileTree(item.children, depth + 1)
                  : !isLoadingDir && (
                    <div className="py-1 px-6 text-[11px] text-[var(--vscode-descriptionForeground)]">Empty folder</div>
                  )}
              </div>
            )}
          </div>
        );
      }

      return (
        <div
          key={item.path}
          className={`flex items-center py-1.5 px-2 hover:bg-[var(--vscode-list-hoverBackground)] cursor-pointer transition-all duration-150 group rounded-sm ${
            item.gitStatus ? getGitStatusColor(item.gitStatus) : ''
          }`}
          style={{ paddingLeft: `${paddingLeft + 24}px` }}
          onClick={() => onFileSelect(item)}
          onContextMenu={(e) => handleContextMenu(e, item)}
        >
          <Icon className="w-4 h-4 mr-2 text-[var(--vscode-foreground)]" />
          <span className="text-[13px] text-[var(--vscode-foreground)] flex-1 font-medium">{item.name}</span>
          
          {/* Git Status Icon */}
          {item.gitStatus && (
            <GitCommit className="w-3 h-3 ml-2 opacity-70" />
          )}
          
          {/* Context Menu Button */}
          <button
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--vscode-list-hoverBackground)] opacity-0 group-hover:opacity-100 transition-all duration-150"
            onClick={(e) => {
              e.stopPropagation();
              handleContextMenu(e, item);
            }}
          >
            <MoreVertical className="w-3 h-3" />
          </button>
        </div>
      );
    });
  };

  const contextMenuItems = contextMenu?.item?.isDirectory ? [
    { label: 'New File...', action: 'newFile' },
    { label: 'New Folder...', action: 'newFolder' },
    { type: 'separator' },
    { label: 'Rename', action: 'rename' },
    { label: 'Delete', action: 'delete' },
    { type: 'separator' },
    { label: 'Copy Path', action: 'copyPath' },
    { label: 'Reveal in Explorer', action: 'reveal' }
  ] : [
    { label: 'Open', action: 'open' },
    { label: 'Open to the Side', action: 'openSide' },
    { type: 'separator' },
    { label: 'Rename', action: 'rename' },
    { label: 'Delete', action: 'delete' },
    { type: 'separator' },
    { label: 'Copy Path', action: 'copyPath' },
    { label: 'Copy Relative Path', action: 'copyRelativePath' }
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-[var(--vscode-sideBar-border)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <span className="text-[11px] font-semibold text-[var(--vscode-foreground)] uppercase tracking-wider">
              EXPLORER
            </span>
            {files.some(f => f.gitStatus) && (
              <GitBranch className="w-3 h-3 ml-2 text-[var(--vscode-foreground)]" />
            )}
          </div>
          <div className="flex items-center space-x-1">
            <button
              className="p-1.5 hover:bg-[var(--vscode-list-hoverBackground)] rounded transition-all duration-150"
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="w-3.5 h-3.5 text-[var(--vscode-foreground)]" />
            </button>
            <button className="p-1.5 hover:bg-[var(--vscode-list-hoverBackground)] rounded transition-all duration-150">
              <FilePlus className="w-3.5 h-3.5 text-[var(--vscode-foreground)]" />
            </button>
            <button onClick={onRefresh} className="p-1.5 hover:bg-[var(--vscode-list-hoverBackground)] rounded transition-all duration-150">
              <RefreshCw className="w-3.5 h-3.5 text-[var(--vscode-foreground)]" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-[13px] bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded text-[var(--vscode-input-foreground)] placeholder-[var(--vscode-input-placeholderForeground)] transition-all duration-150 focus:border-[var(--vscode-focusBorder)]"
            />
          </div>
        )}

        {/* Workspace Info */}
        <div className="text-[11px] text-[var(--vscode-descriptionForeground)] mb-2 font-medium">
          {workspaceName}
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-4 h-4 animate-spin text-[var(--vscode-foreground)]" />
          </div>
        ) : files.length > 0 ? (
          renderFileTree(files)
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-[var(--vscode-descriptionForeground)]">
            <AlertCircle className="w-8 h-8 mb-2 opacity-70" />
            <span className="text-[11px]">No files opened</span>
            <span className="text-[11px] mt-1">Open a folder or workspace</span>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-[var(--vscode-dropdown-background)] border border-[var(--vscode-dropdown-border)] rounded-md shadow-lg py-1 z-50 min-w-[180px] backdrop-blur-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={closeContextMenu}
        >
          {contextMenuItems.map((item, index) => {
            if (item.type === 'separator') {
              return (
                <div key={index} className="h-px bg-[var(--vscode-dropdown-border)] my-1" />
              );
            }
            
            return (
              <button
                key={index}
                className="w-full text-left px-3 py-1.5 text-[13px] text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] transition-all duration-150"
                onClick={() => handleContextAction(item.action!, contextMenu.item)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
