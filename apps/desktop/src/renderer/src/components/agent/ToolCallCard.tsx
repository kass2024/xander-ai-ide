import React from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  SkipForward,
  Clock,
  Terminal,
  FilePen,
  Search,
  GitBranch,
  Database,
  Package,
  Hammer,
} from 'lucide-react';
import type { AgentBlock, ToolStepStatus } from '../../stores/agentRunStore';

interface ToolCallCardProps {
  block: AgentBlock;
}

function iconForTool(name?: string) {
  if (!name) return <FilePen className="w-3.5 h-3.5 text-blue-400" />;
  if (name === 'run_terminal' || name === 'build_project' || name === 'test_project') {
    return <Terminal className="w-3.5 h-3.5 text-amber-400" />;
  }
  if (name.startsWith('git_')) return <GitBranch className="w-3.5 h-3.5 text-violet-400" />;
  if (name.startsWith('mysql_') || name.startsWith('db_')) return <Database className="w-3.5 h-3.5 text-cyan-400" />;
  if (name === 'install_package') return <Package className="w-3.5 h-3.5 text-orange-400" />;
  if (name === 'search_project' || name === 'grep') return <Search className="w-3.5 h-3.5 text-sky-400" />;
  if (name === 'build_project') return <Hammer className="w-3.5 h-3.5 text-yellow-400" />;
  return <FilePen className="w-3.5 h-3.5 text-blue-400" />;
}

function statusIcon(status?: ToolStepStatus) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />;
    case 'success':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    case 'skipped':
      return <SkipForward className="w-3.5 h-3.5 text-gray-400" />;
    case 'awaiting_approval':
      return <Clock className="w-3.5 h-3.5 text-amber-400" />;
    default:
      return null;
  }
}

const STATUS_TEXT: Record<ToolStepStatus, string> = {
  running: 'Running…',
  success: 'Done',
  failed: 'Failed',
  skipped: 'Skipped',
  awaiting_approval: 'Awaiting approval',
};

export function ToolCallCard({ block }: ToolCallCardProps) {
  const status = block.stepStatus || 'running';

  return (
    <div className="agent-tool-card">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">{iconForTool(block.toolName)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-[#e0e0e0]">{block.stepLabel || block.toolName}</span>
            {statusIcon(status)}
          </div>
          {block.stepDetail && (
            <p className="text-[11px] opacity-55 mt-0.5 truncate font-mono">{block.stepDetail}</p>
          )}
          {block.path && (
            <p className="text-[10px] opacity-45 mt-0.5 truncate font-mono">{block.path}</p>
          )}
          <span className={`text-[10px] mt-1 inline-block ${status === 'awaiting_approval' ? 'text-amber-400' : 'opacity-40'}`}>
            {STATUS_TEXT[status]}
          </span>
        </div>
      </div>
    </div>
  );
}
