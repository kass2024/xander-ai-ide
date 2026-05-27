import apiClient from './api';
import { executeToolCall, ToolCall, AUTO_TOOLS, APPROVAL_TOOLS } from './agentTools';
import { WorkspaceContext, resolvePath } from './projectContext';
import { useActionStore } from '../stores/actionStore';
import { buildActionFromToolCall } from './actionEngine';
import { useAgentStateStore, phaseFromTool } from '../stores/agentStateStore';
import { useTaskStore } from '../stores/taskStore';
import { analyzeProject, formatAnalysisForAgent } from './projectAnalyzer';
import { clearBackups } from './patchUtils';
import type { AgentMode } from '../stores/agentStateStore';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface AgentProgress {
  type:
    | 'thinking'
    | 'activity'
    | 'tool_start'
    | 'tool_done'
    | 'content'
    | 'done'
    | 'error'
    | 'approval_needed'
    | 'file_edit'
    | 'terminal'
    | 'explored'
    | 'search'
    | 'screenshot_analysis'
    | 'task_card'
    | 'phase';
  message?: string;
  toolName?: string;
  path?: string;
  provider?: string;
  model?: string;
  content?: string;
  originalContent?: string;
  newContent?: string;
  command?: string;
  output?: string;
  success?: boolean;
  exitCode?: number;
  cardTitle?: string;
  cardStatus?: 'pending' | 'running' | 'success' | 'failed';
  phase?: string;
}

export interface AgentRunResult {
  content: string;
  conversationId?: string;
  stepsUsed: number;
  toolCallsMade: string[];
  cancelled?: boolean;
}

const MAX_STEPS = 40;

const TOOL_ACTIVITY: Record<string, (args: Record<string, unknown>) => string> = {
  read_file: (a) => `Reading ${String(a.path || '').split(/[/\\]/).pop() || 'file'}...`,
  list_files: (a) => `Listing ${String(a.path || 'project root').split(/[/\\]/).pop()}...`,
  list_directory: (a) => `Listing ${String(a.path || 'project root').split(/[/\\]/).pop()}...`,
  search_code: (a) => `Searching for "${String(a.query || a.pattern || '').slice(0, 60)}"...`,
  search_project: (a) => `Searching for "${String(a.query || '').slice(0, 60)}"...`,
  grep: (a) => `Grep: "${String(a.pattern || '').slice(0, 60)}"...`,
  semantic_search: (a) => `Semantic search: "${String(a.query || '').slice(0, 60)}"...`,
  analyze_project: () => 'Analyzing project structure...',
  write_file: (a) => `Editing ${String(a.path || 'file').split(/[/\\]/).pop()}...`,
  edit_file: (a) => `Patching ${String(a.path || 'file').split(/[/\\]/).pop()}...`,
  create_file: (a) => `Creating ${String(a.path || 'file').split(/[/\\]/).pop()}...`,
  create_folder: (a) => `Creating folder ${String(a.path || '')}...`,
  run_terminal: (a) => `Running \`${String(a.command || '').slice(0, 80)}\`...`,
  lint_project: () => 'Running linter...',
  build_project: () => 'Running build...',
  test_project: () => 'Running tests...',
  generate_migration: (a) => `Generating migration for ${a.table}...`,
  delete_file: (a) => `Deleting ${String(a.path || 'file').split(/[/\\]/).pop()}...`,
};

