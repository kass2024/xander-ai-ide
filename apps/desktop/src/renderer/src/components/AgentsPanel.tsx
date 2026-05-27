import React, { useState } from 'react';
import { Bot, Plus, Search, Archive, Trash2, MessageSquare, Sparkles, Code, X } from 'lucide-react';
import { useAgentStore } from '../stores/agentStore';
import { useTaskStore } from '../stores/taskStore';

interface AgentsPanelProps {
  projectPath?: string | null;
  onOpenAgent: (sessionId: string) => void;
  onNewAgentWindow?: () => void;
}

type AgentMode = 'agent' | 'chat' | 'composer';

export function AgentsPanel({ projectPath, onOpenAgent, onNewAgentWindow }: AgentsPanelProps) {
  const [query, setQuery] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMode, setNewMode] = useState<AgentMode>('agent');
  const { sessions, activeSessionId, createSession, setActiveSession, archiveSession, deleteSession } =
    useAgentStore();
  const recentTasks = useTaskStore((s) => s.getRecentTasks(projectPath || undefined, 6));

  const active = sessions.filter((s) => !s.archived);
  const archived = sessions.filter((s) => s.archived);
  const filtered = active.filter(
    (s) => !query || s.title.toLowerCase().includes(query.toLowerCase()),
  );

  const handleNew = (mode: AgentMode = 'agent', title?: string) => {
    const id = createSession(title || 'New Agent', mode, projectPath || undefined);
    onOpenAgent(id);
    setShowNewDialog(false);
    setNewTitle('');
    setNewMode('agent');
  };

  const groupByDate = (list: typeof active) => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const groups: { label: string; items: typeof active }[] = [];
    const todayItems = list.filter((s) => new Date(s.updatedAt).toDateString() === today);
    const yesterdayItems = list.filter((s) => new Date(s.updatedAt).toDateString() === yesterday);
    const older = list.filter(
      (s) =>
        new Date(s.updatedAt).toDateString() !== today &&
        new Date(s.updatedAt).toDateString() !== yesterday,
    );
    if (todayItems.length) groups.push({ label: 'Today', items: todayItems });
    if (yesterdayItems.length) groups.push({ label: 'Yesterday', items: yesterdayItems });
    if (older.length) groups.push({ label: 'Earlier', items: older });
    return groups;
  };

  const modeIcon = (mode: string) => {
    if (mode === 'agent') return <Bot className="w-3 h-3" />;
    if (mode === 'composer') return <Code className="w-3 h-3" />;
    return <Sparkles className="w-3 h-3" />;
  };

  return (
    <div className="h-full flex flex-col text-[13px] relative">
      <div className="p-3 border-b border-[var(--vscode-sideBar-border)]">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-3.5 h-3.5 opacity-60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Agents..."
            className="flex-1 bg-transparent outline-none text-[12px]"
          />
        </div>
        <button
          onClick={() => setShowNewDialog(true)}
          className="w-full py-2 px-3 bg-[var(--vscode-button-background)] text-white rounded text-[12px] hover:opacity-90 flex items-center justify-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> New Agent
        </button>
        <div className="text-[10px] opacity-50 text-center mt-1.5">Ctrl+Shift+L</div>
        {onNewAgentWindow && (
          <button
            onClick={onNewAgentWindow}
            className="w-full mt-2 py-1.5 text-[11px] text-[var(--vscode-textLink-foreground)] hover:underline"
          >
            Open in New Window
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 opacity-50 text-[12px]">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No agents yet.
            <button
              onClick={() => handleNew('agent')}
              className="block mx-auto mt-3 text-[var(--vscode-textLink-foreground)] hover:underline"
            >
              Create your first agent
            </button>
          </div>
        ) : (
          groupByDate(filtered).map((group) => (
            <div key={group.label} className="mb-4">
              <div className="text-[11px] uppercase opacity-50 px-2 mb-1">{group.label}</div>
              {group.items.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-start gap-2 px-2 py-2 rounded cursor-pointer mb-0.5 ${
                    activeSessionId === session.id
                      ? 'bg-[var(--vscode-list-activeSelectionBackground)]'
                      : 'hover:bg-[var(--vscode-list-hoverBackground)]'
                  }`}
                  onClick={() => {
                    setActiveSession(session.id);
                    onOpenAgent(session.id);
                  }}
                >
                  <div className="mt-0.5 shrink-0 opacity-70">{modeIcon(session.mode)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{session.title}</div>
                    <div className="text-[10px] opacity-50 capitalize">
                      {session.mode} · {session.messages.length} msg
                    </div>
                  </div>
                  <div className="hidden group-hover:flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); archiveSession(session.id); }}
                      className="p-1 hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded"
                      title="Archive"
                    >
                      <Archive className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                      className="p-1 hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}

        {recentTasks.length > 0 && (
          <div className="mt-4 border-t border-[var(--vscode-sideBar-border)] pt-3">
            <div className="text-[11px] uppercase opacity-50 px-2 mb-1">Recent tasks</div>
            {recentTasks.map((task) => (
              <div key={task.id} className="px-2 py-1.5 text-[11px] opacity-80">
                <span
                  className={
                    task.status === 'completed'
                      ? 'text-emerald-500'
                      : task.status === 'failed'
                        ? 'text-red-400'
                        : 'text-yellow-400'
                  }
                >
                  ●
                </span>{' '}
                <span className="truncate block">{task.prompt.slice(0, 48)}</span>
                <span className="text-[10px] opacity-40">{task.cards.length} steps</span>
              </div>
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] uppercase opacity-50 px-2 mb-1">Archived</div>
            {archived.map((session) => (
              <div key={session.id} className="px-2 py-1.5 text-[12px] opacity-60 truncate">
                {session.title}
              </div>
            ))}
          </div>
        )}
      </div>

      {showNewDialog && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border)] rounded-lg shadow-xl w-full max-w-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[13px]">New Agent</h3>
              <button onClick={() => setShowNewDialog(false)} className="p-1 hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Agent name (optional)"
              className="w-full px-3 py-2 mb-3 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded text-[12px] outline-none"
              autoFocus
            />
            <div className="text-[11px] opacity-60 mb-2">Mode</div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {([
                { id: 'agent' as const, label: 'Agent', desc: 'Autonomous coding', icon: Bot },
                { id: 'composer' as const, label: 'Composer', desc: 'Multi-file edits', icon: Code },
                { id: 'chat' as const, label: 'Chat', desc: 'Q&A only', icon: Sparkles },
              ]).map(({ id, label, desc, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setNewMode(id)}
                  className={`p-2 rounded border text-left text-[11px] ${
                    newMode === id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-[var(--vscode-input-border)] hover:bg-[var(--vscode-list-hoverBackground)]'
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1" />
                  <div className="font-medium">{label}</div>
                  <div className="opacity-50 text-[10px]">{desc}</div>
                </button>
              ))}
            </div>
            {!projectPath && (
              <div className="text-[11px] text-yellow-500 mb-3">Open a project folder for full agent capabilities.</div>
            )}
            <button
              onClick={() => handleNew(newMode, newTitle.trim() || undefined)}
              className="w-full py-2 bg-[var(--vscode-button-background)] text-white rounded text-[12px] hover:opacity-90"
            >
              Create Agent
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
