import apiClient from './api';
import { executeToolCall, ToolCall, AUTO_TOOLS, APPROVAL_TOOLS } from './agentTools';
import { APPROVAL_REQUIRED_TOOLS, AUTO_APPROVE_TOOLS } from '../../../shared/toolSchemas';
import { WorkspaceContext, resolvePath } from './projectContext';
import { useActionStore } from '../stores/actionStore';
import { buildActionFromToolCall } from './actionEngine';
import { useAgentStateStore, phaseFromTool } from '../stores/agentStateStore';
import { useTaskStore } from '../stores/taskStore';
import { getCachedProjectSummary, peekProjectSummary } from './projectAnalysisCache';
import { clearBackups } from './patchUtils';
import type { AgentMode } from '../stores/agentStateStore';
import {
  AGENT_MODE_CONFIG,
  isToolAllowedInMode,
  maxStepsForAgentMode,
  normalizeAgentMode,
} from '../../../shared/agentModes';
import { maskSecrets } from './secretMasking';
import { useAgentPlanStore } from '../stores/agentPlanStore';
import {
  isActionPrompt,
  extractPathFromPrompt,
  buildLocalTaskPlan,
  isFakeChatbotResponse,
  isPhpToReactTask,
} from './agentIntent';
import { bootstrapAgentContext } from './agentBootstrap';
import { ensureWorkspace, WorkspaceCancelledError } from './workspaceManager';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import { getRunStoreForSession } from '../stores/agentRunStore';
import { useAgentPreferencesStore } from '../stores/agentPreferencesStore';
import { toolTitle, toolStepDetail } from './toolLabels';
import { enterpriseStatusMessage } from './toolCategories';
import { isMockMode, mockAgentStream } from './providers';
import { isUiRelatedTask, CLAUDE_UI_MODEL } from './uiRouting';
import {
  checkToolApproval,
  persistToolCall,
} from './agentPersistence';
import { getToolRiskLevel } from '../../../shared/toolSchemas';

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
    | 'approval_prompt'
    | 'file_edit'
    | 'stepId'
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

function maxStepsForMode(mode: AgentMode): number {
  return maxStepsForAgentMode(normalizeAgentMode(mode));
}

