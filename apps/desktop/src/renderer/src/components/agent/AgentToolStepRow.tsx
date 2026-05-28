import React from 'react';
import {
  Loader2,
  Check,
  X,
  SkipForward,
  ChevronRight,
  FileText,
  Search,
  Terminal,
  FolderTree,
  Database,
} from 'lucide-react';
import type { AgentBlock } from '../../stores/agentRunStore';

function iconFor(toolName?: string) {
  if (!toolName) return <ChevronRight className="w-3.5 h-3.5 opacity-50" />;
  if (toolName.includes('search') || toolName === 'grep') return <Search className="w-3.5 h-3.5 text-sky-400" />;
  if (toolName.includes('terminal') || toolName === 'run_terminal' || toolName.startsWith('mysql_')) {
    return <Terminal className="w-3.5 h-3.5 text-amber-400" />;
  }
  if (toolName.includes('database') || toolName.includes('mysql') || toolName.includes('inspect')) {
    return <Database className="w-3.5 h-3.5 text-cyan-400" />;
  }
  if (toolName.includes('list') || toolName.includes('walk') || toolName.includes('analyze')) {
    return <FolderTree className="w-3.5 h-3.5 text-emerald-400" />;
  }
  return <FileText className="w-3.5 h-3.5 text-violet-400" />;
}

function statusIcon(status?: string) {
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />;
  if (status === 'success') return <Check className="w-3.5 h-3.5 text-emerald-400" />;
  if (status === 'failed') return <X className="w-3.5 h-3.5 text-red-400" />;
  if (status === 'skipped') return <SkipForward className="w-3.5 h-3.5 text-orange-400" />;
  return null;
}

export function AgentToolStepRow({ block }: { block: AgentBlock }) {
  const detail = block.stepDetail;
  return (
    <div className={`agent-tool-step agent-tool-step--${block.stepStatus || 'running'}`}>
      {iconFor(block.toolName)}
      <div className="agent-tool-step-body">
        <span className="agent-tool-step-label">{block.stepLabel}</span>
        {detail && (
          <span className="agent-tool-step-detail" title={detail}>
            {detail}
          </span>
        )}
      </div>
      {statusIcon(block.stepStatus)}
    </div>
  );
}
