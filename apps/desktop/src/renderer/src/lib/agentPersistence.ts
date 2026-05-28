import type {
  AgentMessageRecord,
  AgentSessionRecord,
  ApprovalRecord,
  FileChangeRecord,
  ToolCallRecord,
  WorkspaceSettings,
  ApprovalDecision,
  ToolResult,
} from '../../../shared/types';

const api = () => window.electronAPI;

export async function persistSession(session: AgentSessionRecord): Promise<void> {
  await api().agentSaveSession(session);
}

export async function persistMessage(msg: AgentMessageRecord): Promise<void> {
  await api().agentSaveMessage(msg);
}

export async function persistToolCall(record: ToolCallRecord): Promise<void> {
  await api().agentSaveToolCall(record);
}

export async function persistApproval(
  record: ApprovalRecord,
  workspacePath?: string,
): Promise<void> {
  await api().agentSaveApproval({ ...record, workspacePath });
}

export async function persistFileChange(record: FileChangeRecord): Promise<void> {
  await api().agentSaveFileChange(record);
}

export async function loadSessionsFromDb(includeArchived = false): Promise<AgentSessionRecord[]> {
  const res = await api().agentListSessions(includeArchived);
  return res.success ? res.sessions ?? [] : [];
}

export async function loadMessagesFromDb(sessionId: string): Promise<AgentMessageRecord[]> {
  const res = await api().agentGetMessages(sessionId);
  return res.success ? res.messages ?? [] : [];
}

export async function getWorkspaceSettings(workspacePath: string): Promise<WorkspaceSettings> {
  const res = await api().agentGetWorkspaceSettings(workspacePath);
  return res.success && res.settings
    ? res.settings
    : { workspacePath, alwaysAllowTools: [] };
}

export async function saveWorkspaceSettings(settings: WorkspaceSettings): Promise<void> {
  await api().agentSaveWorkspaceSettings(settings);
}

export async function checkToolApproval(
  toolName: string,
  argsJson: string,
  workspacePath?: string,
): Promise<{ requiresApproval: boolean; riskLevel: string }> {
  const res = await api().agentCheckApproval({ toolName, argsJson, workspacePath });
  return {
    requiresApproval: res.requiresApproval ?? true,
    riskLevel: res.riskLevel ?? 'medium',
  };
}

export async function executeToolViaMain(
  toolName: string,
  args: Record<string, unknown>,
  workspacePath: string,
  sessionId?: string,
): Promise<ToolResult | null> {
  const res = await api().agentExecuteTool({ toolName, args, workspacePath, sessionId });
  return res.success && res.result ? res.result : null;
}

export async function applyApprovalPolicy(
  toolName: string,
  decision: ApprovalDecision,
  workspacePath?: string,
): Promise<void> {
  await api().agentApplyApprovalPolicy({ toolName, decision, workspacePath });
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
