import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown, Search, Settings, Minus, X, Square, Maximize2, FileText
} from 'lucide-react';
import { APP_MENUS, MenuActionId } from '../lib/menuActions';

interface TitleBarProps {
  title?: string;
  isMaximized?: boolean;
  workspaceName?: string;
  planName?: string;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  onOpenSettings?: (tab?: string) => void;
  onMenuAction?: (action: MenuActionId) => void;
}

export function TitleBar({
  title = 'Xander AI IDE',
  isMaximized = false,
  workspaceName = 'Untitled Workspace',
  planName = 'Free',
  onMinimize,
  onMaximize,
  onClose,
  onOpenSettings,
  onMenuAction,
}: TitleBarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = (actionId?: MenuActionId) => {
    setActiveMenu(null);
    if (actionId) onMenuAction?.(actionId);
  };

  return (
    <div className="flex items-center justify-between h-9 bg-[var(--vscode-titleBar-background)] border-b border-[var(--vscode-titleBar-border)] select-none">
      <div className="flex items-center flex-1 min-w-0">
        <div className="flex items-center px-1 shrink-0" ref={menuRef}>
          {APP_MENUS.map((menu) => (
            <div key={menu.id} className="relative">
              <button
                className={`px-2.5 py-1.5 text-[13px] rounded-sm hover:bg-[var(--vscode-list-hoverBackground)] ${
                  activeMenu === menu.id ? 'bg-[var(--vscode-list-hoverBackground)]' : ''
                }`}
                onMouseEnter={() => activeMenu && setActiveMenu(menu.id)}
                onClick={() => setActiveMenu(activeMenu === menu.id ? null : menu.id)}
              >
                {menu.label}
              </button>

              {activeMenu === menu.id && (
                <div className="absolute top-full left-0 mt-0 bg-[var(--vscode-dropdown-background)] border border-[var(--vscode-dropdown-border)] rounded-md shadow-xl z-[100] min-w-[240px] py-1">
                  {menu.items.map((item, index) => {
                    if (item.type === 'separator') {
                      return <div key={index} className="h-px bg-[var(--vscode-dropdown-border)] my-1" />;
                    }
                    return (
                      <button
                        key={item.id || index}
                        disabled={item.disabled}
                        onClick={() => handleItemClick(item.id)}
                        className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-[var(--vscode-list-hoverBackground)] flex items-center justify-between disabled:opacity-40"
                      >
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <span className="text-[11px] text-[var(--vscode-descriptionForeground)] ml-6 font-mono">
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center ml-4 mr-3 shrink-0">
          <div className="flex items-center px-2.5 py-1 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded-md">
            <FileText className="w-3.5 h-3.5 mr-2 text-[var(--vscode-descriptionForeground)]" />
            <span className="text-[12px] font-medium truncate max-w-[140px]">{workspaceName}</span>
            <ChevronDown className="w-3 h-3 ml-1 text-[var(--vscode-descriptionForeground)]" />
          </div>
        </div>

        <div className="flex items-center flex-1 max-w-md mr-4">
          <div className="flex items-center w-full px-2.5 py-1 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded-md">
            <Search className="w-3.5 h-3.5 mr-2 text-[var(--vscode-descriptionForeground)]" />
            <input
              type="text"
              placeholder="Search files..."
              className="flex-1 bg-transparent text-[12px] outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center shrink-0">
        {planName === 'Free' && (
          <button
            onClick={() => onOpenSettings?.('plan')}
            className="mr-2 px-2.5 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Upgrade to Pro
          </button>
        )}
        <button
          onClick={() => onOpenSettings?.('general')}
          className="p-1.5 hover:bg-[var(--vscode-list-hoverBackground)] rounded-sm"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
        <div className="flex items-center ml-1">
          <button onClick={onMinimize} className="p-2 hover:bg-[var(--vscode-list-hoverBackground)]">
            <Minus className="w-4 h-4" />
          </button>
          <button onClick={onMaximize} className="p-2 hover:bg-[var(--vscode-list-hoverBackground)]">
            {isMaximized ? <Square className="w-3.5 h-3.5" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-red-600 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
