import React, { useState, useEffect } from 'react';
import { Brain, Search, RefreshCw, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { semanticSearch, indexProjectForSearch, checkSemanticSearchAvailable } from '../lib/codebaseSearch';
import { useCodebaseIndexStore } from '../stores/codebaseIndexStore';

interface SemanticSearchPanelProps {
  projectPath: string | null;
  onOpenFile: (path: string) => void;
}

export function SemanticSearchPanel({ projectPath, onOpenFile }: SemanticSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ path: string; content: string; score?: number }>>([]);
  const {
    status, progress, progressMessage, chunksIndexed, lastIndexedAt,
    qdrantAvailable, error, setStatus,
  } = useCodebaseIndexStore();

  useEffect(() => {
    if (projectPath) {
      checkSemanticSearchAvailable().then((ok) => {
        if (ok && status === 'idle') {
          indexProjectForSearch(projectPath).catch(() => { /* handled in store */ });
        }
      });
    }
  }, [projectPath]);

  const handleReindex = async () => {
    if (!projectPath) return;
    setStatus('indexing', 'Starting re-index...');
    await indexProjectForSearch(projectPath, { force: true });
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const hits = await semanticSearch(query.trim(), 15);
      setResults(hits);
    } finally {
      setSearching(false);
    }
  };

  const openHit = (hitPath: string) => {
    if (!projectPath) return;
    const sep = projectPath.includes('\\') ? '\\' : '/';
    const full = /^[A-Za-z]:[\\/]/.test(hitPath) || hitPath.startsWith('/')
      ? hitPath
      : `${projectPath}${projectPath.endsWith(sep) ? '' : sep}${hitPath.replace(/\//g, sep)}`;
    onOpenFile(full);
  };

  const statusIcon = () => {
    if (status === 'indexing') return <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />;
    if (status === 'ready') return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
    if (status === 'unavailable' || status === 'error') return <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />;
    return <Brain className="w-3.5 h-3.5 opacity-60" />;
  };

  return (
    <div className="h-full flex flex-col text-[13px]">
      <div className="p-3 border-b border-[var(--vscode-sideBar-border)]">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="font-semibold text-[12px]">Semantic Codebase Search</span>
        </div>

        <div className="rounded-md border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] p-2 mb-2">
          <div className="flex items-center gap-2 text-[11px]">
            {statusIcon()}
            <span className="flex-1 opacity-80">
              {status === 'indexing' ? progressMessage : status === 'ready'
                ? `${chunksIndexed} chunks indexed`
                : status === 'unavailable'
                  ? 'Qdrant not running — start with: docker run -p 6333:6333 qdrant/qdrant'
                  : error || progressMessage || (qdrantAvailable ? 'Ready to index' : 'Checking backend...')}
            </span>
            <button
              onClick={handleReindex}
              disabled={!projectPath || status === 'indexing'}
              className="p-1 hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded disabled:opacity-40"
              title="Re-index project"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${status === 'indexing' ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {status === 'indexing' && (
            <div className="mt-2 h-1 bg-[var(--vscode-progressBar-background)] rounded overflow-hidden">
              <div
                className="h-full bg-[var(--vscode-progressBar-background)] bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {lastIndexedAt && status === 'ready' && (
            <div className="text-[10px] opacity-50 mt-1">
              Last indexed: {new Date(lastIndexedAt).toLocaleString()}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border border-[var(--vscode-input-border)] rounded px-2 py-1.5 bg-[var(--vscode-input-background)]">
          <Search className="w-3.5 h-3.5 opacity-60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Ask about your codebase..."
            className="flex-1 bg-transparent outline-none text-[12px]"
            disabled={!projectPath}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={!projectPath || !query.trim() || searching || status !== 'ready'}
          className="w-full mt-2 py-1.5 bg-[var(--vscode-button-background)] text-white rounded text-[12px] disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
          {searching ? 'Searching...' : 'Semantic Search'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {!projectPath ? (
          <div className="text-center py-8 opacity-50 text-[12px]">Open a project folder to enable semantic search</div>
        ) : results.length === 0 ? (
          <div className="text-center py-8 opacity-50 text-[12px]">
            {status === 'ready'
              ? 'Search by meaning — e.g. "authentication middleware" or "database connection"'
              : 'Indexing project for semantic search...'}
          </div>
        ) : (
          results.map((hit, i) => (
            <button
              key={`${hit.path}-${i}`}
              onClick={() => openHit(hit.path)}
              className="w-full text-left p-2 mb-1 rounded hover:bg-[var(--vscode-list-hoverBackground)] border border-transparent hover:border-[var(--vscode-sideBar-border)]"
            >
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                <span className="font-medium truncate text-[12px]">{hit.path}</span>
                {hit.score != null && (
                  <span className="text-[10px] opacity-50 ml-auto">{Math.round(hit.score * 100)}%</span>
                )}
              </div>
              <div className="text-[11px] opacity-70 line-clamp-3 font-mono pl-5">{hit.content}</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
