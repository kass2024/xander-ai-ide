import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AgentSession {
  id: string;
  title: string;
  model: string;
  mode: 'chat' | 'agent' | 'composer';
  messages: AgentMessage[];
  conversationId?: string;
  projectPath?: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}

interface AgentState {
  sessions: AgentSession[];
  activeSessionId: string | null;
  createSession: (title?: string, mode?: AgentSession['mode'], projectPath?: string) => string;
  setActiveSession: (id: string) => void;
  updateSession: (id: string, patch: Partial<AgentSession>) => void;
  addMessage: (sessionId: string, message: Omit<AgentMessage, 'id' | 'timestamp'>) => void;
  archiveSession: (id: string) => void;
  deleteSession: (id: string) => void;
  getActiveSession: () => AgentSession | null;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,

      createSession: (title, mode = 'agent', projectPath) => {
        const id = `agent_${Date.now()}`;
        const now = new Date().toISOString();
        const session: AgentSession = {
          id,
          title: title || 'New Agent',
          model: 'auto',
          mode,
          messages: [],
          projectPath,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          sessions: [session, ...s.sessions],
          activeSessionId: id,
        }));
        return id;
      },

      setActiveSession: (id) => set({ activeSessionId: id }),

      updateSession: (id, patch) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === id ? { ...sess, ...patch, updatedAt: new Date().toISOString() } : sess,
          ),
        })),

      addMessage: (sessionId, message) => {
        const entry: AgentMessage = {
          ...message,
          id: `msg_${Date.now()}`,
          timestamp: new Date().toISOString(),
        };
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? {
                  ...sess,
                  messages: [...sess.messages, entry],
                  updatedAt: new Date().toISOString(),
                  title:
                    sess.messages.length === 0 && message.role === 'user'
                      ? message.content.slice(0, 48)
                      : sess.title,
                }
              : sess,
          ),
        }));
      },

      archiveSession: (id) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === id ? { ...sess, archived: true } : sess,
          ),
          activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
        })),

      deleteSession: (id) =>
        set((s) => ({
          sessions: s.sessions.filter((sess) => sess.id !== id),
          activeSessionId: s.activeSessionId === id ? s.sessions[0]?.id ?? null : s.activeSessionId,
        })),

      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find((s) => s.id === activeSessionId) ?? null;
      },
    }),
    { name: 'xander-agents' },
  ),
);
