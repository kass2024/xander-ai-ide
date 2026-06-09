import React from 'react';
import {
  Play,
  SkipForward,
  Terminal,
  FilePen,
  Trash2,
  GitBranch,
  Database,
  ShieldAlert,
  Shield,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useActionStore } from '../../stores/actionStore';
import { useAgentRunStore } from '../../stores/agentRunStore';
import { useAgentPreferencesStore } from '../../stores/agentPreferencesStore';
import { useAgentStateStore } from '../../stores/agentStateStore';
import type { AgentBlock } from '../../stores/agentRunStore';
import type { ApprovalDecision } from '../../../../shared/types';
import { applyApprovalPolicy, persistApproval, generateId } from '../../lib/agentPersistence';
import { getToolRiskLevel } from '../../../../shared/toolSchemas';

interface ApprovalCardProps {
  block: AgentBlock;
  projectPath: string | null;
  sessionId?: string | null;
  onResolved?: () => void;
}

function iconForTool(name?: string) {
  if (name === 'run_terminal' || name === 'mysql_execute') return <Terminal className="w-4 h-4 text-amber-400" />;
  if (name === 'delete_file') return <Trash2 className="w-4 h-4 text-red-400" />;
  if (name?.startsWith('git_')) return <GitBranch className="w-4 h-4 text-violet-400" />;
  if (name?.startsWith('mysql_') || name?.startsWith('db_')) return <Database className="w-4 h-4 text-cyan-400" />;
  return <FilePen className="w-4 h-4 text-blue-400" />;
}

function riskIcon(level: string) {
  if (level === 'high') return <ShieldAlert className="w-3.5 h-3.5 text-red-400" />;
  if (level === 'medium') return <Shield className="w-3.5 h-3.5 text-amber-400" />;
  return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
}

function riskLabel(level: string) {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function ApprovalCard({ block, projectPath, sessionId, onResolved }: ApprovalCardProps) {
  const { actions, approve, reject } = useActionStore();
  const removeApprovalBlock = useAgentRunStore((s) => s.removeApprovalBlock);
  const addGlobalAllow = useAgentPreferencesStore((s) => s.addGlobalAllowTool);
  const addWorkspaceAllow = useAgentPreferencesStore((s) => s.addWorkspaceAllowTool);
  const requestCancel = useAgentStateStore((s) => s.requestCancel);

  const action = actions.find((a) => a.id === block.actionId);
  if (!action || action.status !== 'pending') return null;

  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(action.toolCall?.function.arguments || '{}');
  } catch { /* empty */ }
  const riskLevel = getToolRiskLevel(block.toolName || action.toolCall?.function.name || '', args);

  const resolve = async (decision: ApprovalDecision, approved: boolean) => {
    const toolName = block.toolName || action.toolCall?.function.name || 'unknown';
    if (decision === 'always_tool') addGlobalAllow(toolName);
    if (decision === 'always_workspace' && projectPath) addWorkspaceAllow(projectPath, toolName);

    await applyApprovalPolicy(toolName, decision, projectPath || undefined);
    if (sessionId) {
      await persistApproval(
        {
          id: generateId('approval'),
          sessionId,
          toolName,
          decision,
          createdAt: new Date().toISOString(),
        },
        projectPath || undefined,
      );
    }

    if (approved) approve(action.id);
    else reject(action.id);
    removeApprovalBlock(sessionId || '_default', block.id);
    onResolved?.();
  };

  const command = block.command || action.command;
  const preview = block.content || action.content;

  return (
    <div className="agent-approval-card">
      <div className="agent-approval-header">
        {iconForTool(block.toolName)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="agent-approval-title">{block.stepLabel || action.label}</div>
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#2a2a2a]">
              {riskIcon(riskLevel)}
              {riskLabel(riskLevel)}
            </span>
          </div>
          <div className="agent-approval-sub">
            {block.approvalReason || 'This action needs your approval before the agent continues.'}
          </div>
        </div>
      </div>

      <div className="text-[10px] opacity-50 font-mono mb-2">
        Tool: <span className="text-[#9cdcfe]">{block.toolName || action.toolCall?.function.name}</span>
      </div>

      {command && (
        <div className="agent-approval-command">
          <div className="agent-approval-command-label">Command</div>
          <pre className="agent-approval-command-body">{command}</pre>
        </div>
      )}

      {preview && !command && (
        <pre className="agent-approval-preview">{preview.slice(0, 1200)}</pre>
      )}

      {block.path && (
        <div className="agent-approval-path text-[10px] opacity-60 font-mono truncate">{block.path}</div>
      )}

      {action.dangerous && (
        <div className="text-[11px] text-red-400 mt-2 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" />
          Warning: this action may be destructive.
        </div>
      )}

      <div className="agent-approval-actions flex-wrap gap-2 mt-3">
        <button type="button" className="agent-approval-btn-run" onClick={() => resolve('run_once', true)}>
          <Play className="w-3.5 h-3.5" />
          Run once
        </button>
        <button type="button" className="agent-approval-btn-skip" onClick={() => resolve('skip', false)}>
          <SkipForward className="w-3.5 h-3.5" />
          Skip
        </button>
        <button type="button" className="agent-approval-btn-secondary" onClick={() => resolve('always_tool', true)}>
          Always allow this tool
        </button>
        {projectPath && (
          <button type="button" className="agent-approval-btn-secondary" onClick={() => resolve('always_workspace', true)}>
            Always allow in workspace
          </button>
        )}
        <button
          type="button"
          className="agent-approval-btn-cancel"
          onClick={() => {
            requestCancel();
            resolve('cancel_task', false);
          }}
        >
          <XCircle className="w-3.5 h-3.5" />
          Cancel task
        </button>
      </div>
      {!projectPath && (
        <p className="text-[10px] text-orange-400 mt-2">Open a project folder first.</p>
      )}
    </div>
  );
}

/** @deprecated use ApprovalCard */
export const AgentApprovalCard = ApprovalCard;
