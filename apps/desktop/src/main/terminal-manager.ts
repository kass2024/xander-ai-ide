import { BrowserWindow } from 'electron';
import { platform } from 'os';
import { existsSync } from 'fs';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

export interface TerminalSession {
  id: string;
  shell: string;
  cwd: string;
  pty?: { write: (d: string) => void; resize: (c: number, r: number) => void; kill: () => void };
  child?: ChildProcessWithoutNullStreams;
}

const sessions = new Map<string, TerminalSession>();

function defaultShell(): string {
  if (platform() === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

function shellName(shell: string): string {
  const base = shell.split(/[/\\]/).pop()?.replace('.exe', '') || 'shell';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Electron often inherits a trimmed PATH — add Git, Node, etc. for integrated terminal. */
function getEnhancedEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (platform() !== 'win32') return env;

  const extras: string[] = [];
  const localAppData = env.LOCALAPPDATA || '';
  const programFiles = env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

  for (const p of [
    `${programFiles}\\Git\\cmd`,
    `${programFilesX86}\\Git\\cmd`,
    localAppData ? `${localAppData}\\Programs\\Git\\cmd` : '',
    `${programFiles}\\nodejs`,
    env.APPDATA ? `${env.APPDATA}\\npm` : '',
  ]) {
    if (p && existsSync(p)) extras.push(p);
  }

  const current = env.Path || env.PATH || '';
  const lower = current.toLowerCase();
  const toPrepend = extras.filter((p) => !lower.includes(p.toLowerCase()));
  if (toPrepend.length) {
    const merged = [...toPrepend, current].filter(Boolean).join(';');
    env.Path = merged;
    env.PATH = merged;
  }
  return env;
}

async function loadPty() {
  try {
    return await import('node-pty');
  } catch {
    return null;
  }
}

export async function createTerminal(
  win: BrowserWindow,
  cwd: string,
  shell?: string,
): Promise<{ id: string; shell: string; name: string; cwd: string }> {
  const id = `term_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const resolvedShell = shell || defaultShell();

  if (!cwd || !existsSync(cwd)) {
    throw new Error('Invalid workspace directory. Open a project folder first.');
  }
  const resolvedCwd = cwd;
  const pty = await loadPty();

  if (pty) {
    const ptyProcess = pty.spawn(resolvedShell, [], {
      name: 'xterm-color',
      cols: 120,
      rows: 30,
      cwd: resolvedCwd,
      env: getEnhancedEnv() as Record<string, string>,
    });

    const session: TerminalSession = {
      id,
      shell: resolvedShell,
      cwd: resolvedCwd,
      pty: {
        write: (d) => ptyProcess.write(d),
        resize: (c, r) => ptyProcess.resize(c, r),
        kill: () => ptyProcess.kill(),
      },
    };
    sessions.set(id, session);

    ptyProcess.onData((data) => {
      if (!win.isDestroyed()) win.webContents.send('terminal-data', { id, data });
    });
    ptyProcess.onExit(({ exitCode }) => {
      if (!win.isDestroyed()) win.webContents.send('terminal-exit', { id, exitCode });
      sessions.delete(id);
    });
  } else {
    const child = spawn(resolvedShell, [], {
      cwd: resolvedCwd,
      env: getEnhancedEnv(),
      shell: true,
      stdio: 'pipe',
    });

    const session: TerminalSession = {
      id,
      shell: resolvedShell,
      cwd: resolvedCwd,
      child,
      pty: {
        write: (d) => child.stdin?.write(d),
        resize: () => undefined,
        kill: () => child.kill(),
      },
    };
    sessions.set(id, session);

    child.stdout.on('data', (buf) => {
      if (!win.isDestroyed()) win.webContents.send('terminal-data', { id, data: buf.toString() });
    });
    child.stderr.on('data', (buf) => {
      if (!win.isDestroyed()) win.webContents.send('terminal-data', { id, data: buf.toString() });
    });
    child.on('close', (exitCode) => {
      if (!win.isDestroyed()) win.webContents.send('terminal-exit', { id, exitCode: exitCode ?? 0 });
      sessions.delete(id);
    });
  }

  return { id, shell: resolvedShell, name: shellName(resolvedShell), cwd: resolvedCwd };
}

export function writeTerminal(id: string, data: string): boolean {
  const session = sessions.get(id);
  if (!session?.pty) return false;
  session.pty.write(data);
  return true;
}

export function resizeTerminal(id: string, cols: number, rows: number): boolean {
  const session = sessions.get(id);
  if (!session?.pty) return false;
  session.pty.resize(cols, rows);
  return true;
}

export function killTerminal(id: string): boolean {
  const session = sessions.get(id);
  if (!session?.pty) return false;
  session.pty.kill();
  sessions.delete(id);
  return true;
}

export function getTerminalEnv(): NodeJS.ProcessEnv {
  return getEnhancedEnv();
}

export function killAllTerminals(): void {
  for (const [id, session] of sessions) {
    session.pty?.kill();
    session.child?.kill();
    sessions.delete(id);
  }
}
