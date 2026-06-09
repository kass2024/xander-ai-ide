/** Agent task modes — keep in sync with apps/desktop/src/shared/agentModes.ts */

export type AgentTaskMode =
  | 'chat'
  | 'plan'
  | 'build'
  | 'debug'
  | 'refactor'
  | 'database'
  | 'command';

const MODE_PROMPTS: Record<AgentTaskMode, string> = {
  chat: `CHAT MODE: Answer clearly. Use read/search tools only — NEVER write files or run commands.`,
  plan: `PLAN MODE: Scan with tools, output ## Plan with - [ ] checklist. Do not edit files.`,
  build: `BUILD MODE: Autonomous coding — scan, edit, test, fix, summarize changes.`,
  debug: `DEBUG MODE: Trace errors, fix, re-run tests/commands until resolved.`,
  refactor: `REFACTOR MODE: Safe multi-file refactors with tests after changes.`,
  database: `DATABASE MODE: Schema/migrations/SQL. Never expose passwords.`,
  command: `COMMAND MODE: Suggest commands; dangerous ops need user approval.`,
};

export function normalizeAgentMode(mode?: string): AgentTaskMode {
  const m = (mode || 'build').toLowerCase();
  if (m in MODE_PROMPTS) return m as AgentTaskMode;
  if (m === 'fast' || m === 'standard' || m === 'deep') return 'build';
  if (m === 'refactor') return 'refactor';
  return 'build';
}

export function getModeSystemPrompt(mode?: string): string {
  const m = normalizeAgentMode(mode);
  return MODE_PROMPTS[m];
}

export function routeProviderForMode(
  mode: AgentTaskMode,
  uiTask: boolean,
  keys: { openai: boolean; anthropic: boolean; gemini: boolean },
): 'openai' | 'anthropic' | 'google' | null {
  switch (mode) {
    case 'chat':
    case 'debug':
    case 'command':
    case 'build':
      if (keys.openai) return 'openai';
      if (keys.anthropic) return 'anthropic';
      return keys.gemini ? 'google' : null;
    case 'plan':
    case 'refactor':
    case 'database':
      if (keys.anthropic) return 'anthropic';
      if (keys.openai) return 'openai';
      return keys.gemini ? 'google' : null;
    default:
      if (uiTask && keys.anthropic) return 'anthropic';
      if (keys.anthropic) return 'anthropic';
      if (keys.openai) return 'openai';
      return keys.gemini ? 'google' : null;
  }
}
