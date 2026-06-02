import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AiUsageState {
  /** Copilot-style ghost text while typing (uses OpenAI on every pause). Off by default. */
  enableInlineAutocomplete: boolean;
  /** Index project embeddings when a folder opens. Off by default — use Re-index manually. */
  enableAutoIndexing: boolean;

  setEnableInlineAutocomplete: (v: boolean) => void;
  setEnableAutoIndexing: (v: boolean) => void;
}

export const useAiUsageStore = create<AiUsageState>()(
  persist(
    (set) => ({
      enableInlineAutocomplete: false,
      enableAutoIndexing: false,

      setEnableInlineAutocomplete: (v) => set({ enableInlineAutocomplete: v }),
      setEnableAutoIndexing: (v) => set({ enableAutoIndexing: v }),
    }),
    { name: 'xander_ai_usage' },
  ),
);

/** True when idle/background OpenAI features are allowed. */
export function isBackgroundAiAllowed(): boolean {
  return useAiUsageStore.getState().enableInlineAutocomplete
    || useAiUsageStore.getState().enableAutoIndexing;
}

export function isInlineAutocompleteEnabled(): boolean {
  return useAiUsageStore.getState().enableInlineAutocomplete;
}

export function isAutoIndexingEnabled(): boolean {
  return useAiUsageStore.getState().enableAutoIndexing;
}
