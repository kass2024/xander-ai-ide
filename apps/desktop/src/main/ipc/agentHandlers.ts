import { ipcMain } from 'electron';
import {
  initAgentDatabase,
  listSessions,
  upsertSession,
  saveMessage,
  getMessages,
  saveToolCall,
  saveApproval,
  saveFileChange,
  getWorkspaceSettings,
  saveWorkspaceSettings,
  logToolExecution,
} from '../agent/database';
import { executeToolSecure } from '../tools/toolExecutor';
import {
  applyApprovalDecision,
  createApprovalPolicy,
  getRiskForTool,
  requiresApproval,
} from '../security/approvalPolicy';
import type { ApprovalDecision, AgentSessionRecord } from '../../shared/types';

const approvalPolicy = createApprovalPolicy();

export function registerAgentIpcHandlers(): void {
  initAgentDatabase();

  ipcMain.handle('agent:list-sessions', (_, includeArchived?: boolean) => {
    try {
      return { success: true, sessions: listSessions(includeArchived) };
    } catch (err) {
      return { success: false, error: (err as Error).message, sessions: [] };
    }
  });

  ipcMain.handle('agent:save-session', (_, session: AgentSessionRecord) => {
    try {
      upsertSession(session);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('agent:save-message', (_, msg) => {
    try {
      saveMessage(msg);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('agent:get-messages', (_, sessionId: string) => {
    try {
      return { success: true, messages: getMessages(sessionId) };
    } catch (err) {
      return { success: false, error: (err as Error).message, messages: [] };
    }
  });

  ipcMain.handle('agent:save-tool-call', (_, record) => {
    try {
      saveToolCall(record);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('agent:save-approval', (_, record: { workspacePath?: string } & Record<string, unknown>) => {
    try {
      saveApproval(record as Parameters<typeof saveApproval>[0]);
      applyApprovalDecision(
        approvalPolicy,
        String(record.toolName),
        record.decision as ApprovalDecision,
        record.workspacePath,
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('agent:save-file-change', (_, record) => {
    try {
      saveFileChange(record);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('agent:get-workspace-settings', (_, workspacePath: string) => {
    try {
      const settings = getWorkspaceSettings(workspacePath);
      for (const tool of settings.alwaysAllowTools) {
        const existing = approvalPolicy.workspaceAlwaysAllow.get(workspacePath) ?? new Set();
        existing.add(tool);
        approvalPolicy.workspaceAlwaysAllow.set(workspacePath, existing);
      }
      return { success: true, settings };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('agent:save-workspace-settings', (_, settings) => {
    try {
      saveWorkspaceSettings(settings);
      const existing = new Set<string>(settings.alwaysAllowTools || []);
      approvalPolicy.workspaceAlwaysAllow.set(settings.workspacePath, existing);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(
    'agent:check-approval',
    (_, payload: { toolName: string; argsJson: string; workspacePath?: string }) => {
      const needs = requiresApproval(payload.toolName, approvalPolicy, payload.workspacePath);
      return {
        success: true,
        requiresApproval: needs,
        riskLevel: getRiskForTool(payload.toolName, payload.argsJson),
      };
    },
  );

  ipcMain.handle(
    'agent:execute-tool',
    async (_, payload: { toolName: string; args: Record<string, unknown>; workspacePath: string; sessionId?: string }) => {
      try {
        const result = await executeToolSecure(payload);
        return { success: true, result };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle('agent:log-tool', (_, entry) => {
    try {
      logToolExecution(entry);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('agent:apply-approval-policy', (_, payload: { toolName: string; decision: ApprovalDecision; workspacePath?: string }) => {
    applyApprovalDecision(approvalPolicy, payload.toolName, payload.decision, payload.workspacePath);
    return { success: true };
  });
}
