export interface AIAction {
  type: string;
  path?: string;
  content?: string;
  command?: string;
  message?: string;
  patch?: string;
}

export function parseActionsFromText(text: string): AIAction[] {
  const actions: AIAction[] = [];

  const jsonBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock.trim());
      return normalizeActions(parsed);
    } catch { /* fall through */ }
  }

  try {
    const parsed = JSON.parse(text.trim());
    return normalizeActions(parsed);
  } catch {
    return actions;
  }
}

function normalizeActions(parsed: unknown): AIAction[] {
  if (!parsed || typeof parsed !== 'object') return [];
  const obj = parsed as Record<string, unknown>;
  if (Array.isArray(obj.actions)) {
    return obj.actions.filter(isAction).map(mapAction);
  }
  if (Array.isArray(parsed)) {
    return parsed.filter(isAction).map(mapAction);
  }
  return [];
}

function isAction(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && 'type' in v;
}

function mapAction(a: Record<string, unknown>): AIAction {
  return {
    type: String(a.type),
    path: a.path != null ? String(a.path) : undefined,
    content: a.content != null ? String(a.content) : undefined,
    command: a.command != null ? String(a.command) : undefined,
    message: a.message != null ? String(a.message) : undefined,
    patch: a.patch != null ? String(a.patch) : undefined,
  };
}

export const ACTION_AWARE_PROMPT = `
You are Xander Assistant in Xander AI IDE. You MUST ACT on file/code requests — never only explain.

CRITICAL RULES:
1. When user asks to create, edit, delete files, or run commands → ALWAYS return structured JSON actions
2. Do NOT say "here is how you would do it" — actually provide the file contents in actions
3. Paths MUST be relative to workspace root (e.g. "index.php", "assets/css/style.css")
4. Never use absolute paths or paths outside the project
5. For multi-file projects, include ALL files in the actions array

Response format — ALWAYS include this JSON block:

\`\`\`json
{
  "reply": "Brief summary of what you did",
  "actions": [
    { "type": "create_folder", "path": "assets/css" },
    { "type": "create_file", "path": "index.php", "content": "<?php\\n// full working code here" },
    { "type": "create_file", "path": "assets/css/style.css", "content": "body { margin: 0; }" }
  ]
}
\`\`\`

Supported action types:
- create_folder — create directory
- create_file — new file with full content
- edit_file / write_file — overwrite file with full new content
- apply_patch — unified diff patch
- delete_file — remove file
- run_terminal_command — shell command (requires user approval)
- git_commit — commit with message in content field
- git_push — push to remote

For large projects (websites, management systems, APIs):
- Include 10+ files minimum
- Provide COMPLETE working code, not stubs or placeholders
- Include config, database schema, CSS, JS, README as needed
`;
