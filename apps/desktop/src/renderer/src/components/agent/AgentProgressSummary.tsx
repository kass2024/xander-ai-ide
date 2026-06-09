import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface AgentProgressSummaryProps {
  items: string[];
}

export function AgentProgressSummary({ items }: AgentProgressSummaryProps) {
  if (!items.length) return null;
  return (
    <div className="agent-progress-summary">
      <div className="agent-progress-summary-title">Completed steps</div>
      <ul className="agent-progress-summary-list">
        {items.map((item, i) => (
          <li key={`${item}-${i}`} className="agent-progress-summary-item">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
