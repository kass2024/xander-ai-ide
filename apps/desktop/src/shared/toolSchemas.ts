import { z } from 'zod';

export const ReadFileSchema = z.object({
  path: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

export const WriteFileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export const EditFileSchema = z.object({
  path: z.string(),
  patch: z.string(),
});

export const CreateFileSchema = z.object({
  path: z.string(),
  content: z.string().optional(),
});

export const DeleteFileSchema = z.object({
  path: z.string(),
});

export const ListDirectorySchema = z.object({
  path: z.string().optional(),
});

export const SearchProjectSchema = z.object({
  query: z.string(),
});

export const RunTerminalSchema = z.object({
  command: z.string(),
  title: z.string().optional(),
});

export const GitStatusSchema = z.object({});

export const GitDiffSchema = z.object({
  file: z.string().optional(),
});

export const DbQuerySchema = z.object({
  sql: z.string(),
});

export const DbMigrationPreviewSchema = z.object({
  sql: z.string(),
  description: z.string().optional(),
});

export const InstallPackageSchema = z.object({
  package: z.string(),
  dev: z.boolean().optional(),
});

export const BuildProjectSchema = z.object({
  command: z.string().optional(),
});

export const TOOL_SCHEMAS: Record<string, z.ZodType> = {
  read_file: ReadFileSchema,
  write_file: WriteFileSchema,
  edit_file: EditFileSchema,
  create_file: CreateFileSchema,
  delete_file: DeleteFileSchema,
  list_directory: ListDirectorySchema,
  list_files: ListDirectorySchema,
  search_project: SearchProjectSchema,
  run_terminal: RunTerminalSchema,
  git_status: GitStatusSchema,
  git_diff: GitDiffSchema,
  db_query: DbQuerySchema,
  mysql_query: DbQuerySchema,
  db_migration_preview: DbMigrationPreviewSchema,
  mysql_execute: DbMigrationPreviewSchema,
  install_package: InstallPackageSchema,
  build_project: BuildProjectSchema,
};

/** Tools that always require user approval before execution */
export const APPROVAL_REQUIRED_TOOLS = new Set([
  'write_file',
  'edit_file',
  'create_file',
  'delete_file',
  'run_terminal',
  'git_commit',
  'git_push',
  'git_pull',
  'git_init',
  'install_package',
  'build_project',
  'test_project',
  'lint_project',
  'mysql_execute',
  'db_migration_preview',
  'rename_file',
]);

/** Safe read-only tools */
export const AUTO_APPROVE_TOOLS = new Set([
  'read_file',
  'list_directory',
  'list_files',
  'search_project',
  'search_code',
  'grep',
  'semantic_search',
  'git_status',
  'git_diff',
  'db_query',
  'mysql_query',
  'mysql_list_databases',
  'mysql_describe_table',
  'analyze_project',
  'inspect_database',
  'walk_project_files',
]);

export function parseToolArgs<T>(toolName: string, argsJson: string): T | null {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) {
    try {
      return JSON.parse(argsJson || '{}') as T;
    } catch {
      return null;
    }
  }
  try {
    return schema.parse(JSON.parse(argsJson || '{}')) as T;
  } catch {
    return null;
  }
}

export function getToolRiskLevel(toolName: string, args: Record<string, unknown>): 'low' | 'medium' | 'high' {
  if (toolName === 'delete_file') return 'high';
  if (toolName === 'run_terminal' || toolName === 'mysql_execute') {
    const cmd = String(args.command || args.sql || '');
    if (/\b(rm|del|drop|format|shutdown|reboot|diskpart|mkfs)\b/i.test(cmd)) return 'high';
    if (/\b(npm install|git push|git reset|chmod)\b/i.test(cmd)) return 'medium';
    return 'medium';
  }
  if (toolName === 'git_push' || toolName === 'git_commit') return 'medium';
  if (toolName === 'write_file' || toolName === 'edit_file' || toolName === 'create_file') return 'low';
  if (toolName === 'install_package' || toolName === 'build_project') return 'medium';
  return 'low';
}
