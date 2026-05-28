import { spawn } from 'child_process';
import { readFile, writeFile, mkdir, unlink, readdir } from 'fs/promises';
import { dirname, join } from 'path';
import simpleGit from 'simple-git';
import { validateCommand } from '../security/commandPolicy';
import { resolveInWorkspace, getWorkspacePath } from '../workspace';
import { logToolExecution } from '../agent/database';
import type { ToolResult } from '../../shared/types';

export interface ExecuteToolOptions {
  toolName: string;
  args: Record<string, unknown>;
  workspacePath: string;
  sessionId?: string;
}

function resolvePath(workspacePath: string, relPath: string): string {
  if (/^[A-Za-z]:[\\/]/.test(relPath) || relPath.startsWith('/')) {
    return resolveInWorkspace(relPath, workspacePath);
  }
  const sep = workspacePath.includes('\\') ? '\\' : '/';
  return `${workspacePath}${workspacePath.endsWith(sep) ? '' : sep}${relPath.replace(/\//g, sep)}`;
}

export async function executeToolSecure(opts: ExecuteToolOptions): Promise<ToolResult> {
  const { toolName, args, workspacePath, sessionId } = opts;
  const toolCallId = `tool_${Date.now()}`;

  try {
    let result: ToolResult;

    switch (toolName) {
      case 'read_file': {
        const filePath = resolvePath(workspacePath, String(args.path || ''));
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const offset = Number(args.offset) || 1;
        const limit = Number(args.limit) || 500;
        const slice = lines.slice(Math.max(0, offset - 1), offset - 1 + limit);
        const numbered = slice.map((l, i) => `${offset + i}|${l}`).join('\n');
        result = {
          tool_call_id: toolCallId,
          content: `File: ${args.path} (${lines.length} lines)\n${numbered}`,
          success: true,
        };
        break;
      }

      case 'write_file':
      case 'create_file': {
        const rel = String(args.path || '');
        const filePath = resolvePath(workspacePath, rel);
        await mkdir(dirname(filePath), { recursive: true });
        const content = String(args.content ?? '');
        await writeFile(filePath, content, 'utf-8');
        result = { tool_call_id: toolCallId, content: `Wrote ${content.length} bytes to ${rel}`, success: true };
        break;
      }

      case 'delete_file': {
        const filePath = resolvePath(workspacePath, String(args.path || ''));
        await unlink(filePath);
        result = { tool_call_id: toolCallId, content: `Deleted ${args.path}`, success: true };
        break;
      }

      case 'list_directory':
      case 'list_files': {
        const dirPath = resolvePath(workspacePath, String(args.path || workspacePath));
        const items = await readdir(dirPath, { withFileTypes: true });
        const listing = items
          .filter((i) => !i.name.startsWith('.') && !['node_modules', '.git'].includes(i.name))
          .map((i) => `${i.isDirectory() ? '[dir]' : '[file]'} ${i.name}`)
          .join('\n');
        result = { tool_call_id: toolCallId, content: listing || '(empty)', success: true };
        break;
      }

      case 'run_terminal':
      case 'build_project':
      case 'install_package': {
        let command = String(args.command || '');
        if (toolName === 'install_package') {
          const pkg = String(args.package || '');
          command = args.dev ? `npm install -D ${pkg}` : `npm install ${pkg}`;
        } else if (toolName === 'build_project' && !command) {
          command = 'npm run build';
        }
        const check = validateCommand(command);
        if (!check.allowed) {
          result = { tool_call_id: toolCallId, content: check.reason || 'Blocked', success: false };
          break;
        }
        const execResult = await runShellCommand(command, workspacePath);
        result = {
          tool_call_id: toolCallId,
          content: execResult.stdout + (execResult.stderr ? `\nSTDERR:\n${execResult.stderr}` : ''),
          success: execResult.success,
          stdout: execResult.stdout,
          stderr: execResult.stderr,
          exitCode: execResult.exitCode,
        };
        break;
      }

      case 'git_status': {
        const git = simpleGit(workspacePath);
        const status = await git.status();
        result = {
          tool_call_id: toolCallId,
          content: JSON.stringify({ branch: status.current, files: status.files }, null, 2),
          success: true,
        };
        break;
      }

      case 'git_diff': {
        const git = simpleGit(workspacePath);
        const diff = args.file ? await git.diff([String(args.file)]) : await git.diff();
        result = { tool_call_id: toolCallId, content: diff || '(no changes)', success: true };
        break;
      }

      case 'db_query':
      case 'db_migration_preview': {
        result = {
          tool_call_id: toolCallId,
          content: `SQL preview (not executed in main): ${String(args.sql || '').slice(0, 2000)}`,
          success: true,
        };
        break;
      }

      default:
        result = { tool_call_id: toolCallId, content: `Unknown tool: ${toolName}`, success: false };
    }

    logToolExecution({
      sessionId,
      toolName,
      arguments: JSON.stringify(args),
      result: result.content.slice(0, 4000),
      success: result.success,
      workspacePath,
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logToolExecution({
      sessionId,
      toolName,
      arguments: JSON.stringify(args),
      result: message,
      success: false,
      workspacePath,
    });
    return { tool_call_id: toolCallId, content: `Error: ${message}`, success: false };
  }
}

async function runShellCommand(
  command: string,
  cwd: string,
): Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn(command, [], { cwd, shell: true, env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      resolve({ success: code === 0, stdout, stderr, exitCode: code ?? 1 });
    });
    child.on('error', (error) => {
      resolve({ success: false, stdout, stderr: stderr || error.message, exitCode: 1 });
    });
  });
}

export function getActiveWorkspace(): string | null {
  return getWorkspacePath();
}
