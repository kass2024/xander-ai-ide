import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { getElectronAPI } from '../lib/electron';

export interface TerminalViewHandle {
  clear: () => void;
  focus: () => void;
  fit: () => void;
}

interface TerminalViewProps {
  terminalId: string;
  active: boolean;
  onReady?: () => void;
}

export const TerminalView = forwardRef<TerminalViewHandle, TerminalViewProps>(
  function TerminalView({ terminalId, active, onReady }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const initializedRef = useRef(false);

    useImperativeHandle(ref, () => ({
      clear: () => termRef.current?.clear(),
      focus: () => termRef.current?.focus(),
      fit: () => {
        try {
          fitRef.current?.fit();
          const api = getElectronAPI();
          if (termRef.current && api) {
            api.terminalResize(terminalId, termRef.current.cols, termRef.current.rows);
          }
        } catch {
          /* ignore fit errors during layout */
        }
      },
    }));

    useEffect(() => {
      if (!containerRef.current || initializedRef.current) return;
      initializedRef.current = true;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'Consolas, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#cccccc',
          cursor: '#aeafad',
          selectionBackground: '#264f78',
        },
        scrollback: 5000,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();
      termRef.current = term;
      fitRef.current = fitAddon;

      const api = getElectronAPI();
      if (!api) return;

      term.onData((data) => {
        api.terminalWrite(terminalId, data);
      });

      const onData = ({ id, data }: { id: string; data: string }) => {
        if (id === terminalId) term.write(data);
      };
      const onExit = ({ id }: { id: string }) => {
        if (id === terminalId) term.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
      };

      api.onTerminalData(onData);
      api.onTerminalExit(onExit);
      onReady?.();

      const ro = new ResizeObserver(() => {
        try {
          fitAddon.fit();
          api.terminalResize(terminalId, term.cols, term.rows);
        } catch {
          /* ignore */
        }
      });
      ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
        term.dispose();
        initializedRef.current = false;
      };
    }, [terminalId, onReady]);

    useEffect(() => {
      if (active) {
        setTimeout(() => {
          fitRef.current?.fit();
          termRef.current?.focus();
        }, 50);
      }
    }, [active]);

    return (
      <div
        ref={containerRef}
        className="h-full w-full p-1"
        style={{ display: active ? 'block' : 'none' }}
      />
    );
  },
);
