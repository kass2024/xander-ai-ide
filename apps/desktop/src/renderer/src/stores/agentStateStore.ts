import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AgentPhase =
  | 'idle'
  | 'planning'
  | 'analyzing'
  | 'database'
  | 'reading_files'
  | 'editing_files'
  | 'creating_files'
  | 'running_terminal'
  | 'fixing_errors'
  | 'awaiting_confirmation'
  | 'completed'
  | 'failed';

import {
  normalizeAgentMode,
  AGENT_MODE_LIST,
  AGENT_MODE_CONFIG,
  type AgentTaskMode,
} from '../../../shared/agentModes';

export type { AgentTaskMode as AgentMode };
export { normalizeAgentMode, AGENT_MODE_LIST, AGENT_MODE_CONFIG };

interface AgentStateStore {
  phase: AgentPhase;
  mode: AgentTaskMode;
  cancelRequested: boolean;
  lastError: string | null;
  provider: string | null;
  model: string | null;

  setPhase: (phase: AgentPhase) => void;
  setMode: (mode: AgentTaskMode) => void;
  setProvider: (provider: string | null, model: string | null) => void;
  requestCancel: () => void;
  clearCancel: () => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

export const useAgentStateStore = create<AgentStateStore>()(
  persist(
    (set) => ({
      phase: 'idle',
      mode: 'build',
      cancelRequested: false,
      lastError: null,
      provider: null,
      model: null,

      setPhase: (phase) => set({ phase }),
      setMode: (mode) => set({ mode: mode as AgentTaskMode }),
      setProvider: (provider, model) => set({ provider, model }),
      requestCancel: () => set({ cancelRequested: true }),
      clearCancel: () => set({ cancelRequested: false }),
      setError: (lastError) => set({ lastError, ...(lastError ? { phase: 'failed' as const } : {}) }),
      reset: () =>
        set({
          phase: 'idle',
          cancelRequested: false,
          lastError: null,
          provider: null,
          model: null,
        }),
    }),
    {
      name: 'xander-agent-state',
      partialize: (s) => ({ mode: s.mode }),
      merge: (persisted, current) => {
        const p = persisted as { mode?: string } | undefined;
        return {
          ...current,
          ...p,
          mode: normalizeAgentMode(p?.mode),
        };
      },
    },
  ),
);

export function phaseFromTool(toolName: string): AgentPhase {
  switch (toolName) {
    case 'analyze_project':
    case 'list_directory':
    case 'list_files':
      return 'analyzing';
    case 'read_file':
    case 'grep':
    case 'search_project':
    case 'search_code':
    case 'semantic_search':
      return 'reading_files';
    case 'write_file':
    case 'edit_file':
    case 'apply_patch':
      return 'editing_files';
    case 'create_file':
    case 'create_folder':
      return 'creating_files';
    case 'run_terminal':
    case 'install_package':
    case 'lint_project':
    case 'build_project':
    case 'test_project':
      return 'running_terminal';
    case 'inspect_database':
    case 'inspect_xampp_mysql':
    case 'mysql_list_databases':
    case 'mysql_describe_table':
    case 'mysql_query':
    case 'mysql_execute':
    case 'generate_migration':
      return 'database';
    case 'delete_file':
      return 'awaiting_confirmation';
    default:
      return 'planning';
  }
}

export const PHASE_LABELS: Record<AgentPhase, string> = {
  idle: 'Ready',
  planning: 'Planning next steps…',
  analyzing: 'Analyzing project structure…',
  database: 'Working with database…',
  reading_files: 'Reading project files…',
  editing_files: 'Applying code changes…',
  creating_files: 'Creating new files…',
  running_terminal: 'Executing command…',
  fixing_errors: 'Fixing errors from output…',
  awaiting_confirmation: 'Waiting for your approval…',
  completed: 'Task completed',
  failed: 'Task failed',
};
