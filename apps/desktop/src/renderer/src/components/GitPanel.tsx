import React, { useEffect, useState } from 'react';
import { GitBranch, GitCommit, Plus, RefreshCw, Upload, Download, Check } from 'lucide-react';

interface GitPanelProps {
  projectPath: string | null;
}

export function GitPanel({ projectPath }: GitPanelProps) {
  const [branch, setBranch] = useState('main');
  const [files, setFiles] = useState<Array<{ path: string; index: string; working_dir: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    if (!projectPath) return;
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.gitStatus(projectPath);
      if (result.success && result.status) {
        setBranch(result.status.current || 'main');
        setFiles(result.status.files || []);
      } else {
        setError(result.error || 'Not a git repository');
        setFiles([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [projectPath]);

  const stage = async (filePath: string) => {
    if (!projectPath) return;
    await window.electronAPI.gitAdd(projectPath, [filePath]);
    await refresh();
  };

  const commit = async () => {
    if (!projectPath || !message.trim()) return;
    const result = await window.electronAPI.gitCommit(projectPath, message);
    if (!result.success) setError(result.error || 'Commit failed');
    else { setMessage(''); await refresh(); }
  };

  const pull = async () => {
    if (!projectPath) return;
    const result = await window.electronAPI.gitPull(projectPath);
    setError(result.success ? '' : result.error || 'Pull failed');
    await refresh();
  };

  const push = async () => {
    if (!projectPath) return;
    const result = await window.electronAPI.gitPush(projectPath);
    setError(result.success ? '' : result.error || 'Push failed');
    await refresh();
  };

  if (!projectPath) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-[var(--vscode-descriptionForeground)] p-4 text-center">
        Open a folder to use Source Control
      </div>
    );
  }

  const initRepo = async () => {
    setLoading(true);
    setError('');
    const result = await window.electronAPI.gitInit(projectPath);
    if (!result.success) setError(result.error || 'git init failed');
    else await refresh();
    setLoading(false);
  };

  const isNotRepo = error.toLowerCase().includes('not a git') || error.toLowerCase().includes('not a valid');

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-[var(--vscode-sideBar-border)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Source Control</span>
          <button onClick={refresh} className="p-1 hover:bg-[var(--vscode-list-hoverBackground)] rounded">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm mb-2">
          <GitBranch className="w-4 h-4" />
          <span>{branch}</span>
        </div>
        <div className="flex gap-1">
          <button onClick={pull} className="flex-1 flex items-center justify-center gap-1 py-1 text-xs border border-[var(--vscode-border)] rounded hover:bg-[var(--vscode-list-hoverBackground)]">
            <Download className="w-3 h-3" /> Pull
          </button>
          <button onClick={push} className="flex-1 flex items-center justify-center gap-1 py-1 text-xs border border-[var(--vscode-border)] rounded hover:bg-[var(--vscode-list-hoverBackground)]">
            <Upload className="w-3 h-3" /> Push
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 text-xs text-red-400 border-b border-[var(--vscode-border)]">
          {error}
          {isNotRepo && (
            <button
              onClick={initRepo}
              className="block mt-2 w-full py-1.5 bg-[var(--vscode-button-background)] text-white rounded text-[11px]"
            >
              Initialize Repository
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto p-2">
        {files.length === 0 ? (
          <p className="text-xs text-[var(--vscode-descriptionForeground)] p-2">No changes detected</p>
        ) : files.map((f, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 px-2 hover:bg-[var(--vscode-list-hoverBackground)] rounded text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <GitCommit className="w-3.5 h-3.5 shrink-0 text-yellow-500" />
              <span className="truncate">{f.path}</span>
              <span className="text-[10px] opacity-60">{f.working_dir || f.index}</span>
            </div>
            <button onClick={() => stage(f.path)} className="p-1 hover:bg-[var(--vscode-list-hoverBackground)] rounded" title="Stage">
              <Plus className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-[var(--vscode-sideBar-border)]">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Commit message"
          className="w-full px-2 py-1.5 text-sm bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded mb-2"
        />
        <button
          onClick={commit}
          disabled={!message.trim()}
          className="w-full py-1.5 text-sm bg-[var(--vscode-button-background)] text-white rounded disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Check className="w-3.5 h-3.5" /> Commit
        </button>
      </div>
    </div>
  );
}
