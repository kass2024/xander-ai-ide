import { create } from 'zustand';
import { ToolCall } from '../lib/agentTools';

export type ActionType =
  | 'create_folder'
  | 'create_file'
  | 'edit_file'
  | 'write_file'
  | 'delete_file'
  | 'run_terminal_command'
  | 'git_commit'
  | 'git_push'
  | 'apply_patch';

export interface PendingAction {
  id: string;
  type: ActionType;
  label: string;
  path?: string;
  content?: string;
  command?: string;
  toolCall?: ToolCall;
  originalContent?: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  dangerous?: boolean;
}

interface ActionStore {
  actions: PendingAction[];
  addAction: (action: Omit<PendingAction, 'id' | 'status'>) => Promise<boolean>;
  approve: (id: string) => void;
  reject: (id: string) => void;
  approveAll: () => void;
  rejectAll: () => void;
  markApplied: (id: string) => void;
  clear: () => void;
  waiters: Map<string, (approved: boolean) => void>;
}

export const useActionStore = create<ActionStore>((set, get) => ({
  actions: [],
  waiters: new Map(),

  addAction: (action) =>
    new Promise((resolve) => {
      const id = `action_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const entry: PendingAction = { ...action, id, status: 'pending' };
      set((s) => ({
        actions: [...s.actions, entry],
        waiters: new Map(s.waiters).set(id, resolve),
      }));
    }),

  approve: (id) => {
    const waiter = get().waiters.get(id);
    set((s) => ({
      actions: s.actions.map((a) => (a.id === id ? { ...a, status: 'approved' as const } : a)),
      waiters: (() => { const m = new Map(s.waiters); m.delete(id); return m; })(),
    }));
    waiter?.(true);
  },

  reject: (id) => {
    const waiter = get().waiters.get(id);
    set((s) => ({
      actions: s.actions.map((a) => (a.id === id ? { ...a, status: 'rejected' as const } : a)),
      waiters: (() => { const m = new Map(s.waiters); m.delete(id); return m; })(),
    }));
    waiter?.(false);
  },

  approveAll: () => {
    get().actions.filter((a) => a.status === 'pending').forEach((a) => get().approve(a.id));
  },

  rejectAll: () => {
    get().actions.filter((a) => a.status === 'pending').forEach((a) => get().reject(a.id));
  },

  markApplied: (id) =>
    set((s) => ({
      actions: s.actions.map((a) => (a.id === id ? { ...a, status: 'applied' as const } : a)),
    })),

  clear: () => set({ actions: [], waiters: new Map() }),
}));
