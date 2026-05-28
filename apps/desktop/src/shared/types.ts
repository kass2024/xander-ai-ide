export type RiskLevel = 'low' | 'medium' | 'high';

export type ToolName =
  | 'read_file'
  | 'write_file'
  | 'edit_file'
  | 'create_file'
  | 'delete_file'
  | 'list_directory'
  | 'search_project'
  | 'run_terminal'
  | 'git_status'
  | 'git_diff'
  | 'db_query'
  | 'db_migration_preview'
  | 'install_package'
  | 'build_project';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

export type ApprovalDecision =
  | 'run_once'
  | 'skip'
  | 'always_tool'
  | 'always_workspace'
  | 'cancel_task';

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  toolName: string;
  command?: string;
  filePath?: string;
  reason: string;
  riskLevel: RiskLevel;
  preview?: string;
}

export type AgentEvent =
  | { type: 'message_delta'; text: string }
  | { type: 'status'; text: string }
  | { type: 'tool_request'; toolCall: ToolCall }
  | { type: 'tool_result'; result: ToolResult }
  | { type: 'diff'; filePath: string; oldText: string; newText: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

export type AIProviderName = 'openai' | 'claude' | 'gemini' | 'auto' | 'mock';

export interface AgentSessionRecord {
  id: string;
  title: string;
  model: string;
  provider: AIProviderName;
  projectPath?: string;
  archived: boolean;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  createdAt: string;
}

export interface ToolCallRecord {
  id: string;
  sessionId: string;
  toolName: string;
  arguments: string;
  result?: string;
  success?: boolean;
  createdAt: string;
}

export interface ApprovalRecord {
  id: string;
  sessionId: string;
  toolName: string;
  decision: ApprovalDecision;
  createdAt: string;
}

export interface FileChangeRecord {
  id: string;
  sessionId: string;
  filePath: string;
  oldText: string;
  newText: string;
  accepted: boolean;
  createdAt: string;
}

export interface WorkspaceSettings {
  workspacePath: string;
  alwaysAllowTools: string[];
  model?: string;
  provider?: AIProviderName;
}

export interface AIProvider {
  name: Exclude<AIProviderName, 'auto' | 'mock'>;
  streamChat(
    messages: Array<{ role: string; content?: string | null }>,
    tools: unknown[],
    options?: { model?: string; conversationId?: string; context?: Record<string, unknown> },
  ): AsyncIterable<AgentEvent>;
}
