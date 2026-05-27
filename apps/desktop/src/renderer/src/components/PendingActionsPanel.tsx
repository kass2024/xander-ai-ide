import React from 'react';
import { Check, X, Terminal, FilePlus, FilePen, Trash2, AlertTriangle } from 'lucide-react';
import { useActionStore, PendingAction } from '../stores/actionStore';
import { applyAction } from '../lib/actionEngine';
import { computeLineDiff } from '../lib/composerUtils';

interface PendingActionsPanelProps {
  workspacePath: string | null;
  onFileChanged?: (path: string) => void;
  onRunTerminal?: (command: string) => void;
  onRefreshGit?: () => void;
}

function actionIcon(type: PendingAction['type']) {
  if (type === 'create_file') return <FilePlus className="w-3.5 h-3.5 text-green-400" />;
  if (type === 'delete_file') return <Trash2 className="w-3.5 h-3.5 text-red-400" />;
  if (type === 'run_terminal_command') return <Terminal className="w-3.5 h-3.5 text-yellow-400" />;
  return <FilePen className="w-3.5 h-3.5 text-blue-400" />;
}

export function PendingActionsPanel({
  workspacePath,
  onFileChanged,
  onRunTerminal,
  onRefreshGit,
}: PendingActionsPanelProps) {
  const { actions, approve, reject, approveAll, rejectAll, markApplied } = useActionStore();
  const pending = actions.filter((a) => a.status === 'pending');

  if (pending.length === 0) return null;

  const handleApply = async (action: PendingAction) => {
    if (!workspacePath) return;
    approve(action.id);
    if (action.toolCall) {
      markApplied(action.id);
      return;
    }
    const result = await applyAction(action, workspacePath, {
      onFileChanged,
      onRunTerminal,
      onRefreshGit,
    });
    if (result.success) markApplied(action.id);
  };

  return (
    <div className="border-t border-[var(--vscode-ai-border)] bg-[var(--vscode-editor-background)] max-h-64 overflow-y-auto">
      <div className="px-3 py-2 flex items-center justify-between border-b border-[var(--vscode-ai-border)]">
        <span className="text-[11px] font-semibold">Pending AI Actions ({pending.length})</span>
        <div className="flex gap-1">
          <button
            onClick={() => pending.forEach((a) => handleApply(a))}
            className="px-2 py-0.5 text-[10px] bg-green-600 text-white rounded hover:opacity-90"
          >
            Apply All
          </button>
          <button
            onClick={rejectAll}
            className="px-2 py-0.5 text-[10px] border border-[var(--vscode-border)] rounded hover:bg-[var(--vscode-list-hoverBackground)]"
          >
            Reject All
          </button>
        </div>
      </div>
      {pending.map((action) => {
        const diff = action.originalContent != null && action.content != null
          ? computeLineDiff(action.originalContent, action.content)
          : null;
        return (
          <div key={action.id} className="px-3 py-2 border-b border-[var(--vscode-ai-border)] text-[11px]">
            <div className="flex items-center gap-2 mb-1">
              {actionIcon(action.type)}
              <span className="font-medium flex-1">{action.label}</span>
              {action.dangerous && (
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" title="Dangerous command" />
              )}
              <button onClick={() => handleApply(action)} className="p-1 hover:bg-green-600/20 rounded" title="Apply">
                <Check className="w-3.5 h-3.5 text-green-400" />
              </button>
              <button onClick={() => reject(action.id)} className="p-1 hover:bg-red-600/20 rounded" title="Reject">
                <X className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
            {action.content && action.type !== 'run_terminal_command' && (
              <pre className="mt-1 p-2 bg-[var(--vscode-ai-codeBackground)] rounded text-[10px] font-mono max-h-24 overflow-auto whitespace-pre-wrap">
                {action.content.slice(0, 800)}{action.content.length > 800 ? '...' : ''}
              </pre>
            )}
            {action.command && (
              <code className="block mt-1 p-1 bg-[#2d2d2d] rounded font-mono text-[10px]">{action.command}</code>
            )}
            {diff && (diff.added > 0 || diff.removed > 0) && (
              <div className="text-[10px] opacity-60 mt-1">+{diff.added} / -{diff.removed} lines</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
