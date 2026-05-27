import { useProjectStore } from '../stores/projectStore';

export const LAST_WORKSPACE_KEY = 'xander_last_workspace';

export class WorkspaceCancelledError extends Error {
  constructor() {
    super('Project folder selection cancelled');
    this.name = 'WorkspaceCancelledError';
  }
}

export function saveLastWorkspace(path: string): void {
  try {
    localStorage.setItem(LAST_WORKSPACE_KEY, path);
  } catch {
    /* ignore */
  }
}

/** Resolve an open workspace: store → Electron → last session → folder picker. */
export async function ensureWorkspace(options?: {
  onOpened?: (path: string) => void | Promise<void>;
}): Promise<string> {
  const store = useProjectStore.getState();
  if (store.currentProject) return store.currentProject;

  const api = window.electronAPI;
  const ws = await api.getWorkspacePath();
  if (ws.success && ws.path) {
    const opened = await openWorkspacePath(ws.path, store);
    if (opened) {
      await options?.onOpened?.(opened);
      return opened;
    }
  }

  const last = localStorage.getItem(LAST_WORKSPACE_KEY);
  if (last) {
    const opened = await openWorkspacePath(last, store);
    if (opened) {
      await options?.onOpened?.(opened);
      return opened;
    }
  }

  const picked = await api.openProjectDialog();
  if (!picked) throw new WorkspaceCancelledError();

  const opened = await openWorkspacePath(picked, store);
  if (!opened) throw new Error('Failed to open project folder');
  await options?.onOpened?.(opened);
  return opened;
}

async function openWorkspacePath(
  path: string,
  store: ReturnType<typeof useProjectStore.getState>,
): Promise<string | null> {
  const result = await window.electronAPI.openProject(path);
  if (!result.success) return null;
  store.setCurrentProject(path);
  await store.loadRoot(path);
  saveLastWorkspace(path);
  return path;
}

/** Restore last workspace on app start (non-blocking). */
export async function restoreLastWorkspaceIfAny(
  setCurrentProject: (path: string) => void,
  loadFiles: (path: string) => Promise<void>,
): Promise<string | null> {
  const store = useProjectStore.getState();
  if (store.currentProject) return store.currentProject;

  const last = localStorage.getItem(LAST_WORKSPACE_KEY);
  if (!last) return null;

  const opened = await openWorkspacePath(last, store);
  if (!opened) return null;
  setCurrentProject(opened);
  await loadFiles(opened);
  return opened;
}
