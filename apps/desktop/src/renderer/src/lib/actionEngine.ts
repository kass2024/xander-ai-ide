import { PendingAction } from '../stores/actionStore';
import { resolvePath } from './pathSecurity';
import { isDangerousCommand } from './pathSecurity';
import { applyPatch } from './patchUtils';

export async function applyAction(
  action: PendingAction,
  workspacePath: string,
  callbacks?: {
    onFileChanged?: (path: string) => void;
    onRunTerminal?: (command: string) => void;
    onRefreshGit?: () => void;
  },
): Promise<{ success: boolean; error?: string }> {
  const api = window.electronAPI;
  if (!api) return { success: false, error: 'Electron API unavailable' };

  try {
    switch (action.type) {
      case 'create_folder': {
        if (!action.path) return { success: false, error: 'Missing path' };
        const fullPath = resolvePath(workspacePath, action.path);
        const result = await api.createFolder(fullPath);
        if (!result.success) return { success: false, error: result.error };
        return { success: true };
      }

      case 'create_file':
      case 'write_file':
      case 'edit_file': {
        if (!action.path) return { success: false, error: 'Missing path' };
        const fullPath = resolvePath(workspacePath, action.path);
        const parent = fullPath.replace(/[/\\][^/\\]+$/, '');
        if (parent) await api.createFolder(parent).catch(() => { /* may exist */ });
        const result = await api.writeFile(fullPath, action.content ?? '');
        if (!result.success) return { success: false, error: result.error };
        callbacks?.onFileChanged?.(action.path);
        return { success: true };
      }

      case 'apply_patch': {
        if (!action.path) return { success: false, error: 'Missing path' };
        const fullPath = resolvePath(workspacePath, action.path);
        const readResult = await api.readFile(fullPath);
        const original = readResult.success ? readResult.content || '' : (action.originalContent || '');
        const patched = applyPatch(original, action.content ?? '');
        const result = await api.writeFile(fullPath, patched);
        if (!result.success) return { success: false, error: result.error };
        callbacks?.onFileChanged?.(action.path);
        return { success: true };
      }

      case 'delete_file': {
        if (!action.path) return { success: false, error: 'Missing path' };
        const fullPath = resolvePath(workspacePath, action.path);
        const result = await api.deleteFile(fullPath);
        if (!result.success) return { success: false, error: result.error };
        callbacks?.onFileChanged?.(action.path);
        return { success: true };
      }

      case 'run_terminal_command': {
        if (!action.command) return { success: false, error: 'Missing command' };
        if (isDangerousCommand(action.command)) {
          return { success: false, error: 'Dangerous command blocked' };
        }
        callbacks?.onRunTerminal?.(action.command);
        const result = await api.terminalCommand(action.command, workspacePath);
        return { success: result.success, error: result.error || result.stderr };
      }

      case 'git_commit': {
        const msg = action.content || action.command || 'AI commit';
        await api.gitAdd(workspacePath, ['.']);
        const result = await api.gitCommit(workspacePath, msg);
        callbacks?.onRefreshGit?.();
        return { success: result.success, error: result.error };
      }

      case 'git_push': {
        const result = await api.gitPush(workspacePath);
        callbacks?.onRefreshGit?.();
        return { success: result.success, error: result.error };
      }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function toolNameToActionType(name: string): PendingAction['type'] | null {
  const map: Record<string, PendingAction['type']> = {
    create_folder: 'create_folder',
    create_file: 'create_file',
    write_file: 'write_file',
    edit_file: 'edit_file',
    delete_file: 'delete_file',
    run_terminal: 'run_terminal_command',
    rename_file: 'edit_file',
    git_commit: 'git_commit',
    git_push: 'git_push',
    apply_patch: 'apply_patch',
  };
  return map[name] ?? null;
}

export function buildActionFromToolCall(
  toolCall: { function: { name: string; arguments: string } },
): Omit<PendingAction, 'id' | 'status'> | null {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    return null;
  }

  const type = toolNameToActionType(toolCall.function.name);
  if (!type) return null;

  const path = args.path ? String(args.path) : undefined;
  const command = args.command ? String(args.command) : undefined;
  let content = args.content != null ? String(args.content) : args.message ? String(args.message) : undefined;
  let actionType = type;

  if (toolCall.function.name === 'edit_file' && args.patch) {
    actionType = 'apply_patch';
    content = String(args.patch);
  }

  let label = toolCall.function.name;
  if (actionType === 'create_file') label = `Create file: ${path}`;
  else if (actionType === 'write_file' || actionType === 'edit_file' || actionType === 'apply_patch') {
    label = `Edit file: ${path}`;
  }
  else if (type === 'delete_file') label = `Delete file: ${path}`;
  else if (type === 'run_terminal_command') label = `Run: ${command}`;

  return {
    type: actionType,
    label,
    path,
    content,
    command,
    toolCall: toolCall as PendingAction['toolCall'],
    dangerous: command ? isDangerousCommand(command) : false,
  };
}
