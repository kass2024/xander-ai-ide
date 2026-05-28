import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalOutputProps {
  command?: string;
  title?: string;
  output?: string;
  stderr?: string;
  exitCode?: number;
  status: 'awaiting_approval' | 'running' | 'success' | 'failed' | 'skipped';
  expanded?: boolean;
}

const STATUS_LABELS: Record<TerminalOutputProps['status'], string> = {
  awaiting_approval: 'Awaiting approval',
  running: 'Running',
  success: 'Success',
  failed: 'Failed',
  skipped: 'Skipped',
};

const STATUS_CLASS: Record<TerminalOutputProps['status'], string> = {
  awaiting_approval: 'text-amber-400',
  running: 'text-blue-400',
  success: 'text-emerald-400',
  failed: 'text-red-400',
  skipped: 'text-gray-400',
};

export function TerminalOutput({
  command,
  title,
  output = '',
  stderr,
  exitCode,
  status,
  expanded = true,
}: TerminalOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!expanded || !containerRef.current) return;
    const term = new Terminal({
      theme: { background: '#0d0d0d', foreground: '#d4d4d4', cursor: '#d4d4d4' },
      fontSize: 12,
      fontFamily: 'Consolas, "Courier New", monospace',
      convertEol: true,
      disableStdin: true,
      rows: 8,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;

    const text = [
      command ? `$ ${command}\n` : '',
      output,
      stderr ? `\n[stderr]\n${stderr}` : '',
      exitCode != null ? `\n[exit ${exitCode}]` : '',
    ].join('');
    term.write(text.slice(0, 8000));

    return () => {
      term.dispose();
      termRef.current = null;
    };
  }, [expanded, command, output, stderr, exitCode]);

  return (
    <div className="agent-terminal-block">
      <div className="agent-terminal-header">
        <span className="agent-terminal-prompt">&gt;_</span>
        <span className="truncate flex-1 font-medium">{title || command || 'Terminal'}</span>
        <span className={`text-[10px] font-medium ${STATUS_CLASS[status]}`}>{STATUS_LABELS[status]}</span>
      </div>
      {expanded && command && (
        <div className="agent-terminal-meta px-3 py-2 border-b border-[#2a2a2a] text-[11px]">
          <div><strong>Command</strong> <code className="font-mono">{command}</code></div>
          {exitCode != null && <div className="mt-1"><strong>Exit code</strong> {exitCode}</div>}
        </div>
      )}
      {expanded && (
        <div ref={containerRef} className="agent-terminal-xterm p-2" style={{ minHeight: 140 }} />
      )}
    </div>
  );
}
