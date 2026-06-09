import OpenAI from 'openai';
import { getModeSystemPrompt, normalizeAgentMode } from './agent-modes';

/** Tool schemas sent to LLM — executed on the desktop client via Electron IPC. */
export const AGENT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read file contents. Always read before editing.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Project-relative or absolute path' },
          offset: { type: 'number', description: 'Start line (1-based)' },
          limit: { type: 'number', description: 'Max lines (default 500)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Overwrite entire file. Prefer edit_file for small changes.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string', description: 'Full new file content' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_file',
      description: 'Create a new file. Fails if exists.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Apply a targeted patch. Use SEARCH/REPLACE blocks or unified diff hunks. Read file first.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          patch: { type: 'string', description: 'Patch: <<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE or +/- diff lines' },
        },
        required: ['path', 'patch'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_folder',
      description: 'Create a directory (and parents).',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete a file. Destructive — use only when necessary.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rename_file',
      description: 'Rename or move a file within the project.',
      parameters: {
        type: 'object',
        properties: {
          old_path: { type: 'string' },
          new_path: { type: 'string' },
        },
        required: ['old_path', 'new_path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files and folders in a directory.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Directory path (default: project root)' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_code',
      description: 'Search for text/regex across the project (like ripgrep).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          path: { type: 'string', description: 'Optional subdirectory to limit search' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Alias for search_code — find pattern in codebase.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          path: { type: 'string' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_project',
      description: 'Analyze project structure, detect frameworks (Laravel, React, Next.js, Electron, Python), list key files.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'semantic_search',
      description: 'Meaning-based search over indexed codebase.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_terminal',
      description: 'Run shell command in project directory.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          cwd: { type: 'string' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'install_package',
      description: 'Install dependencies: npm install, composer install, pip install, etc.',
      parameters: {
        type: 'object',
        properties: {
          manager: { type: 'string', enum: ['npm', 'composer', 'pip', 'yarn', 'pnpm'] },
          packages: { type: 'string', description: 'Space-separated package names (optional)' },
        },
        required: ['manager'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lint_project',
      description: 'Run linter (npm run lint, php -l, eslint, etc.).',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Optional file or scope' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'build_project',
      description: 'Run project build (npm run build, composer, vite build).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'test_project',
      description: 'Run tests (npm test, phpunit, pytest).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_migration',
      description: 'Generate reversible DB migration file (Laravel PHP or SQL).',
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          action: { type: 'string', enum: ['create', 'alter'] },
          columns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                nullable: { type: 'boolean' },
                unique: { type: 'boolean' },
                default: { type: 'string' },
                references: { type: 'string' },
              },
            },
          },
          stack: { type: 'string', enum: ['laravel', 'php', 'auto'] },
        },
        required: ['table', 'action', 'columns'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_database_schema',
      description: 'Create new table via migration file (never drop live DB).',
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          columns: { type: 'array', items: { type: 'object' } },
        },
        required: ['table', 'columns'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'alter_database_schema',
      description: 'Alter table via migration file.',
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          columns: { type: 'array', items: { type: 'object' } },
        },
        required: ['table', 'columns'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'refactor_files',
      description: 'Plan multi-file refactor: list affected paths, read each, then edit_file per file.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          paths: { type: 'array', items: { type: 'string' } },
        },
        required: ['description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Git status (modified, staged, untracked).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_diff',
      description: 'Git diff for repo or file.',
      parameters: {
        type: 'object',
        properties: { file: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_commit',
      description: 'Stage changes (default: all) and commit with a clear message.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Commit message' },
          stage_all: { type: 'boolean', description: 'Stage all changed files (default true)' },
          files: { type: 'array', items: { type: 'string' }, description: 'Paths to stage when stage_all is false' },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_push',
      description: 'Push commits to origin. Requires user approval in desktop IDE.',
      parameters: {
        type: 'object',
        properties: { branch: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_pull',
      description: 'Pull latest from origin.',
      parameters: {
        type: 'object',
        properties: { branch: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inspect_database',
      description: 'Inspect DB schema/config: Prisma, docker-compose, migrations, .env.example (secrets masked). No live DB connection.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inspect_xampp_mysql',
      description: 'Probe XAMPP MySQL on Windows (127.0.0.1:3306): list DBs, read project .env DB config.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mysql_list_databases',
      description: 'List MySQL/MariaDB databases via XAMPP mysql CLI.',
      parameters: {
        type: 'object',
        properties: {
          user: { type: 'string' },
          password: { type: 'string' },
          host: { type: 'string' },
          port: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mysql_describe_table',
      description: 'DESCRIBE a MySQL table (columns, types).',
      parameters: {
        type: 'object',
        properties: {
          database: { type: 'string' },
          table: { type: 'string' },
          user: { type: 'string' },
          password: { type: 'string' },
        },
        required: ['database', 'table'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mysql_query',
      description: 'Run read-only SQL (SELECT, SHOW, DESCRIBE) against XAMPP MySQL.',
      parameters: {
        type: 'object',
        properties: {
          sql: { type: 'string' },
          database: { type: 'string' },
          user: { type: 'string' },
          password: { type: 'string' },
        },
        required: ['sql'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mysql_execute',
      description: 'Run SQL that changes data/schema (INSERT/UPDATE/DELETE/ALTER). Requires user approval.',
      parameters: {
        type: 'object',
        properties: {
          sql: { type: 'string' },
          database: { type: 'string' },
          user: { type: 'string' },
          password: { type: 'string' },
        },
        required: ['sql'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'walk_project_files',
      description: 'Paginated list of project files for systematic file-by-file review. Follow with read_file.',
      parameters: {
        type: 'object',
        properties: {
          offset: { type: 'number', description: 'Skip N files (pagination)' },
          max_files: { type: 'number', description: 'Max files to return (default 40, max 80)' },
          extension: { type: 'string', description: 'Filter by extension e.g. ts, php, py' },
        },
      },
    },
  },
];

export function getAgentSystemPrompt(context?: {
  repositoryPath?: string;
  workspaceFolders?: string[];
  currentFile?: string;
  currentFileContent?: string;
  openFiles?: string[];
  projectTree?: string;
  projectSummary?: string;
  selectedText?: string;
  semanticContext?: string;
  hasScreenshots?: boolean;
  screenshotAnalysis?: string;
  agentMode?: string;
}): string {
  let prompt = `You are Xander Agent — an enterprise-grade autonomous coding agent in a desktop IDE (OpenAI, Anthropic, Gemini routed by task).

YOUR JOB: Debug, build, refactor, and ship code by USING TOOLS — never only explain.

WORKFLOW (production):
1. analyze_project + inspect_database (if DB/API bugs) — map stacks and schema
2. walk_project_files (paginated) or search_code / grep / semantic_search — locate code
3. read_file — every path before editing; in deep mode review files systematically
4. edit_file (small) or write_file (new files only)
5. run_terminal / lint_project / build_project / test_project — verify fixes
6. generate_migration for schema changes — never DROP production data blindly
7. git_status → git_diff → git_commit (clear message) → git_push when user asked to ship

DEBUG & DB:
- inspect_database reads Prisma, docker-compose, migrations — use before DB fixes
- inspect_xampp_mysql / mysql_list_databases / mysql_describe_table / mysql_query for XAMPP (Windows localhost MySQL)
- mysql_execute for INSERT/UPDATE/ALTER (user approves in IDE)
- For PHP/Laravel samples: read .env, config/database.php, then query tables
- Support all languages in repo (TS, PHP, Python, Go, Rust, Java, etc.) — match conventions per stack

GIT:
- Always git_status before commit; summarize changes in commit message
- git_push only when the user wants changes published

RULES:
- NEVER say "you should change X" without calling a tool
- Prefer edit_file patches over blind write_file on existing files
- Path traversal outside project root is blocked
- Brief status before major steps

AGENT TASK MODES (user-selected in IDE):
- chat: read-only Q&A
- plan: analyze and output checklist plan — no edits
- build: full autonomous coding (default)
- debug: fix errors from terminal/logs
- refactor: safe multi-file improvements
- database: migrations, schema, SQL
- command: terminal commands with approval

SAFETY:
- Never print API keys, DB passwords, JWT secrets, or Stripe keys
- Mask secrets from .env in all responses
- Destructive commands and deletes require user approval in the IDE`;

  const mode = normalizeAgentMode(context?.agentMode);
  prompt += `\n\n${getModeSystemPrompt(mode)}`;
  prompt += `\n\nActive mode: ${mode}`;

  if (context?.hasScreenshots) {
    prompt += `

SCREENSHOT: quote exact errors, map to files, fix with tools, verify in terminal.`;
  }

  if (context?.screenshotAnalysis) {
    prompt += `\n\nScreenshot analysis:\n${context.screenshotAnalysis}`;
  }

  if (context?.repositoryPath) prompt += `\n\nProject root: ${context.repositoryPath}`;
  if (context?.projectSummary) prompt += `\n\n${context.projectSummary}`;
  if (context?.projectTree) prompt += `\n\nProject tree:\n${context.projectTree}`;
  if (context?.currentFile) prompt += `\n\nOpen file: ${context.currentFile}`;
  if (context?.currentFileContent) prompt += `\n\nOpen file content:\n${context.currentFileContent}`;
  if (context?.selectedText) prompt += `\n\nSelection:\n${context.selectedText}`;
  if (context?.semanticContext) prompt += `\n\nRelevant code:\n${context.semanticContext}`;
  if ((context as { mentionedFiles?: string })?.mentionedFiles) {
    prompt += `\n\n@mentioned files:\n${(context as { mentionedFiles?: string }).mentionedFiles}`;
  }

  return prompt;
}
