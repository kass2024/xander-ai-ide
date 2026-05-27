import React, { useEffect, useRef, useState } from 'react';

interface SimpleEditorProps {
  content: string;
  language: string;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  readOnly?: boolean;
}

export function SimpleEditor({ 
  content, 
  language, 
  onChange, 
  onSave,
  readOnly = false 
}: SimpleEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.value = content;
      setIsReady(true);
    }
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    onChange?.(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      const value = textareaRef.current?.value || '';
      onSave?.(value);
    }
    
    // Handle tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      const newValue = target.value.substring(0, start) + '  ' + target.value.substring(end);
      target.value = newValue;
      target.selectionStart = target.selectionEnd = start + 2;
      onChange?.(newValue);
    }
  };

  const getLineNumbers = () => {
    const lines = content.split('\n');
    const lineCount = lines.length;
    return Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
  };

  return (
    <div className="h-full w-full flex bg-[#1e1e1e] font-mono text-sm">
      {/* Line numbers */}
      <div className="w-12 bg-[#252526] text-[#858585] text-right pr-2 pt-2 select-none border-r border-[#3e3e3e]">
        <pre className="text-xs leading-6">{getLineNumbers()}</pre>
      </div>
      
      {/* Editor */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          className="w-full h-full bg-transparent text-[#cccccc] p-2 resize-none outline-none leading-6"
          style={{
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '14px',
            lineHeight: '1.6',
            tabSize: 2,
          }}
          placeholder="Start typing your code here..."
          spellCheck={false}
        />
        
        {/* Language indicator */}
        <div className="absolute bottom-2 right-2 text-xs text-[#858585] bg-[#2d2d30] px-2 py-1 rounded">
          {language}
        </div>
        
        {/* Instructions */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]">
            <div className="text-[#cccccc]">Loading editor...</div>
          </div>
        )}
      </div>
    </div>
  );
}
