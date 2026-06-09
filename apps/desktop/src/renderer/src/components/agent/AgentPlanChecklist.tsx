import React from 'react';
import { CheckCircle2, Circle, ListChecks } from 'lucide-react';
import { useAgentPlanStore } from '../../stores/agentPlanStore';

export function AgentPlanChecklist() {
  const steps = useAgentPlanStore((s) => s.steps);
  const toggleStep = useAgentPlanStore((s) => s.toggleStep);

  if (!steps.length) return null;

  const done = steps.filter((s) => s.done).length;

  return (
    <div className="agent-plan-checklist">
      <div className="agent-plan-checklist-header">
        <ListChecks className="w-4 h-4 text-violet-400" />
        <span>Plan</span>
        <span className="agent-plan-checklist-count">{done}/{steps.length}</span>
      </div>
      <ul className="agent-plan-checklist-items">
        {steps.map((step) => (
          <li key={step.id}>
            <button type="button" className="agent-plan-step" onClick={() => toggleStep(step.id)}>
              {step.done ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              )}
              <span className={step.done ? 'line-through opacity-50' : ''}>{step.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
