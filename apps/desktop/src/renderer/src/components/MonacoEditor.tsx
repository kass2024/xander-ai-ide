import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as monaco from 'monaco-editor';
import { setupMonacoEnvironment } from '../monacoSetup';
import apiClient from '../lib/api';
import { debouncedAICompletion, cancelPendingAutocomplete } from '../lib/aiAutocomplete';
import { isInlineAutocompleteEnabled } from '../stores/aiUsageStore';

export interface MonacoEditorHandle {
  undo: () => void;
  redo: () => void;
  cut: () => void;
  copy: () => void;
  paste: () => void;
  selectAll: () => void;
  find: () => void;
  replace: () => void;
  goToSymbol: () => void;
  save: () => void;
  focus: () => void;
  getSelectedText: () => string;
  expandSelection: () => void;
  insertAtCursor: (text: string) => void;
}

interface MonacoEditorProps {
  content: string;
  language: string;
  theme?: string;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  onCursorChange?: (line: number, column: number) => void;
  readOnly?: boolean;
  filePath?: string;
  breakpoints?: number[];
  onBreakpointToggle?: (line: number) => void;
}

const EDITOR_OPTS: monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  minimap: { enabled: true, side: 'right', showSlider: 'always' },
  fontSize: 14,
  lineHeight: 22,
  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  bracketPairColorization: { enabled: true },
  guides: { indentation: true, bracketPairs: true, highlightActiveIndentation: true },
  suggest: {
    showKeywords: true,
    showSnippets: true,
    preview: true,
    showIcons: true,
  },
  quickSuggestions: { other: true, comments: false, strings: true },
  inlineSuggest: { enabled: false, mode: 'prefix' },
  parameterHints: { enabled: true },
  hover: { enabled: true },
  padding: { top: 10, bottom: 10 },
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  folding: true,
  lineNumbers: 'on',
  glyphMargin: true,
  stickyScroll: { enabled: true, maxLineNumber: 3 },
  tabSize: 2,
  insertSpaces: true,
  formatOnPaste: true,
  formatOnType: true,
};

function getContextAround(model: monaco.editor.ITextModel, position: monaco.Position) {
  const prefix = model.getValueInRange(
    new monaco.Range(Math.max(1, position.lineNumber - 30), 1, position.lineNumber, position.column),
  );
  const suffix = model.getValueInRange(
    new monaco.Range(
      position.lineNumber,
      position.column,
      Math.min(model.getLineCount(), position.lineNumber + 15),
      model.getLineMaxColumn(Math.min(model.getLineCount(), position.lineNumber + 15)),
    ),
  );
  return { prefix, suffix };
}

