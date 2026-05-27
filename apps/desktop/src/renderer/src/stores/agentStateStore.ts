import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AgentPhase =
  | 'idle'
  | 'planning'
  | 'analyzing'
  | 'reading_files'
  | 'editing_files'
  | 'creating_files'
  | 'running_terminal'
  | 'fixing_errors'
  | 'awaiting_confirmation'
  | 'completed'
  | 'failed';

export type AgentMode = 'standard' | 'fast' | 'deep' | 'refactor';

interface AgentStateStore {
  phase: AgentPhase;
  mode: AgentMode;
  cancelRequested: boolean;
  lastError: string | null;
  provider: string | null;
  model: string | null;

  setPhase: (phase: AgentPhase) => void;
  setMode: (mode: AgentMode) => void;
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
      mode: 'standard',
      cancelRequested: false,
      lastError: null,
      provider: null,
      model: null,

      setPhase: (phase) => set({ phase }),
      setMode: (mode) => set({ mode }),
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
    { name: 'xander-agent-state', partialize: (s) => ({ mode: s.mode }) },
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
    case 'delete_file':
      return 'awaiting_confirmation';
    default:
      return 'planning';
  }
}

export const PHASE_LABELS: Record<AgentPhase, string> = {
  idle: 'Ready',
  planning: 'Planning task…',
  analyzing: 'Analyzing project…',
  reading_files: 'Reading files…',
  editing_files: 'Editing files…',
  creating_files: 'Creating files…',
  running_terminal: 'Running command…',
  fixing_errors: 'Fixing errors…',
  awaiting_confirmation: 'Awaiting confirmation…',
  completed: 'Completed',
  failed: 'Failed',
};
