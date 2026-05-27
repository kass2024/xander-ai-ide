import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { join, dirname } from 'path';
import { readFile, writeFile, access, mkdir, rename, unlink, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import chokidar, { FSWatcher } from 'chokidar';
import simpleGit, { SimpleGit } from 'simple-git';
import {
  createTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal,
  killAllTerminals,
  getTerminalEnv,
} from './terminal-manager';
import {
  readLaunchConfigurations,
  startDebug,
  stopDebug,
  type LaunchConfiguration,
} from './debug-manager';
import {
  setWorkspacePath,
  getWorkspacePath,
  resolveInWorkspace,
  isValidWorkspacePath,
} from './workspace';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
const agentWindows = new Set<BrowserWindow>();
let currentProjectPath: string | null = null;
let fileWatcher: FSWatcher | null = null;

const IGNORED = new Set([
  'node_modules', 'vendor', '.git', 'dist', 'build', '.next', 'release', 'out',
  '.cache', 'coverage', 'storage', 'logs', 'uploads', 'tmp', 'temp', '.turbo',
]);

function getWindowFromEvent(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

function getPreloadPath(): string {
  const mjs = join(__dirname, '../preload/preload.mjs');
  const js = join(__dirname, '../preload/preload.js');
  return existsSync(mjs) ? mjs : js;
}

function createAppWindow(options?: { agentMode?: boolean }): BrowserWindow {
  const win = new BrowserWindow({
    width: options?.agentMode ? 1100 : 1400,
    height: options?.agentMode ? 800 : 900,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: getPreloadPath(),
    },
    show: false,
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    const url = options?.agentMode
      ? `${process.env['ELECTRON_RENDERER_URL']}?agentWindow=1`
      : process.env['ELECTRON_RENDERER_URL'];
    win.loadURL(url);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), {
      query: options?.agentMode ? { agentWindow: '1' } : undefined,
    });
  }

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    if (win === mainWindow) mainWindow = null;
    agentWindows.delete(win);
    killAllTerminals();
  });

  return win;
}

function getGit(repoPath: string): SimpleGit {
  return simpleGit(repoPath);
}

function startWatching(projectPath: string) {
  fileWatcher?.close();
  fileWatcher = chokidar.watch(projectPath, {
    ignored: /(^|[\\/\\])(node_modules|vendor|\.git|dist|build|\.next|release|\.cache|storage|logs|uploads)([\\/\\]|$)/,
    ignoreInitial: true,
    persistent: true,
  });

  fileWatcher.on('change', (path) => mainWindow?.webContents.send('file-changed', path));
  fileWatcher.on('add', (path) => mainWindow?.webContents.send('file-added', path));
  fileWatcher.on('unlink', (path) => mainWindow?.webContents.send('file-deleted', path));
}

function createWindow(): void {
  mainWindow = createAppWindow();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// IPC Handlers

// Project Management
ipcMain.handle('open-project-dialog', async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Project Folder',
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('open-project', async (_, projectPath: string) => {
  try {
    await access(projectPath);
    currentProjectPath = projectPath;
    setWorkspacePath(projectPath);
    startWatching(projectPath);
    killAllTerminals();
    mainWindow?.webContents.send('workspace-changed', projectPath);
    return { success: true, path: projectPath };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-workspace-path', async () => {
  return { success: true, path: getWorkspacePath() };
});

ipcMain.handle('open-file-dialog', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Open File',
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Code', extensions: ['ts', 'tsx', 'js', 'jsx', 'py', 'json', 'md', 'html', 'css'] },
    ],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('save-as-dialog', async (_, defaultPath?: string) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save As',
    defaultPath,
    filters: [{ name: 'All Files', extensions: ['*'] }],
  });
  if (!result.canceled && result.filePath) {
    return result.filePath;
  }
  return null;
});

ipcMain.handle('show-message-box', async (_, options: Electron.MessageBoxOptions) => {
  if (!mainWindow) return { response: 0 };
  return dialog.showMessageBox(mainWindow, options);
});

