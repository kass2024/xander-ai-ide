import React, { useRef, useEffect, useState, useCallback } from 'react';
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
  Brain,
  RotateCcw,
  X,
  Infinity,
  Plus,
  Clock,
  ArrowUp,
} from 'lucide-react';
import { displayModelLabel, type ModelOption } from '../../lib/modelLabels';
import { useAgentRunStore, AgentBlock, getDiffStats } from '../../stores/agentRunStore';
import { runAgent, AgentProgress } from '../../lib/agentRunner';
import { buildRichContext, indexProjectForSearch } from '../../lib/projectContext';
import { useAgentStore } from '../../stores/agentStore';
import { useAgentStateStore, type AgentMode, PHASE_LABELS } from '../../stores/agentStateStore';
import { TaskProgressPanel } from './TaskProgressPanel';
import apiClient from '../../lib/api';
import {
  ImageAttachment,
  attachmentsForApi,
  clipboardItemToAttachment,
  fileToImageAttachment,
} from '../../lib/imageAttachment';
import { ensureWorkspace, WorkspaceCancelledError } from '../../lib/workspaceManager';

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

function DiffBlock({ block, onToggle }: { block: AgentBlock; onToggle: () => void }) {
  const diff = getDiffStats(block.originalContent || '', block.newContent || '');
  const fileName = block.path?.split(/[/\\]/).pop() || block.path;
  const reverted = block.editStatus === 'reverted';

  return (
    <div className={`agent-diff-block ${reverted ? 'opacity-50' : ''}`}>
      <button type="button" className="agent-diff-header" onClick={onToggle}>
        <Brain className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
        <span className="agent-diff-filename">{fileName}</span>
        <span className="agent-diff-stats">
          <span className="text-emerald-400">+{diff.added}</span>
          <span className="text-red-400 ml-1.5">-{diff.removed}</span>
        </span>
        {block.expanded ? (
          <ChevronDown className="w-3.5 h-3.5 ml-auto opacity-50" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-50" />
        )}
      </button>
      {block.expanded && (
        <div className="agent-diff-body">
          {diff.hunks.slice(0, 80).map((h, i) => (
            <div
              key={i}
              className={
                h.type === 'add'
                  ? 'agent-diff-line agent-diff-add'
                  : h.type === 'remove'
                    ? 'agent-diff-line agent-diff-remove'
                    : 'agent-diff-line agent-diff-same'
              }
            >
              <span className="agent-diff-gutter">{h.newNum ?? h.oldNum ?? ''}</span>
              <span className="agent-diff-prefix">{h.type === 'add' ? '+' : h.type === 'remove' ? '-' : ' '}</span>
              <span>{h.line || ' '}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TerminalBlock({ block }: { block: AgentBlock }) {
  const [open, setOpen] = useState(block.expanded ?? true);
  const exitCode = block.exitCode ?? (block.success === false ? 1 : 0);
  return (
    <div className="agent-terminal-block">
      <button type="button" className="agent-terminal-header" onClick={() => setOpen(!open)}>
        <span className="agent-terminal-prompt">&gt;_</span>
        <span className="truncate flex-1 text-left font-medium">{block.command}</span>
        {open ? <ChevronDown className="w-3 h-3 opacity-50" /> : <ChevronRight className="w-3 h-3 opacity-50" />}
      </button>
      {open && (
        <div className="agent-terminal-body">
          <div className="agent-terminal-meta">
            <span><strong>Command</strong> {block.command}</span>
            <span><strong>Exit code</strong> {exitCode}</span>
          </div>
          {block.output && (
            <div className="agent-terminal-section">
              <div className="agent-terminal-label">STDOUT</div>
              <pre className="agent-terminal-output">{block.output.slice(0, 3000)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
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

function RenderBlock({
  block,
  onToggleDiff,
}: {
  block: AgentBlock;
  onToggleDiff: (id: string) => void;
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
    case 'activity':
      return (
        <div className="agent-activity-line">
          <span>{block.message}</span>
        </div>
      );
    case 'status':
      return (
        <div className="agent-status-line">
          {block.loading && <Loader2 className="w-3.5 h-3.5 animate-spin opacity-60" />}
          <span>{block.message}</span>
        </div>
      );
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
    default:
      return null;
  }
}

export function AgentInteractivePanel({
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
}: AgentInteractivePanelProps) {
  const { sessions, addMessage, updateSession, createSession, setActiveSession } = useAgentStore();
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
  } = useAgentRunStore();

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const agentMode = useAgentStateStore((s) => s.mode);
  const setAgentMode = useAgentStateStore((s) => s.setMode);
  const phase = useAgentStateStore((s) => s.phase);
  const requestCancel = useAgentStateStore((s) => s.requestCancel);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [blocks, isRunning]);

  useEffect(() => {
    if (projectPath) indexProjectForSearch(projectPath).catch(() => {});
  }, [projectPath]);

  const addAttachment = useCallback(async (file: File) => {
    try {
      setAttachError(null);
      const att = await fileToImageAttachment(file);
      setAttachments((prev) => [...prev, att].slice(0, 4));
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Failed to attach image');
    }
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await addAttachment(file);
        return;
      }
    }
    if (e.clipboardData.files.length) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        await addAttachment(file);
      }
    }
  }, [addAttachment]);

  const handleProgress = useCallback((p: AgentProgress) => {
    if (p.type === 'activity' && p.message) {
      addActivity(p.message);
    } else if (p.type === 'thinking') {
      setStatus(p.message || 'Analyzing...', true);
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
      setStatus(p.message || 'Working...', true);
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
      setStatus(`Waiting for approval: ${p.toolName}`, true);
    }
  }, [
    setStatus, addActivity, addScreenshotAnalysis, addExplored, addSearch,
    addFileDiff, addTerminal, addText, addError, flushExplored,
    onFileChanged, onRunTerminal,
  ]);

  const handleSend = async () => {
    if (!input.trim() || isRunning) return;
    if (!apiClient.getToken()) {
      addError('Sign in via Settings → General to use Agent.');
      return;
    }
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

    const prompt = input.trim();
    const imagePayload = attachmentsForApi(attachments);
    const imagePreviews = attachments.map((a) => a.previewUrl);
    setInput('');
    setAttachments([]);
    startRun(prompt, imagePreviews.length ? imagePreviews : undefined);
    if (agentSessionId) addMessage(agentSessionId, { role: 'user', content: prompt });

    try {
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
      endRun();
      onRefreshGit?.();
      onRefreshExplorer?.();
    }
  };

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
            <p className="text-[11px] opacity-45 max-w-[280px] text-center leading-relaxed">
              Ask me to build, fix, or refactor code. Attach screenshots with Ctrl+V.
            </p>
          </div>
        )}

        {blocks.length > 0 && blocks.map((block) => (
          <RenderBlock key={block.id} block={block} onToggleDiff={toggleDiff} />
        ))}

        {blocks.length > 0 && isRunning && (
          <div className="agent-status-line">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
            <span className="text-violet-300">{PHASE_LABELS[phase]}</span>
          </div>
        )}
      </div>

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
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Plan, Build, / for commands, @ for context"
            rows={3}
            disabled={isRunning}
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
                  {agentMode}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
                {showModeMenu && (
                  <div className="cursor-model-menu">
                    {(['standard', 'fast', 'deep', 'refactor'] as AgentMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className="cursor-model-item capitalize"
                        onClick={() => { setAgentMode(m); setShowModeMenu(false); }}
                      >
                        {m}
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
              <button
                type="button"
                className="cursor-icon-btn"
                title="Attach screenshot"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="w-4 h-4" />
              </button>
              {isRunning && (
                <button
                  type="button"
                  className="cursor-icon-btn text-red-400"
                  title="Cancel agent"
                  onClick={requestCancel}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {blocks.length > 0 && !isRunning && (
                <button type="button" className="cursor-icon-btn" title="Clear" onClick={resetRun}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                className="cursor-send-btn"
                disabled={(!input.trim() && attachments.length === 0) || isRunning}
                onClick={handleSend}
                title="Send"
              >
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