export const MonacoEditor = forwardRef<MonacoEditorHandle, MonacoEditorProps>(function MonacoEditor({
  content,
  language,
  theme = 'vs-dark',
  onChange,
  onSave,
  onCursorChange,
  readOnly = false,
  filePath = '',
  breakpoints = [],
  onBreakpointToggle,
}, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const breakpointDecorationsRef = useRef<string[]>([]);
  const disposablesRef = useRef<monaco.IDisposable[]>([]);
  const [isReady, setIsReady] = useState(false);

  useImperativeHandle(ref, () => ({
    undo: () => editorInstanceRef.current?.trigger('menu', 'undo', null),
    redo: () => editorInstanceRef.current?.trigger('menu', 'redo', null),
    cut: () => editorInstanceRef.current?.trigger('menu', 'editor.action.clipboardCutAction', null),
    copy: () => editorInstanceRef.current?.trigger('menu', 'editor.action.clipboardCopyAction', null),
    paste: () => editorInstanceRef.current?.trigger('menu', 'editor.action.clipboardPasteAction', null),
    selectAll: () => editorInstanceRef.current?.trigger('menu', 'editor.action.selectAll', null),
    find: () => editorInstanceRef.current?.trigger('menu', 'actions.find', null),
    replace: () => editorInstanceRef.current?.trigger('menu', 'editor.action.startFindReplaceAction', null),
    goToSymbol: () => editorInstanceRef.current?.trigger('menu', 'editor.action.quickOutline', null),
    save: () => {
      const value = editorInstanceRef.current?.getValue();
      if (value !== undefined) onSave?.(value);
    },
    focus: () => editorInstanceRef.current?.focus(),
    getSelectedText: () => {
      const sel = editorInstanceRef.current?.getSelection();
      const model = editorInstanceRef.current?.getModel();
      if (!sel || !model) return '';
      return model.getValueInRange(sel);
    },
    expandSelection: () =>
      editorInstanceRef.current?.trigger('menu', 'editor.action.smartSelect.expand', null),
    insertAtCursor: (text: string) => {
      const editor = editorInstanceRef.current;
      if (!editor) return;
      const sel = editor.getSelection();
      if (!sel) return;
      editor.executeEdits('ai-insert', [{ range: sel, text, forceMoveMarkers: true }]);
    },
  }), [onSave]);

  useEffect(() => {
    if (!editorRef.current) return;

    setupMonacoEnvironment();

    const editor = monaco.editor.create(editorRef.current, {
      ...EDITOR_OPTS,
      value: content,
      language,
      theme,
      readOnly,
    });

    editorInstanceRef.current = editor;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.(editor.getValue());
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
      editor.trigger('ai', 'editor.action.triggerSuggest', {});
    });

    const disposables: monaco.IDisposable[] = [
      editor.onDidChangeCursorPosition((e) => {
        onCursorChange?.(e.position.lineNumber, e.position.column);
      }),
      editor.onMouseDown((e) => {
        if (
          e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
          e.target.position &&
          onBreakpointToggle
        ) {
          onBreakpointToggle(e.target.position.lineNumber);
        }
      }),
      editor.onDidChangeModelContent(() => onChange?.(editor.getValue())),

      // AI inline ghost-text completions — only when enabled in Settings (off by default)
      monaco.languages.registerInlineCompletionsProvider({ pattern: '**' }, {
        provideInlineCompletions: async (model, position, _ctx, token) => {
          if (!apiClient.getToken() || readOnly || !isInlineAutocompleteEnabled()) return { items: [] };
          const { prefix, suffix } = getContextAround(model, position);
          if (prefix.trim().length < 2) return { items: [] };

          const completion = await debouncedAICompletion({
            prefix,
            suffix,
            filename: filePath || 'untitled.txt',
            language,
          });

          if (token.isCancellationRequested || !completion) return { items: [] };

          return {
            items: [{
              insertText: completion,
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column,
              ),
            }],
          };
        },
        disposeInlineCompletions: () => {},
      }),

      // AI completion on Ctrl+Space only (explicit user action — no auto trigger on typing)
      monaco.languages.registerCompletionItemProvider('*', {
        provideCompletionItems: async (model, position, _context, token) => {
          if (!apiClient.getToken() || readOnly) return { suggestions: [] };
          if (token.triggerKind !== monaco.languages.CompletionTriggerKind.Invoke) {
            return { suggestions: [] };
          }
          const { prefix, suffix } = getContextAround(model, position);
          if (prefix.trim().length < 3) return { suggestions: [] };

          const completion = await fetchAICompletionDirect(prefix, suffix);
          if (!completion) return { suggestions: [] };

          return {
            suggestions: [{
              label: '✨ AI suggestion',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: completion,
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column,
              ),
              detail: 'Xander AI',
              sortText: '0',
            }],
          };
        },
      }),
    ];

    disposablesRef.current = disposables;
    setIsReady(true);

    return () => {
      cancelPendingAutocomplete();
      disposables.forEach((d) => d.dispose());
      editor.dispose();
    };
  }, []);

  async function fetchAICompletionDirect(prefix: string, suffix: string) {
    try {
      const result = await apiClient.aiAutocomplete({
        prefix,
        suffix,
        filename: filePath || 'untitled.txt',
        language,
      });
      return result.completion?.trim() || null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (editorInstanceRef.current && isReady) {
      const current = editorInstanceRef.current.getValue();
      if (current !== content) editorInstanceRef.current.setValue(content);
    }
  }, [content, isReady]);

  useEffect(() => {
    if (editorInstanceRef.current && isReady) {
      const model = editorInstanceRef.current.getModel();
      if (model) monaco.editor.setModelLanguage(model, language);
    }
  }, [language, isReady]);

  useEffect(() => {
    if (!editorInstanceRef.current || !isReady) return;
    breakpointDecorationsRef.current = editorInstanceRef.current.deltaDecorations(
      breakpointDecorationsRef.current,
      breakpoints.map((line) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          glyphMarginClassName: 'xander-breakpoint',
          glyphMarginHoverMessage: { value: 'Breakpoint — click to remove' },
        },
      })),
    );
  }, [breakpoints, isReady]);

  return (
    <div className="h-full w-full relative bg-[var(--vscode-editor-background)]">
      <div ref={editorRef} className="h-full w-full" />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--vscode-editor-background)]">
          <div className="text-[var(--vscode-foreground)] flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-[var(--vscode-foreground)] border-t-transparent rounded-full animate-spin" />
            <span>Loading editor...</span>
          </div>
        </div>
      )}
    </div>
  );
});
