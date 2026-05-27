import { BrowserWindow, ipcMain } from 'electron';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface LaunchConfiguration {
  name: string;
  type: string;
  program?: string;
  args?: string[];
  cwd?: string;
  request?: string;
  console?: string;
  env?: Record<string, string>;
}

let debugProcess: ChildProcessWithoutNullStreams | null = null;
let debugWindow: BrowserWindow | null = null;

const DEFAULT_CONFIGS: LaunchConfiguration[] = [
  {
    name: 'Debug Current File (Node)',
    type: 'node',
    request: 'launch',
    console: 'integratedTerminal',
  },
  {
    name: 'Debug Current File (Python)',
    type: 'python',
    request: 'launch',
    console: 'integratedTerminal',
  },
];

export async function readLaunchConfigurations(projectPath: string): Promise<LaunchConfiguration[]> {
  try {
    const raw = await readFile(join(projectPath, '.vscode', 'launch.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.configurations)) {
      return parsed.configurations;
    }
  } catch {
    /* use defaults */
  }
  return DEFAULT_CONFIGS;
}

function emitDebug(win: BrowserWindow | null, line: string) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('debug-output', line);
  }
}

export function stopDebug() {
  if (debugProcess) {
    debugProcess.kill();
    debugProcess = null;
    emitDebug(debugWindow, '[Debug] Session stopped');
  }
}

export async function startDebug(
  win: BrowserWindow,
  projectPath: string,
  config: LaunchConfiguration,
  activeFile?: string,
): Promise<{ success: boolean; error?: string; config?: LaunchConfiguration }> {
  stopDebug();
  debugWindow = win;

  const cwd = config.cwd || projectPath || process.cwd();
  const program = config.program || activeFile;

  if (!program) {
    return { success: false, error: 'No file to debug. Open a file or set program in launch.json' };
  }

  emitDebug(win, `[Debug] Starting: ${config.name}`);
  emitDebug(win, `[Debug] Program: ${program}`);

  try {
    if (config.type === 'node' || program.endsWith('.js') || program.endsWith('.ts') || program.endsWith('.mjs')) {
      const args = ['--inspect-brk=9229', program, ...(config.args || [])];
      const runner = program.endsWith('.ts') ? 'npx' : 'node';
      const runnerArgs = program.endsWith('.ts') ? ['ts-node', '--inspect-brk=9229', program, ...(config.args || [])] : args;

      debugProcess = spawn(runner, runnerArgs, {
        cwd,
        env: { ...process.env, ...config.env },
        shell: true,
      });
    } else if (config.type === 'python' || program.endsWith('.py')) {
      debugProcess = spawn('python', ['-m', 'debugpy', '--listen', '5678', '--wait-for-client', program, ...(config.args || [])], {
        cwd,
        env: { ...process.env, ...config.env },
        shell: true,
      });
      emitDebug(win, '[Debug] Python debugger listening on port 5678 — attach your debugger');
    } else {
      return { success: false, error: `Unsupported debug type: ${config.type}` };
    }

    debugProcess.stdout?.on('data', (d) => emitDebug(win, d.toString()));
    debugProcess.stderr?.on('data', (d) => emitDebug(win, d.toString()));
    debugProcess.on('close', (code) => {
      emitDebug(win, `[Debug] Process exited with code ${code}`);
      debugProcess = null;
    });
    debugProcess.on('error', (err) => emitDebug(win, `[Debug] Error: ${err.message}`));

    emitDebug(win, '[Debug] Debugger started — use Chrome DevTools at chrome://inspect for Node.js');
    return { success: true, config };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export function isDebugging(): boolean {
  return debugProcess !== null;
}
