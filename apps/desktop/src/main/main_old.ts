import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { join } from 'path';
import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let currentProjectPath: string | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: join(__dirname, '../preload/preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (projectWatcher) {
      projectWatcher.close();
      projectWatcher = null;
    }
  });
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
    // Check if it's a valid directory
    await access(projectPath);
    
    currentProjectPath = projectPath;
    
    // Start file watcher
    if (projectWatcher) {
      projectWatcher.close();
    }
    
    projectWatcher = chokidar.watch(projectPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/vendor/**',
        '**/storage/**',
        '**/cache/**',
      ],
      persistent: true,
    });

    projectWatcher.on('change', (path) => {
      mainWindow?.webContents.send('file-changed', path);
    });

    projectWatcher.on('add', (path) => {
      mainWindow?.webContents.send('file-added', path);
    });

    projectWatcher.on('unlink', (path) => {
      mainWindow?.webContents.send('file-deleted', path);
    });

    return { success: true, path: projectPath };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
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
    await writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('create-file', async (_, filePath: string, content: string = '') => {
  try {
    // Ensure directory exists
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    
    await writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('delete-file', async (_, filePath: string) => {
  try {
    const fs = await import('fs/promises');
    await fs.unlink(filePath);
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
      .filter(item => !['node_modules', '.git', 'dist', 'build', '.next', 'vendor', 'storage', 'cache'].includes(item.name))
      .map(item => ({
        name: item.name,
        path: join(dirPath, item.name),
        isDirectory: item.isDirectory(),
        type: item.isDirectory() ? 'folder' : getFileType(item.name),
      }));

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

// Git Operations
ipcMain.handle('git-status', async (_, repoPath: string) => {
  try {
    const git = simpleGit(repoPath);
    const status = await git.status();
    return { success: true, status };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git-add', async (_, repoPath: string, files: string[]) => {
  try {
    const git = simpleGit(repoPath);
    await git.add(files);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git-commit', async (_, repoPath: string, message: string) => {
  try {
    const git = simpleGit(repoPath);
    await git.commit(message);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git-push', async (_, repoPath: string, branch?: string) => {
  try {
    const git = simpleGit(repoPath);
    await git.push('origin', branch || 'main');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git-pull', async (_, repoPath: string, branch?: string) => {
  try {
    const git = simpleGit(repoPath);
    await git.pull('origin', branch || 'main');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git-branches', async (_, repoPath: string) => {
  try {
    const git = simpleGit(repoPath);
    const branches = await git.branch();
    return { success: true, branches };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('git-diff', async (_, repoPath: string, file?: string) => {
  try {
    const git = simpleGit(repoPath);
    const diff = file ? await git.diff([file]) : await git.diff();
    return { success: true, diff };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// Terminal Operations
ipcMain.handle('terminal-command', async (_, command: string, cwd?: string) => {
  return new Promise((resolve) => {
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, {
      cwd: cwd || currentProjectPath,
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout,
        stderr,
        exitCode: code,
      });
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        stdout,
        stderr,
      });
    });
  });
});

// Utility
ipcMain.handle('open-external', async (_, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle('show-item-in-folder', async (_, fullPath: string) => {
  shell.showItemInFolder(fullPath);
});
