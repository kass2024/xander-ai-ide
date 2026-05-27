import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ResizablePanelProps {
  /** Which edge has the drag handle */
  edge?: 'left' | 'right';
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  children: React.ReactNode;
  className?: string;
}

export function ResizablePanel({
  edge = 'left',
  defaultWidth = 320,
  minWidth = 280,
  maxWidth = 720,
  storageKey,
  children,
  className = '',
}: ResizablePanelProps) {
  const [width, setWidth] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const n = parseInt(saved, 10);
        if (!Number.isNaN(n)) return Math.min(maxWidth, Math.max(minWidth, n));
      }
    }
    return defaultWidth;
  });

  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = edge === 'left' ? startX.current - e.clientX : e.clientX - startX.current;
      const next = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
      setWidth(next);
    };

    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [edge, minWidth, maxWidth]);

  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, String(width));
  }, [width, storageKey]);

  return (
    <div
      className={`relative shrink-0 flex flex-col h-full ${className}`}
      style={{ width }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        onMouseDown={onMouseDown}
        className={`absolute top-0 bottom-0 w-1.5 z-10 cursor-col-resize hover:bg-[var(--vscode-focusBorder)] active:bg-blue-500 transition-colors ${
          edge === 'left' ? 'left-0 -ml-0.5' : 'right-0 -mr-0.5'
        }`}
        title="Drag to resize"
      />
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
