import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  FileCode,
  Search,
  Loader2,
  Paperclip,
  Undo2,
  Eye,
  RotateCcw,
  X,
  Infinity,
  Plus,
  Clock,
  ArrowUp,
  Square,
} from 'lucide-react';
import { displayModelLabel, type ModelOption } from '../../lib/modelLabels';
import { AgentBlock, getDiffStats } from '../../stores/agentRunStore';
import { useAgentSessionRun } from '../../stores/useAgentSessionRun';
import { useActionStore } from '../../stores/actionStore';
import { runAgent, AgentProgress } from '../../lib/agentRunner';
import { buildRichContext } from '../../lib/projectContext';
import { ensureWorkspace, WorkspaceCancelledError } from '../../lib/workspaceManager';
import { useAgentStore } from '../../stores/agentStore';
import {
  useAgentStateStore,
  type AgentMode,
  type AgentPhase,
  PHASE_LABELS,
  AGENT_MODE_LIST,
  AGENT_MODE_CONFIG,
} from '../../stores/agentStateStore';
import { AgentPlanChecklist } from './AgentPlanChecklist';
import { useAgentPlanStore } from '../../stores/agentPlanStore';
import { TaskProgressPanel } from './TaskProgressPanel';
import apiClient from '../../lib/api';
import {
  ImageAttachment,
  attachmentsForApi,
  fileToImageAttachmentFast,
  encodeAttachmentData,
  ensureAllAttachmentsEncoded,
  revokeAttachmentPreview,
} from '../../lib/imageAttachment';
import { isMockMode } from '../../lib/providers';
import { useAgentUiStore } from '../../stores/agentUiStore';
import { useAuthStore } from '../../stores/authStore';
import { ApprovalCard } from './ApprovalCard';
import { DiffViewer } from './DiffViewer';
import { TerminalOutput } from './TerminalOutput';
import { ToolCallCard } from './ToolCallCard';
import { AgentProgressSummary } from './AgentProgressSummary';
import { AgentSessionTabs } from './AgentSessionTabs';
import { AgentEnterpriseStatus } from './AgentEnterpriseStatus';
import { AgentActivityLine } from './AgentActivityLine';

interface AgentInteractivePanelProps {
  projectPath: string | null;
  workspaceFolders?: string[];
  currentFilePath?: string;
  selectedCode?: string;
  openFiles?: Array<{ filePath?: string; name: string; content: string }>;
  agentSessionId?: string | null;
  selectedModel: string;
  models: ModelOption[];
  onModelChange: (id: string) => void;
  backendOk?: boolean;
  compact?: boolean;
  onFileChanged?: (path: string) => void;
  onOpenFile?: (path: string, content: string) => void;
  onRunTerminal?: (command: string) => void;
  onRefreshGit?: () => void;
  onRefreshExplorer?: () => void;
  onWorkspaceReady?: (path: string) => void;
}

export interface AgentInteractivePanelHandle {
  setPrompt: (text: string, autoSend?: boolean) => void;
}

function DiffBlock({ block, onToggle }: { block: AgentBlock; onToggle: () => void }) {
  return (
    <DiffViewer
      filePath={block.path || 'file'}
      oldText={block.originalContent || ''}
      newText={block.newContent || ''}
      expanded={block.expanded}
      onToggle={onToggle}
      status={block.editStatus === 'reverted' ? 'reverted' : 'applied'}
    />
  );
}

function TerminalBlock({ block }: { block: AgentBlock }) {
  const status =
    block.stepStatus === 'awaiting_approval'
      ? 'awaiting_approval'
      : block.stepStatus === 'running'
        ? 'running'
        : block.stepStatus === 'skipped'
          ? 'skipped'
          : block.success === false
            ? 'failed'
            : 'success';

  return (
    <TerminalOutput
      command={block.command}
      output={block.output}
      exitCode={block.exitCode}
      status={status}
      expanded={block.expanded ?? true}
    />
  );
}

