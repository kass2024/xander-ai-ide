import { useActionStore, PendingAction } from '../stores/actionStore';
import { applyAction } from './actionEngine';

export interface ActionCallbacks {
  onFileChanged?: (path: string) => void;
  onOpenFile?: (path: string, content: string) => void;
  onRunTerminal?: (command: string) => void;
  onRefreshGit?: () => void;
  onRefreshExplorer?: () => void;
}

const AUTO_APPLY_TYPES = new Set([
  'create_folder',
  'create_file',
  'write_file',
  'edit_file',
  'apply_patch',
]);

const APPROVAL_REQUIRED = new Set([
  'delete_file',
  'run_terminal_command',
  'git_commit',
  'git_push',
]);

export function mapBackendAction(a: {
  type: string;
  path?: string;
  content?: string;
  command?: string;
  message?: string;
  patch?: string;
}): Omit<PendingAction, 'id' | 'status'> {
  const typeMap: Record<string, PendingAction['type']> = {
    create_folder: 'create_folder',
    create_file: 'create_file',
    edit_file: 'edit_file',
    write_file: 'write_file',
    delete_file: 'delete_file',
    run_terminal_command: 'run_terminal_command',
    run_terminal: 'run_terminal_command',
    git_commit: 'git_commit',
    git_push: 'git_push',
    apply_patch: 'apply_patch',
    stream_file: 'write_file',
  };

  const type = typeMap[a.type] || 'create_file';
  let label = a.type;
  if (a.path) label = `${a.type}: ${a.path}`;
  if (a.command) label = `Run: ${a.command}`;

  return {
    type,
    label,
    path: a.path,
    content: a.content || a.message || a.patch,
    command: a.command,
  };
}

/** Auto-apply safe file actions directly to workspace (production mode). */
export async function applyActionsDirectly(
  actions: Array<{ type: string; path?: string; content?: string; command?: string; message?: string; patch?: string }>,
  workspacePath: string,
  callbacks?: ActionCallbacks,
): Promise<{ applied: number; queued: number; errors: string[] }> {
  let applied = 0;
  let queued = 0;
  const errors: string[] = [];

  for (const raw of actions) {
    const action = mapBackendAction(raw);

    if (AUTO_APPLY_TYPES.has(action.type)) {
      if (!action.path && action.type !== 'create_folder') {
        errors.push(`Missing path for ${action.type}`);
        continue;
      }
      const result = await applyAction(
        { ...action, id: '', status: 'pending' },
        workspacePath,
        callbacks,
      );
      if (result.success) {
        applied++;
        if (action.path && action.content) {
          callbacks?.onOpenFile?.(action.path, action.content);
        }
        callbacks?.onRefreshExplorer?.();
      } else {
        errors.push(result.error || `Failed: ${action.type}`);
      }
    } else if (APPROVAL_REQUIRED.has(action.type)) {
      const { addAction } = useActionStore.getState();
      await addAction(action);
      queued++;
    }
  }

  if (applied > 0) callbacks?.onRefreshGit?.();
  return { applied, queued, errors };
}

export async function queueBackendActions(
  actions: Array<{ type: string; path?: string; content?: string; command?: string; message?: string }>,
): Promise<number> {
  const { addAction } = useActionStore.getState();
  let queued = 0;
  for (const a of actions) {
    await addAction(mapBackendAction(a));
    queued++;
  }
  return queued;
}
