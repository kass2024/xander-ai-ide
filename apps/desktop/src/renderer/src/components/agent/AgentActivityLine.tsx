import React from 'react';
import { CATEGORY_STYLES, toolCategory, type ToolCategory } from '../../lib/toolCategories';

interface AgentActivityLineProps {
  message: string;
  toolName?: string;
  category?: ToolCategory;
}

export function AgentActivityLine({ message, toolName, category }: AgentActivityLineProps) {
  const cat = category || (toolName ? toolCategory(toolName) : 'general');
  const style = CATEGORY_STYLES[cat];

  return (
    <div
      className="agent-activity-enterprise"
      style={{ borderLeftColor: style.color, background: style.bg }}
    >
      <span className="agent-activity-enterprise-dot" style={{ background: style.color }} />
      <span className="agent-activity-enterprise-tag" style={{ color: style.color }}>
        {style.label}
      </span>
      <span className="agent-activity-enterprise-msg">{message}</span>
    </div>
  );
}
