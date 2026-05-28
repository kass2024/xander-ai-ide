import React from 'react';
import { CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';
import { useTaskStore, TaskCardStatus } from '../../stores/taskStore';
import { useAgentStateStore, PHASE_LABELS } from '../../stores/agentStateStore';

function StatusIcon({ status }: { status: TaskCardStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />;
    case 'success':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    default:
      return <Circle className="w-3.5 h-3.5 text-gray-500" />;
  }
}

interface TaskProgressPanelProps {
  projectPath?: string | null;
  compact?: boolean;
}

export function TaskProgressPanel(_props: TaskProgressPanelProps) {
  const activeTaskId = useTaskStore((s) => s.activeTaskId);
  const activeTask = useTaskStore((s) => s.tasks.find((t) => t.id === activeTaskId));
  const phase = useAgentStateStore((s) => s.phase);
  const isRunning = useAgentStateStore(
    (s) => s.phase !== 'idle' && s.phase !== 'completed' && s.phase !== 'failed',
  );

  if (!activeTask?.cards.length && !isRunning) {
    return null;
  }

  const cards = activeTask?.cards ?? [];

  return (
    <div className="task-progress-panel border-t border-[var(--vscode-panel-border)]">
      {isRunning && (
        <div className="px-3 py-2 text-[11px] text-[var(--vscode-descriptionForeground)] flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
          <span>{PHASE_LABELS[phase]}</span>
        </div>
      )}
      {cards.length > 0 && (
        <div className="px-2 pb-2 space-y-1 max-h-36 overflow-y-auto">
          {cards.map((card) => (
            <div
              key={card.id}
              className={`task-card task-card--${card.status} flex items-start gap-2 px-2 py-1.5 rounded text-[11px]`}
            >
              <StatusIcon status={card.status} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[var(--vscode-foreground)] truncate">{card.title}</div>
                {card.detail && (
                  <div className="text-[var(--vscode-descriptionForeground)] truncate">{card.detail}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
