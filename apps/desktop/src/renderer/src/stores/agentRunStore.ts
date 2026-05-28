import { create } from 'zustand';
import { computeLineDiff } from '../lib/composerUtils';
import { getAllBackups, clearBackups } from '../lib/patchUtils';

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
  | 'approval';

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
  actionId?: string;
  approvalReason?: string;
}

export interface AgentFileEdit {
  path: string;
  originalContent: string;
  newContent: string;
  blockId: string;
  status: 'applied' | 'reverted';
}

interface AgentRunStore {
  isRunning: boolean;
  blocks: AgentBlock[];
  edits: AgentFileEdit[];
  exploredPaths: Set<string>;
  searchCount: number;
  statusBlockId: string | null;
  showFilesList: boolean;

  resetRun: () => void;
  startRun: (prompt: string, imagePreviews?: string[]) => void;
  endRun: () => void;
  setStatus: (message: string, loading?: boolean) => void;
  clearStatus: () => void;
  addActivity: (message: string) => void;
  addScreenshotAnalysis: (content: string) => void;
  addExplored: (path: string) => void;
  addSearch: () => void;
  flushExplored: () => void;
  addFileDiff: (path: string, originalContent: string, newContent: string) => void;
  addTerminal: (command: string, output: string, success: boolean, exitCode?: number) => void;
  addText: (content: string) => void;
  addError: (message: string) => void;
  startToolStep: (toolName: string, label: string, detail?: string) => string;
  finishToolStep: (stepId: string, status: ToolStepStatus, detail?: string) => void;
  addApprovalBlock: (opts: {
    toolName: string;
    label: string;
    actionId: string;
    command?: string;
    path?: string;
    preview?: string;
    reason?: string;
  }) => string;
  removeApprovalBlock: (blockId: string) => void;
  toggleDiff: (blockId: string) => void;
  toggleFilesList: () => void;
  undoAll: (projectPath: string) => Promise<number>;
  getEditedFileCount: () => number;
}

let blockCounter = 0;
function nextId(prefix: string) {
  blockCounter += 1;
  return `${prefix}-${Date.now()}-${blockCounter}`;
}

