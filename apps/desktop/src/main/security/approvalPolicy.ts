import { APPROVAL_REQUIRED_TOOLS, AUTO_APPROVE_TOOLS, getToolRiskLevel } from '../../shared/toolSchemas';
import type { ApprovalDecision, RiskLevel } from '../../shared/types';

export interface ApprovalPolicyState {
  globalAlwaysAllow: Set<string>;
  workspaceAlwaysAllow: Map<string, Set<string>>;
}

export function createApprovalPolicy(): ApprovalPolicyState {
  return {
    globalAlwaysAllow: new Set(),
    workspaceAlwaysAllow: new Map(),
  };
}

export function requiresApproval(
  toolName: string,
  policy: ApprovalPolicyState,
  workspacePath?: string,
): boolean {
  if (AUTO_APPROVE_TOOLS.has(toolName)) return false;
  if (policy.globalAlwaysAllow.has(toolName)) return false;
  if (workspacePath) {
    const ws = policy.workspaceAlwaysAllow.get(workspacePath);
    if (ws?.has(toolName)) return false;
  }
  return APPROVAL_REQUIRED_TOOLS.has(toolName) || !AUTO_APPROVE_TOOLS.has(toolName);
}

export function applyApprovalDecision(
  policy: ApprovalPolicyState,
  toolName: string,
  decision: ApprovalDecision,
  workspacePath?: string,
): void {
  if (decision === 'always_tool') {
    policy.globalAlwaysAllow.add(toolName);
  } else if (decision === 'always_workspace' && workspacePath) {
    const existing = policy.workspaceAlwaysAllow.get(workspacePath) ?? new Set();
    existing.add(toolName);
    policy.workspaceAlwaysAllow.set(workspacePath, existing);
  }
}

export function getRiskForTool(toolName: string, argsJson: string): RiskLevel {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || '{}');
  } catch { /* empty */ }
  return getToolRiskLevel(toolName, args);
}