const TOOL_CARD_TITLE: Record<string, (args: Record<string, unknown>, ok: boolean) => string> = {
  analyze_project: (_, ok) => (ok ? 'Analyzed project' : 'Project analysis failed'),
  read_file: (a, ok) => (ok ? `Read ${String(a.path || 'file')}` : `Failed to read ${a.path}`),
  write_file: (a, ok) => (ok ? `Edited ${String(a.path || 'file')}` : `Failed to edit ${a.path}`),
  edit_file: (a, ok) => (ok ? `Patched ${String(a.path || 'file')}` : `Patch failed on ${a.path}`),
  create_file: (a, ok) => (ok ? `Created ${String(a.path || 'file')}` : `Failed to create ${a.path}`),
  create_folder: (a, ok) => (ok ? `Created folder ${a.path}` : 'Create folder failed'),
  run_terminal: (a, ok) => (ok ? `Ran: ${String(a.command || '').slice(0, 50)}` : 'Command failed'),
  build_project: (_, ok) => (ok ? 'Build successful' : 'Build failed'),
  test_project: (_, ok) => (ok ? 'Tests passed' : 'Tests failed'),
  lint_project: (_, ok) => (ok ? 'Lint passed' : 'Lint issues found'),
  generate_migration: (a, ok) => (ok ? `Migration for ${a.table}` : 'Migration failed'),
};

function parseToolArgs(argsJson: string): Record<string, unknown> {
  try {
    return JSON.parse(argsJson || '{}');
  } catch {
    return {};
  }
}

async function readOriginalContent(
  projectPath: string | null | undefined,
  relativePath: string,
): Promise<string> {
  if (!relativePath || !projectPath) return '';
  try {
    const full = resolvePath(projectPath, relativePath);
    const read = await window.electronAPI.readFile(full);
    return read.success ? (read.content || '') : '';
  } catch {
    return '';
  }
}

async function requestToolApproval(
  tc: ToolCall,
  projectPath: string | null | undefined,
): Promise<boolean> {
  const built = buildActionFromToolCall(tc);
  if (!built) return false;

  if (built.path && (built.type === 'write_file' || built.type === 'edit_file')) {
    try {
      const sep = projectPath?.includes('\\') ? '\\' : '/';
      const full = projectPath
        ? `${projectPath}${projectPath.endsWith(sep) ? '' : sep}${built.path.replace(/\//g, sep)}`
        : built.path;
      const read = await window.electronAPI.readFile(full);
      if (read.success) built.originalContent = read.content;
    } catch { /* new file */ }
  }

  const { addAction } = useActionStore.getState();
  useAgentStateStore.getState().setPhase('awaiting_confirmation');
  return addAction(built);
}

function resolveModelForMode(model: string | undefined, agentMode: AgentMode): string | undefined {
  if (model && model !== 'auto') return model;
  switch (agentMode) {
    case 'fast':
      return 'gemini-2.0-flash';
    case 'deep':
      return 'claude-sonnet-4-20250514';
    case 'refactor':
      return 'claude-sonnet-4-20250514';
    default:
      return undefined;
  }
}

