import React from 'react';
import { FolderOpen, Play, X, ListTodo } from 'lucide-react';

interface AgentTaskCardProps {
  title: string;
  projectPath: string;
  actions: string[];
  status?: 'ready' | 'running' | 'done';
  onRun?: () => void;
  onCancel?: () => void;
}

export function AgentTaskCard({
  title,
  projectPath,
  actions,
  status = 'ready',
  onRun,
  onCancel,
}: AgentTaskCardProps) {
  return (
    <div className="agent-task-card">
      <div className="agent-task-card-accent" />
      <div className="agent-task-card-body">
        <div className="agent-task-card-header">
          <ListTodo className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="agent-task-card-title">{title}</span>
          <span className={`agent-task-card-status agent-task-card-status--${status}`}>
            {status === 'running' ? 'Executing…' : status === 'done' ? 'Complete' : 'Ready'}
          </span>
        </div>
        <div className="agent-task-card-path">
          <FolderOpen className="w-3.5 h-3.5 opacity-50" />
          <span>{projectPath}</span>
        </div>
        <ul className="agent-task-card-actions">
          {actions.map((a, i) => (
            <li key={i}>
              <span className="agent-task-card-step-num">{i + 1}</span>
              {a}
            </li>
          ))}
        </ul>
        {status === 'ready' && onRun && (
          <div className="agent-task-card-buttons">
            <button type="button" className="agent-task-btn agent-task-btn--run" onClick={onRun}>
              <Play className="w-3.5 h-3.5" />
              Run
            </button>
            {onCancel && (
              <button type="button" className="agent-task-btn agent-task-btn--cancel" onClick={onCancel}>
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
