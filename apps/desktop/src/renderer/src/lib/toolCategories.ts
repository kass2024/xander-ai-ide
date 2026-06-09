/** Enterprise tool categories — colors & phase labels for agent UI. */

export type ToolCategory =
  | 'database'
  | 'filesystem'
  | 'terminal'
  | 'search'
  | 'git'
  | 'build'
  | 'analysis'
  | 'general';

export interface CategoryStyle {
  id: ToolCategory;
  label: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
}

export const CATEGORY_STYLES: Record<ToolCategory, CategoryStyle> = {
  database: {
    id: 'database',
    label: 'Database',
    color: '#22d3ee',
    bg: 'rgba(6, 182, 212, 0.12)',
    border: 'rgba(34, 211, 238, 0.35)',
    glow: 'rgba(34, 211, 238, 0.15)',
  },
  filesystem: {
    id: 'filesystem',
    label: 'Files',
    color: '#60a5fa',
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(96, 165, 250, 0.35)',
    glow: 'rgba(96, 165, 250, 0.12)',
  },
  terminal: {
    id: 'terminal',
    label: 'Terminal',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.12)',
    border: 'rgba(251, 191, 36, 0.35)',
    glow: 'rgba(251, 191, 36, 0.12)',
  },
  search: {
    id: 'search',
    label: 'Search',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.1)',
    border: 'rgba(56, 189, 248, 0.3)',
    glow: 'rgba(56, 189, 248, 0.1)',
  },
  git: {
    id: 'git',
    label: 'Git',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.12)',
    border: 'rgba(167, 139, 250, 0.35)',
    glow: 'rgba(167, 139, 250, 0.12)',
  },
  build: {
    id: 'build',
    label: 'Build',
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.12)',
    border: 'rgba(249, 115, 22, 0.35)',
    glow: 'rgba(249, 115, 22, 0.12)',
  },
  analysis: {
    id: 'analysis',
    label: 'Analysis',
    color: '#c084fc',
    bg: 'rgba(192, 132, 252, 0.12)',
    border: 'rgba(192, 132, 252, 0.35)',
    glow: 'rgba(192, 132, 252, 0.12)',
  },
  general: {
    id: 'general',
    label: 'Agent',
    color: '#a3a3a3',
    bg: 'rgba(163, 163, 163, 0.08)',
    border: 'rgba(163, 163, 163, 0.25)',
    glow: 'rgba(163, 163, 163, 0.08)',
  },
};

const DB_TOOLS = new Set([
  'inspect_database', 'inspect_xampp_mysql', 'mysql_list_databases',
  'mysql_describe_table', 'mysql_query', 'mysql_execute', 'generate_migration',
]);

const FS_TOOLS = new Set([
  'read_file', 'write_file', 'edit_file', 'create_file', 'create_folder',
  'delete_file', 'rename_file', 'list_files', 'list_directory', 'walk_project_files',
]);

const TERM_TOOLS = new Set(['run_terminal', 'install_package']);
const SEARCH_TOOLS = new Set(['search_code', 'search_project', 'grep', 'semantic_search']);
const GIT_TOOLS = new Set(['git_status', 'git_diff', 'git_commit', 'git_push', 'git_pull']);
const BUILD_TOOLS = new Set(['lint_project', 'build_project', 'test_project']);
const ANALYSIS_TOOLS = new Set(['analyze_project', 'refactor_files']);

export function toolCategory(toolName?: string): ToolCategory {
  if (!toolName) return 'general';
  if (DB_TOOLS.has(toolName)) return 'database';
  if (FS_TOOLS.has(toolName)) return 'filesystem';
  if (TERM_TOOLS.has(toolName)) return 'terminal';
  if (SEARCH_TOOLS.has(toolName)) return 'search';
  if (GIT_TOOLS.has(toolName)) return 'git';
  if (BUILD_TOOLS.has(toolName)) return 'build';
  if (ANALYSIS_TOOLS.has(toolName)) return 'analysis';
  return 'general';
}

export function categoryForPhase(phase: string): ToolCategory {
  if (phase === 'database') return 'database';
  if (phase.includes('database')) return 'database';
  if (phase.includes('terminal') || phase === 'running_terminal') return 'terminal';
  if (phase.includes('edit') || phase.includes('creat') || phase.includes('read')) return 'filesystem';
  if (phase.includes('analy')) return 'analysis';
  return 'general';
}

export function enterpriseStatusMessage(toolName: string, args: Record<string, unknown>): string {
  const cat = toolCategory(toolName);
  switch (cat) {
    case 'database':
      if (toolName === 'mysql_query' || toolName === 'mysql_execute') {
        return `Executing SQL on ${args.database || 'MySQL'}…`;
      }
      if (toolName === 'mysql_describe_table') {
        return `Analyzing table ${args.table || ''}…`;
      }
      if (toolName === 'mysql_list_databases') return 'Browsing MySQL databases…';
      if (toolName === 'inspect_xampp_mysql') return 'Connecting to XAMPP MySQL…';
      return 'Analyzing database configuration…';
    case 'filesystem':
      if (toolName === 'read_file') return `Reading ${String(args.path || 'file').split(/[/\\]/).pop()}…`;
      if (toolName === 'write_file' || toolName === 'edit_file') return `Updating ${String(args.path || 'file').split(/[/\\]/).pop()}…`;
      if (toolName === 'create_file') return `Creating ${String(args.path || 'file').split(/[/\\]/).pop()}…`;
      if (toolName === 'walk_project_files' || toolName === 'list_directory') return 'Browsing project structure…';
      return 'Working with project files…';
    case 'terminal':
      return `Running \`${String(args.command || 'command').slice(0, 60)}\`…`;
    case 'search':
      return `Searching for "${String(args.query || args.pattern || '').slice(0, 50)}"…`;
    case 'build':
      return 'Running build pipeline…';
    default:
      return `${toolName.replace(/_/g, ' ')}…`;
  }
}
