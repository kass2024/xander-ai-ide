# Xander AI IDE — Agent Architecture

Production autonomous coding agent (Cursor/Windsurf-class) for the Electron desktop IDE.

## Stack

| Layer | Technology |
|-------|------------|
| Desktop | Electron + React + Monaco + xterm |
| Backend API | NestJS @ `https://api.xanderai.online` |
| LLMs | OpenAI, Anthropic Claude, Google Gemini |
| Local tools | Electron IPC (files, terminal, git, MySQL) |

## Agent Loop

```
User prompt → buildRichContext() → POST /ai/agent/step
  → LLM returns tool_calls OR final answer
  → Desktop executes tools (with approval if required)
  → Tool JSON results (secrets masked) appended to messages
  → Repeat until stop / max steps / cancel
  → Summary + changed files + Undo All
```

## Task Modes

Defined in `apps/desktop/src/shared/agentModes.ts` (mirrored in `apps/backend/src/ai/agent-modes.ts`):

| Mode | Purpose | Tools |
|------|---------|-------|
| **chat** | Q&A, explanations | Read/search only |
| **plan** | Step-by-step plan checklist | Read/search only |
| **build** | Create/edit files (default) | All tools |
| **debug** | Fix errors from terminal/logs | All + auto re-run on failure |
| **refactor** | Safe multi-file refactors | All (Claude-routed) |
| **database** | Migrations, schema, SQL | DB + file tools |
| **command** | Shell commands with approval | Read + terminal |

Select mode in the Agent panel toolbar (next to model picker).

## Key Files

| File | Role |
|------|------|
| `apps/desktop/src/renderer/src/lib/agentRunner.ts` | Main agent loop |
| `apps/desktop/src/renderer/src/lib/agentTools.ts` | Tool execution (~30 tools) |
| `apps/desktop/src/shared/toolSchemas.ts` | Approval policy + Zod schemas |
| `apps/desktop/src/shared/agentModes.ts` | Mode config |
| `apps/desktop/src/renderer/src/lib/projectContext.ts` | Repo context + `@file` mentions |
| `apps/desktop/src/renderer/src/lib/projectAnalyzer.ts` | Framework detection |
| `apps/desktop/src/renderer/src/lib/secretMasking.ts` | Redact API keys/passwords |
| `apps/backend/src/ai/agent.tools.ts` | LLM tool schemas + system prompt |
| `apps/backend/src/ai/multi-model.service.ts` | Provider routing + fallback |
| `apps/desktop/src/renderer/src/components/agent/AgentInteractivePanel.tsx` | Agent UI |

## Tools (structured JSON)

- **Files:** `read_file`, `write_file`, `edit_file`, `create_file`, `create_folder`, `delete_file`, `rename_file`
- **Search:** `search_code`, `grep`, `semantic_search`, `walk_project_files`
- **Project:** `analyze_project`
- **Terminal:** `run_terminal`, `lint_project`, `build_project`, `test_project`, `install_package`
- **Git:** `git_status`, `git_diff`, `git_commit`, `git_push`, `git_pull`
- **Database:** `inspect_database`, `inspect_xampp_mysql`, `mysql_*`, `generate_migration`

## Approval System

- **Auto-allow:** reads, search, git status/diff, read-only SQL
- **Requires approval:** writes, deletes, terminal, installs, migrations, git push/commit
- UI: `ApprovalCard.tsx` — Run / Skip / Allow Always
- Dangerous commands blocked in `commandPolicy.ts` (rm -rf, DROP DATABASE, git reset --hard)

## Provider Routing

| Mode | Primary provider |
|------|------------------|
| chat, build, debug, command | OpenAI |
| plan, refactor, database | Claude |
| Fallback chain | configured in `multi-model.service.ts` |

Override via model picker or `agentPreferencesStore.selectedProvider`.

## Run Locally

```bash
# Backend
cd apps/backend && cp .env.example .env   # add API keys
npm install && npm run start:dev

# Desktop
cd apps/desktop && npm install && npm run dev

# Production .exe
cd apps/desktop && npm run dist:win
```

## Configure API Keys

**Local backend:** `apps/backend/.env`  
**Live server:** `/opt/xander-ai-ide/.env.production`

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

Desktop app uses live API by default (`apiConfig.ts` → `https://api.xanderai.online`). Sign in via Settings → General.

## Test the Agent

1. Open a project folder (File → Open Folder)
2. Select **Build** mode
3. Prompt: `Analyze this project and list the main stack`
4. Prompt: `Fix any TypeScript errors and run npm build`
5. Switch to **Plan** mode: `Create a plan to add user authentication`
6. Switch to **Database** mode: `Inspect MySQL schema for users table`
7. Verify approval cards appear for `run_terminal` and file writes
8. Use **Undo All** after edits to revert session changes

## Security

- Secrets masked before LLM context (`secretMasking.ts`, `inspectDatabase.ts`)
- Workspace path boundary (`pathSecurity.ts`, `workspace.ts`)
- No hardcoded project paths — user picks workspace per session
- DB passwords never echoed in chat

## Roadmap (next iterations)

- Streaming agent steps (`/ai/agent/stream`)
- Unified main-process tool executor
- MCP tool integration
- Per-file diff review before apply
- Agent debug mode ↔ IDE debugger bridge