function ExploredBlock({ block }: { block: AgentBlock }) {
  const [open, setOpen] = useState(false);
  const fileCount = block.fileCount ?? 0;
  const searchCount = block.searchCount ?? 0;
  const parts: string[] = [];
  if (fileCount > 0) parts.push(`${fileCount} file${fileCount !== 1 ? 's' : ''}`);
  if (searchCount > 0) parts.push(`${searchCount} search${searchCount !== 1 ? 'es' : ''}`);
  const label = parts.length ? `Explored ${parts.join(', ')}` : 'Explored codebase';

  return (
    <div className="agent-explored-line">
      <button type="button" className="agent-explored-btn" onClick={() => block.files?.length && setOpen(!open)}>
        <Search className="w-3.5 h-3.5 opacity-50" />
        <span>{label}</span>
        {block.files?.length ? (
          open ? <ChevronDown className="w-3 h-3 opacity-40" /> : <ChevronRight className="w-3 h-3 opacity-40" />
        ) : null}
      </button>
      {open && block.files?.length ? (
        <ul className="agent-explored-files">
          {block.files.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StatusBlock({ block }: { block: AgentBlock }) {
  const phase = useAgentStateStore((s) => s.phase);
  const provider = useAgentStateStore((s) => s.provider);
  const model = useAgentStateStore((s) => s.model);
  return (
    <AgentEnterpriseStatus
      phase={phase}
      provider={provider}
      model={model}
      loading={block.loading}
      message={block.message}
    />
  );
}

function RenderBlock({
  block,
  onToggleDiff,
  projectPath,
  sessionId,
}: {
  block: AgentBlock;
  onToggleDiff: (id: string) => void;
  projectPath: string | null;
  sessionId?: string | null;
}) {
  switch (block.type) {
    case 'user_prompt':
      return (
        <div className="agent-user-prompt">
          <div className="agent-user-prompt-inner">
            {block.imagePreviews?.length ? (
              <div className="agent-user-screenshots">
                {block.imagePreviews.map((src, i) => (
                  <img key={i} src={src} alt={`Screenshot ${i + 1}`} className="agent-screenshot-thumb" />
                ))}
              </div>
            ) : null}
            <div>{block.prompt}</div>
          </div>
        </div>
      );
    case 'tool_step':
      return <ToolCallCard block={block} />;
    case 'approval':
      return <ApprovalCard block={block} projectPath={projectPath} sessionId={sessionId} />;
    case 'activity':
      return (
        <AgentActivityLine
          message={block.message || ''}
          toolName={block.toolName}
          category={block.category}
        />
      );
    case 'status':
      return <StatusBlock block={block} />;
    case 'explored':
      return <ExploredBlock block={block} />;
    case 'screenshot_analysis':
      return (
        <div className="agent-screenshot-analysis">
          <div className="agent-screenshot-analysis-label">Screenshot scan</div>
          <div className="agent-screenshot-analysis-body">
            {block.content?.split('\n').map((line, i) => {
              if (line.startsWith('## ')) {
                return <strong key={i} className="block mt-2 mb-0.5 text-[11px] uppercase tracking-wide opacity-70">{line.slice(3)}</strong>;
              }
              if (!line.trim()) return <br key={i} />;
              return <p key={i} className="text-[12px] leading-relaxed">{line}</p>;
            })}
          </div>
        </div>
      );
    case 'file_diff':
      return <DiffBlock block={block} onToggle={() => onToggleDiff(block.id)} />;
    case 'terminal':
      return <TerminalBlock block={block} />;
    case 'text':
      return (
        <div className="agent-text-block">
          {block.content?.split('\n').map((line, i) => {
            if (line.startsWith('**') && line.endsWith('**')) {
              return <strong key={i} className="block mt-2 mb-1">{line.slice(2, -2)}</strong>;
            }
            if (line.startsWith('- ')) {
              return <li key={i} className="ml-4 list-disc text-[12px] opacity-90">{line.slice(2)}</li>;
            }
            if (!line.trim()) return <br key={i} />;
            return <p key={i} className="text-[12px] leading-relaxed opacity-90">{line}</p>;
          })}
        </div>
      );
    case 'error':
      return (
        <div className="agent-error-block">{block.content}</div>
      );
    case 'progress_summary':
      return <AgentProgressSummary items={block.summaryItems || []} />;
    default:
      return null;
  }
}

export const AgentInteractivePanel = forwardRef<AgentInteractivePanelHandle, AgentInteractivePanelProps>(
function AgentInteractivePanel({
  projectPath,
  workspaceFolders = [],
  currentFilePath,
  selectedCode,
  openFiles = [],
  agentSessionId,
  selectedModel,
  models,
  onModelChange,
  backendOk = true,
  compact,
  onFileChanged,
  onOpenFile,
  onRunTerminal,
  onRefreshGit,
  onRefreshExplorer,
  onWorkspaceReady,
}: AgentInteractivePanelProps, ref) {
  const { sessions, addMessage, updateSession, createSession, setActiveSession } = useAgentStore();
  const ensureSession = useAuthStore((s) => s.ensureSession);
  const run = useAgentSessionRun(agentSessionId);
  const {
    blocks,
    isRunning,
    edits,
    showFilesList,
    startRun,
    endRun,
    setStatus,
    addActivity,
    addScreenshotAnalysis,
    addExplored,
    addSearch,
    flushExplored,
    addFileDiff,
    addTerminal,
    addText,
    addError,
    toggleDiff,
    toggleFilesList,
    undoAll,
    getEditedFileCount,
    resetRun,
  } = run;

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const agentMode = useAgentStateStore((s) => s.mode);
  const setAgentMode = useAgentStateStore((s) => s.setMode);
  const phase = useAgentStateStore((s) => s.phase);
  const provider = useAgentStateStore((s) => s.provider);
  const model = useAgentStateStore((s) => s.model);
  const setPhase = useAgentStateStore((s) => s.setPhase);
  const setProvider = useAgentStateStore((s) => s.setProvider);
  const resetAgentState = useAgentStateStore((s) => s.reset);
  const requestCancel = useAgentStateStore((s) => s.requestCancel);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendInFlightRef = useRef(false);
  const blockCountRef = useRef(0);
  const handleSendRef = useRef<(overridePrompt?: string) => Promise<void>>(async () => {});

  useImperativeHandle(ref, () => ({
    setPrompt: (text: string, autoSend?: boolean) => {
      setInput(text);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(text.length, text.length);
      });
      if (autoSend) {
        requestAnimationFrame(() => void handleSend(text));
      }
    },
  }));

  useEffect(() => {
    if (blocks.length === blockCountRef.current) return;
    blockCountRef.current = blocks.length;
    requestAnimationFrame(() => {
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, [blocks.length]);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
    }, 800);
    return () => clearInterval(id);
  }, [isRunning]);

  const injectPrompt = useAgentUiStore((s) => s.injectPrompt);
  const injectSend = useAgentUiStore((s) => s.injectSend);
  const clearInject = useAgentUiStore((s) => s.clearInject);

  useEffect(() => {
    if (!injectPrompt) return;
    const prompt = injectPrompt;
    const send = injectSend;
    setInput(prompt);
    clearInject();
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(prompt.length, prompt.length);
      if (send) void handleSendRef.current(prompt);
    });
  }, [injectPrompt, injectSend, clearInject]);

  const addAttachment = useCallback((file: File) => {
    try {
      setAttachError(null);
      const fast = fileToImageAttachmentFast(file);
      setAttachments((prev) => [...prev, fast].slice(0, 4));
      void encodeAttachmentData(file, fast).then((encoded) => {
        setAttachments((prev) => prev.map((a) => (a.id === fast.id ? encoded : a)));
      }).catch((err) => {
        setAttachError(err instanceof Error ? err.message : 'Failed to encode image');
        setAttachments((prev) => {
          revokeAttachmentPreview(fast);
          return prev.filter((a) => a.id !== fast.id);
        });
      });
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Failed to attach image');
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) setTimeout(() => addAttachment(file), 0);
        return;
      }
    }
    const file = e.clipboardData.files[0];
    if (file?.type.startsWith('image/')) {
      e.preventDefault();
      setTimeout(() => addAttachment(file), 0);
    }
  }, [addAttachment]);

  const handleProgress = useCallback((p: AgentProgress) => {
    if (p.type === 'phase' && p.phase) {
      setPhase(p.phase as AgentPhase);
    } else if (p.type === 'activity' && p.message) {
      addActivity(p.message, p.toolName ? { toolName: p.toolName } : undefined);
    } else if (p.type === 'thinking') {
      setStatus(p.message || PHASE_LABELS.analyzing, true);
    } else if (p.type === 'screenshot_analysis' && p.content) {
      addScreenshotAnalysis(p.content);
    } else if (p.type === 'tool_start') {
      if (
        p.toolName === 'write_file'
        || p.toolName === 'create_file'
        || p.toolName === 'edit_file'
        || p.toolName === 'run_terminal'
      ) {
        flushExplored();
      }
      if (p.provider) setProvider(p.provider, p.model || null);
      setStatus(p.message || PHASE_LABELS.planning, true);
    } else if (p.type === 'search') {
      addSearch();
    } else if (p.type === 'explored' && p.path) {
      addExplored(p.path);
    } else if (p.type === 'file_edit' && p.path) {
      addFileDiff(p.path, p.originalContent || '', p.newContent || '');
      onFileChanged?.(p.path);
    } else if (p.type === 'terminal' && p.command) {
      addTerminal(p.command, p.output || '', p.success ?? true, p.exitCode);
      onRunTerminal?.(p.command);
    } else if (p.type === 'content' && p.content) {
      flushExplored();
      addText(p.content);
    } else if (p.type === 'error' && p.message) {
      addError(p.message);
    } else if (p.type === 'approval_needed') {
      setStatus(p.message || 'Waiting for your approval…', true);
    }
  }, [
    setPhase, setProvider, setStatus, addActivity, addScreenshotAnalysis, addExplored, addSearch,
    addFileDiff, addTerminal, addText, addError, flushExplored,
    onFileChanged, onRunTerminal,
  ]);

  const handleSend = async (overridePrompt?: string) => {
    const promptText = (overridePrompt ?? input).trim();
    if (!promptText && attachments.length === 0) return;
    if (!promptText && attachments.length > 0) {
      setAttachError('Add a message describing what to fix.');
      return;
    }
    if (isRunning || sendInFlightRef.current) return;

    const mock = await isMockMode();
    if (!mock && !apiClient.getToken()) {
      addError('Sign in via Settings → General to use Agent.');
      return;
    }

    sendInFlightRef.current = true;
    setIsSending(true);
    setAttachError(null);
    let didStartRun = false;

    try {
      void ensureSession();

      let workspace = projectPath;
      try {
        workspace = await ensureWorkspace({
          onOpened: (p) => {
            onWorkspaceReady?.(p);
          },
        });
      } catch (e) {
        if (e instanceof WorkspaceCancelledError) return;
        addError(e instanceof Error ? e.message : 'Could not open project folder');
        return;
      }

      let encodedAttachments = attachments;
      if (attachments.length > 0) {
        try {
          encodedAttachments = await ensureAllAttachmentsEncoded(attachments);
          setAttachments(encodedAttachments);
        } catch (err) {
          setAttachError(err instanceof Error ? err.message : 'Failed to process screenshot');
          return;
        }
      }

      const prompt = promptText;
      const imagePayload = attachmentsForApi(encodedAttachments);
      const imagePreviews = encodedAttachments.map((a) => a.previewUrl);

      if (!overridePrompt) {
        setInput('');
        setAttachments((prev) => {
          prev.forEach(revokeAttachmentPreview);
          return [];
        });
      }

      useActionStore.getState().clear();
      resetAgentState();
      useAgentPlanStore.getState().clearPlan();
      setPhase('planning');
      startRun(prompt, imagePreviews.length ? imagePreviews : undefined);
      didStartRun = true;
      if (agentSessionId) addMessage(agentSessionId, { role: 'user', content: prompt });

      const context = await buildRichContext({
        projectPath: workspace,
        workspaceFolders: workspaceFolders.length ? workspaceFolders : [workspace],
        currentFilePath,
        selectedCode,
        openFiles,
        prompt,
      });

      const session = agentSessionId ? sessions.find((s) => s.id === agentSessionId) : null;

      const result = await runAgent({
        prompt,
        sessionId: agentSessionId || run.sessionId,
        context: { ...context, agentMode },
        model: selectedModel === 'auto' ? undefined : selectedModel,
        agentMode,
        conversationId: session?.conversationId,
        images: imagePayload.length ? imagePayload : undefined,
        onProgress: handleProgress,
        onFileChanged,
        onRefreshGit,
        onRefreshExplorer,
      });

      flushExplored();
      if (result.content && !blocks.some((b) => b.type === 'text' && b.content === result.content)) {
        addText(result.content);
      }
      if (agentSessionId) addMessage(agentSessionId, { role: 'assistant', content: result.content });
      if (agentSessionId && result.conversationId) {
        updateSession(agentSessionId, { conversationId: result.conversationId, mode: 'agent', model: selectedModel });
      }
    } catch (err) {
      addError(err instanceof Error ? err.message : 'Agent failed');
    } finally {
      sendInFlightRef.current = false;
      setIsSending(false);
      if (didStartRun) {
        endRun();
        setPhase('idle');
      }
      onRefreshGit?.();
      onRefreshExplorer?.();
    }
  };

  handleSendRef.current = handleSend;

  const handleUndoAll = async () => {
    if (!projectPath) return;
    const n = await undoAll(projectPath);
    onRefreshGit?.();
    onRefreshExplorer?.();
    addText(`Reverted ${n} file change(s).`);
  };

  const editedCount = getEditedFileCount();
  const appliedEdits = edits.filter((e) => e.status === 'applied');
  const session = agentSessionId ? sessions.find((s) => s.id === agentSessionId) : null;
  const sessionTitle = session?.title || 'New Agent';

  return (
    <div className="agent-panel flex flex-col flex-1 min-h-0">
      <AgentSessionTabs
        activeSessionId={agentSessionId}
        onSelect={setActiveSession}
        onNewAgent={() => {
          const id = createSession('New Agent', 'agent', projectPath || undefined);
          setActiveSession(id);
        }}
        onClose={(id) => {
          if (agentSessionId === id) {
            const remaining = sessions.filter((s) => s.id !== id && !s.archived);
            setActiveSession(remaining[0]?.id ?? null);
          }
          useAgentStore.getState().deleteSession(id);
        }}
      />
      {/* Cursor-style session bar */}
      <div className="cursor-session-bar">
        <div className="cursor-session-tab">
          <span className="truncate max-w-[140px]">{sessionTitle}</span>
        </div>
        <div className="flex items-center gap-0.5 ml-auto">
          {!backendOk && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2" title="Offline" />}
          <button
            type="button"
            className="cursor-session-icon"
            title="New agent"
            onClick={() => {
              const id = createSession('New Agent', 'agent', projectPath || undefined);
              setActiveSession(id);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button type="button" className="cursor-session-icon" title="History">
            <Clock className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Feed — empty state centered like Cursor when no messages */}
      <div ref={feedRef} className={`agent-feed flex-1 overflow-y-auto ${blocks.length === 0 ? 'flex flex-col' : 'px-3 py-3 space-y-2'}`}>
        {blocks.length === 0 && (
          <div className="agent-empty-state flex-1 flex flex-col items-center justify-center">
            {!compact && (
              <>
                <div className="text-[22px] font-semibold tracking-tight text-[#e8e8e8] mb-1 opacity-90">XANDER</div>
                <p className="text-[11px] opacity-40 mb-8">Agent</p>
              </>
            )}
            {compact && (
              <>
                <Sparkles className="w-7 h-7 text-[#888] mb-3" />
                <h4 className="text-[13px] font-medium mb-1 text-[#ccc]">Agent</h4>
              </>
            )}
            <p className="text-[11px] opacity-45 max-w-[320px] text-center leading-relaxed">
              Plan, build, and refactor with full terminal, database, and file access. Attach screenshots with Ctrl+V.
            </p>
            <div className="agent-quick-chips">
              {[
                'Improve UI styling',
                'Run npm build',
                'Inspect MySQL schema',
                'Fix errors in project',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="agent-quick-chip"
                  onClick={() => {
                    setInput(chip);
                    inputRef.current?.focus();
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {blocks.length > 0 && blocks.map((block) => (
          <RenderBlock
            key={block.id}
            block={block}
            onToggleDiff={toggleDiff}
            projectPath={projectPath}
            sessionId={agentSessionId}
          />
        ))}

        {blocks.length > 0 && isRunning && (
          <AgentEnterpriseStatus
            phase={phase}
            provider={provider}
            model={model}
            loading
            message={PHASE_LABELS[phase]}
          />
        )}
      </div>

      <AgentPlanChecklist />

      <TaskProgressPanel projectPath={projectPath} compact={compact} />

      {/* Review footer */}
      {(editedCount > 0 || showReview) && !isRunning && (
        <div className="agent-review-bar">
          <button type="button" className="agent-files-toggle" onClick={toggleFilesList}>
            {showFilesList ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <FileCode className="w-3.5 h-3.5 opacity-60" />
            <span>{editedCount} File{editedCount !== 1 ? 's' : ''}</span>
          </button>
          <div className="flex gap-2 ml-auto">
            <button type="button" className="agent-btn-ghost" onClick={handleUndoAll} disabled={editedCount === 0}>
              <Undo2 className="w-3.5 h-3.5" />
              Undo All
            </button>
            <button
              type="button"
              className="agent-btn-review"
              onClick={() => setShowReview(!showReview)}
            >
              <Eye className="w-3.5 h-3.5" />
              Review
            </button>
          </div>
        </div>
      )}

      {showFilesList && appliedEdits.length > 0 && (
        <div className="agent-files-list">
          {appliedEdits.map((e) => {
            const stats = getDiffStats(e.originalContent, e.newContent);
            return (
              <button
                key={e.path}
                type="button"
                className="agent-files-list-item"
                onClick={() => onOpenFile?.(e.path, e.newContent)}
              >
                <FileCode className="w-3 h-3 opacity-50" />
                <span className="truncate">{e.path}</span>
                <span className="text-emerald-400 text-[10px]">+{stats.added}</span>
                <span className="text-red-400 text-[10px]">-{stats.removed}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Input */}
      <div className="agent-input-area">
        {attachments.length > 0 && (
          <div className="agent-attach-preview-row">
            {attachments.map((a) => (
              <div key={a.id} className="agent-attach-preview">
                <img src={a.previewUrl} alt={a.name} />
                <button
                  type="button"
                  className="agent-attach-remove"
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {attachError && (
          <div className="text-[10px] text-red-400 mb-1 px-1">{attachError}</div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          multiple
          onChange={(e) => {
            const files = e.target.files;
            if (files) {
              void Promise.all([...files].map((f) => addAttachment(f)));
            }
            e.target.value = '';
          }}
        />
        <div className="agent-input-box">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.stopPropagation();
                void handleSend();
              }
            }}
            placeholder="Plan, Build, / for commands, @ for context"
            rows={3}
            className="agent-input-textarea cursor-input-textarea"
          />
          <div className="agent-input-toolbar">
            <div className="flex items-center gap-1.5">
              <span className="cursor-pill cursor-pill-mode">
                <Infinity className="w-3 h-3" />
                Agent
              </span>
              <div className="relative">
                <button
                  type="button"
                  className="cursor-pill cursor-pill-auto capitalize"
                  onClick={() => setShowModeMenu(!showModeMenu)}
                >
                  {AGENT_MODE_CONFIG[agentMode]?.label || agentMode}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
                {showModeMenu && (
                  <div className="cursor-model-menu agent-mode-menu">
                    {AGENT_MODE_LIST.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`cursor-model-item agent-mode-item ${agentMode === m ? 'agent-mode-item--active' : ''}`}
                        onClick={() => { setAgentMode(m); setShowModeMenu(false); }}
                      >
                        <span className="agent-mode-item-label">{AGENT_MODE_CONFIG[m].label}</span>
                        <span className="agent-mode-item-desc">{AGENT_MODE_CONFIG[m].description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  className="cursor-pill cursor-pill-auto"
                  onClick={() => setShowModelMenu(!showModelMenu)}
                >
                  {displayModelLabel(selectedModel)}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
                {showModelMenu && (
                  <div className="cursor-model-menu">
                    {models.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="cursor-model-item"
                        onClick={() => { onModelChange(m.id); setShowModelMenu(false); }}
                      >
                        {displayModelLabel(m.id)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isRunning ? (
                <button
                  type="button"
                  className="agent-stop-btn"
                  title="Stop agent"
                  onClick={requestCancel}
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Stop
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="cursor-icon-btn"
                    title="Attach screenshot"
                    disabled={isSending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  {blocks.length > 0 && (
                    <button type="button" className="cursor-icon-btn" title="Clear" onClick={resetRun}>
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="cursor-send-btn"
                    disabled={(!input.trim() && attachments.length === 0) || isSending}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleSend();
                    }}
                    title="Send (Enter)"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
