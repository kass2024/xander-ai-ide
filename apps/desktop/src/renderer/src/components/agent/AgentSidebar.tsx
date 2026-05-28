import React, { useState, useEffect } from 'react';
import { Search, Plus, Archive } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { AgentSessionList } from './AgentSessionList';
import { loadSessionsFromDb, persistSession } from '../../lib/agentPersistence';
import type { AgentSessionRecord } from '../../../../shared/types';
import { RecentTasksPanel } from './RecentTasksPanel';
import { useAgentUiStore } from '../../stores/agentUiStore';

interface AgentSidebarProps {
  projectPath?: string | null;
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewAgent: () => void;
  onReEditTask?: (prompt: string) => void;
  onContinueTask?: (prompt: string) => void;
}

export function AgentSidebar({
  projectPath,
  activeSessionId,
  onSelectSession,
  onNewAgent,
  onReEditTask,
  onContinueTask,
}: AgentSidebarProps) {
  const setInject = useAgentUiStore((s) => s.setInject);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const { sessions, archiveSession, deleteSession, setActiveSession } = useAgentStore();

  useEffect(() => {
    loadSessionsFromDb(true).catch(() => {});
  }, []);

  const active = sessions.filter((s) => !s.archived);
  const archived = sessions.filter((s) => s.archived);

  const syncSessionToDb = (sessionId: string) => {
    const s = sessions.find((x) => x.id === sessionId);
    if (!s) return;
    const record: AgentSessionRecord = {
      id: s.id,
      title: s.title,
      model: s.model,
      provider: 'auto',
      projectPath: s.projectPath,
      archived: !!s.archived,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
    persistSession(record).catch(() => {});
  };

  return (
    <aside className="agent-sidebar h-full flex flex-col bg-[#0f0f0f] border-r border-[#2a2a2a]">
      <div className="p-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2 mb-3 px-1 py-1.5 rounded-md bg-[#1a1a1a] border border-[#2a2a2a]">
          <Search className="w-3.5 h-3.5 opacity-50 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents"
            className="flex-1 bg-transparent outline-none text-[12px] text-[#ccc] placeholder:opacity-40"
          />
        </div>
        <button
          type="button"
          onClick={onNewAgent}
          className="w-full py-2 px-3 bg-[#2d2d2d] hover:bg-[#383838] text-white rounded-lg text-[12px] flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Agent
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <AgentSessionList
          sessions={active}
          activeSessionId={activeSessionId}
          query={query}
          onSelect={(id) => {
            setActiveSession(id);
            onSelectSession(id);
          }}
          onArchive={(id) => {
            archiveSession(id);
            syncSessionToDb(id);
          }}
          onDelete={(id) => {
            deleteSession(id);
          }}
        />

        {archived.length > 0 && (
          <div className="mt-4 border-t border-[#2a2a2a] pt-2">
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 text-[11px] opacity-50 hover:opacity-80 w-full"
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive className="w-3.5 h-3.5" />
              Archived ({archived.length})
            </button>
            {showArchived && (
              <AgentSessionList
                sessions={archived}
                activeSessionId={activeSessionId}
                query={query}
                onSelect={(id) => {
                  setActiveSession(id);
                  onSelectSession(id);
                }}
                onArchive={() => {}}
                onDelete={deleteSession}
              />
            )}
          </div>
        )}
      </div>

      <RecentTasksPanel
        projectPath={projectPath}
        onReEdit={onReEditTask ?? ((p) => setInject(p, false))}
        onContinue={onContinueTask ?? ((p) => setInject(p, true))}
      />

      {projectPath && (
        <div className="p-3 border-t border-[#2a2a2a] text-[10px] opacity-40 truncate font-mono" title={projectPath}>
          {projectPath.split(/[/\\]/).pop()}
        </div>
      )}
    </aside>
  );
}
