export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  type: string;
  gitStatus?: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  children?: FileItem[];
}

export interface ElectronAPI {
  // Project Management
  openProjectDialog: () => Promise<string | null>;
  openFileDialog: () => Promise<string | null>;
  saveAsDialog: (defaultPath?: string) => Promise<string | null>;
  showMessageBox: (options: { type?: string; title?: string; message?: string; detail?: string }) => Promise<{ response: number }>;
  openProject: (projectPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  
  // File System Operations
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  createFile: (filePath: string, content?: string) => Promise<{ success: boolean; error?: string }>;
  createFolder: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
  renamePath: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
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
  gitInit: (repoPath: string) => Promise<{ success: boolean; error?: string }>;
  getWorkspacePath: () => Promise<{ success: boolean; path?: string | null }>;
  
  // Terminal Operations
  terminalKill: (id: string) => Promise<{ success: boolean }>;
  onTerminalData: (callback: (payload: { id: string; data: string }) => void) => void;
  onTerminalExit: (callback: (payload: { id: string; exitCode: number }) => void) => void;
  removeTerminalListeners: () => void;
  searchInProject: (rootPath: string, query: string) => Promise<{ success: boolean; results?: Array<{ name: string; path: string; matches: number }>; error?: string }>;
  walkProjectFiles: (rootPath: string) => Promise<{ success: boolean; files?: Array<{ name: string; path: string; isDirectory: boolean; type: string }>; error?: string }>;
  gitCreateBranch: (repoPath: string, branchName: string) => Promise<{ success: boolean; error?: string }>;
  gitSwitchBranch: (repoPath: string, branchName: string) => Promise<{ success: boolean; error?: string }>;
  windowNew: () => Promise<{ success: boolean }>;
  windowNewAgent: () => Promise<{ success: boolean }>;
  terminalCreate: (cwd?: string, shell?: string) => Promise<{ success: boolean; id?: string; shell?: string; name?: string; cwd?: string; error?: string }>;
  terminalWrite: (id: string, data: string) => Promise<{ success: boolean }>;
  terminalResize: (id: string, cols: number, rows: number) => Promise<{ success: boolean }>;
  terminalCommand: (command: string, cwd?: string) => Promise<{ success: boolean; stdout?: string; stderr?: string; exitCode?: number; error?: string }>;
  
  // Utility
  openExternal: (url: string) => Promise<void>;
  showItemInFolder: (fullPath: string) => Promise<void>;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<boolean>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;

  debugGetLaunchConfigs: (projectPath: string) => Promise<{ success: boolean; configs?: Array<Record<string, unknown>>; error?: string }>;
  debugStart: (projectPath: string, config: Record<string, unknown>, activeFile?: string) => Promise<{ success: boolean; error?: string }>;
  debugStop: () => Promise<{ success: boolean }>;
  onDebugOutput: (callback: (line: string) => void) => void;
  removeDebugListeners: () => void;

  // Events
  onFileChanged: (callback: (path: string) => void) => void;
  onFileAdded: (callback: (path: string) => void) => void;
  onFileDeleted: (callback: (path: string) => void) => void;
  onWorkspaceChanged: (callback: (path: string) => void) => void;
  
  // Remove all listeners
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
