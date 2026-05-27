import OpenAI from 'openai';

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
  let prompt = `You are Xander Agent — a Cursor-class autonomous coding agent in a desktop IDE.

YOUR JOB: Fix bugs, build features, refactor, and edit code by USING TOOLS — never only explain.

WORKFLOW:
1. analyze_project or list_files — understand structure
2. search_code / grep / semantic_search — find relevant code
3. read_file — inspect before every edit
4. edit_file (small changes) or write_file (new/full rewrite)
5. run_terminal / lint_project / build_project / test_project — verify
6. generate_migration for DB changes — never destroy live databases

RULES:
- NEVER say "you should change X" without calling a tool
- Prefer edit_file patches over blind write_file on existing files
- Use generate_migration / create_database_schema for DB — not raw DROP
- For Laravel: migrations in database/migrations, update models/controllers/routes/views
- Path traversal outside project root is blocked
- Brief status messages before major steps (like Cursor activity cards)

MODES:
- standard: balanced
- fast: minimal reads, quick fixes
- deep: read more files, thorough analysis
- refactor: multi-file, use refactor_files then edit each file`;

  if (context?.agentMode) {
    prompt += `\n\nActive mode: ${context.agentMode}`;
  }

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

  return prompt;
}
