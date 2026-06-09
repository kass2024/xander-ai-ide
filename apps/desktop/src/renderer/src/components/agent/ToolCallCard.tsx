import React, { useState } from 'react';

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

  ChevronDown,

  ChevronRight,

  FolderOpen,

} from 'lucide-react';

import type { AgentBlock, ToolStepStatus } from '../../stores/agentRunStore';

import { CATEGORY_STYLES, toolCategory } from '../../lib/toolCategories';



interface ToolCallCardProps {

  block: AgentBlock;

}



function iconForTool(name?: string, color?: string) {

  const cls = `w-4 h-4 shrink-0`;

  const style = color ? { color } : undefined;

  if (!name) return <FilePen className={cls} style={style} />;

  if (name === 'run_terminal' || name === 'build_project' || name === 'test_project') {

    return <Terminal className={cls} style={style} />;

  }

  if (name.startsWith('git_')) return <GitBranch className={cls} style={style} />;

  if (name.startsWith('mysql_') || name.startsWith('db_') || name === 'inspect_database' || name === 'inspect_xampp_mysql') {

    return <Database className={cls} style={style} />;

  }

  if (name === 'install_package') return <Package className={cls} style={style} />;

  if (name === 'search_project' || name === 'grep' || name === 'semantic_search' || name === 'search_code') {

    return <Search className={cls} style={style} />;

  }

  if (name === 'list_files' || name === 'list_directory' || name === 'walk_project_files') {

    return <FolderOpen className={cls} style={style} />;

  }

  if (name === 'build_project') return <Hammer className={cls} style={style} />;

  return <FilePen className={cls} style={style} />;

}



function statusIcon(status?: ToolStepStatus) {

  switch (status) {

    case 'running':

      return <Loader2 className="w-4 h-4 animate-spin text-violet-400" />;

    case 'success':

      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;

    case 'failed':

      return <XCircle className="w-4 h-4 text-red-400" />;

    case 'skipped':

      return <SkipForward className="w-4 h-4 text-gray-400" />;

    case 'awaiting_approval':

      return <Clock className="w-4 h-4 text-amber-400" />;

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

  const [expanded, setExpanded] = useState(true);

  const status = block.stepStatus || 'running';

  const hasDetail = !!(block.stepDetail || block.path || block.command);

  const cat = block.category || toolCategory(block.toolName);

  const style = CATEGORY_STYLES[cat];



  return (

    <div

      className={`cursor-action-card cursor-action-card--${status} cursor-action-card--cat-${cat}`}

      style={{

        borderLeftWidth: 3,

        borderLeftColor: style.color,

        background: `linear-gradient(90deg, ${style.bg} 0%, #161616 28%)`,

        boxShadow: status === 'running' ? `0 0 20px ${style.glow}` : undefined,

      }}

    >

      <button

        type="button"

        className="cursor-action-card-header"

        onClick={() => hasDetail && setExpanded(!expanded)}

        disabled={!hasDetail}

      >

        <div className="cursor-action-card-icon">{iconForTool(block.toolName, style.color)}</div>

        <div className="cursor-action-card-body">

          <div className="flex items-center gap-2 flex-wrap">

            <span

              className="cursor-action-card-tag"

              style={{ color: style.color, background: style.bg, borderColor: style.border }}

            >

              {style.label}

            </span>

            <div className="cursor-action-card-title">{block.stepLabel || block.toolName}</div>

          </div>

          {block.stepDetail && (

            <div className="cursor-action-card-detail">{block.stepDetail}</div>

          )}

        </div>

        <div className="cursor-action-card-status">

          {statusIcon(status)}

          <span

            className={`cursor-action-badge cursor-action-badge--${status}`}

            style={status === 'running' ? { background: style.bg, color: style.color } : undefined}

          >

            {STATUS_TEXT[status]}

          </span>

          {hasDetail && (

            expanded ? <ChevronDown className="w-3.5 h-3.5 opacity-40" /> : <ChevronRight className="w-3.5 h-3.5 opacity-40" />

          )}

        </div>

      </button>

      {expanded && hasDetail && (

        <div className="cursor-action-card-expand">

          {block.path && (

            <div className="cursor-action-card-path">{block.path}</div>

          )}

          {block.command && (

            <pre className="cursor-action-card-command">{block.command}</pre>

          )}

        </div>

      )}

    </div>

  );

}

