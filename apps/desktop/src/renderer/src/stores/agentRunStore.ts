import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { computeLineDiff } from '../lib/composerUtils';
import { getAllBackups, clearBackups } from '../lib/patchUtils';
import { toolCategory, type ToolCategory } from '../lib/toolCategories';

export type AgentBlockType =
  | 'user_prompt'
  | 'status'
  | 'activity'
  | 'explored'
  | 'file_diff'
  | 'terminal'
  | 'text'
  | 'error'
  | 'screenshot_analysis'
  | 'tool_step'
  | 'approval'
  | 'progress_summary';

export type ToolStepStatus = 'running' | 'success' | 'failed' | 'skipped' | 'awaiting_approval';

export interface AgentBlock {
  id: string;
  type: AgentBlockType;
  timestamp: number;
  prompt?: string;
  message?: string;
  loading?: boolean;
  fileCount?: number;
  searchCount?: number;
  files?: string[];
  path?: string;
  originalContent?: string;
  newContent?: string;
  expanded?: boolean;
  editStatus?: 'applied' | 'reverted';
  command?: string;
  output?: string;
  exitCode?: number;
  success?: boolean;
  content?: string;
  imagePreviews?: string[];
  toolName?: string;
  stepStatus?: ToolStepStatus;
  stepLabel?: string;
  stepDetail?: string;
  category?: ToolCategory;
  actionId?: string;
  approvalReason?: string;
  summaryItems?: string[];
}

export interface AgentFileEdit {
  path: string;
  originalContent: string;
  newContent: string;
  blockId: string;
  status: 'applied' | 'reverted';
}

export interface SessionRunData {
  isRunning: boolean;
  blocks: AgentBlock[];
  edits: AgentFileEdit[];
  exploredPaths: string[];
  searchCount: number;
  statusBlockId: string | null;
  showFilesList: boolean;
}

function createEmptyRun(): SessionRunData {
  return {
    isRunning: false,
    blocks: [],
    edits: [],
    exploredPaths: [],
    searchCount: 0,
    statusBlockId: null,
    showFilesList: false,
  };
}

/** Stable fallback for selectors — never call createEmptyRun() inside useStore selectors. */
export const EMPTY_SESSION_RUN: Readonly<SessionRunData> = Object.freeze({
  isRunning: false,
  blocks: Object.freeze([]) as AgentBlock[],
  edits: Object.freeze([]) as AgentFileEdit[],
  exploredPaths: Object.freeze([]) as string[],
  searchCount: 0,
  statusBlockId: null,
  showFilesList: false,
});

let blockCounter = 0;
function nextId(prefix: string) {
  blockCounter += 1;
  return `${prefix}-${Date.now()}-${blockCounter}`;
}

function patchRun(
  runs: Record<string, SessionRunData>,
  sessionId: string,
  updater: (run: SessionRunData) => SessionRunData,
): Record<string, SessionRunData> {
  const current = runs[sessionId] ?? createEmptyRun();
  return { ...runs, [sessionId]: updater(current) };
}

interface AgentRunStore {
  runs: Record<string, SessionRunData>;
  emptyRun: () => SessionRunData;
  getRunningSessionIds: () => string[];
  isSessionRunning: (sessionId: string) => boolean;

  resetRun: (sessionId: string) => void;
  startRun: (sessionId: string, prompt: string, imagePreviews?: string[]) => void;
  endRun: (sessionId: string) => void;
  setStatus: (sessionId: string, message: string, loading?: boolean) => void;
  clearStatus: (sessionId: string) => void;
  addActivity: (sessionId: string, message: string, opts?: { toolName?: string }) => void;
  addScreenshotAnalysis: (sessionId: string, content: string) => void;
  addExplored: (sessionId: string, path: string) => void;
  addSearch: (sessionId: string) => void;
  flushExplored: (sessionId: string) => void;
  addFileDiff: (sessionId: string, path: string, originalContent: string, newContent: string) => void;
  addTerminal: (sessionId: string, command: string, output: string, success: boolean, exitCode?: number) => void;
  addText: (sessionId: string, content: string) => void;
  addError: (sessionId: string, message: string) => void;
  addProgressSummary: (sessionId: string, items: string[]) => void;
  startToolStep: (sessionId: string, toolName: string, label: string, detail?: string) => string;
  finishToolStep: (sessionId: string, stepId: string, status: ToolStepStatus, detail?: string) => void;
  addApprovalBlock: (
    sessionId: string,
    opts: {
      toolName: string;
      label: string;
      actionId: string;
      command?: string;
      path?: string;
      preview?: string;
      reason?: string;
    },
  ) => string;
  removeApprovalBlock: (sessionId: string, blockId: string) => void;
  toggleDiff: (sessionId: string, blockId: string) => void;
  toggleFilesList: (sessionId: string) => void;
  undoAll: (sessionId: string, projectPath: string) => Promise<number>;
  getEditedFileCount: (sessionId: string) => number;
}

