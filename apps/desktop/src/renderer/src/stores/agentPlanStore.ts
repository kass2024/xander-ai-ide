import { create } from 'zustand';

export interface PlanStep {
  id: string;
  text: string;
  done: boolean;
}

interface AgentPlanStore {
  steps: PlanStep[];
  setSteps: (items: string[]) => void;
  toggleStep: (id: string) => void;
  clearPlan: () => void;
  parseFromMarkdown: (content: string) => void;
}

let stepCounter = 0;

export const useAgentPlanStore = create<AgentPlanStore>((set) => ({
  steps: [],

  setSteps: (items) =>
    set({
      steps: items.map((text) => ({
        id: `plan-${++stepCounter}`,
        text,
        done: false,
      })),
    }),

  toggleStep: (id) =>
    set((s) => ({
      steps: s.steps.map((st) => (st.id === id ? { ...st, done: !st.done } : st)),
    })),

  clearPlan: () => set({ steps: [] }),

  parseFromMarkdown: (content) => {
    const lines = content.split('\n');
    const items: string[] = [];
    for (const line of lines) {
      const m = line.match(/^[-*]\s*\[[ xX]?\]\s*(.+)/) || line.match(/^\d+\.\s+(.+)/);
      if (m) items.push(m[1].trim());
    }
    if (items.length) set({
      steps: items.map((text) => ({
        id: `plan-${++stepCounter}`,
        text,
        done: false,
      })),
    });
  },
}));
