import React, { useCallback } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  FileCode,
  FolderOpen,
  Terminal,
  X,
  CheckCheck,
  Ban,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useGenerationStore } from '../stores/generationStore';
import { streamClient } from '../lib/streamClient';
import { applyAllGeneratedFiles, applyGeneratedFile } from '../lib/streamFileWriter';
import { createProductionStreamHandler } from '../lib/streamActionHandler';
import type { ActionCallbacks } from '../lib/parseActions';

interface GenerationProgressPanelProps {
  workspacePath: string | null;
  onFileChanged?: (path: string) => void;
  onOpenFile?: (path: string, content: string) => void;
  onRunTerminal?: (command: string) => void;
  onRefreshGit?: () => void;
  onRefreshExplorer?: () => void;
}

const STEP_LABELS: Record<string, string> = {
  idle: 'Ready',
  planning: 'Planning...',
  creating_folders: 'Creating folders...',
  writing: 'Writing code...',
  running_command: 'Running command...',
  fixing: 'Fixing errors...',
  completed: 'Finished successfully',
  error: 'Error occurred',
  cancelled: 'Cancelled',
};

export function GenerationProgressPanel({
  workspacePath,
  onFileChanged,
  onOpenFile,
  onRunTerminal,
  onRefreshGit,
  onRefreshExplorer,
}: GenerationProgressPanelProps) {
  const {
    isActive,
    currentStep,
    statusMessage,
    plan,
    files,
    currentFilePath,
    streamingContent,
    suggestedCommands,
    summary,
    error,
    quotaWarning,
    handleStreamEvent,
    cancelGeneration,
    applyFile,
    rejectFile,
    applyAll,
    rejectAll,
    getPendingFiles,
    reset,
  } = useGenerationStore();

  const [expandedFile, setExpandedFile] = React.useState<string | null>(null);
  const [showPlan, setShowPlan] = React.useState(true);

  React.useEffect(() => {
    if (currentFilePath && streamingContent && onOpenFile) {
      onOpenFile(currentFilePath, streamingContent);
    }
  }, [currentFilePath, streamingContent, onOpenFile]);

  const callbacks = {
    onFileChanged,
    onOpenFile,
    onRunTerminal,
    onRefreshGit,
    onRefreshExplorer,
  };

  const handleCancel = useCallback(() => {
    streamClient.cancel();
    cancelGeneration();
  }, [cancelGeneration]);

  const handleApplyAll = useCallback(async () => {
    if (!workspacePath) return;
    const pending = getPendingFiles();
    await applyAllGeneratedFiles(
      workspacePath,
      pending.map((f) => ({ path: f.path, content: f.content })),
      callbacks,
    );
    applyAll();
  }, [workspacePath, getPendingFiles, applyAll, callbacks]);

  const handleRejectAll = useCallback(() => {
    rejectAll();
  }, [rejectAll]);

  const handleApplyFile = useCallback(
    async (path: string, content: string) => {
      if (!workspacePath) return;
      await applyGeneratedFile(workspacePath, path, content, callbacks);
      applyFile(path);
    },
    [workspacePath, applyFile, callbacks],
  );

  const isVisible = isActive || files.length > 0 || currentStep === 'completed' || error;

  if (!isVisible) return null;

  const completedCount = files.filter((f) => f.status === 'complete' || f.status === 'applied').length;
  const appliedCount = files.filter((f) => f.status === 'applied').length;
  const progress = plan?.fileCount ? Math.round((completedCount / plan.fileCount) * 100) : 0;

  return (
    <div className="border-t border-[var(--vscode-ai-border)] bg-[var(--vscode-editor-background)] flex flex-col max-h-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-b border-[var(--vscode-ai-border)]">
        <div className="flex items-center gap-2">
          {isActive ? (
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          ) : currentStep === 'completed' ? (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          ) : error ? (
            <XCircle className="w-4 h-4 text-red-400" />
          ) : (
            <Sparkles className="w-4 h-4 text-purple-400" />
          )}
          <span className="text-[12px] font-semibold text-[var(--vscode-foreground)]">
            {STEP_LABELS[currentStep] || statusMessage}
          </span>
          {plan?.fileCount && (
            <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
              {completedCount}/{plan.fileCount} files
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isActive && (
            <button
              onClick={handleCancel}
              className="px-2 py-0.5 text-[10px] rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors"
            >
              Cancel
            </button>
          )}
          {!isActive && files.some((f) => f.status === 'complete') && (
            <>
              <button
                onClick={handleApplyAll}
                disabled={!workspacePath}
                className="px-2 py-0.5 text-[10px] rounded bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" /> Apply All
              </button>
              <button
                onClick={handleRejectAll}
                className="px-2 py-0.5 text-[10px] rounded bg-orange-600/20 text-orange-400 hover:bg-orange-600/40 transition-colors flex items-center gap-1"
              >
                <Ban className="w-3 h-3" /> Reject All
              </button>
            </>
          )}
          {!isActive && (
            <button onClick={reset} className="p-1 hover:bg-[var(--vscode-list-hoverBackground)] rounded">
              <X className="w-3.5 h-3.5 text-[var(--vscode-descriptionForeground)]" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(isActive || currentStep === 'completed') && plan?.fileCount && (
        <div className="px-3 py-1.5">
          <div className="h-1.5 bg-[var(--vscode-input-background)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-[10px] text-[var(--vscode-descriptionForeground)] mt-1">{statusMessage}</div>
        </div>
      )}

      {quotaWarning && (
        <div className="mx-3 my-1 px-2 py-1.5 rounded bg-orange-900/30 border border-orange-600/30 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
          <span className="text-[10px] text-orange-300">{quotaWarning}</span>
        </div>
      )}

      {error && (
        <div className="mx-3 my-2 rounded-lg border border-red-500/40 bg-red-950/40 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-red-900/30 border-b border-red-500/20">
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-[12px] font-semibold text-red-300">Generation failed</span>
          </div>
          <div className="px-3 py-2 text-[11px] text-red-200/90 whitespace-pre-line leading-relaxed">{error}</div>
          {error.includes('Restart backend') && (
            <div className="px-3 pb-2 text-[10px] text-[var(--vscode-descriptionForeground)]">
              1. Open terminal → <code className="text-blue-300">cd apps\backend</code><br />
              2. Run → <code className="text-blue-300">pnpm build && pnpm dev</code><br />
              3. Open folder in IDE (File → Open Folder) then retry Builder
            </div>
          )}
        </div>
      )}

      {/* Plan */}
      {plan && (
        <div className="px-3 py-1 border-b border-[var(--vscode-ai-border)]">
          <button
            onClick={() => setShowPlan(!showPlan)}
            className="flex items-center gap-1 text-[11px] text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
          >
            {showPlan ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span className="font-medium">{plan.title || 'Project Plan'}</span>
            {plan.description && <span className="opacity-60">— {plan.description}</span>}
          </button>
          {showPlan && plan.files && (
            <div className="mt-1 max-h-20 overflow-y-auto">
              {plan.files.map((f) => (
                <div key={f.path} className="flex items-center gap-1.5 text-[10px] py-0.5">
                  <FileCode className="w-3 h-3 text-blue-400 flex-shrink-0" />
                  <span className="font-mono text-[var(--vscode-foreground)]">{f.path}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* File list + live preview */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {files.map((file) => (
          <div
            key={file.path}
            className={`border-b border-[var(--vscode-ai-border)]/50 ${
              file.path === currentFilePath ? 'bg-blue-900/20' : ''
            }`}
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)]"
              onClick={() => setExpandedFile(expandedFile === file.path ? null : file.path)}
            >
              {file.status === 'generating' ? (
                <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin flex-shrink-0" />
              ) : file.status === 'complete' ? (
                <FileCode className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              ) : file.status === 'applied' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              ) : file.status === 'rejected' ? (
                <Ban className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
              ) : file.status === 'error' ? (
                <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              ) : (
                <FileCode className="w-3.5 h-3.5 text-[var(--vscode-descriptionForeground)] flex-shrink-0" />
              )}
              <span className="text-[11px] font-mono flex-1 truncate">{file.path}</span>
              {file.size && (
                <span className="text-[9px] text-[var(--vscode-descriptionForeground)]">
                  {file.size > 1024 ? `${(file.size / 1024).toFixed(1)}KB` : `${file.size}B`}
                </span>
              )}
              {file.status === 'complete' && workspacePath && (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleApplyFile(file.path, file.content)}
                    className="p-0.5 rounded hover:bg-green-600/30 text-green-400"
                    title="Apply"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => rejectFile(file.path)}
                    className="p-0.5 rounded hover:bg-orange-600/30 text-orange-400"
                    title="Reject"
                  >
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {(expandedFile === file.path || file.path === currentFilePath) && (
              <div className="px-3 pb-2">
                <pre className="text-[10px] font-mono bg-[var(--vscode-ai-codeBackground)] rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
                  {file.path === currentFilePath ? streamingContent || file.content : file.content}
                  {file.path === currentFilePath && isActive && (
                    <span className="inline-block w-1.5 h-3.5 bg-blue-400 animate-pulse ml-0.5" />
                  )}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Suggested commands */}
      {suggestedCommands.length > 0 && (
        <div className="px-3 py-2 border-t border-[var(--vscode-ai-border)]">
          <div className="text-[10px] text-[var(--vscode-descriptionForeground)] mb-1">Suggested commands:</div>
          {suggestedCommands.map((cmd) => (
            <div key={cmd} className="flex items-center gap-2 py-1">
              <Terminal className="w-3 h-3 text-yellow-400" />
              <code className="text-[10px] font-mono flex-1">{cmd}</code>
              <button
                onClick={() => onRunTerminal?.(cmd)}
                className="px-2 py-0.5 text-[9px] rounded bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/40"
              >
                Run
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {summary && currentStep === 'completed' && (
        <div className="px-3 py-2 border-t border-[var(--vscode-ai-border)] text-[10px] text-green-400 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {appliedCount > 0
            ? `${appliedCount} files applied to workspace`
            : `${summary.filesGenerated || completedCount} files ready — click Apply All to write to disk`}
        </div>
      )}
    </div>
  );
}

// Export handler for use in AIChatPanel
export async function runProjectBuilder(
  instruction: string,
  context: Record<string, unknown>,
  model?: string,
  workspacePath?: string,
  callbacks?: ActionCallbacks,
): Promise<void> {
  const { startGeneration, handleStreamEvent, cancelGeneration } = useGenerationStore.getState();
  startGeneration();

  const handler = workspacePath && callbacks
    ? createProductionStreamHandler(workspacePath, callbacks)
    : handleStreamEvent;

  try {
    await streamClient.streamBuild(
      { instruction, context, model },
      (event) => { void handler(event); },
    );
  } catch (err) {
    if (err instanceof Error && err.name !== 'AbortError') {
      handleStreamEvent({ type: 'error', message: err.message });
    } else {
      cancelGeneration();
    }
  }
}

export async function runComposerStream(
  instruction: string,
  files: Array<{ path: string; content: string }>,
  model?: string,
  workspacePath?: string,
  callbacks?: ActionCallbacks,
): Promise<void> {
  const { startGeneration, handleStreamEvent, cancelGeneration } = useGenerationStore.getState();
  startGeneration();

  const handler = workspacePath && callbacks
    ? createProductionStreamHandler(workspacePath, callbacks)
    : handleStreamEvent;

  try {
    await streamClient.stream(
      '/ai/composer/stream',
      { instruction, files, model },
      (event) => { void handler(event); },
    );
  } catch (err) {
    if (err instanceof Error && err.name !== 'AbortError') {
      handleStreamEvent({ type: 'error', message: err.message });
    } else {
      cancelGeneration();
    }
  }
}

export async function runChatStream(
  message: string,
  context: Record<string, unknown>,
  model?: string,
  onTextDelta?: (delta: string) => void,
): Promise<void> {
  const { handleStreamEvent } = useGenerationStore.getState();

  try {
    await streamClient.stream(
      '/ai/stream',
      { message, context, model },
      (event) => {
        handleStreamEvent(event);
        if (event.type === 'text_delta' && event.delta) {
          onTextDelta?.(event.delta);
        }
      },
    );
  } catch (err) {
    if (err instanceof Error && err.name !== 'AbortError') {
      throw err;
    }
  }
}
