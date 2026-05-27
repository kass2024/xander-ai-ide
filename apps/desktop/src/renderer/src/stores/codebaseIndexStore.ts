import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type IndexStatus = 'idle' | 'checking' | 'indexing' | 'ready' | 'unavailable' | 'error';

export interface IndexState {
  projectPath: string | null;
  status: IndexStatus;
  progress: number;
  progressMessage: string;
  chunksIndexed: number;
  filesScanned: number;
  lastIndexedAt: string | null;
  qdrantAvailable: boolean;
  error: string | null;
}

interface CodebaseIndexStore extends IndexState {
  setProject: (path: string | null) => void;
  setStatus: (status: IndexStatus, message?: string) => void;
  setProgress: (progress: number, message: string) => void;
  setResult: (result: { chunksIndexed: number; filesScanned?: number }) => void;
  setQdrantAvailable: (available: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: IndexState = {
  projectPath: null,
  status: 'idle',
  progress: 0,
  progressMessage: '',
  chunksIndexed: 0,
  filesScanned: 0,
  lastIndexedAt: null,
  qdrantAvailable: false,
  error: null,
};

export const useCodebaseIndexStore = create<CodebaseIndexStore>()(
  persist(
    (set) => ({
      ...initialState,
      setProject: (path) => set({ projectPath: path }),
      setStatus: (status, message = '') => set({ status, progressMessage: message, error: status === 'error' ? message : null }),
      setProgress: (progress, message) => set({ progress, progressMessage: message }),
      setResult: ({ chunksIndexed, filesScanned }) =>
        set({
          status: 'ready',
          progress: 100,
          chunksIndexed,
          filesScanned: filesScanned ?? 0,
          lastIndexedAt: new Date().toISOString(),
          progressMessage: `Indexed ${chunksIndexed} code chunks`,
          error: null,
        }),
      setQdrantAvailable: (available) => set({ qdrantAvailable: available }),
      setError: (error) => set({ error, status: error ? 'error' : 'idle' }),
      reset: () => set(initialState),
    }),
    {
      name: 'xander-codebase-index',
      partialize: (s) => ({
        projectPath: s.projectPath,
        chunksIndexed: s.chunksIndexed,
        lastIndexedAt: s.lastIndexedAt,
        qdrantAvailable: s.qdrantAvailable,
      }),
    },
  ),
);
