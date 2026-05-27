import React, { useState } from 'react';
import { Search, Replace, Brain } from 'lucide-react';
import { SemanticSearchPanel } from './SemanticSearchPanel';

interface SearchPanelProps {
  projectPath: string | null;
  onOpenFile: (path: string) => void;
}

type SearchTab = 'text' | 'semantic';

export function SearchPanel({ projectPath, onOpenFile }: SearchPanelProps) {
  const [tab, setTab] = useState<SearchTab>('semantic');
  const [query, setQuery] = useState('');
  const [replaceWith, setReplaceWith] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [results, setResults] = useState<Array<{ name: string; path: string; matches: number }>>([]);
  const [searching, setSearching] = useState(false);

  const runSearch = async () => {
    if (!projectPath || !query.trim()) return;
    setSearching(true);
    try {
      const r = await window.electronAPI.searchInProject(projectPath, query.trim());
      if (r.success && r.results) setResults(r.results);
      else setResults([]);
    } finally {
      setSearching(false);
    }
  };

  if (tab === 'semantic') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex border-b border-[var(--vscode-sideBar-border)]">
          <button
            onClick={() => setTab('semantic')}
            className="flex-1 py-2 text-[11px] font-medium border-b-2 border-purple-500 text-purple-400 flex items-center justify-center gap-1"
          >
            <Brain className="w-3.5 h-3.5" /> Semantic
          </button>
          <button
            onClick={() => setTab('text')}
            className="flex-1 py-2 text-[11px] opacity-60 hover:opacity-100 flex items-center justify-center gap-1"
          >
            <Search className="w-3.5 h-3.5" /> Text
          </button>
        </div>
        <SemanticSearchPanel projectPath={projectPath} onOpenFile={onOpenFile} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-[var(--vscode-sideBar-border)]">
        <button
          onClick={() => setTab('semantic')}
          className="flex-1 py-2 text-[11px] opacity-60 hover:opacity-100 flex items-center justify-center gap-1"
        >
          <Brain className="w-3.5 h-3.5" /> Semantic
        </button>
        <button
          onClick={() => setTab('text')}
          className="flex-1 py-2 text-[11px] font-medium border-b-2 border-blue-500 text-blue-400 flex items-center justify-center gap-1"
        >
          <Search className="w-3.5 h-3.5" /> Text
        </button>
      </div>
      <div className="flex-1 flex flex-col p-3 text-[13px] overflow-hidden">
        <div className="flex items-center gap-2 mb-2 border border-[var(--vscode-input-border)] rounded px-2 py-1.5 bg-[var(--vscode-input-background)]">
          <Search className="w-3.5 h-3.5 opacity-60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Search in files"
            className="flex-1 bg-transparent outline-none text-[12px]"
          />
        </div>
        <div className="flex gap-2 mb-2">
          <button
            onClick={runSearch}
            disabled={!projectPath || searching}
            className="flex-1 py-1.5 bg-[var(--vscode-button-background)] text-white rounded text-[12px] disabled:opacity-40"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
          <button
            onClick={() => setShowReplace((v) => !v)}
            className="px-2 py-1.5 border border-[var(--vscode-input-border)] rounded text-[12px]"
          >
            <Replace className="w-3.5 h-3.5" />
          </button>
        </div>
        {showReplace && (
          <input
            value={replaceWith}
            onChange={(e) => setReplaceWith(e.target.value)}
            placeholder="Replace with..."
            className="w-full mb-2 px-2 py-1.5 border border-[var(--vscode-input-border)] rounded bg-[var(--vscode-input-background)] text-[12px]"
          />
        )}
        <div className="flex-1 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.path}
              onClick={() => onOpenFile(r.path)}
              className="w-full text-left px-2 py-1.5 hover:bg-[var(--vscode-list-hoverBackground)] rounded text-[12px]"
            >
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-[10px] opacity-50 truncate">{r.path} · {r.matches} matches</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
