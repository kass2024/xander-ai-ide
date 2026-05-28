import React from 'react';
import { X, Pencil, Play, ChevronDown, ChevronRight } from 'lucide-react';
import { useTaskStore, AgentTask } from '../../stores/taskStore';

interface RecentTasksPanelProps {
  projectPath?: string | null;
  onReEdit: (prompt: string) => void;
  onContinue: (prompt: string) => void;
}

function statusDot(status: AgentTask['status']) {
  if (status === 'completed') return 'text-emerald-400';
  if (status === 'failed' || status === 'cancelled') return 'text-red-400';
  return 'text-amber-400';
}

export function RecentTasksPanel({ projectPath, onReEdit, onContinue }: RecentTasksPanelProps) {
  const [open, setOpen] = React.useState(true);
  const tasks = useTaskStore((s) => s.tasks);
  const activeTaskId = useTaskStore((s) => s.activeTaskId);
  const removeTask = useTaskStore((s) => s.removeTask);

  const recent = tasks
    .filter((t) => !projectPath || t.projectPath === projectPath)
    .slice(0, 12);

  if (recent.length === 0) return null;

  return (
    <div className="recent-tasks-panel border-t border-[#2a2a2a]">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wide text-[#888] hover:text-[#bbb]"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Recent Tasks
        <span className="ml-auto opacity-50">{recent.length}</span>
      </button>
      {open && (
        <ul className="px-2 pb-2 space-y-0.5 max-h-52 overflow-y-auto">
          {recent.map((task) => (
            <li
              key={task.id}
              className={`group rounded-md px-2 py-1.5 text-[11px] hover:bg-[#1e1e1e] ${
                task.id === activeTaskId ? 'bg-[#252525] ring-1 ring-[#3a3a3a]' : ''
              }`}
            >
              <div className="flex items-start gap-1.5 min-w-0">
                <span className={`mt-1 shrink-0 ${statusDot(task.status)}`}>●</span>
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left truncate text-[#ccc] hover:text-white"
                  title={task.prompt}
                  onClick={() => onReEdit(task.prompt)}
                >
                  {task.prompt.slice(0, 72)}
                  {task.prompt.length > 72 ? '…' : ''}
                </button>
                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-[#333] text-[#aaa] hover:text-white"
                    title="Re-edit prompt"
                    onClick={() => onReEdit(task.prompt)}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-[#333] text-emerald-400 hover:text-emerald-300"
                    title="Continue task"
                    onClick={() => onContinue(task.prompt)}
                  >
                    <Play className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-[#333] text-[#aaa] hover:text-red-400"
                    title="Remove from list"
                    onClick={() => removeTask(task.id)}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="text-[9px] opacity-40 ml-3 mt-0.5">
                {task.cards.length} step{task.cards.length !== 1 ? 's' : ''}
                {task.status === 'running' ? ' · running' : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
