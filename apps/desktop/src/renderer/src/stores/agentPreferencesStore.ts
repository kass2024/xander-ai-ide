import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AgentPreferencesState {
  autoApproveRisky: boolean;
  globalAllowTools: string[];
  workspaceAllowTools: Record<string, string[]>;
  selectedProvider: 'openai' | 'claude' | 'gemini' | 'auto';

  setAutoApproveRisky: (v: boolean) => void;
  addGlobalAllowTool: (toolName: string) => void;
  addWorkspaceAllowTool: (workspacePath: string, toolName: string) => void;
  isToolAllowed: (toolName: string, workspacePath?: string) => boolean;
  setSelectedProvider: (p: AgentPreferencesState['selectedProvider']) => void;
}

export const useAgentPreferencesStore = create<AgentPreferencesState>()(
  persist(
    (set, get) => ({
      autoApproveRisky: false,
      globalAllowTools: [],
      workspaceAllowTools: {},
      selectedProvider: 'auto',

      setAutoApproveRisky: (v) => set({ autoApproveRisky: v }),

      addGlobalAllowTool: (toolName) =>
        set((s) => ({
          globalAllowTools: s.globalAllowTools.includes(toolName)
            ? s.globalAllowTools
            : [...s.globalAllowTools, toolName],
        })),

      addWorkspaceAllowTool: (workspacePath, toolName) =>
        set((s) => {
          const existing = s.workspaceAllowTools[workspacePath] || [];
          if (existing.includes(toolName)) return s;
          return {
            workspaceAllowTools: {
              ...s.workspaceAllowTools,
              [workspacePath]: [...existing, toolName],
            },
          };
        }),

      isToolAllowed: (toolName, workspacePath) => {
        const s = get();
        if (s.autoApproveRisky) return true;
        if (s.globalAllowTools.includes(toolName)) return true;
        if (workspacePath && s.workspaceAllowTools[workspacePath]?.includes(toolName)) return true;
        return false;
      },

      setSelectedProvider: (p) => set({ selectedProvider: p }),
    }),
    { name: 'xander_agent_prefs' },
  ),
);