// File System Operations
ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    const content = await readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
  try {
    const safe = resolveInWorkspace(filePath);
    await mkdir(dirname(safe), { recursive: true });
    await writeFile(safe, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('create-file', async (_, filePath: string, content = '') => {
  try {
    const safe = resolveInWorkspace(filePath);
    await mkdir(dirname(safe), { recursive: true });
    await writeFile(safe, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('delete-file', async (_, filePath: string) => {
  try {
    const safe = resolveInWorkspace(filePath);
    await unlink(safe);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('create-folder', async (_, dirPath: string) => {
  try {
    const safe = resolveInWorkspace(dirPath);
    await mkdir(safe, { recursive: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('rename-path', async (_, oldPath: string, newPath: string) => {
  try {
    await rename(oldPath, newPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('list-files', async (_, dirPath: string) => {
  try {
    const fs = await import('fs/promises');
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    const files = items
      .filter(item => !item.name.startsWith('.'))
      .filter(item => !['node_modules', '.git', 'dist', 'build', '.next', 'vendor', 'storage', 'cache', 'release'].includes(item.name))
      .map(item => ({
        name: item.name,
        path: join(dirPath, item.name),
        isDirectory: item.isDirectory(),
        type: item.isDirectory() ? 'folder' : getFileType(item.name),
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

    return { success: true, files };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    ps1: 'powershell',
  };
  return typeMap[ext || ''] || 'text';
}

// Git Operations (simple-git)
function assertGitRepoPath(repoPath: string): void {
  const ws = getWorkspacePath();
  if (!ws) throw new Error('Open a project folder first.');
  resolveInWorkspace(repoPath, ws);
}

ipcMain.handle('git-init', async (_, repoPath: string) => {
  try {
    assertGitRepoPath(repoPath);
    await getGit(repoPath).init();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git-status', async (_, repoPath: string) => {
  try {
    const git = getGit(repoPath);
    const status = await git.status();
    return {
      success: true,
      status: {
        current: status.current,
        files: status.files.map((f) => ({
          path: f.path,
          index: f.index,
          working_dir: f.working_dir,
        })),
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git-add', async (_, repoPath: string, files: string[]) => {
  try {
    await getGit(repoPath).add(files);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git-commit', async (_, repoPath: string, message: string) => {
  try {
    await getGit(repoPath).commit(message);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git-push', async (_, repoPath: string, branch?: string) => {
  try {
    await getGit(repoPath).push('origin', branch);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git-pull', async (_, repoPath: string, branch?: string) => {
  try {
    await getGit(repoPath).pull('origin', branch);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git-branches', async (_, repoPath: string) => {
  try {
    const branches = await getGit(repoPath).branchLocal();
    return { success: true, branches };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git-diff', async (_, repoPath: string, file?: string) => {
  try {
    const diff = file
      ? await getGit(repoPath).diff([file])
      : await getGit(repoPath).diff();
    return { success: true, diff };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// Terminal PTY Operations
ipcMain.handle('terminal-create', async (event, cwd?: string, shell?: string) => {
  try {
    const win = getWindowFromEvent(event);
    if (!win) return { success: false, error: 'No window' };
    const resolvedCwd = cwd || currentProjectPath;
    if (!resolvedCwd || !isValidWorkspacePath(resolvedCwd)) {
      return {
        success: false,
        error: 'Open a project folder first. Terminal cannot run in the install directory.',
      };
    }
    const session = await createTerminal(win, resolvedCwd, shell);
    return { success: true, ...session };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('terminal-write', async (_, id: string, data: string) => {
  return { success: writeTerminal(id, data) };
});

ipcMain.handle('terminal-resize', async (_, id: string, cols: number, rows: number) => {
  return { success: resizeTerminal(id, cols, rows) };
});

ipcMain.handle('terminal-kill', async (_, id: string) => {
  return { success: killTerminal(id) };
});

// Legacy one-shot command (kept for compatibility)
ipcMain.handle('terminal-command', async (_, command: string, cwd?: string) => {
  const { spawn } = await import('child_process');
  const resolvedCwd = cwd || currentProjectPath;
  if (!resolvedCwd || !isValidWorkspacePath(resolvedCwd)) {
    return { success: false, error: 'Open a project folder first.', stdout: '', stderr: '' };
  }
  return new Promise((resolve) => {
    const child = spawn(command, [], {
      cwd: resolvedCwd,
      shell: true,
      env: getTerminalEnv(),
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => resolve({ success: code === 0, stdout, stderr, exitCode: code }));
    child.on('error', (error) => resolve({ success: false, error: error.message, stdout, stderr }));
  });
});

async function walkProjectFiles(dir: string, results: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walkProjectFiles(full, results);
    else if (entry.isFile()) results.push(full);
  }
  return results;
}

ipcMain.handle('search-in-project', async (_, rootPath: string, query: string) => {
  try {
    const files = await walkProjectFiles(rootPath);
    const q = query.toLowerCase();
    const results: Array<{ name: string; path: string; matches: number }> = [];
    for (const filePath of files.slice(0, 5000)) {
      try {
        const content = await readFile(filePath, 'utf-8');
        if (content.toLowerCase().includes(q)) {
          const matches = content.match(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'))?.length || 1;
          results.push({ name: filePath.split(/[/\\]/).pop() || filePath, path: filePath, matches });
          if (results.length >= 100) break;
        }
      } catch {
        /* skip binary/unreadable */
      }
    }
    return { success: true, results };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('walk-project-files', async (_, rootPath: string) => {
  try {
    const paths = await walkProjectFiles(rootPath);
    const files = paths.map((filePath) => ({
      name: filePath.split(/[/\\]/).pop() || filePath,
      path: filePath,
      isDirectory: false,
      type: getFileType(filePath),
    }));
    return { success: true, files };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git-create-branch', async (_, repoPath: string, branchName: string) => {
  try {
    await getGit(repoPath).checkoutLocalBranch(branchName);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git-switch-branch', async (_, repoPath: string, branchName: string) => {
  try {
    await getGit(repoPath).checkout(branchName);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('window-new', async () => {
  createAppWindow();
  return { success: true };
});

ipcMain.handle('window-new-agent', async () => {
  const win = createAppWindow({ agentMode: true });
  agentWindows.add(win);
  return { success: true };
});

// Utility
ipcMain.handle('open-external', async (_, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle('show-item-in-folder', async (_, fullPath: string) => {
  shell.showItemInFolder(fullPath);
});

// Window controls
ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  }
  mainWindow.maximize();
  return true;
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

ipcMain.handle('debug-get-launch-configs', async (_, projectPath: string) => {
  try {
    const configs = await readLaunchConfigurations(projectPath || currentProjectPath || '');
    return { success: true, configs };
  } catch (err) {
    return { success: false, error: (err as Error).message, configs: [] };
  }
});

ipcMain.handle(
  'debug-start',
  async (event, projectPath: string, config: LaunchConfiguration, activeFile?: string) => {
    const win = getWindowFromEvent(event) || mainWindow;
    if (!win) return { success: false, error: 'No window available' };
    return startDebug(win, projectPath || currentProjectPath || '', config, activeFile);
  },
);

ipcMain.handle('debug-stop', async () => {
  stopDebug();
  return { success: true };
});
