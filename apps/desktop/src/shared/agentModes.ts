/**
 * Xander Agent — task mode definitions (desktop + mirrored in backend agent-modes.ts).
 */

export type AgentTaskMode =
  | 'chat'
  | 'plan'
  | 'build'
  | 'debug'
  | 'refactor'
  | 'database'
  | 'command';

export interface AgentModeConfig {
  id: AgentTaskMode;
  label: string;
  description: string;
  maxSteps: number;
  /** If true, mutating tools are blocked entirely */
  readOnly: boolean;
  /** null = all tools allowed (subject to approval policy) */
  allowedTools: Set<string> | null;
  preferredProvider: 'openai' | 'anthropic' | 'google' | 'auto';
  systemPrompt: string;
}

const READ_TOOLS = new Set([
  'read_file', 'list_files', 'list_directory', 'search_code', 'search_project',
  'grep', 'semantic_search', 'analyze_project', 'walk_project_files',
  'inspect_database', 'inspect_xampp_mysql', 'mysql_list_databases',
  'mysql_describe_table', 'mysql_query', 'git_status', 'git_diff',
]);

const BUILD_TOOLS = null; // all tools

const DB_TOOLS = new Set([
  ...READ_TOOLS,
  'generate_migration', 'create_database_schema', 'alter_database_schema',
  'mysql_execute', 'run_terminal', 'write_file', 'create_file', 'edit_file',
  'create_folder',
]);

const COMMAND_TOOLS = new Set([
  ...READ_TOOLS,
  'run_terminal', 'build_project', 'test_project', 'lint_project', 'install_package',
  'git_status', 'git_diff',
]);

export const AGENT_MODE_CONFIG: Record<AgentTaskMode, AgentModeConfig> = {
  chat: {
    id: 'chat',
    label: 'Chat',
    description: 'Ask questions — read-only, no file changes',
    maxSteps: 8,
    readOnly: true,
    allowedTools: READ_TOOLS,
    preferredProvider: 'openai',
    systemPrompt: `CHAT MODE: Answer clearly. Use read/search tools only — NEVER write files, run commands, or mutate the project.
Explain architecture, suggest approaches, and cite file paths. If the user wants changes, tell them to switch to Build mode.`,
  },
  plan: {
    id: 'plan',
    label: 'Plan',
    description: 'Analyze task and produce a step-by-step plan',
    maxSteps: 15,
    readOnly: true,
    allowedTools: READ_TOOLS,
    preferredProvider: 'anthropic',
    systemPrompt: `PLAN MODE: Scan the project with tools, then output a structured plan ONLY — do not edit files yet.
Format:
## Plan
- [ ] Step 1: ...
- [ ] Step 2: ...
Include files to touch, commands to run, and risks. End with "Switch to Build mode to execute."`,
  },
  build: {
    id: 'build',
    label: 'Build',
    description: 'Create and edit files autonomously',
    maxSteps: 40,
    readOnly: false,
    allowedTools: BUILD_TOOLS,
    preferredProvider: 'openai',
    systemPrompt: `BUILD MODE: Full autonomous coding. Loop: scan → plan briefly → edit → run tests/build → fix errors → summarize changed files.
Create folders/files as needed. Prefer edit_file for small changes. Verify with lint/build/test when possible.`,
  },
  debug: {
    id: 'debug',
    label: 'Debug',
    description: 'Find errors in logs/terminal and fix them',
    maxSteps: 45,
    readOnly: false,
    allowedTools: BUILD_TOOLS,
    preferredProvider: 'openai',
    systemPrompt: `DEBUG MODE: Find root cause from errors, logs, and terminal output.
1. Read failing file/stack trace 2. Search related code 3. Fix 4. Re-run command/test 5. Repeat until fixed or ask user.
Always run_terminal / test_project / build_project after fixes to verify.`,
  },
  refactor: {
    id: 'refactor',
    label: 'Refactor',
    description: 'Improve code safely across multiple files',
    maxSteps: 50,
    readOnly: false,
    allowedTools: BUILD_TOOLS,
    preferredProvider: 'anthropic',
    systemPrompt: `REFACTOR MODE: Large safe refactors. Read all affected files first. Use refactor_files for plan, then edit_file per file.
Preserve behavior; run tests after. Never delete without explicit user request.`,
  },
  database: {
    id: 'database',
    label: 'Database',
    description: 'Schema, migrations, seeders, SQL',
    maxSteps: 35,
    readOnly: false,
    allowedTools: DB_TOOLS,
    preferredProvider: 'anthropic',
    systemPrompt: `DATABASE MODE: inspect_database / inspect_xampp_mysql first. Never expose passwords.
generate_migration for Laravel/SQL. mysql_query read-only; mysql_execute needs approval.
Support migrations, models, seeders. Run migration commands only after user approval.`,
  },
  command: {
    id: 'command',
    label: 'Command',
    description: 'Suggest and run terminal commands (with approval)',
    maxSteps: 20,
    readOnly: false,
    allowedTools: COMMAND_TOOLS,
    preferredProvider: 'openai',
    systemPrompt: `COMMAND MODE: Suggest shell commands; every run_terminal requires user approval.
Explain what each command does. Block dangerous ops (rm -rf, DROP DATABASE, git reset --hard).
Feed stdout/stderr back and debug failures.`,
  },
};

export const AGENT_MODE_LIST: AgentTaskMode[] = [
  'chat', 'plan', 'build', 'debug', 'refactor', 'database', 'command',
];

/** Map legacy persisted modes to new task modes */
export function normalizeAgentMode(mode: string | undefined): AgentTaskMode {
  const m = (mode || 'build').toLowerCase();
  if (m in AGENT_MODE_CONFIG) return m as AgentTaskMode;
  switch (m) {
    case 'fast':
    case 'standard':
    case 'deep':
      return 'build';
    case 'refactor':
      return 'refactor';
    default:
      return 'build';
  }
}

export function isToolAllowedInMode(toolName: string, mode: AgentTaskMode): boolean {
  const cfg = AGENT_MODE_CONFIG[mode];
  if (cfg.readOnly && !READ_TOOLS.has(toolName)) return false;
  if (!cfg.allowedTools) return true;
  return cfg.allowedTools.has(toolName);
}

export function maxStepsForAgentMode(mode: AgentTaskMode): number {
  return AGENT_MODE_CONFIG[mode].maxSteps;
}
