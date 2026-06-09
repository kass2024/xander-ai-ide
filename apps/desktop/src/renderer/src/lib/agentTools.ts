import { resolvePath } from './projectContext';
import { analyzeProject, formatAnalysisForAgent } from './projectAnalyzer';
import { inspectDatabase } from './inspectDatabase';
import {
  detectXamppConfig,
  describeMysqlTable,
  isReadOnlySql,
  listMysqlDatabases,
  runMysql,
} from './xamppDatabase';
import { applyPatch, snapshotBeforeEdit } from './patchUtils';
import {
  detectDbStack,
  generateLaravelMigration,
  generatePlainSqlMigration,
  parseMigrationArgs,
} from './databaseTools';
import apiClient from './api';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
  success: boolean;
}

function truncate(text: string, max = 12000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n... (truncated, ${text.length - max} chars omitted)`;
}

async function detectProjectStacks(projectPath: string): Promise<string[]> {
  try {
    const a = await analyzeProject(projectPath);
    return a.stacks;
  } catch {
    return [];
  }
}

export async function executeToolCall(
  toolCall: ToolCall,
  projectPath: string | null | undefined,
): Promise<ToolResult> {
  const api = window.electronAPI;
  let args: Record<string, unknown> = {};

  try {
    args = JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    return {
      tool_call_id: toolCall.id,
      content: 'Error: invalid tool arguments JSON',
      success: false,
    };
  }

  const name = toolCall.function.name;

  try {
    switch (name) {
      case 'read_file': {
        const filePath = resolvePath(projectPath, String(args.path || ''));
        const offset = Number(args.offset) || 1;
        const limit = Number(args.limit) || 500;
        const result = await api.readFile(filePath);
        if (!result.success) {
          return { tool_call_id: toolCall.id, content: `Error reading file: ${result.error}`, success: false };
        }
        const lines = (result.content || '').split('\n');
        const slice = lines.slice(Math.max(0, offset - 1), offset - 1 + limit);
        const numbered = slice.map((l, i) => `${offset + i}|${l}`).join('\n');
        return {
          tool_call_id: toolCall.id,
          content: truncate(`File: ${filePath} (${lines.length} lines total)\n${numbered}`),
          success: true,
        };
      }

      case 'write_file': {
        const rel = String(args.path || '');
        const filePath = resolvePath(projectPath, rel);
        const content = String(args.content ?? '');
        if (projectPath) {
          const read = await api.readFile(filePath);
          snapshotBeforeEdit(projectPath, rel, read.success ? (read.content || '') : '');
        }
        const result = await api.writeFile(filePath, content);
        if (!result.success) {
          return { tool_call_id: toolCall.id, content: `Error writing file: ${result.error}`, success: false };
        }
        return {
          tool_call_id: toolCall.id,
          content: `Successfully wrote ${content.length} bytes to ${rel}`,
          success: true,
        };
      }

      case 'edit_file': {
        const rel = String(args.path || '');
        const filePath = resolvePath(projectPath, rel);
        const patch = String(args.patch ?? '');
        const read = await api.readFile(filePath);
        if (!read.success) {
          return { tool_call_id: toolCall.id, content: `Cannot edit — read failed: ${read.error}`, success: false };
        }
        const original = read.content || '';
        if (projectPath) snapshotBeforeEdit(projectPath, rel, original);
        const patched = applyPatch(original, patch);
        const result = await api.writeFile(filePath, patched);
        if (!result.success) {
          return { tool_call_id: toolCall.id, content: `Error applying patch: ${result.error}`, success: false };
        }
        return {
          tool_call_id: toolCall.id,
          content: `Patched ${rel} (${original.length} → ${patched.length} bytes)`,
          success: true,
        };
      }

      case 'create_file': {
        const rel = String(args.path || '');
        const filePath = resolvePath(projectPath, rel);
        const content = String(args.content ?? '');
        if (projectPath) snapshotBeforeEdit(projectPath, rel, '');
        const result = await api.createFile(filePath, content);
        if (!result.success) {
          return { tool_call_id: toolCall.id, content: `Error creating file: ${result.error}`, success: false };
        }
        return {
          tool_call_id: toolCall.id,
          content: `Created file ${rel} (${content.length} bytes)`,
          success: true,
        };
      }

      case 'create_folder': {
        const dirPath = resolvePath(projectPath, String(args.path || ''));
        const result = await api.createFolder(dirPath);
        if (!result.success) {
          return { tool_call_id: toolCall.id, content: `Error creating folder: ${result.error}`, success: false };
        }
        return { tool_call_id: toolCall.id, content: `Created folder ${args.path}`, success: true };
      }

      case 'list_files':
      case 'list_directory': {
        const dirPath = resolvePath(projectPath, String(args.path || projectPath || '.'));
        const result = await api.listFiles(dirPath);
        if (!result.success) {
          return { tool_call_id: toolCall.id, content: `Error listing directory: ${result.error}`, success: false };
        }
        const listing = (result.files || [])
          .map((f) => `${f.isDirectory ? '[dir]  ' : '       '}${f.name}`)
          .join('\n');
        return {
          tool_call_id: toolCall.id,
          content: `${dirPath}:\n${listing || '(empty)'}`,
          success: true,
        };
      }

      case 'search_code':
      case 'search_project':
      case 'grep': {
        const query = String(args.query || args.pattern || '');
        if (!projectPath) {
          return { tool_call_id: toolCall.id, content: 'No project open', success: false };
        }
        const result = await api.searchInProject(projectPath, query);
        if (!result.success) {
          return { tool_call_id: toolCall.id, content: `Search error: ${result.error}`, success: false };
        }
        const hits = (result.results || [])
          .slice(0, 40)
          .map((r) => `${r.path} (${r.matches} matches)`)
          .join('\n');
        return {
          tool_call_id: toolCall.id,
          content: hits ? `Matches for "${query}":\n${hits}` : `No matches for "${query}"`,
          success: true,
        };
      }

      case 'analyze_project':
      case 'detect_stack': {
        if (!projectPath) {
          return { tool_call_id: toolCall.id, content: 'No project open', success: false };
        }
        const analysis = await analyzeProject(projectPath);
        return {
          tool_call_id: toolCall.id,
          content: truncate(formatAnalysisForAgent(analysis)),
          success: true,
        };
      }

      case 'get_terminal_cwd': {
        const ws = await api.getWorkspacePath();
        const cwd = projectPath || ws.path || '';
        return {
          tool_call_id: toolCall.id,
          content: JSON.stringify({ cwd, workspaceOpen: !!cwd }),
          success: !!cwd,
        };
      }

      case 'get_project_tree': {
        const dir = resolvePath(projectPath, String(args.path || '.'));
        const result = await api.listFiles(dir);
        if (!result.success) {
          return { tool_call_id: toolCall.id, content: `Error: ${result.error}`, success: false };
        }
        const tree = (result.files || [])
          .map((f) => (f.isDirectory ? `[dir] ${f.name}` : f.name))
          .join('\n');
        return { tool_call_id: toolCall.id, content: truncate(`Tree: ${dir}\n${tree}`), success: true };
      }

      case 'run_terminal':
      case 'lint_project':
      case 'build_project':
      case 'test_project': {
        let command = String(args.command || '');
        if (name === 'lint_project') {
          command = args.target
            ? `npm run lint -- ${args.target}`
            : 'npm run lint 2>/dev/null || npx eslint . 2>/dev/null || echo "No lint script"';
        } else if (name === 'build_project') {
          command = 'npm run build 2>/dev/null || composer build 2>/dev/null || npm run compile 2>/dev/null || echo "No build script"';
        } else if (name === 'test_project') {
          command = 'npm test 2>/dev/null || npm run test 2>/dev/null || php artisan test 2>/dev/null || pytest 2>/dev/null || echo "No test script"';
        }
        const cwd = args.cwd ? resolvePath(projectPath, String(args.cwd)) : projectPath || undefined;
        const result = await api.terminalCommand(command, cwd);
        const output = [
          `Command: ${command}`,
          `Exit code: ${result.exitCode ?? 'unknown'}`,
          result.stdout ? `STDOUT:\n${result.stdout}` : '',
          result.stderr ? `STDERR:\n${result.stderr}` : '',
          result.error ? `Error: ${result.error}` : '',
        ].filter(Boolean).join('\n');
        return {
          tool_call_id: toolCall.id,
          content: truncate(output),
          success: result.success && (result.exitCode === 0 || result.exitCode === undefined),
        };
      }

      case 'install_package': {
        const manager = String(args.manager || 'npm');
        const packages = args.packages ? String(args.packages) : '';
        let command = '';
        switch (manager) {
          case 'composer':
            command = packages ? `composer require ${packages}` : 'composer install';
            break;
          case 'pip':
            command = packages ? `pip install ${packages}` : 'pip install -r requirements.txt';
            break;
          case 'yarn':
            command = packages ? `yarn add ${packages}` : 'yarn install';
            break;
          case 'pnpm':
            command = packages ? `pnpm add ${packages}` : 'pnpm install';
            break;
          default:
            command = packages ? `npm install ${packages}` : 'npm install';
        }
        const result = await api.terminalCommand(command, projectPath || undefined);
        return {
          tool_call_id: toolCall.id,
          content: truncate(`Command: ${command}\nExit: ${result.exitCode}\n${result.stdout || ''}\n${result.stderr || ''}`),
          success: result.success && result.exitCode === 0,
        };
      }

      case 'delete_file': {
        const filePath = resolvePath(projectPath, String(args.path || ''));
        const result = await api.deleteFile(filePath);
        if (!result.success) {
          return { tool_call_id: toolCall.id, content: `Error deleting: ${result.error}`, success: false };
        }
        return { tool_call_id: toolCall.id, content: `Deleted ${args.path}`, success: true };
      }

      case 'rename_file': {
        const oldPath = resolvePath(projectPath, String(args.old_path || args.oldPath || ''));
        const newPath = resolvePath(projectPath, String(args.new_path || args.newPath || ''));
        const result = await api.renamePath(oldPath, newPath);
        if (!result.success) {
          return { tool_call_id: toolCall.id, content: `Rename error: ${result.error}`, success: false };
        }
        return {
          tool_call_id: toolCall.id,
          content: `Renamed ${args.old_path} → ${args.new_path}`,
          success: true,
        };
      }

      case 'generate_migration':
      case 'create_database_schema':
      case 'alter_database_schema': {
        if (!projectPath) {
          return { tool_call_id: toolCall.id, content: 'No project open', success: false };
        }
        const spec = parseMigrationArgs({
          ...args,
          action: name === 'alter_database_schema' ? 'alter' : (args.action || 'create'),
        });
        if (!spec) {
          return { tool_call_id: toolCall.id, content: 'Invalid migration spec (need table + columns)', success: false };
        }
        const stacks = await detectProjectStacks(projectPath);
        const stack = args.stack === 'laravel' || detectDbStack(stacks) === 'laravel'
          ? 'laravel'
          : detectDbStack(stacks);
        const gen =
          stack === 'laravel'
            ? generateLaravelMigration(spec)
            : generatePlainSqlMigration(spec);
        const parent = gen.filename.replace(/[/\\][^/\\]+$/, '');
        await api.createFolder(resolvePath(projectPath, parent));
        const full = resolvePath(projectPath, gen.filename);
        const result = await api.createFile(full, gen.up);
        if (!result.success) {
          const w = await api.writeFile(full, gen.up);
          if (!w.success) {
            return { tool_call_id: toolCall.id, content: `Failed to write migration: ${w.error}`, success: false };
          }
        }
        return {
          tool_call_id: toolCall.id,
          content: `Created migration ${gen.filename}\nDown (reversible):\n${gen.down.slice(0, 500)}`,
          success: true,
        };
      }

      case 'refactor_files': {
        const desc = String(args.description || '');
        const paths = Array.isArray(args.paths) ? args.paths.map(String) : [];
        return {
          tool_call_id: toolCall.id,
          content: `Refactor plan: ${desc}\nAffected files (${paths.length}): ${paths.join(', ') || '(discover via search_code)'}\nNext: read_file each path, then edit_file with patches.`,
          success: true,
        };
      }

      case 'semantic_search': {
        const query = String(args.query || '');
        const limit = Number(args.limit) || 8;
        if (!apiClient.getToken()) {
          return { tool_call_id: toolCall.id, content: 'Sign in to use semantic search', success: false };
        }
        try {
          const res = await apiClient.searchRepo(query, limit);
          const hits = (res.results || []).slice(0, limit);
          if (!hits.length) {
            return {
              tool_call_id: toolCall.id,
              content: `No semantic matches for "${query}". Try search_code or index the project.`,
              success: true,
            };
          }
          const formatted = hits
            .map((h) => `File: ${h.path}${h.score != null ? ` (score: ${h.score.toFixed(3)})` : ''}\n${h.content}`)
            .join('\n---\n');
          return { tool_call_id: toolCall.id, content: truncate(formatted), success: true };
        } catch (err) {
          return {
            tool_call_id: toolCall.id,
            content: `Semantic search error: ${err instanceof Error ? err.message : String(err)}`,
            success: false,
          };
        }
      }

      case 'git_status': {
        if (!projectPath) {
          return { tool_call_id: toolCall.id, content: 'No project open', success: false };
        }
        const result = await api.gitStatus(projectPath);
        if (!result.success) {
          return { tool_call_id: toolCall.id, content: `Git error: ${result.error}`, success: false };
        }
        return {
          tool_call_id: toolCall.id,
          content: truncate(JSON.stringify(result.status, null, 2)),
          success: true,
        };
      }

      case 'git_diff': {
        if (!projectPath) {
          return { tool_call_id: toolCall.id, content: 'No project open', success: false };
        }
        const file = args.file ? resolvePath(projectPath, String(args.file)) : undefined;
        const result = await api.gitDiff(projectPath, file);
        if (!result.success) {
          return { tool_call_id: toolCall.id, content: `Git diff error: ${result.error}`, success: false };
        }
        return {
          tool_call_id: toolCall.id,
          content: truncate(result.diff || '(no diff)'),
          success: true,
        };
      }

      case 'git_commit': {
        if (!projectPath) {
          return { tool_call_id: toolCall.id, content: 'No project open', success: false };
        }
        const message = String(args.message || 'chore: agent changes');
        if (args.stage_all !== false) {
          const st = await api.gitStatus(projectPath);
          if (st.success && st.status?.files?.length) {
            const paths = st.status.files.map((f: { path: string }) => f.path);
            await api.gitAdd(projectPath, paths);
          } else {
            await api.gitAdd(projectPath, ['.']);
          }
        } else if (Array.isArray(args.files) && args.files.length) {
          await api.gitAdd(projectPath, args.files.map(String));
        }
        const result = await api.gitCommit(projectPath, message);
        if (!result.success) {
          return { tool_call_id: toolCall.id, content: `Git commit failed: ${result.error}`, success: false };
        }
        return {
          tool_call_id: toolCall.id,
          content: `Committed: ${message}`,
          success: true,
        };
      }

      case 'git_push': {
        if (!projectPath) {
          return { tool_call_id: toolCall.id, content: 'No project open', success: false };
        }
        const branch = args.branch ? String(args.branch) : undefined;
        const result = await api.gitPush(projectPath, branch);
        if (!result.success) {
          return { tool_call_id: toolCall.id, content: `Git push failed: ${result.error}`, success: false };
        }
        return {
          tool_call_id: toolCall.id,
          content: `Pushed to origin${branch ? ` (${branch})` : ''}`,
          success: true,
        };
      }

      case 'git_pull': {
        if (!projectPath) {
          return { tool_call_id: toolCall.id, content: 'No project open', success: false };
        }
        const branch = args.branch ? String(args.branch) : undefined;
        const result = await api.gitPull(projectPath, branch);
        if (!result.success) {
          return { tool_call_id: toolCall.id, content: `Git pull failed: ${result.error}`, success: false };
        }
        return {
          tool_call_id: toolCall.id,
          content: `Pulled from origin${branch ? ` (${branch})` : ''}`,
          success: true,
        };
      }

      case 'inspect_database': {
        if (!projectPath) {
          return { tool_call_id: toolCall.id, content: 'No project open', success: false };
        }
        const report = await inspectDatabase(projectPath);
        return {
          tool_call_id: toolCall.id,
          content: truncate(report),
          success: true,
        };
      }

      case 'inspect_xampp_mysql': {
        const report = await detectXamppConfig(projectPath || undefined);
        return {
          tool_call_id: toolCall.id,
          content: truncate(report),
          success: true,
        };
      }

      case 'mysql_list_databases': {
        const opts = {
          user: args.user ? String(args.user) : 'root',
          password: args.password ? String(args.password) : '',
          host: args.host ? String(args.host) : '127.0.0.1',
          port: args.port ? Number(args.port) : 3306,
        };
        const out = await listMysqlDatabases(opts);
        return {
          tool_call_id: toolCall.id,
          content: truncate(out),
          success: !out.toLowerCase().includes('error'),
        };
      }

      case 'mysql_describe_table': {
        const database = String(args.database || '');
        const table = String(args.table || '');
        if (!database || !table) {
          return { tool_call_id: toolCall.id, content: 'Need database and table', success: false };
        }
        const opts = {
          user: args.user ? String(args.user) : 'root',
          password: args.password ? String(args.password) : '',
          host: args.host ? String(args.host) : '127.0.0.1',
        };
        const out = await describeMysqlTable(database, table, opts);
        return {
          tool_call_id: toolCall.id,
          content: truncate(out),
          success: true,
        };
      }

      case 'mysql_query':
      case 'mysql_execute': {
        const sql = String(args.sql || args.query || '');
        if (!sql.trim()) {
          return { tool_call_id: toolCall.id, content: 'Empty SQL', success: false };
        }
        const opts = {
          database: args.database ? String(args.database) : undefined,
          user: args.user ? String(args.user) : 'root',
          password: args.password ? String(args.password) : '',
          host: args.host ? String(args.host) : '127.0.0.1',
          port: args.port ? Number(args.port) : 3306,
        };
        if (name === 'mysql_query' && !isReadOnlySql(sql)) {
          return {
            tool_call_id: toolCall.id,
            content: 'mysql_query is read-only (SELECT/SHOW/DESCRIBE). Use mysql_execute for writes.',
            success: false,
          };
        }
        const result = await runMysql(sql, opts);
        return {
          tool_call_id: toolCall.id,
          content: truncate(result.output),
          success: result.success,
        };
      }

      case 'walk_project_files': {
        if (!projectPath) {
          return { tool_call_id: toolCall.id, content: 'No project open', success: false };
        }
        const offset = Math.max(0, Number(args.offset) || 0);
        const maxFiles = Math.min(80, Math.max(1, Number(args.max_files) || 40));
        const extFilter = args.extension ? String(args.extension).toLowerCase().replace(/^\./, '') : '';
        const walk = await api.walkProjectFiles(projectPath);
        if (!walk.success || !walk.files) {
          return { tool_call_id: toolCall.id, content: 'Could not walk project', success: false };
        }
        let files = walk.files.filter((f) => !f.isDirectory);
        if (extFilter) {
          files = files.filter((f) => f.name.toLowerCase().endsWith(`.${extFilter}`));
        }
        const total = files.length;
        const slice = files.slice(offset, offset + maxFiles);
        const listing = slice.map((f) => f.path.replace(/\\/g, '/')).join('\n');
        return {
          tool_call_id: toolCall.id,
          content: `Total matching files: ${total}\nShowing ${offset + 1}-${offset + slice.length}:\n${listing || '(none)'}\n\nUse read_file on paths for deep inspection. Next page: offset=${offset + maxFiles}`,
          success: true,
        };
      }

      default:
        return {
          tool_call_id: toolCall.id,
          content: `Unknown tool: ${name}`,
          success: false,
        };
    }
  } catch (err) {
    return {
      tool_call_id: toolCall.id,
      content: `Tool execution error: ${err instanceof Error ? err.message : String(err)}`,
      success: false,
    };
  }
}

/** Tools that run without user approval */
export const AUTO_TOOLS = new Set([
  'read_file',
  'list_files',
  'list_directory',
  'search_code',
  'search_project',
  'grep',
  'semantic_search',
  'analyze_project',
  'inspect_database',
  'inspect_xampp_mysql',
  'mysql_list_databases',
  'mysql_describe_table',
  'mysql_query',
  'walk_project_files',
  'git_status',
  'git_diff',
  'create_file',
  'write_file',
  'edit_file',
  'create_folder',
  'generate_migration',
  'create_database_schema',
  'alter_database_schema',
  'refactor_files',
  'install_package',
  'lint_project',
  'build_project',
  'test_project',
]);

export const APPROVAL_TOOLS = new Set([
  'delete_file',
  'run_terminal',
  'rename_file',
  'git_commit',
  'git_push',
  'git_pull',
  'mysql_execute',
]);
