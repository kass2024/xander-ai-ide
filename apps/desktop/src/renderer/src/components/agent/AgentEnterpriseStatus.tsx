import React from 'react';
import { Loader2 } from 'lucide-react';
import type { AgentPhase } from '../../stores/agentStateStore';
import { PHASE_LABELS } from '../../stores/agentStateStore';
import { categoryForPhase, CATEGORY_STYLES } from '../../lib/toolCategories';

interface AgentEnterpriseStatusProps {
  phase: AgentPhase;
  provider?: string | null;
  model?: string | null;
  loading?: boolean;
  message?: string;
}

export function AgentEnterpriseStatus({
  phase,
  provider,
  model,
  loading = true,
  message,
}: AgentEnterpriseStatusProps) {
  const cat = categoryForPhase(phase);
  const style = CATEGORY_STYLES[cat];
  const label = message || PHASE_LABELS[phase] || 'Working…';

  return (
    <div
      className="agent-enterprise-status"
      style={{
        background: style.bg,
        borderColor: style.border,
        boxShadow: `0 0 24px ${style.glow}`,
      }}
    >
      <div className="agent-enterprise-status-accent" style={{ background: style.color }} />
      <div className="agent-enterprise-status-body">
        <div className="flex items-center gap-2 min-w-0">
          {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: style.color }} />}
          <span className="agent-enterprise-status-label" style={{ color: style.color }}>
            {style.label}
          </span>
          <span className="agent-enterprise-status-text truncate">{label}</span>
        </div>
        {(provider || model) && (
          <span className="agent-enterprise-status-model truncate">
            {provider}{model ? ` · ${model}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}