export const useAgentRunStore = create<AgentRunStore>()(
  persist(
    (set, get) => ({
      runs: {},

      emptyRun: () => EMPTY_SESSION_RUN as SessionRunData,

      getRunningSessionIds: () =>
        Object.entries(get().runs)
          .filter(([, r]) => r.isRunning)
          .map(([id]) => id),

      isSessionRunning: (sessionId) => get().runs[sessionId]?.isRunning ?? false,

      resetRun: (sessionId) =>
        set((s) => ({
          runs: patchRun(s.runs, sessionId, () => createEmptyRun()),
        })),

      startRun: (sessionId, prompt, imagePreviews) => {
        get().flushExplored(sessionId);
        const blocks: AgentBlock[] = [
          {
            id: nextId('prompt'),
            type: 'user_prompt',
            timestamp: Date.now(),
            prompt,
            imagePreviews: imagePreviews?.length ? imagePreviews : undefined,
          },
        ];
        const statusId = nextId('status');
        blocks.push({
          id: statusId,
          type: 'status',
          timestamp: Date.now(),
          message: imagePreviews?.length ? 'Scanning screenshot for errors…' : 'Connecting to AI agent…',
          loading: true,
        });
        set((s) => ({
          runs: patchRun(s.runs, sessionId, () => ({
            isRunning: true,
            blocks,
            edits: [],
            exploredPaths: [],
            searchCount: 0,
            statusBlockId: statusId,
            showFilesList: false,
          })),
        }));
      },

      endRun: (sessionId) => {
        get().flushExplored(sessionId);
        const run = get().runs[sessionId];
        if (!run) return;

        const toolSteps = run.blocks.filter((b) => b.type === 'tool_step' && b.stepStatus === 'success');
        const summaryItems = toolSteps
          .slice(-8)
          .map((b) => b.stepLabel || b.toolName || 'Step')
          .filter(Boolean);

        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            isRunning: false,
            statusBlockId: null,
            blocks: [
              ...r.blocks.filter((b) => !(b.type === 'status' && b.loading)),
              ...(summaryItems.length > 0
                ? [{
                    id: nextId('summary'),
                    type: 'progress_summary' as const,
                    timestamp: Date.now(),
                    summaryItems,
                  }]
                : []),
            ],
          })),
        }));
      },

      setStatus: (sessionId, message, loading = true) => {
        const run = get().runs[sessionId];
        if (!run) return;
        if (run.statusBlockId) {
          set((s) => ({
            runs: patchRun(s.runs, sessionId, (r) => ({
              ...r,
              blocks: r.blocks.map((b) =>
                b.id === r.statusBlockId ? { ...b, message, loading } : b,
              ),
            })),
          }));
        } else {
          const id = nextId('status');
          set((s) => ({
            runs: patchRun(s.runs, sessionId, (r) => ({
              ...r,
              statusBlockId: id,
              blocks: [...r.blocks, { id, type: 'status', timestamp: Date.now(), message, loading }],
            })),
          }));
        }
      },

      clearStatus: (sessionId) => {
        const run = get().runs[sessionId];
        if (!run?.statusBlockId) return;
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            statusBlockId: null,
            blocks: r.blocks.filter((b) => b.id !== r.statusBlockId),
          })),
        }));
      },

      addActivity: (sessionId, message, opts) => {
        if (!message.trim()) return;
        const run = get().runs[sessionId];
        const last = run?.blocks[run.blocks.length - 1];
        if (last?.type === 'activity' && last.message === message) return;
        const category = opts?.toolName ? toolCategory(opts.toolName) : undefined;
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            blocks: [
              ...r.blocks,
              {
                id: nextId('activity'),
                type: 'activity',
                timestamp: Date.now(),
                message,
                toolName: opts?.toolName,
                category,
              },
            ],
          })),
        }));
      },

      addScreenshotAnalysis: (sessionId, content) => {
        get().flushExplored(sessionId);
        get().clearStatus(sessionId);
        if (!content.trim()) return;
        const run = get().runs[sessionId];
        if (run?.blocks.some((b) => b.type === 'screenshot_analysis' && b.content === content)) return;
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            blocks: [
              ...r.blocks,
              { id: nextId('screenshot'), type: 'screenshot_analysis', timestamp: Date.now(), content },
            ],
          })),
        }));
      },

      addExplored: (sessionId, path) => {
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            exploredPaths: r.exploredPaths.includes(path) ? r.exploredPaths : [...r.exploredPaths, path],
          })),
        }));
      },

      addSearch: (sessionId) => {
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({ ...r, searchCount: r.searchCount + 1 })),
        }));
      },

      flushExplored: (sessionId) => {
        const run = get().runs[sessionId];
        if (!run || (run.exploredPaths.length === 0 && run.searchCount === 0)) return;
        const files = [...run.exploredPaths];
        const savedSearchCount = run.searchCount;
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            exploredPaths: [],
            searchCount: 0,
            blocks: [
              ...r.blocks,
              {
                id: nextId('explored'),
                type: 'explored',
                timestamp: Date.now(),
                fileCount: files.length,
                searchCount: savedSearchCount,
                files,
              },
            ],
          })),
        }));
      },

      addFileDiff: (sessionId, path, originalContent, newContent) => {
        get().flushExplored(sessionId);
        get().clearStatus(sessionId);
        const id = nextId('diff');
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            blocks: [
              ...r.blocks,
              {
                id,
                type: 'file_diff',
                timestamp: Date.now(),
                path,
                originalContent,
                newContent,
                expanded: false,
                editStatus: 'applied',
              },
            ],
            edits: [
              ...r.edits.filter((e) => e.path !== path),
              { path, originalContent, newContent, blockId: id, status: 'applied' },
            ],
          })),
        }));
      },

      addTerminal: (sessionId, command, output, success, exitCode) => {
        get().flushExplored(sessionId);
        get().clearStatus(sessionId);
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            blocks: [
              ...r.blocks,
              {
                id: nextId('terminal'),
                type: 'terminal',
                timestamp: Date.now(),
                command,
                output,
                success,
                exitCode: exitCode ?? (success ? 0 : 1),
                expanded: true,
              },
            ],
          })),
        }));
      },

      addText: (sessionId, content) => {
        get().flushExplored(sessionId);
        get().clearStatus(sessionId);
        if (!content.trim()) return;
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            blocks: [
              ...r.blocks,
              { id: nextId('text'), type: 'text', timestamp: Date.now(), content },
            ],
          })),
        }));
      },

      addError: (sessionId, message) => {
        get().endRun(sessionId);
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            isRunning: false,
            blocks: [
              ...r.blocks,
              { id: nextId('error'), type: 'error', timestamp: Date.now(), content: message },
            ],
          })),
        }));
      },

      addProgressSummary: (sessionId, items) => {
        if (!items.length) return;
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            blocks: [
              ...r.blocks,
              {
                id: nextId('summary'),
                type: 'progress_summary',
                timestamp: Date.now(),
                summaryItems: items,
              },
            ],
          })),
        }));
      },

      startToolStep: (sessionId, toolName, label, detail) => {
        get().flushExplored(sessionId);
        get().clearStatus(sessionId);
        const id = nextId('step');
        const category = toolCategory(toolName);
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            blocks: [
              ...r.blocks,
              {
                id,
                type: 'tool_step',
                timestamp: Date.now(),
                toolName,
                stepLabel: label,
                stepDetail: detail,
                stepStatus: 'running',
                category,
                path: detail?.includes('/') || detail?.includes('\\') ? detail : undefined,
              },
            ],
          })),
        }));
        return id;
      },

      finishToolStep: (sessionId, stepId, status, detail) => {
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            blocks: r.blocks.map((b) =>
              b.id === stepId && b.type === 'tool_step'
                ? { ...b, stepStatus: status, stepDetail: detail ?? b.stepDetail }
                : b,
            ),
          })),
        }));
      },

      addApprovalBlock: (sessionId, opts) => {
        get().clearStatus(sessionId);
        const id = nextId('approval');
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            blocks: [
              ...r.blocks,
              {
                id,
                type: 'approval',
                timestamp: Date.now(),
                toolName: opts.toolName,
                stepLabel: opts.label,
                actionId: opts.actionId,
                command: opts.command,
                path: opts.path,
                content: opts.preview,
                approvalReason: opts.reason,
                stepStatus: 'awaiting_approval',
              },
            ],
          })),
        }));
        return id;
      },

      removeApprovalBlock: (sessionId, blockId) => {
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            blocks: r.blocks.filter((b) => b.id !== blockId),
          })),
        }));
      },

      toggleDiff: (sessionId, blockId) => {
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            blocks: r.blocks.map((b) =>
              b.id === blockId && b.type === 'file_diff' ? { ...b, expanded: !b.expanded } : b,
            ),
          })),
        }));
      },

      toggleFilesList: (sessionId) => {
        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({ ...r, showFilesList: !r.showFilesList })),
        }));
      },

      undoAll: async (sessionId, projectPath) => {
        const run = get().runs[sessionId];
        if (!run) return 0;
        let restored = 0;
        const sep = projectPath.includes('\\') ? '\\' : '/';
        const backups = getAllBackups(projectPath);
        const backupMap = new Map(backups.map((b) => [b.path.replace(/\\/g, '/'), b.content]));

        for (const edit of [...run.edits].reverse()) {
          if (edit.status !== 'applied') continue;
          try {
            const full = `${projectPath}${projectPath.endsWith(sep) ? '' : sep}${edit.path.replace(/\//g, sep)}`;
            const fromBackup = backupMap.get(edit.path.replace(/\\/g, '/'));
            const content = fromBackup !== undefined ? fromBackup : edit.originalContent;
            if (content === '') {
              await window.electronAPI.deleteFile(full);
            } else {
              await window.electronAPI.writeFile(full, content);
            }
            restored++;
          } catch { /* skip */ }
        }
        clearBackups(projectPath);

        set((s) => ({
          runs: patchRun(s.runs, sessionId, (r) => ({
            ...r,
            edits: r.edits.map((e) => ({ ...e, status: 'reverted' as const })),
            blocks: r.blocks.map((b) =>
              b.type === 'file_diff' ? { ...b, editStatus: 'reverted' as const } : b,
            ),
          })),
        }));
        return restored;
      },

      getEditedFileCount: (sessionId) =>
        get().runs[sessionId]?.edits.filter((e) => e.status === 'applied').length ?? 0,
    }),
    {
      name: 'xander-agent-runs',
      partialize: (s) => ({ runs: s.runs }),
    },
  ),
);

export function getDiffStats(original: string, updated: string) {
  return computeLineDiff(original, updated);
}

/** Legacy shim — prefer useAgentSessionRun(sessionId) in components. */
export function getRunStoreForSession(sessionId: string) {
  const s = useAgentRunStore.getState();
  const sid = sessionId || '_default';
  return {
    startToolStep: (toolName: string, label: string, detail?: string) =>
      s.startToolStep(sid, toolName, label, detail),
    finishToolStep: (stepId: string, status: ToolStepStatus, detail?: string) =>
      s.finishToolStep(sid, stepId, status, detail),
    addApprovalBlock: (opts: Parameters<typeof s.addApprovalBlock>[1]) => s.addApprovalBlock(sid, opts),
    removeApprovalBlock: (blockId: string) => s.removeApprovalBlock(sid, blockId),
  };
}