export async function runAgent(options: {
  prompt: string;
  context: WorkspaceContext;
  model?: string;
  agentMode?: AgentMode;
  conversationId?: string;
  images?: Array<{ mediaType: string; data: string }>;
  onProgress?: (progress: AgentProgress) => void;
  onFileChanged?: (path: string) => void;
  onRefreshGit?: () => void;
  onRefreshExplorer?: () => void;
}): Promise<AgentRunResult> {
  const {
    prompt,
    context,
    images,
    onProgress,
    onFileChanged,
    onRefreshGit,
    onRefreshExplorer,
  } = options;

  const agentMode = options.agentMode ?? useAgentStateStore.getState().mode;
  const model = resolveModelForMode(options.model, agentMode);

  const stateStore = useAgentStateStore.getState();
  stateStore.clearCancel();
  stateStore.setError(null);
  stateStore.setPhase('planning');

  let conversationId = options.conversationId;
  const userPrompt = images?.length
    ? `[Screenshot attached — read the image for errors and fix the codebase.]\n\n${prompt}`
    : prompt;
  const messages: AgentMessage[] = [{ role: 'user', content: userPrompt }];
  const toolCallsMade: string[] = [];
  let finalContent = '';
  let stepsUsed = 0;
  let cancelled = false;

  if (!context.repositoryPath) {
    stateStore.setPhase('failed');
    throw new Error('Open a project folder first — Agent needs access to your workspace.');
  }

  if (context.repositoryPath) {
    clearBackups(context.repositoryPath);
  }

  const taskId = useTaskStore.getState().startTask(context.repositoryPath!, prompt);
  const addTaskCard = (title: string, status: 'pending' | 'running' | 'success' | 'failed', detail?: string) => {
    const cardId = useTaskStore.getState().addCard(taskId, { title, status, detail });
    onProgress?.({ type: 'task_card', cardTitle: title, cardStatus: status, message: detail });
    return cardId;
  };

  let activeProvider: string | undefined;
  let screenshotAnalysisFromScan: string | undefined;

  // Enrich context with project analysis on first run
  let projectSummary = context.projectSummary;
  if (!projectSummary && context.repositoryPath) {
    try {
      const analysis = await analyzeProject(context.repositoryPath);
      projectSummary = formatAnalysisForAgent(analysis);
      const cardId = addTaskCard('Analyzing project', 'running');
      useTaskStore.getState().updateCard(taskId, cardId, { status: 'success', detail: `${analysis.fileCount} files` });
    } catch { /* optional */ }
  }

  if (images?.length) {
    stateStore.setPhase('analyzing');
    onProgress?.({ type: 'activity', message: 'Scanning attached screenshot...' });
    try {
      const scan = await apiClient.aiAnalyzeScreenshot({ images, prompt });
      if (scan.analysis) {
        screenshotAnalysisFromScan = scan.analysis;
        onProgress?.({ type: 'screenshot_analysis', content: scan.analysis });
      }
    } catch { /* vision in step */ }
  } else {
    onProgress?.({ type: 'activity', message: 'Planning task...' });
    onProgress?.({ type: 'thinking', message: 'Planning task...' });
  }

  while (stepsUsed < MAX_STEPS) {
    if (useAgentStateStore.getState().cancelRequested) {
      cancelled = true;
      finalContent = 'Agent run cancelled.';
      stateStore.setPhase('failed');
      useTaskStore.getState().completeTask(taskId, 'cancelled');
      onProgress?.({ type: 'error', message: finalContent });
      break;
    }

    stepsUsed++;

    const step = await apiClient.aiAgentStep({
      messages,
      context: {
        ...context,
        projectSummary,
        agentMode,
        ...(images?.length && stepsUsed === 1 ? { images } : {}),
        ...(screenshotAnalysisFromScan && stepsUsed === 1
          ? { screenshotAnalysis: screenshotAnalysisFromScan }
          : {}),
      },
      model,
      conversationId,
    });

    conversationId = step.conversationId;
    if (step.provider) {
      activeProvider = step.provider;
      stateStore.setProvider(step.provider, step.model || '');
    }

    if (step.finishReason === 'stop') {
      finalContent = step.message.content || 'Task completed.';
      stateStore.setPhase('completed');
      useTaskStore.getState().completeTask(taskId, 'completed');
      onProgress?.({ type: 'content', content: finalContent });
      onProgress?.({ type: 'done', content: finalContent });
      onProgress?.({ type: 'phase', phase: 'completed' });
      break;
    }

    if (step.finishReason === 'tool_calls' && step.message.tool_calls?.length) {
      messages.push({
        role: 'assistant',
        content: step.message.content,
        tool_calls: step.message.tool_calls,
      });

      for (const tc of step.message.tool_calls) {
        if (useAgentStateStore.getState().cancelRequested) {
          cancelled = true;
          break;
        }

        const toolName = tc.function.name;
        const args = parseToolArgs(tc.function.arguments);
        const filePath = (args.path || args.file || args.old_path) as string | undefined;
        toolCallsMade.push(toolName);

        const phase = phaseFromTool(toolName);
        stateStore.setPhase(phase);
        onProgress?.({ type: 'phase', phase });

        const activityMsg = TOOL_ACTIVITY[toolName]?.(args) || `${toolName}...`;
        onProgress?.({ type: 'activity', message: activityMsg });
        onProgress?.({ type: 'tool_start', toolName, path: filePath, provider: activeProvider, message: activityMsg });

        const cardTitleFn = TOOL_CARD_TITLE[toolName];
        const cardTitle = cardTitleFn?.(args, true) || activityMsg.replace('...', '');
        const cardId = addTaskCard(cardTitle, 'running', filePath);

        if (toolName === 'search_project' || toolName === 'search_code' || toolName === 'grep' || toolName === 'semantic_search') {
          onProgress?.({ type: 'search' });
        }

        let result;
        let originalContent = '';

        if (toolName === 'write_file' || toolName === 'create_file' || toolName === 'edit_file') {
          originalContent = filePath ? await readOriginalContent(context.repositoryPath, filePath) : '';
        }

        if (APPROVAL_TOOLS.has(toolName)) {
          onProgress?.({ type: 'approval_needed', toolName, message: `Waiting for approval: ${toolName}` });
          const approved = await requestToolApproval(tc, context.repositoryPath);
          if (!approved) {
            result = { tool_call_id: tc.id, content: 'User rejected this action.', success: false };
          } else {
            result = await executeToolCall(tc, context.repositoryPath);
          }
        } else if (AUTO_TOOLS.has(toolName)) {
          result = await executeToolCall(tc, context.repositoryPath);
        } else {
          result = await executeToolCall(tc, context.repositoryPath);
        }

        useTaskStore.getState().updateCard(taskId, cardId, {
          status: result.success ? 'success' : 'failed',
          detail: result.success ? undefined : result.content.slice(0, 200),
        });
        onProgress?.({
          type: 'task_card',
          cardTitle,
          cardStatus: result.success ? 'success' : 'failed',
        });

        onProgress?.({
          type: 'tool_done',
          toolName,
          path: filePath,
          provider: activeProvider,
          message: result.success ? `✓ ${filePath || toolName}` : `✗ ${toolName} failed`,
          success: result.success,
        });

        if (result.success && filePath && (toolName === 'write_file' || toolName === 'create_file' || toolName === 'edit_file')) {
          onFileChanged?.(filePath);
          onRefreshExplorer?.();
          onRefreshGit?.();
          let newContent = String(args.content ?? '');
          if (toolName === 'edit_file') {
            newContent = await readOriginalContent(context.repositoryPath, filePath);
          }
          onProgress?.({
            type: 'file_edit',
            path: filePath,
            originalContent,
            newContent,
          });
        }

        if (result.success && filePath && (toolName === 'read_file' || toolName === 'list_files' || toolName === 'list_directory')) {
          onProgress?.({ type: 'explored', path: filePath });
        }

        if (toolName === 'run_terminal' || toolName === 'build_project' || toolName === 'test_project' || toolName === 'lint_project') {
          onProgress?.({
            type: 'terminal',
            command: String(args.command || toolName),
            output: result.content,
            success: result.success,
            exitCode: result.success ? 0 : 1,
          });
          if (!result.success && stepsUsed < MAX_STEPS - 2) {
            stateStore.setPhase('fixing_errors');
            onProgress?.({ type: 'activity', message: 'Fixing errors from terminal output...' });
          }
        }

        messages.push({
          role: 'tool',
          tool_call_id: result.tool_call_id,
          content: result.content,
        });
      }

      if (cancelled) break;
      continue;
    }

    finalContent = step.message.content || 'Agent stopped unexpectedly.';
    stateStore.setPhase('completed');
    useTaskStore.getState().completeTask(taskId, 'completed');
    onProgress?.({ type: 'content', content: finalContent });
    onProgress?.({ type: 'done', content: finalContent });
    break;
  }

  if (stepsUsed >= MAX_STEPS && !finalContent) {
    finalContent = 'Agent reached maximum steps. Review files and run again if needed.';
    stateStore.setPhase('failed');
    useTaskStore.getState().completeTask(taskId, 'failed');
    onProgress?.({ type: 'error', message: finalContent });
  }

  if (!cancelled && !finalContent) {
    stateStore.setPhase('idle');
  }

  return { content: finalContent, conversationId, stepsUsed, toolCallsMade, cancelled };
}
