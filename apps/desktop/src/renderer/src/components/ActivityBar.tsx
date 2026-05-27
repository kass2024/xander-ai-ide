import React, { useState } from 'react';
import { 
  Files, 
  Search, 
  GitBranch, 
  Terminal, 
  Settings, 
  MessageSquare,
  Cpu,
  Database,
  Package,
  Puzzle,
  LayoutDashboard,
  Sparkles,
  Bot
} from 'lucide-react';

interface ActivityBarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export function ActivityBar({ activeView, onViewChange }: ActivityBarProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const activities = [
    { 
      id: 'explorer', 
      icon: Files, 
      tooltip: 'Explorer',
      badge: null
    },
    { 
      id: 'search', 
      icon: Search, 
      tooltip: 'Search (Text + Semantic)',
      badge: null
    },
    { 
      id: 'git', 
      icon: GitBranch, 
      tooltip: 'Source Control',
      badge: '3'
    },
    { 
      id: 'ai', 
      icon: Sparkles, 
      tooltip: 'AI Assistant',
      badge: null
    },
    { 
      id: 'agents', 
      icon: Bot, 
      tooltip: 'AI Agents',
      badge: null
    },
    { 
      id: 'database', 
      icon: Database, 
      tooltip: 'Database',
      badge: null
    },
    { 
      id: 'extensions', 
      icon: Puzzle, 
      tooltip: 'Extensions',
      badge: '12'
    },
    { 
      id: 'terminal', 
      icon: Terminal, 
      tooltip: 'Terminal',
      badge: null
    },
    { 
      id: 'settings', 
      icon: Settings, 
      tooltip: 'Settings',
      badge: null
    }
  ];

  return (
    <div className="w-14 bg-[var(--vscode-activityBar-background)] flex flex-col items-center py-3 space-y-1 border-r border-[var(--vscode-activityBar-border)]">
      {/* App Logo */}
      <div className="mb-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
          <LayoutDashboard className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Activity Items */}
      <div className="flex flex-col items-center space-y-1">
        {activities.map((activity) => {
          const Icon = activity.icon;
          const isActive = activeView === activity.id;
          const isHovered = hoveredItem === activity.id;
          
          return (
            <div key={activity.id} className="relative">
              <button
                onClick={() => onViewChange(activity.id)}
                onMouseEnter={() => setHoveredItem(activity.id)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 relative group ${
                  isActive 
                    ? 'bg-[var(--vscode-activityBar-activeBackground)] text-[var(--vscode-activityBar-activeForeground)] shadow-sm' 
                    : 'text-[var(--vscode-activityBar-inactiveForeground)] hover:text-[var(--vscode-activityBar-activeForeground)] hover:bg-[var(--vscode-activityBar-activeBackground)]'
                }`}
              >
                <Icon className="w-5 h-5" />
                
                {/* Badge */}
                {activity.badge && (
                  <div className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] text-[9px] rounded-full flex items-center justify-center font-mono px-1 shadow-sm">
                    {activity.badge}
                  </div>
                )}
              </button>
              
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute left-full ml-3 px-3 py-1.5 bg-[var(--vscode-widget-background)] border border-[var(--vscode-widget-border)] text-[var(--vscode-widget-foreground)] text-[12px] rounded-md shadow-lg opacity-100 visible transition-all whitespace-nowrap z-50 backdrop-blur-sm">
                  {activity.tooltip}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Spacer */}
      <div className="flex-1"></div>
    </div>
  );
}
