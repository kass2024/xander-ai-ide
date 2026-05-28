import React, { useMemo } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import * as Diff from 'diff';

interface DiffViewerProps {
  filePath: string;
  oldText: string;
  newText: string;
  explanation?: string;
  expanded?: boolean;
  onToggle?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  status?: 'pending' | 'applied' | 'reverted';
}

export function DiffViewer({
  filePath,
  oldText,
  newText,
  explanation,
  expanded = true,
  onToggle,
  onAccept,
  onReject,
  status = 'applied',
}: DiffViewerProps) {
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  const stats = useMemo(() => {
    const changes = Diff.diffLines(oldText, newText);
    let added = 0;
    let removed = 0;
    for (const part of changes) {
      const lines = part.value.split('\n').filter((l, i, arr) => i < arr.length - 1 || l).length;
      if (part.added) added += lines;
      if (part.removed) removed += lines;
    }
    return { added, removed };
  }, [oldText, newText]);

  return (
    <div className={`agent-diff-block ${status === 'reverted' ? 'opacity-50' : ''}`}>
      <div className="agent-diff-header flex items-center gap-2">
        <button type="button" className="flex items-center gap-2 flex-1 min-w-0" onClick={onToggle}>
          <span className="agent-diff-filename truncate">{fileName}</span>
          <span className="agent-diff-stats shrink-0">
            <span className="text-emerald-400">+{stats.added}</span>
            <span className="text-red-400 ml-1.5">-{stats.removed}</span>
          </span>
        </button>
        {(onAccept || onReject) && status !== 'reverted' && (
          <div className="flex gap-1 shrink-0">
            {onReject && (
              <button type="button" className="agent-approval-btn-skip text-[10px] px-2 py-1" onClick={onReject}>
                Reject
              </button>
            )}
            {onAccept && (
              <button type="button" className="agent-approval-btn-run text-[10px] px-2 py-1" onClick={onAccept}>
                Accept
              </button>
            )}
          </div>
        )}
      </div>
      {explanation && (
        <p className="text-[11px] opacity-60 px-3 py-1 border-b border-[#2a2a2a]">{explanation}</p>
      )}
      {expanded && (
        <div className="agent-diff-monaco" style={{ height: Math.min(320, Math.max(120, stats.added + stats.removed) * 18) }}>
          <DiffEditor
            original={oldText}
            modified={newText}
            language="typescript"
            theme="vs-dark"
            options={{
              readOnly: true,
              renderSideBySide: false,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 12,
              lineNumbers: 'on',
            }}
          />
        </div>
      )}
    </div>
  );
}
