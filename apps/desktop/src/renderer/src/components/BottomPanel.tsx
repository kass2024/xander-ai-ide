import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  Terminal, AlertTriangle, Info, Plus, Trash2, Minimize2, ChevronDown, SplitSquareHorizontal,
} from 'lucide-react';
import { TerminalView, TerminalViewHandle } from './TerminalView';
import { getElectronAPI } from '../lib/electron';

export type BottomPanelTab = 'terminal' | 'problems' | 'output' | 'debug' | 'ports';

export interface BottomPanelHandle {
  clearTerminal: () => void;
  newTerminal: () => void;
  splitTerminal: () => void;
  killTerminal: () => void;
  appendOutput: (line: string) => void;
  appendDebug: (line: string) => void;
  focusTerminal: () => void;
  runInTerminal: (command: string) => void;
  getActiveTerminalId: () => string | null;
}

interface TerminalTab {
  id: string;
  name: string;
  shell: string;
  cwd: string;
}

interface BottomPanelProps {
  isVisible: boolean;
  onToggle: () => void;
  height?: number;
  activeTab?: BottomPanelTab;
  onTabChange?: (tab: BottomPanelTab) => void;
  projectPath?: string | null;
}

export const BottomPanel = forwardRef<BottomPanelHandle, BottomPanelProps>(function BottomPanel({
  isVisible,
  onToggle,
  height = 220,
  activeTab: controlledTab,
  onTabChange,
  projectPath,
}, ref) {
  const [internalTab, setInternalTab] = useState<BottomPanelTab>('terminal');
  const [terminals, setTerminals] = useState<TerminalTab[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>(['[Xander] Ready']);
  const [debugOutput, setDebugOutput] = useState<string[]>(['[Debug] Ready']);
  const [splitView, setSplitView] = useState(false);
  const [secondaryTerminalId, setSecondaryTerminalId] = useState<string | null>(null);
  const termRefs = useRef<Map<string, TerminalViewHandle>>(new Map());
  const pendingCommandRef = useRef<string | null>(null);

  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = (tab: BottomPanelTab) => {
    onTabChange?.(tab);
    if (!controlledTab) setInternalTab(tab);
  };

  const spawnTerminal = useCallback(async () => {
    const api = getElectronAPI();
    if (!api) return null;
    if (!projectPath) {
      setOutput((o) => [...o, '[Terminal] Open a project folder first (File → Open Folder).']);
      return null;
    }
    const result = await api.terminalCreate(projectPath);
    if (!result.success || !result.id) {
      setOutput((o) => [...o, `[Terminal] Failed: ${result.error || 'unknown'}`]);
      return null;
    }
    const tab: TerminalTab = {
      id: result.id,
      name: result.name || 'Terminal',
      shell: result.shell || 'shell',
      cwd: (result as { cwd?: string }).cwd || projectPath,
    };
    setTerminals((prev) => [...prev, tab]);
    setActiveTerminalId(result.id);
    if (pendingCommandRef.current) {
      const cmd = pendingCommandRef.current;
      pendingCommandRef.current = null;
      setTimeout(() => {
        api.terminalWrite(result.id, cmd + '\r');
      }, 400);
    }
    return result.id;
  }, [projectPath]);

  useEffect(() => {
    if (isVisible && terminals.length === 0 && projectPath) {
      spawnTerminal();
    }
  }, [isVisible, terminals.length, spawnTerminal, projectPath]);

  useEffect(() => {
    if (!projectPath) return;
    setTerminals([]);
    setActiveTerminalId(null);
    setSecondaryTerminalId(null);
    setSplitView(false);
    if (isVisible) spawnTerminal();
  }, [projectPath]);

  useEffect(() => {
    const api = getElectronAPI();
    if (!api?.onDebugOutput) return;
    api.onDebugOutput((line) => {
      setDebugOutput((o) => [...o, line.trim()]);
    });
    return () => api.removeDebugListeners?.();
  }, []);

  useImperativeHandle(ref, () => ({
    clearTerminal: () => {
      if (activeTerminalId) termRefs.current.get(activeTerminalId)?.clear();
    },
    newTerminal: () => { spawnTerminal(); setActiveTab('terminal'); },
    splitTerminal: async () => {
      const id = await spawnTerminal();
      if (id) {
        setSplitView(true);
        setSecondaryTerminalId(id);
      }
    },
    killTerminal: () => {
      if (!activeTerminalId) return;
      getElectronAPI()?.terminalKill(activeTerminalId);
      setTerminals((prev) => prev.filter((t) => t.id !== activeTerminalId));
      setActiveTerminalId((prev) => {
        const remaining = terminals.filter((t) => t.id !== prev);
        return remaining[0]?.id ?? null;
      });
      if (secondaryTerminalId === activeTerminalId) {
        setSplitView(false);
        setSecondaryTerminalId(null);
      }
    },
    appendOutput: (line: string) => setOutput((o) => [...o, line]),
    appendDebug: (line: string) => setDebugOutput((o) => [...o, line]),
    focusTerminal: () => {
      setActiveTab('terminal');
      if (activeTerminalId) termRefs.current.get(activeTerminalId)?.focus();
    },
    runInTerminal: (command: string) => {
      setActiveTab('terminal');
      if (activeTerminalId) {
        getElectronAPI()?.terminalWrite(activeTerminalId, command + '\r');
      } else {
        pendingCommandRef.current = command;
        spawnTerminal();
      }
    },
    getActiveTerminalId: () => activeTerminalId,
  }), [activeTerminalId, secondaryTerminalId, spawnTerminal, terminals]);

  const tabs = [
    { id: 'terminal' as const, label: 'TERMINAL', icon: Terminal },
    { id: 'problems' as const, label: 'PROBLEMS', icon: AlertTriangle },
    { id: 'output' as const, label: 'OUTPUT', icon: Info },
    { id: 'debug' as const, label: 'DEBUG CONSOLE', icon: Info },
    { id: 'ports' as const, label: 'PORTS', icon: ChevronDown },
  ];

  if (!isVisible) return null;

  const primaryId = activeTerminalId;
  const secondaryId = splitView ? secondaryTerminalId : null;

  return (
    <div className="border-t border-[var(--vscode-panel-border)] bg-[var(--vscode-panel-background)]">
      <div className="flex items-center h-9 border-b border-[var(--vscode-panel-border)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-3 py-2 text-[11px] border-r border-[var(--vscode-panel-border)] ${
                activeTab === tab.id
                  ? 'text-[var(--vscode-panelTitle-activeForeground)] border-b-2 border-b-[var(--vscode-panelTitle-activeBorder)]'
                  : 'text-[var(--vscode-panelTitle-inactiveForeground)] hover:bg-[var(--vscode-list-hoverBackground)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 mr-1.5" />
              {tab.label}
            </button>
          );
        })}
        <div className="flex-1" />
        <button onClick={onToggle} className="p-1.5 hover:bg-[var(--vscode-list-hoverBackground)]">
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div style={{ height }}>
        {activeTab === 'terminal' && (
          <div className="h-full flex flex-col bg-[#1e1e1e]">
            <div className="flex items-center px-2 py-1 border-b border-[#333] gap-1 shrink-0">
              <span className="text-[10px] opacity-60 truncate max-w-[50%]" title={projectPath || ''}>
                {projectPath ? `cwd: ${projectPath}` : 'No folder open'}
              </span>
              <div className="flex-1" />
              {terminals.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTerminalId(t.id)}
                  className={`px-2 py-0.5 text-[11px] rounded ${
                    activeTerminalId === t.id ? 'bg-[#37373d] text-white' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {t.name}
                </button>
              ))}
              <button onClick={() => spawnTerminal()} className="p-1 hover:bg-[#333] rounded" title="New Terminal">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={async () => {
                  const id = await spawnTerminal();
                  if (id) { setSplitView(true); setSecondaryTerminalId(id); }
                }}
                className="p-1 hover:bg-[#333] rounded"
                title="Split Terminal"
              >
                <SplitSquareHorizontal className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => activeTerminalId && termRefs.current.get(activeTerminalId)?.clear()}
                className="p-1 hover:bg-[#333] rounded"
                title="Clear"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className={`flex-1 min-h-0 ${splitView ? 'flex' : ''}`}>
              {terminals.map((t) => (
                <div
                  key={t.id}
                  className={`${splitView ? 'w-1/2 border-r border-[#333]' : 'h-full w-full'} ${
                    !splitView && t.id !== primaryId ? 'hidden' : ''
                  } ${splitView && t.id !== primaryId && t.id !== secondaryId ? 'hidden' : ''}`}
                  style={{ height: splitView ? '100%' : undefined }}
                >
                  <TerminalView
                    ref={(el) => {
                      if (el) termRefs.current.set(t.id, el);
                      else termRefs.current.delete(t.id);
                    }}
                    terminalId={t.id}
                    active={t.id === primaryId || t.id === secondaryId}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'problems' && (
          <div className="h-full flex items-center justify-center text-[var(--vscode-descriptionForeground)] text-sm">
            No problems detected
          </div>
        )}
        {activeTab === 'output' && (
          <div className="h-full overflow-y-auto p-2 font-mono text-[11px]">
            {output.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        )}
        {activeTab === 'debug' && (
          <div className="h-full overflow-y-auto p-2 font-mono text-[11px] opacity-80">
            {debugOutput.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
        {activeTab === 'ports' && (
          <div className="h-full flex items-center justify-center text-sm opacity-60">No forwarded ports</div>
        )}
      </div>
    </div>
  );
});
