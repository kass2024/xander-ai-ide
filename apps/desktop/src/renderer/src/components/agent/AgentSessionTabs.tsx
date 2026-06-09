import React, { useMemo } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAgentStore } from '../../stores/agentStore';
import { useAgentRunStore } from '../../stores/agentRunStore';

interface AgentSessionTabsProps {
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNewAgent: () => void;
  onClose?: (id: string) => void;
}

export function AgentSessionTabs({
  activeSessionId,
  onSelect,
  onNewAgent,
  onClose,
}: AgentSessionTabsProps) {
  const sessions = useAgentStore(
    useShallow((s) => s.sessions.filter((x) => !x.archived).slice(0, 8)),
  );
  const runs = useAgentRunStore((s) => s.runs);
  const runningIds = useMemo(
    () => Object.keys(runs).filter((id) => runs[id]?.isRunning),
    [runs],
  );

  if (sessions.length === 0) return null;

  return (
    <div className="agent-session-tabs">
      <div className="agent-session-tabs-scroll">
        {sessions.map((session) => {
          const active = session.id === activeSessionId;
          const running = runningIds.includes(session.id);
          return (
            <button
              key={session.id}
              type="button"
              className={`agent-session-tab ${active ? 'agent-session-tab--active' : ''}`}
              onClick={() => onSelect(session.id)}
              title={session.title}
            >
              {running && <Loader2 className="w-3 h-3 animate-spin text-violet-400 shrink-0" />}
              <span className="truncate max-w-[120px]">{session.title}</span>
              {onClose && sessions.length > 1 && (
                <span
                  role="button"
                  tabIndex={0}
                  className="agent-session-tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(session.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      onClose(session.id);
                    }
                  }}
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button type="button" className="agent-session-tab-new" onClick={onNewAgent} title="New Agent">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
