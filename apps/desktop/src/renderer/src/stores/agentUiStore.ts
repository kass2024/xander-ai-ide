import { create } from 'zustand';

interface AgentUiStore {
  injectPrompt: string | null;
  injectSend: boolean;
  setInject: (prompt: string, send?: boolean) => void;
  clearInject: () => void;
}

export const useAgentUiStore = create<AgentUiStore>((set) => ({
  injectPrompt: null,
  injectSend: false,
  setInject: (prompt, send = false) => set({ injectPrompt: prompt, injectSend: send }),
  clearInject: () => set({ injectPrompt: null, injectSend: false }),
}));
