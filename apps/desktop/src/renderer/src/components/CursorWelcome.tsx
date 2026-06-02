import React from 'react';
import { Bot, Terminal, Search, Sparkles } from 'lucide-react';

interface CursorWelcomeProps {
  onOpenFolder: () => void;
}

const SHORTCUTS = [
  { keys: 'Ctrl + Shift + L', label: 'New Agent', icon: Bot },
  { keys: 'Ctrl + J', label: 'Toggle Terminal', icon: Terminal },
  { keys: 'Ctrl + P', label: 'Go to File', icon: Search },
  { keys: 'Ctrl + Shift + P', label: 'Command Palette', icon: Sparkles },
];

export function CursorWelcome({ onOpenFolder }: CursorWelcomeProps) {
  return (
    <div className="h-full flex items-center justify-center bg-[var(--vscode-editor-background)]">
      <div className="text-center max-w-lg px-8">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-semibold mb-2 text-[var(--vscode-foreground)]">Xander AI IDE</h1>
        <p className="text-sm text-[var(--vscode-descriptionForeground)] mb-8">
          Agent on the left · Editor in the center · Files on the right
        </p>
        <div className="grid grid-cols-2 gap-3 mb-8 text-left">
          {SHORTCUTS.map(({ keys, label, icon: Icon }) => (
            <div
              key={keys}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--vscode-input-background)] border border-[var(--vscode-border)]"
            >
              <Icon className="w-4 h-4 text-[var(--vscode-descriptionForeground)] shrink-0" />
              <div className="min-w-0">
                <div className="text-[12px] text-[var(--vscode-foreground)]">{label}</div>
                <div className="text-[10px] text-[var(--vscode-descriptionForeground)] font-mono">{keys}</div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenFolder}
          className="px-5 py-2.5 bg-[var(--vscode-button-background)] text-white rounded-md text-sm hover:bg-[var(--vscode-button-hoverBackground)]"
        >
          Open Folder
        </button>
      </div>
    </div>
  );
}
