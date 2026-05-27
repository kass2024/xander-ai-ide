import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Project Management
  openProjectDialog: () => ipcRenderer.invoke('open-project-dialog'),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveAsDialog: (defaultPath?: string) => ipcRenderer.invoke('save-as-dialog', defaultPath),
  showMessageBox: (options: Electron.MessageBoxOptions) => ipcRenderer.invoke('show-message-box', options),
  openProject: (projectPath: string) => ipcRenderer.invoke('open-project', projectPath),
  getWorkspacePath: () => ipcRenderer.invoke('get-workspace-path'),
  
  // File System Operations
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('write-file', filePath, content),
  createFile: (filePath: string, content?: string) => ipcRenderer.invoke('create-file', filePath, content),
  createFolder: (dirPath: string) => ipcRenderer.invoke('create-folder', dirPath),
  renamePath: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename-path', oldPath, newPath),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  listFiles: (dirPath: string) => ipcRenderer.invoke('list-files', dirPath),
  
  // Git Operations
  gitStatus: (repoPath: string) => ipcRenderer.invoke('git-status', repoPath),
  gitAdd: (repoPath: string, files: string[]) => ipcRenderer.invoke('git-add', repoPath, files),
  gitCommit: (repoPath: string, message: string) => ipcRenderer.invoke('git-commit', repoPath, message),
  gitPush: (repoPath: string, branch?: string) => ipcRenderer.invoke('git-push', repoPath, branch),
  gitPull: (repoPath: string, branch?: string) => ipcRenderer.invoke('git-pull', repoPath, branch),
  gitBranches: (repoPath: string) => ipcRenderer.invoke('git-branches', repoPath),
  gitDiff: (repoPath: string, file?: string) => ipcRenderer.invoke('git-diff', repoPath, file),
  gitInit: (repoPath: string) => ipcRenderer.invoke('git-init', repoPath),
  
  // Terminal PTY Operations
  terminalCreate: (cwd?: string, shell?: string) => ipcRenderer.invoke('terminal-create', cwd, shell),
  terminalWrite: (id: string, data: string) => ipcRenderer.invoke('terminal-write', id, data),
  terminalResize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal-resize', id, cols, rows),
  terminalKill: (id: string) => ipcRenderer.invoke('terminal-kill', id),
  terminalCommand: (command: string, cwd?: string) => ipcRenderer.invoke('terminal-command', command, cwd),
  onTerminalData: (callback: (payload: { id: string; data: string }) => void) => {
    ipcRenderer.on('terminal-data', (_, payload) => callback(payload));
  },
  onTerminalExit: (callback: (payload: { id: string; exitCode: number }) => void) => {
    ipcRenderer.on('terminal-exit', (_, payload) => callback(payload));
  },
  removeTerminalListeners: () => {
    ipcRenderer.removeAllListeners('terminal-data');
    ipcRenderer.removeAllListeners('terminal-exit');
  },

  searchInProject: (rootPath: string, query: string) =>
    ipcRenderer.invoke('search-in-project', rootPath, query),
  walkProjectFiles: (rootPath: string) =>
    ipcRenderer.invoke('walk-project-files', rootPath),

  gitCreateBranch: (repoPath: string, branchName: string) =>
    ipcRenderer.invoke('git-create-branch', repoPath, branchName),
  gitSwitchBranch: (repoPath: string, branchName: string) =>
    ipcRenderer.invoke('git-switch-branch', repoPath, branchName),

  windowNew: () => ipcRenderer.invoke('window-new'),
  windowNewAgent: () => ipcRenderer.invoke('window-new-agent'),
  
  // Utility
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  showItemInFolder: (fullPath: string) => ipcRenderer.invoke('show-item-in-folder', fullPath),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  debugGetLaunchConfigs: (projectPath: string) =>
    ipcRenderer.invoke('debug-get-launch-configs', projectPath),
  debugStart: (projectPath: string, config: LaunchConfig, activeFile?: string) =>
    ipcRenderer.invoke('debug-start', projectPath, config, activeFile),
  debugStop: () => ipcRenderer.invoke('debug-stop'),
  onDebugOutput: (callback: (line: string) => void) => {
    ipcRenderer.on('debug-output', (_, line) => callback(line));
  },
  removeDebugListeners: () => {
    ipcRenderer.removeAllListeners('debug-output');
  },
  
  // Events
  onFileChanged: (callback: (path: string) => void) => {
    ipcRenderer.on('file-changed', (_, path) => callback(path));
  },
  onFileAdded: (callback: (path: string) => void) => {
    ipcRenderer.on('file-added', (_, path) => callback(path));
  },
  onFileDeleted: (callback: (path: string) => void) => {
    ipcRenderer.on('file-deleted', (_, path) => callback(path));
  },
  onWorkspaceChanged: (callback: (path: string) => void) => {
    ipcRenderer.on('workspace-changed', (_, path) => callback(path));
  },
  
  // Remove all listeners
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
});