export const useAgentRunStore = create<AgentRunStore>((set, get) => ({
  isRunning: false,
  blocks: [],
  edits: [],
  exploredPaths: new Set(),
  searchCount: 0,
  statusBlockId: null,
  showFilesList: false,

  resetRun: () =>
    set({
      isRunning: false,
      blocks: [],
      edits: [],
      exploredPaths: new Set(),
      searchCount: 0,
      statusBlockId: null,
      showFilesList: false,
    }),

  startRun: (prompt, imagePreviews) => {
    get().flushExplored();
    const blocks: AgentBlock[] = [
      {
        id: nextId('prompt'),
        type: 'user_prompt',
        timestamp: Date.now(),
        prompt,
        imagePreviews: imagePreviews?.length ? imagePreviews : undefined,
      },
    ];
    blocks.push({
      id: nextId('status'),
      type: 'status',
      timestamp: Date.now(),
      message: imagePreviews?.length ? 'Scanning screenshot for errors...' : 'Searching codebase...',
      loading: true,
    });
    set({
      isRunning: true,
      blocks,
      edits: [],
      exploredPaths: new Set(),
      searchCount: 0,
      statusBlockId: blocks.find((b) => b.type === 'status')?.id ?? null,
    });
  },

  endRun: () => {
    get().flushExplored();
    set((state) => ({
      isRunning: false,
      blocks: state.blocks.filter((b) => !(b.type === 'status' && b.loading)),
      statusBlockId: null,
    }));
  },

  setStatus: (message, loading = true) => {
    const { statusBlockId } = get();
    if (statusBlockId) {
      set((state) => ({
        blocks: state.blocks.map((b) =>
          b.id === statusBlockId ? { ...b, message, loading } : b,
        ),
      }));
    } else {
      const id = nextId('status');
      set((state) => ({
        statusBlockId: id,
        blocks: [
          ...state.blocks,
          { id, type: 'status', timestamp: Date.now(), message, loading },
        ],
      }));
    }
  },

  clearStatus: () => {
    const { statusBlockId } = get();
    if (!statusBlockId) return;
    set((state) => ({
      blocks: state.blocks.filter((b) => b.id !== statusBlockId),
      statusBlockId: null,
    }));
  },

  addActivity: (message) => {
    if (!message.trim()) return;
    set((state) => ({
      blocks: [
        ...state.blocks,
        {
          id: nextId('activity'),
          type: 'activity',
          timestamp: Date.now(),
          message,
        },
      ],
    }));
  },

  addScreenshotAnalysis: (content) => {
    get().flushExplored();
    get().clearStatus();
    if (!content.trim()) return;
    const { blocks } = get();
    if (blocks.some((b) => b.type === 'screenshot_analysis' && b.content === content)) return;
    set((state) => ({
      blocks: [
        ...state.blocks,
        {
          id: nextId('screenshot'),
          type: 'screenshot_analysis',
          timestamp: Date.now(),
          content,
        },
      ],
    }));
  },

  addExplored: (path) => {
    const explored = new Set(get().exploredPaths);
    explored.add(path);
    set({ exploredPaths: explored });
  },

  addSearch: () => {
    set((state) => ({ searchCount: state.searchCount + 1 }));
  },

  flushExplored: () => {
    const { exploredPaths, searchCount, blocks } = get();
    if (exploredPaths.size === 0 && searchCount === 0) return;
    const files = [...exploredPaths];
    const savedSearchCount = searchCount;
    set({
      exploredPaths: new Set(),
      searchCount: 0,
      blocks: [
        ...blocks,
        {
          id: nextId('explored'),
          type: 'explored',
          timestamp: Date.now(),
          fileCount: files.length,
          searchCount: savedSearchCount,
          files,
        },
      ],
    });
  },

  addFileDiff: (path, originalContent, newContent) => {
    get().flushExplored();
    get().clearStatus();
    const id = nextId('diff');
    set((state) => ({
      blocks: [
        ...state.blocks,
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
        ...state.edits.filter((e) => e.path !== path),
        { path, originalContent, newContent, blockId: id, status: 'applied' },
      ],
    }));
  },

  addTerminal: (command, output, success, exitCode) => {
    get().flushExplored();
    get().clearStatus();
    set((state) => ({
      blocks: [
        ...state.blocks,
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
    }));
  },

  addText: (content) => {
    get().flushExplored();
    get().clearStatus();
    if (!content.trim()) return;
    set((state) => ({
      blocks: [
        ...state.blocks,
        {
          id: nextId('text'),
          type: 'text',
          timestamp: Date.now(),
          content,
        },
      ],
    }));
  },

  addError: (message) => {
    get().endRun();
    set((state) => ({
      blocks: [
        ...state.blocks,
        {
          id: nextId('error'),
          type: 'error',
          timestamp: Date.now(),
          content: message,
        },
      ],
    }));
  },

  startToolStep: (toolName, label, detail) => {
    get().flushExplored();
    const id = nextId('step');
    set((state) => ({
      blocks: [
        ...state.blocks,
        {
          id,
          type: 'tool_step',
          timestamp: Date.now(),
          toolName,
          stepLabel: label,
          stepDetail: detail,
          stepStatus: 'running',
        },
      ],
    }));
    return id;
  },

  finishToolStep: (stepId, status, detail) => {
    set((state) => ({
      blocks: state.blocks.map((b) =>
        b.id === stepId && b.type === 'tool_step'
          ? { ...b, stepStatus: status, stepDetail: detail ?? b.stepDetail }
          : b,
      ),
    }));
  },

  addApprovalBlock: (opts) => {
    get().clearStatus();
    const id = nextId('approval');
    set((state) => ({
      blocks: [
        ...state.blocks,
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
    }));
    return id;
  },

  removeApprovalBlock: (blockId) => {
    set((state) => ({
      blocks: state.blocks.filter((b) => b.id !== blockId),
    }));
  },

  toggleDiff: (blockId) => {
    set((state) => ({
      blocks: state.blocks.map((b) =>
        b.id === blockId && b.type === 'file_diff'
          ? { ...b, expanded: !b.expanded }
          : b,
      ),
    }));
  },

  toggleFilesList: () => set((s) => ({ showFilesList: !s.showFilesList })),

  undoAll: async (projectPath) => {
    const { edits } = get();
    let restored = 0;
    const sep = projectPath.includes('\\') ? '\\' : '/';

    const backups = getAllBackups(projectPath);
    const backupMap = new Map(backups.map((b) => [b.path.replace(/\\/g, '/'), b.content]));

    for (const edit of [...edits].reverse()) {
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

    set((state) => ({
      edits: state.edits.map((e) => ({ ...e, status: 'reverted' as const })),
      blocks: state.blocks.map((b) =>
        b.type === 'file_diff' ? { ...b, editStatus: 'reverted' as const } : b,
      ),
    }));
    return restored;
  },

  getEditedFileCount: () => get().edits.filter((e) => e.status === 'applied').length,
}));

export function getDiffStats(original: string, updated: string) {
  return computeLineDiff(original, updated);
}
