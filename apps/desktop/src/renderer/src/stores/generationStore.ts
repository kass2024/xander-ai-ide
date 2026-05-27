import { create } from 'zustand';
import {
  GenerationState,
  GenerationStep,
  GeneratedFile,
  GenerationPlan,
  StreamEvent,
} from '../lib/streamClient';

interface GenerationStore extends GenerationState {
  startGeneration: () => void;
  cancelGeneration: () => void;
  handleStreamEvent: (event: StreamEvent) => void;
  applyFile: (path: string) => void;
  rejectFile: (path: string) => void;
  applyAll: () => string[];
  rejectAll: () => void;
  reset: () => void;
  getPendingFiles: () => GeneratedFile[];
}

const initialState: GenerationState = {
  isActive: false,
  isCancelled: false,
  currentStep: 'idle',
  statusMessage: '',
  plan: null,
  files: [],
  currentFilePath: null,
  streamingContent: '',
  suggestedCommands: [],
  summary: null,
  error: null,
  quotaWarning: null,
};

export const useGenerationStore = create<GenerationStore>((set, get) => ({
  ...initialState,

  startGeneration: () =>
    set({
      ...initialState,
      isActive: true,
      currentStep: 'planning',
      statusMessage: 'Starting generation...',
    }),

  cancelGeneration: () =>
    set({
      isCancelled: true,
      isActive: false,
      currentStep: 'cancelled',
      statusMessage: 'Generation cancelled',
    }),

  handleStreamEvent: (event: StreamEvent) => {
    const state = get();
    if (state.isCancelled) return;

    switch (event.type) {
      case 'step':
        set({
          currentStep: (event.step as GenerationStep) || 'writing',
          statusMessage: event.message || state.statusMessage,
        });
        break;

      case 'plan':
        set({
          plan: event.plan || null,
          currentStep: 'creating_folders',
          statusMessage: `Plan: ${event.plan?.title || 'Project'} — ${event.plan?.fileCount || 0} files`,
          files: (event.plan?.files || []).map((f) => ({
            path: f.path,
            content: '',
            status: 'pending' as const,
          })),
        });
        break;

      case 'folder_start':
        set({ statusMessage: `Creating folder: ${event.path}` });
        break;

      case 'folder_complete':
        break;

      case 'file_start':
        set({
          currentFilePath: event.path || null,
          streamingContent: '',
          currentStep: 'writing',
          statusMessage: `Creating file: ${event.path}`,
          files: state.files.some((f) => f.path === event.path)
            ? state.files.map((f) =>
                f.path === event.path ? { ...f, status: 'generating' as const, language: event.language } : f,
              )
            : [
                ...state.files,
                { path: event.path!, content: '', status: 'generating' as const, language: event.language },
              ],
        });
        break;

      case 'file_delta':
        set((s) => ({
          streamingContent: s.streamingContent + (event.delta || ''),
          files: s.files.map((f) =>
            f.path === event.path ? { ...f, content: f.content + (event.delta || '') } : f,
          ),
        }));
        break;

      case 'file_complete':
        set((s) => ({
          streamingContent: '',
          currentFilePath: null,
          files: s.files.map((f) =>
            f.path === event.path
              ? {
                  ...f,
                  content: event.content || f.content,
                  originalContent: event.originalContent,
                  size: event.size || f.content.length,
                  status: 'complete' as const,
                }
              : f,
          ),
        }));
        break;

      case 'file_error':
        set((s) => ({
          files: s.files.map((f) =>
            f.path === event.path ? { ...f, status: 'error' as const, error: event.message } : f,
          ),
        }));
        break;

      case 'text_delta':
        set((s) => ({ streamingContent: s.streamingContent + (event.delta || '') }));
        break;

      case 'action':
        if (event.action) {
          set((s) => ({
            files: event.action?.path
              ? s.files.some((f) => f.path === event.action!.path)
                ? s.files
                : [
                    ...s.files,
                    {
                      path: event.action!.path!,
                      content: event.action!.content || '',
                      status: 'complete' as const,
                    },
                  ]
              : s.files,
          }));
        }
        break;

      case 'command_suggested':
        if (event.command) {
          set((s) => ({
            suggestedCommands: [...s.suggestedCommands, event.command!],
            currentStep: 'running_command',
          }));
        }
        break;

      case 'quota_warning':
        set({ quotaWarning: event.quota?.warningMessage || 'Low quota warning' });
        break;

      case 'error':
        set({
          error: event.message || 'Unknown error',
          currentStep: 'error',
          isActive: false,
        });
        break;

      case 'task_complete':
        set({
          currentStep: 'completed',
          isActive: false,
          summary: event.summary || null,
          statusMessage: `Finished — ${event.summary?.filesGenerated || 0} files generated`,
        });
        break;
    }
  },

  applyFile: (path: string) =>
    set((s) => ({
      files: s.files.map((f) => (f.path === path ? { ...f, status: 'applied' as const } : f)),
    })),

  rejectFile: (path: string) =>
    set((s) => ({
      files: s.files.map((f) => (f.path === path ? { ...f, status: 'rejected' as const } : f)),
    })),

  applyAll: () => {
    const pending = get().files.filter((f) => f.status === 'complete' && f.content);
    set((s) => ({
      files: s.files.map((f) =>
        f.status === 'complete' ? { ...f, status: 'applied' as const } : f,
      ),
    }));
    return pending.map((f) => f.path);
  },

  rejectAll: () =>
    set((s) => ({
      files: s.files.map((f) =>
        f.status === 'complete' || f.status === 'pending' || f.status === 'generating'
          ? { ...f, status: 'rejected' as const }
          : f,
      ),
    })),

  getPendingFiles: () =>
    get().files.filter((f) => f.status === 'complete' && f.content),

  reset: () => set(initialState),
}));
