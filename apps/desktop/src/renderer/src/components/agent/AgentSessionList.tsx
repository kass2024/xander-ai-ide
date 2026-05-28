import React from 'react';
import { Bot, Archive, Trash2, Clock, Loader2 } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { useAgentStateStore } from '../../stores/agentStateStore';
import { useActionStore } from '../../stores/actionStore';

interface AgentSessionListProps {
  sessions: ReturnType<typeof useAgentStore.getState>['sessions'];
  activeSessionId: string | null;
  query?: string;
  onSelect: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

function statusBadge(sessionId: string | null, activeSessionId: string | null): string | null {
  const phase = useAgentStateStore.getState().phase;
  const pending = useActionStore.getState().actions.some((a) => a.status === 'pending');
  if (sessionId !== activeSessionId) return null;
  if (pending) return 'Awaiting approval';
  if (phase === 'awaiting_confirmation') return 'Awaiting approval to run command';
  if (phase === 'running_tools' || phase === 'planning') return 'Running…';
  return null;
}

export function AgentSessionList({
  sessions,
  activeSessionId,
  query = '',
  onSelect,
  onArchive,
  onDelete,
}: AgentSessionListProps) {
  const filtered = sessions.filter(
    (s) => !query || s.title.toLowerCase().includes(query.toLowerCase()),
  );

  const groupByDate = () => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const groups: { label: string; items: typeof filtered }[] = [];
    const todayItems = filtered.filter((s) => new Date(s.updatedAt).toDateString() === today);
    const yesterdayItems = filtered.filter((s) => new Date(s.updatedAt).toDateString() === yesterday);
    const older = filtered.filter(
      (s) =>
        new Date(s.updatedAt).toDateString() !== today &&
        new Date(s.updatedAt).toDateString() !== yesterday,
    );
    if (todayItems.length) groups.push({ label: 'Today', items: todayItems });
    if (yesterdayItems.length) groups.push({ label: 'Yesterday', items: yesterdayItems });
    if (older.length) groups.push({ label: 'Earlier', items: older });
    return groups;
  };

  if (filtered.length === 0) {
    return (
      <div className="text-center py-8 opacity-50 text-[12px] px-4">
        <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
        No agents match your search.
      </div>
    );
  }

  return (
    <>
      {groupByDate().map((group) => (
        <div key={group.label} className="mb-3">
          <div className="text-[10px] uppercase tracking-wide opacity-45 px-3 mb-1">{group.label}</div>
          {group.items.map((session) => {
            const badge = statusBadge(session.id, activeSessionId);
            return (
              <div
                key={session.id}
                className={`group flex items-start gap-2 mx-2 px-2 py-2 rounded cursor-pointer mb-0.5 transition-colors ${
                  activeSessionId === session.id
                    ? 'bg-[#2a2a2a] text-white'
                    : 'hover:bg-[#1e1e1e] text-[#bbb]'
                }`}
                onClick={() => onSelect(session.id)}
              >
                <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-[12px] font-medium">{session.title}</div>
                  {badge && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-400 mt-0.5">
                      {badge.includes('Running') ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      {badge}
                    </div>
                  )}
                  <div className="text-[10px] opacity-40 mt-0.5">
                    {session.messages.length} message{session.messages.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="hidden group-hover:flex gap-0.5 shrink-0">
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-[#333]"
                    title="Archive"
                    onClick={(e) => { e.stopPropagation(); onArchive(session.id); }}
                  >
                    <Archive className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-[#333]"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