// Type definitions for the exposed API
export interface ElectronAPI {
  // Project Management
  openProjectDialog: () => Promise<string | null>;
  openFileDialog: () => Promise<string | null>;
  saveAsDialog: (defaultPath?: string) => Promise<string | null>;
  showMessageBox: (options: Electron.MessageBoxOptions) => Promise<Electron.MessageBoxReturnValue>;
  openProject: (projectPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  
  // File System Operations
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  createFile: (filePath: string, content?: string) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  listFiles: (dirPath: string) => Promise<{ success: boolean; files?: FileItem[]; error?: string }>;
  
  // Git Operations
  gitStatus: (repoPath: string) => Promise<{ success: boolean; status?: any; error?: string }>;
  gitAdd: (repoPath: string, files: string[]) => Promise<{ success: boolean; error?: string }>;
  gitCommit: (repoPath: string, message: string) => Promise<{ success: boolean; error?: string }>;
  gitPush: (repoPath: string, branch?: string) => Promise<{ success: boolean; error?: string }>;
  gitPull: (repoPath: string, branch?: string) => Promise<{ success: boolean; error?: string }>;
  gitBranches: (repoPath: string) => Promise<{ success: boolean; branches?: any; error?: string }>;
  gitDiff: (repoPath: string, file?: string) => Promise<{ success: boolean; diff?: string; error?: string }>;
  
  // Terminal PTY
  terminalCreate: (cwd?: string, shell?: string) => Promise<{ success: boolean; id?: string; shell?: string; name?: string; error?: string }>;
  terminalWrite: (id: string, data: string) => Promise<{ success: boolean }>;
  terminalResize: (id: string, cols: number, rows: number) => Promise<{ success: boolean }>;
  terminalKill: (id: string) => Promise<{ success: boolean }>;
  terminalCommand: (command: string, cwd?: string) => Promise<{ success: boolean; stdout?: string; stderr?: string; exitCode?: number; error?: string }>;
  onTerminalData: (callback: (payload: { id: string; data: string }) => void) => void;
  onTerminalExit: (callback: (payload: { id: string; exitCode: number }) => void) => void;
  removeTerminalListeners: () => void;
  searchInProject: (rootPath: string, query: string) => Promise<{ success: boolean; results?: Array<{ name: string; path: string; matches: number }>; error?: string }>;
  gitCreateBranch: (repoPath: string, branchName: string) => Promise<{ success: boolean; error?: string }>;
  gitSwitchBranch: (repoPath: string, branchName: string) => Promise<{ success: boolean; error?: string }>;
  windowNew: () => Promise<{ success: boolean }>;
  windowNewAgent: () => Promise<{ success: boolean }>;
  
  // Utility
  openExternal: (url: string) => Promise<void>;
  showItemInFolder: (fullPath: string) => Promise<void>;

  // Window controls
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;

  debugGetLaunchConfigs: (projectPath: string) => Promise<{ success: boolean; configs: LaunchConfig[]; error?: string }>;
  debugStart: (projectPath: string, config: LaunchConfig, activeFile?: string) => Promise<{ success: boolean; error?: string; config?: LaunchConfig }>;
  debugStop: () => Promise<{ success: boolean }>;
  onDebugOutput: (callback: (line: string) => void) => void;
  removeDebugListeners: () => void;
  
  // Events
  onFileChanged: (callback: (path: string) => void) => void;
  onFileAdded: (callback: (path: string) => void) => void;
  onFileDeleted: (callback: (path: string) => void) => void;
  
  // Remove all listeners
  removeAllListeners: (channel: string) => void;
}

export interface LaunchConfig {
  name: string;
  type: string;
  program?: string;
  args?: string[];
  cwd?: string;
  request?: string;
  console?: string;
  env?: Record<string, string>;
}

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  type: string;
  gitStatus?: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  children?: FileItem[];
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
