import React, { useState } from 'react';
import { Check, X, FileText, ChevronDown, ChevronRight, CheckCheck } from 'lucide-react';
import { ComposerChange, computeLineDiff } from '../lib/composerUtils';

interface ComposerDiffPanelProps {
  changes: ComposerChange[];
  onAccept: (path: string) => void;
  onReject: (path: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onClose: () => void;
}

export function ComposerDiffPanel({
  changes,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  onClose,
}: ComposerDiffPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(changes.map((c) => c.path)));

  const pending = changes.filter((c) => c.status === 'pending');
  const accepted = changes.filter((c) => c.status === 'accepted').length;

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[var(--vscode-editor-background)] border-l border-[var(--vscode-panel-border)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-titleBar-background)]">
        <div>
          <h3 className="text-[13px] font-semibold">Xander Composer — Review Changes</h3>
          <p className="text-[11px] opacity-60">
            {pending.length} pending · {accepted} accepted · {changes.length} files
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onAcceptAll}
            disabled={pending.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] bg-green-700 text-white rounded disabled:opacity-40"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Accept All
          </button>
          <button
            onClick={onRejectAll}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] border border-[var(--vscode-border)] rounded"
          >
            <X className="w-3.5 h-3.5" /> Reject All
          </button>
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] opacity-70 hover:opacity-100">
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {changes.map((change) => {
          const diff = computeLineDiff(change.originalContent, change.newContent);
          const isOpen = expanded.has(change.path);
          const statusColor =
            change.status === 'accepted'
              ? 'border-green-600/50 bg-green-900/10'
              : change.status === 'rejected'
              ? 'border-red-600/30 opacity-50'
              : 'border-[var(--vscode-border)]';

          return (
            <div key={change.path} className={`border rounded-lg overflow-hidden ${statusColor}`}>
              <div className="flex items-center gap-2 px-3 py-2 bg-[var(--vscode-sideBar-background)]">
                <button onClick={() => toggle(change.path)} className="p-0.5">
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                <FileText className="w-3.5 h-3.5 opacity-60" />
                <span className="text-[12px] font-medium flex-1 truncate">{change.path}</span>
                <span className="text-[10px] text-green-400">+{diff.added}</span>
                <span className="text-[10px] text-red-400 ml-1">-{diff.removed}</span>
                {change.status === 'pending' && (
                  <>
                    <button
                      onClick={() => onAccept(change.path)}
                      className="p-1 hover:bg-green-800/40 rounded"
                      title="Accept"
                    >
                      <Check className="w-4 h-4 text-green-400" />
                    </button>
                    <button
                      onClick={() => onReject(change.path)}
                      className="p-1 hover:bg-red-800/40 rounded"
                      title="Reject"
                    >
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  </>
                )}
                {change.status !== 'pending' && (
                  <span className="text-[10px] uppercase opacity-60">{change.status}</span>
                )}
              </div>

              {isOpen && (
                <div className="max-h-48 overflow-auto font-mono text-[11px] p-2 bg-[#1e1e1e]">
                  {diff.hunks.map((h, i) => (
                    <div
                      key={i}
                      className={
                        h.type === 'add'
                          ? 'bg-green-900/30 text-green-200'
                          : h.type === 'remove'
                          ? 'bg-red-900/30 text-red-200 line-through'
                          : 'opacity-50'
                      }
                    >
                      <span className="inline-block w-8 text-right mr-2 opacity-40 select-none">
                        {h.newNum ?? h.oldNum ?? ''}
                      </span>
                      {h.type === 'add' ? '+ ' : h.type === 'remove' ? '- ' : '  '}
                      {h.line || ' '}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
