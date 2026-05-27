import { resolvePath } from './pathSecurity';
import { isDangerousCommand } from './pathSecurity';

export interface StreamWriterCallbacks {
  onFileChanged?: (path: string) => void;
  onOpenFile?: (path: string, content: string) => void;
  onRunTerminal?: (command: string) => void;
  onRefreshGit?: () => void;
  onRefreshExplorer?: () => void;
}

export async function applyGeneratedFile(
  workspacePath: string,
  relativePath: string,
  content: string,
  callbacks?: StreamWriterCallbacks,
): Promise<{ success: boolean; error?: string }> {
  const api = window.electronAPI;
  if (!api) return { success: false, error: 'Electron API unavailable' };

  try {
    const fullPath = resolvePath(workspacePath, relativePath);
    const parent = fullPath.replace(/[/\\][^/\\]+$/, '');
    if (parent && parent !== fullPath) {
      await api.createFolder(parent).catch(() => { /* may exist */ });
    }
    const result = await api.writeFile(fullPath, content);
    if (!result.success) return { success: false, error: result.error };

    callbacks?.onFileChanged?.(relativePath);
    callbacks?.onOpenFile?.(relativePath, content);
    callbacks?.onRefreshExplorer?.();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function applyAllGeneratedFiles(
  workspacePath: string,
  files: Array<{ path: string; content: string }>,
  callbacks?: StreamWriterCallbacks,
): Promise<{ applied: number; failed: string[] }> {
  let applied = 0;
  const failed: string[] = [];

  for (const file of files) {
    const result = await applyGeneratedFile(workspacePath, file.path, file.content, callbacks);
    if (result.success) applied++;
    else failed.push(file.path);
  }

  callbacks?.onRefreshGit?.();
  return { applied, failed };
}

export async function createFolderInWorkspace(
  workspacePath: string,
  relativePath: string,
): Promise<{ success: boolean; error?: string }> {
  const api = window.electronAPI;
  if (!api) return { success: false, error: 'Electron API unavailable' };

  try {
    const fullPath = resolvePath(workspacePath, relativePath);
    const result = await api.createFolder(fullPath);
    return { success: result.success, error: result.error };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function runApprovedCommand(
  command: string,
  workspacePath: string,
  callbacks?: StreamWriterCallbacks,
): Promise<{ success: boolean; error?: string; output?: string }> {
  if (isDangerousCommand(command)) {
    return { success: false, error: 'Dangerous command requires explicit approval' };
  }

  const api = window.electronAPI;
  if (!api) return { success: false, error: 'Electron API unavailable' };

  callbacks?.onRunTerminal?.(command);
  const result = await api.terminalCommand(command, workspacePath);
  return {
    success: result.success,
    error: result.error || result.stderr,
    output: result.stdout,
  };
}

export function applyPatchToContent(original: string, patch: string): string {
  const lines = original.split('\n');
  const patchLines = patch.split('\n');
  const result: string[] = [];
  let origIdx = 0;

  for (const pl of patchLines) {
    if (pl.startsWith('@@')) continue;
    if (pl.startsWith('+')) {
      result.push(pl.slice(1));
    } else if (pl.startsWith('-')) {
      origIdx++;
    } else if (pl.startsWith(' ')) {
      result.push(lines[origIdx] ?? pl.slice(1));
      origIdx++;
    } else {
      result.push(pl);
    }
  }

  while (origIdx < lines.length) {
    result.push(lines[origIdx++]);
  }

  return result.join('\n');
}
