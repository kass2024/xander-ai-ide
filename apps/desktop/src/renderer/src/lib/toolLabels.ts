/** Human-readable labels for agent tools (Cursor-style timeline). */

const TOOL_TITLES: Record<string, string> = {
  read_file: 'Read file',
  write_file: 'Write file',
  edit_file: 'Edit file',
  create_file: 'Create file',
  create_folder: 'Create folder',
  delete_file: 'Delete file',
  rename_file: 'Rename file',
  list_files: 'List directory',
  list_directory: 'List directory',
  search_code: 'Search codebase',
  search_project: 'Search project',
  grep: 'Grep',
  semantic_search: 'Semantic search',
  analyze_project: 'Analyze project',
  walk_project_files: 'Browse project files',
  inspect_database: 'Inspect database config',
  inspect_xampp_mysql: 'Inspect XAMPP MySQL',
  mysql_list_databases: 'List MySQL databases',
  mysql_describe_table: 'Describe table',
  mysql_query: 'SQL query (read-only)',
  mysql_execute: 'SQL execute',
  run_terminal: 'Run terminal command',
  lint_project: 'Lint project',
  build_project: 'Build project',
  test_project: 'Run tests',
  install_package: 'Install packages',
  generate_migration: 'Generate migration',
  git_status: 'Git status',
  git_diff: 'Git diff',
  git_commit: 'Git commit',
  git_push: 'Git push',
  git_pull: 'Git pull',
  refactor_files: 'Plan refactor',
};

export function toolTitle(name: string): string {
  return TOOL_TITLES[name] || name.replace(/_/g, ' ');
}

export function toolStepDetail(
  name: string,
  args: Record<string, unknown>,
): string | undefined {
  if (args.path) return String(args.path);
  if (args.command) return String(args.command);
  if (args.query || args.pattern) return String(args.query || args.pattern).slice(0, 120);
  if (args.message) return String(args.message).slice(0, 120);
  if (args.database && args.table) return `${args.database}.${args.table}`;
  if (args.sql) return String(args.sql).slice(0, 160);
  if (name === 'analyze_project' || name === 'inspect_xampp_mysql') return undefined;
  return undefined;
}