const TOOL_ACTIVITY: Record<string, (args: Record<string, unknown>) => string> = {
  read_file: (a) => `Reading ${String(a.path || '').split(/[/\\]/).pop() || 'file'}...`,
  list_files: (a) => `Listing ${String(a.path || 'project root').split(/[/\\]/).pop()}...`,
  list_directory: (a) => `Listing ${String(a.path || 'project root').split(/[/\\]/).pop()}...`,
  search_code: (a) => `Searching for "${String(a.query || a.pattern || '').slice(0, 60)}"...`,
  search_project: (a) => `Searching for "${String(a.query || '').slice(0, 60)}"...`,
  grep: (a) => `Grep: "${String(a.pattern || '').slice(0, 60)}"...`,
  semantic_search: (a) => `Semantic search: "${String(a.query || '').slice(0, 60)}"...`,
  analyze_project: () => 'Analyzing project structure...',
  inspect_database: () => 'Inspecting database config...',
  inspect_xampp_mysql: () => 'Connecting to XAMPP MySQL...',
  mysql_list_databases: () => 'Listing MySQL databases...',
  mysql_query: () => 'Running SQL query...',
  mysql_execute: () => 'Executing SQL...',
  walk_project_files: () => 'Listing project files...',
  git_commit: (a) => `Committing: ${String(a.message || '').slice(0, 50)}...`,
  git_push: () => 'Pushing to remote...',
  git_pull: () => 'Pulling from remote...',
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

async function toolNeedsApproval(
  toolName: string,
  argsJson: string,
  workspacePath?: string | null,
): Promise<boolean> {
  const prefs = useAgentPreferencesStore.getState();
  if (prefs.isToolAllowed(toolName, workspacePath || undefined)) return false;
  if (AUTO_APPROVE_TOOLS.has(toolName) || AUTO_TOOLS.has(toolName)) {
    if (!APPROVAL_REQUIRED_TOOLS.has(toolName) && !APPROVAL_TOOLS.has(toolName)) return false;
  }
  try {
    const check = await checkToolApproval(toolName, argsJson, workspacePath || undefined);
    return check.requiresApproval;
  } catch {
    return APPROVAL_REQUIRED_TOOLS.has(toolName) || APPROVAL_TOOLS.has(toolName);
  }
}

async function requestToolApproval(
  tc: ToolCall,
  projectPath: string | null | undefined,
  stepId: string,
  sessionId: string,
): Promise<boolean> {
  const runStore = getRunStoreForSession(sessionId);
  const built = buildActionFromToolCall(tc);
  if (!built) return false;

  const args = parseToolArgs(tc.function.arguments);
  const riskLevel = getToolRiskLevel(tc.function.name, args);

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

  const approvalPromise = addAction(built);
  const pendingList = useActionStore.getState().actions.filter((a) => a.status === 'pending');
  const pending =
    pendingList.find((a) => a.toolCall?.id === tc.id) ?? pendingList[pendingList.length - 1];
  const actionId = pending?.id;

  let approvalBlockId: string | undefined;
  if (actionId) {
    approvalBlockId = runStore.addApprovalBlock({
      toolName: tc.function.name,
      label: built.label,
      actionId,
      command: built.command,
      path: built.path,
      preview: built.content?.slice(0, 2000),
      reason:
        tc.function.name === 'run_terminal'
          ? `Shell command (${riskLevel} risk) — review before running on your machine.`
          : tc.function.name === 'git_push'
            ? 'Pushes commits to the remote repository.'
            : tc.function.name === 'delete_file'
              ? 'Permanent file deletion.'
              : 'Review this change before applying.',
    });
    runStore.finishToolStep(stepId, 'awaiting_approval');
  }

  const approved = await approvalPromise;
  if (approvalBlockId) {
    runStore.removeApprovalBlock(approvalBlockId);
  }
  return approved;
}

function resolveModelForMode(
  model: string | undefined,
  agentMode: AgentMode,
  prompt?: string,
  hasImages?: boolean,
): string | undefined {
  if (model && model !== 'auto') return model;
  if (hasImages || (prompt && isUiRelatedTask(prompt))) return CLAUDE_UI_MODEL;

  const prefs = useAgentPreferencesStore.getState();
  if (prefs.selectedProvider !== 'auto') {
    switch (prefs.selectedProvider) {
      case 'claude': return 'claude-sonnet-4-20250514';
      case 'gemini': return 'gemini-2.5-flash';
      case 'openai': return 'gpt-4o';
      default: break;
    }
  }

  const mode = normalizeAgentMode(agentMode);
  const pref = AGENT_MODE_CONFIG[mode].preferredProvider;
  switch (pref) {
    case 'anthropic': return 'claude-sonnet-4-20250514';
    case 'google': return 'gemini-2.5-flash';
    case 'openai': return 'gpt-4o';
    default: return undefined;
  }
}

export async function runAgent(options: {
  prompt: string;
  context: WorkspaceContext;
  model?: string;
  agentMode?: AgentMode;
  sessionId?: string;
  conversationId?: string;
  images?: Array<{ mediaType: string; data: string }>;
  onProgress?: (progress: AgentProgress) => void;
  onFileChanged?: (path: string) => void;
  onRefreshGit?: () => void;
  onRefreshExplorer?: () => void;
}): Promise<AgentRunResult> {
  const sessionId = options.sessionId || '_default';
  const runStore = getRunStoreForSession(sessionId);
  const {
    prompt,
    images,
    onProgress,
    onFileChanged,
    onRefreshGit,
    onRefreshExplorer,
  } = options;
  let context = options.context;

  let agentMode = options.agentMode ?? useAgentStateStore.getState().mode;
  const actionTask = isActionPrompt(prompt);
  if (actionTask && (agentMode === 'chat' || agentMode === 'command')) {
    agentMode = 'build';
    useAgentStateStore.getState().setMode('build');
  }
  let model = resolveModelForMode(options.model, agentMode, prompt, !!images?.length);
  if (actionTask && (!model || model === 'gemini-2.5-flash')) {
    model = 'gpt-4o';
  }
  const MAX_STEPS = maxStepsForMode(agentMode);
  let forceTools = actionTask;
  let chatbotRetries = 0;

  const hasToken = !!apiClient.getToken();
  const mockMode = !hasToken;

  if (!mockMode) {
    await useAuthStore.getState().ensureSession();
  }

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

  let repositoryPath = context.repositoryPath;
  const pathFromPrompt = extractPathFromPrompt(prompt);
  if (pathFromPrompt && !repositoryPath) {
    onProgress?.({ type: 'activity', message: `Detected path: ${pathFromPrompt}` });
    try {
      const opened = await window.electronAPI.openProject(pathFromPrompt);
      if (opened.success) {
        repositoryPath = pathFromPrompt;
        useProjectStore.getState().setCurrentProject(pathFromPrompt);
        context = { ...context, repositoryPath, workspaceFolders: [pathFromPrompt] };
      }
    } catch { /* fall through to picker */ }
  }
  if (!repositoryPath) {
    onProgress?.({ type: 'activity', message: 'Selecting project folder...' });
    try {
      repositoryPath = await ensureWorkspace();
      context = {
        ...context,
        repositoryPath,
        workspaceFolders: context.workspaceFolders?.length
          ? context.workspaceFolders
          : [repositoryPath],
      };
    } catch (e) {
      stateStore.setPhase('failed');
      if (e instanceof WorkspaceCancelledError) {
        throw new Error('Pick a project folder to run Agent (File → Open Folder or retry).');
      }
      throw e;
    }
  }

  clearBackups(repositoryPath);

  const taskId = useTaskStore.getState().startTask(repositoryPath, prompt);
  const addTaskCard = (title: string, status: 'pending' | 'running' | 'success' | 'failed', detail?: string) => {
    const cardId = useTaskStore.getState().addCard(taskId, { title, status, detail });
    onProgress?.({ type: 'task_card', cardTitle: title, cardStatus: status, message: detail });
    return cardId;
  };

  let activeProvider: string | undefined;
  let screenshotAnalysisFromScan: string | undefined;

  // Bootstrap: real scan before LLM on action tasks
  let projectSummary = context.projectSummary || peekProjectSummary(repositoryPath || '');
  if (actionTask && repositoryPath) {
    const boot = await bootstrapAgentContext(repositoryPath, prompt, onProgress);
    projectSummary = boot.projectSummary;
    context = { ...context, projectSummary, projectTree: boot.projectTree };
    const planSteps = buildLocalTaskPlan(prompt, repositoryPath);
    useAgentPlanStore.getState().setSteps(planSteps);
    runStore.addTaskPlan(
      isPhpToReactTask(prompt) ? 'Convert PHP project to React' : 'Execute coding task',
      repositoryPath,
      planSteps,
    );
    forceTools = true;
  } else if (!projectSummary && repositoryPath) {
    projectSummary = await getCachedProjectSummary(repositoryPath);
    if (projectSummary) context = { ...context, projectSummary };
  }

  if (images?.length) {
    stateStore.setPhase('analyzing');
    onProgress?.({ type: 'activity', message: 'Scanning attached screenshot…' });
    onProgress?.({ type: 'phase', phase: 'analyzing' });
    try {
      const scan = await apiClient.aiAnalyzeScreenshot({ images, prompt });
      if (scan.analysis) {
        screenshotAnalysisFromScan = scan.analysis;
        onProgress?.({ type: 'screenshot_analysis', content: scan.analysis });
      }
    } catch { /* vision in step */ }
  } else {
    stateStore.setPhase('planning');
    onProgress?.({ type: 'phase', phase: 'planning' });
    onProgress?.({ type: 'thinking', message: 'Connecting to AI agent…' });
  }

  if (mockMode) {
    return runMockAgent({
      prompt: userPrompt,
      repositoryPath: repositoryPath!,
      messages,
      sessionId,
      onProgress,
      onFileChanged,
      onRefreshGit,
      onRefreshExplorer,
      taskId,
      stateStore,
    });
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
        forceTools: forceTools && toolCallsMade.length === 0,
        terminalCwd: repositoryPath,
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
      const reply = step.message.content || '';
      const needsTools = actionTask && toolCallsMade.length === 0;
      const isFake = isFakeChatbotResponse(reply) || (needsTools && reply.length > 80);
      if (isFake && chatbotRetries < 4) {
        chatbotRetries += 1;
        forceTools = true;
        messages.push({ role: 'assistant', content: reply });
        messages.push({
          role: 'user',
          content:
            '[SYSTEM] Execute with tools NOW. Do not explain or ask questions. '
            + 'Call walk_project_files or read_file, then write_file/create_file. '
            + 'For PHP→React: scaffold Vite React, convert pages to components, run npm install && npm run build.',
        });
        onProgress?.({ type: 'activity', message: 'Rejecting chat-only reply — forcing tool execution…' });
        stateStore.setPhase('reading_files');
        continue;
      }
      finalContent = reply || 'Task completed.';
      if (normalizeAgentMode(agentMode) === 'plan' && finalContent) {
        useAgentPlanStore.getState().parseFromMarkdown(finalContent);
      }
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
        forceTools = false;

        const phase = phaseFromTool(toolName);
        stateStore.setPhase(phase);
        onProgress?.({ type: 'phase', phase });

        const activityMsg = enterpriseStatusMessage(toolName, args);
        const stepLabel = toolTitle(toolName);
        const stepDetail = toolStepDetail(toolName, args);
        const stepId = runStore.startToolStep(toolName, stepLabel, stepDetail);

        const taskMode = normalizeAgentMode(agentMode);
        if (!isToolAllowedInMode(toolName, taskMode)) {
          const blocked = {
            tool_call_id: tc.id,
            content: `Tool "${toolName}" is not allowed in ${taskMode} mode. Switch to Build, Debug, or Database mode.`,
            success: false,
          };
          runStore.finishToolStep(stepId, 'failed', blocked.content);
          messages.push({ role: 'tool', tool_call_id: blocked.tool_call_id, content: blocked.content });
          continue;
        }
        onProgress?.({ type: 'phase', phase });
        onProgress?.({ type: 'activity', message: activityMsg, toolName });
        onProgress?.({ type: 'tool_start', toolName, path: filePath, provider: activeProvider, message: activityMsg, stepId });

        const cardTitleFn = TOOL_CARD_TITLE[toolName];
        const cardTitle = cardTitleFn?.(args, true) || activityMsg.replace('...', '');
        const cardId = addTaskCard(cardTitle, 'running', filePath);

        if (toolName === 'search_project' || toolName === 'search_code' || toolName === 'grep' || toolName === 'semantic_search') {
          onProgress?.({ type: 'search' });
        }

        let result;
        let originalContent = '';

        if (toolName === 'write_file' || toolName === 'create_file' || toolName === 'edit_file') {
          originalContent = filePath ? await readOriginalContent(repositoryPath, filePath) : '';
        }

        if (await toolNeedsApproval(toolName, tc.function.arguments, repositoryPath)) {
          onProgress?.({ type: 'approval_needed', toolName, message: `Approve: ${stepLabel}` });
          const approved = await requestToolApproval(tc, repositoryPath, stepId, sessionId);
          if (!approved) {
            result = { tool_call_id: tc.id, content: 'User skipped this action.', success: false };
          } else {
            result = await executeToolCall(tc, repositoryPath);
          }
        } else if (AUTO_TOOLS.has(toolName)) {
          result = await executeToolCall(tc, repositoryPath);
        } else {
          result = await executeToolCall(tc, repositoryPath);
        }

        const safeResultContent = maskSecrets(result.content);

        persistToolCall({
          id: tc.id,
          sessionId: options.conversationId || 'local',
          toolName,
          arguments: tc.function.arguments,
          result: safeResultContent.slice(0, 4000),
          success: result.success,
          createdAt: new Date().toISOString(),
        }).catch(() => {});

        runStore.finishToolStep(
          stepId,
          result.success ? 'success' : APPROVAL_TOOLS.has(toolName) && !result.success ? 'skipped' : 'failed',
          result.success ? undefined : result.content.slice(0, 200),
        );

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
            newContent = await readOriginalContent(repositoryPath, filePath);
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

        if (result.success && (toolName === 'git_commit' || toolName === 'git_push' || toolName === 'git_pull')) {
          onRefreshGit?.();
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
          content: safeResultContent,
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

async function runMockAgent(opts: {
  prompt: string;
  repositoryPath: string;
  messages: AgentMessage[];
  sessionId: string;
  onProgress?: (progress: AgentProgress) => void;
  onFileChanged?: (path: string) => void;
  onRefreshGit?: () => void;
  onRefreshExplorer?: () => void;
  taskId: string;
  stateStore: ReturnType<typeof useAgentStateStore.getState>;
}): Promise<AgentRunResult> {
  const { prompt, repositoryPath, sessionId, onProgress, onFileChanged, onRefreshGit, onRefreshExplorer, taskId, stateStore } = opts;
  const runStore = getRunStoreForSession(sessionId);
  const toolCallsMade: string[] = [];
  let streamedText = '';

  for await (const event of mockAgentStream(prompt, opts.messages)) {
    if (useAgentStateStore.getState().cancelRequested) {
      onProgress?.({ type: 'error', message: 'Agent run cancelled.' });
      useTaskStore.getState().completeTask(taskId, 'cancelled');
      return { content: 'Cancelled.', stepsUsed: 0, toolCallsMade, cancelled: true };
    }

    switch (event.type) {
      case 'status':
        onProgress?.({ type: 'thinking', message: event.text });
        break;
      case 'message_delta':
        streamedText += event.text;
        onProgress?.({ type: 'content', content: streamedText });
        break;
      case 'tool_request': {
        const tc = event.toolCall;
        const toolName = tc.function.name;
        const args = parseToolArgs(tc.function.arguments);
        toolCallsMade.push(toolName);
        const stepLabel = toolTitle(toolName);
        const stepDetail = toolStepDetail(toolName, args);
        const stepId = runStore.startToolStep(toolName, stepLabel, stepDetail);
        onProgress?.({ type: 'tool_start', toolName, stepId, message: `${toolName}...` });

        let approved = true;
        if (await toolNeedsApproval(toolName, tc.function.arguments, repositoryPath)) {
          onProgress?.({ type: 'approval_needed', toolName, message: `Approve: ${stepLabel}` });
          approved = await requestToolApproval(tc, repositoryPath, stepId, sessionId);
        }

        if (approved) {
          const result = await executeToolCall(tc, repositoryPath);
          runStore.finishToolStep(stepId, result.success ? 'success' : 'failed');
          onProgress?.({ type: 'tool_done', toolName, success: result.success });
          if (event.type === 'tool_request' && result.success) {
            const filePath = (args.path || args.file) as string | undefined;
            if (filePath && ['write_file', 'create_file', 'edit_file'].includes(toolName)) {
              onFileChanged?.(filePath);
              onRefreshExplorer?.();
              onProgress?.({
                type: 'file_edit',
                path: filePath,
                originalContent: '',
                newContent: String(args.content ?? ''),
              });
            }
            if (toolName === 'run_terminal') {
              onProgress?.({
                type: 'terminal',
                command: String(args.command || ''),
                output: result.content,
                success: result.success,
              });
            }
          }
        } else {
          runStore.finishToolStep(stepId, 'skipped');
        }
        break;
      }
      case 'diff':
        onProgress?.({
          type: 'file_edit',
          path: event.filePath,
          originalContent: event.oldText,
          newContent: event.newText,
        });
        break;
      case 'error':
        onProgress?.({ type: 'error', message: event.message });
        break;
      case 'done':
        stateStore.setPhase('completed');
        useTaskStore.getState().completeTask(taskId, 'completed');
        onProgress?.({ type: 'done', content: streamedText });
        onRefreshGit?.();
        onRefreshExplorer?.();
        break;
    }
  }

  return {
    content: streamedText || 'Mock agent finished.',
    stepsUsed: toolCallsMade.length,
    toolCallsMade,
  };
}
