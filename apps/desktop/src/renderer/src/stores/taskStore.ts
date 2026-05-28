import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TaskCardStatus = 'pending' | 'running' | 'success' | 'failed';

export interface TaskCard {
  id: string;
  title: string;
  detail?: string;
  status: TaskCardStatus;
  timestamp: number;
  path?: string;
  toolName?: string;
}

export interface AgentTask {
  id: string;
  projectPath: string;
  prompt: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  endedAt?: number;
  cards: TaskCard[];
  filesEdited: number;
}

interface TaskStore {
  tasks: AgentTask[];
  activeTaskId: string | null;

  startTask: (projectPath: string, prompt: string) => string;
  addCard: (taskId: string, card: Omit<TaskCard, 'id' | 'timestamp'>) => string;
  updateCard: (taskId: string, cardId: string, patch: Partial<TaskCard>) => void;
  completeTask: (taskId: string, status: 'completed' | 'failed' | 'cancelled') => void;
  getRecentTasks: (projectPath?: string, limit?: number) => AgentTask[];
  clearOldTasks: (keep?: number) => void;
  removeTask: (taskId: string) => void;
}

let cardId = 0;
function nextCardId() {
  cardId += 1;
  return `card-${Date.now()}-${cardId}`;
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      activeTaskId: null,

      startTask: (projectPath, prompt) => {
        const id = `task-${Date.now()}`;
        const task: AgentTask = {
          id,
          projectPath,
          prompt: prompt.slice(0, 500),
          status: 'running',
          startedAt: Date.now(),
          cards: [],
          filesEdited: 0,
        };
        set((s) => ({
          tasks: [task, ...s.tasks].slice(0, 50),
          activeTaskId: id,
        }));
        return id;
      },

      addCard: (taskId, card) => {
        const c: TaskCard = {
          ...card,
          id: nextCardId(),
          timestamp: Date.now(),
        };
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, cards: [...t.cards, c] } : t,
          ),
        }));
        return c.id;
      },

      updateCard: (taskId, cardId, patch) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  cards: t.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
                }
              : t,
          ),
        }));
      },

      completeTask: (taskId, status) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, status, endedAt: Date.now() } : t,
          ),
          activeTaskId: s.activeTaskId === taskId ? null : s.activeTaskId,
        }));
      },

      getRecentTasks: (projectPath, limit = 10) => {
        let list = get().tasks;
        if (projectPath) list = list.filter((t) => t.projectPath === projectPath);
        return list.slice(0, limit);
      },

      clearOldTasks: (keep = 30) => {
        set((s) => ({ tasks: s.tasks.slice(0, keep) }));
      },

      removeTask: (taskId) => {
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== taskId),
          activeTaskId: s.activeTaskId === taskId ? null : s.activeTaskId,
        }));
      },
    }),
    { name: 'xander-agent-tasks', partialize: (s) => ({ tasks: s.tasks }) },
  ),
);
