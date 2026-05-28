import { join } from 'path';
import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import type {
  AgentMessageRecord,
  AgentSessionRecord,
  ApprovalRecord,
  FileChangeRecord,
  ToolCallRecord,
  WorkspaceSettings,
} from '../../shared/types';

type Database = import('better-sqlite3').Database;

let db: Database | null = null;
let memoryFallback = false;

interface MemoryStore {
  sessions: AgentSessionRecord[];
  messages: AgentMessageRecord[];
  toolCalls: ToolCallRecord[];
  approvals: ApprovalRecord[];
  fileChanges: FileChangeRecord[];
  workspaceSettings: Record<string, WorkspaceSettings>;
  toolLog: Array<Record<string, unknown>>;
}

const mem: MemoryStore = {
  sessions: [],
  messages: [],
  toolCalls: [],
  approvals: [],
  fileChanges: [],
  workspaceSettings: {},
  toolLog: [],
};

function getDbPath(): string {
  const dir = join(app.getPath('userData'), 'agent-data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'agent.db');
}

function getJsonFallbackPath(): string {
  const dir = join(app.getPath('userData'), 'agent-data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'agent-fallback.json');
}

function loadJsonFallback(): void {
  try {
    const raw = readFileSync(getJsonFallbackPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<MemoryStore>;
    Object.assign(mem, {
      sessions: parsed.sessions ?? [],
      messages: parsed.messages ?? [],
      toolCalls: parsed.toolCalls ?? [],
      approvals: parsed.approvals ?? [],
      fileChanges: parsed.fileChanges ?? [],
      workspaceSettings: parsed.workspaceSettings ?? {},
      toolLog: parsed.toolLog ?? [],
    });
  } catch { /* first run */ }
}

function saveJsonFallback(): void {
  writeFileSync(getJsonFallbackPath(), JSON.stringify(mem, null, 2), 'utf-8');
}

export function initAgentDatabase(): Database | null {
  if (db) return db;
  if (memoryFallback) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    db = new Database(getDbPath());
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT 'auto',
        provider TEXT NOT NULL DEFAULT 'auto',
        project_path TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        status TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tool_calls (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        arguments TEXT NOT NULL,
        result TEXT,
        success INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS approval_decisions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        decision TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS file_changes (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        old_text TEXT NOT NULL,
        new_text TEXT NOT NULL,
        accepted INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspace_settings (
        workspace_path TEXT PRIMARY KEY,
        always_allow_tools TEXT NOT NULL DEFAULT '[]',
        model TEXT,
        provider TEXT
      );
      CREATE TABLE IF NOT EXISTS tool_execution_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        tool_name TEXT NOT NULL,
        arguments TEXT,
        result TEXT,
        success INTEGER,
        workspace_path TEXT,
        created_at TEXT NOT NULL
      );
    `);
    return db;
  } catch (err) {
    console.warn('[agent-db] better-sqlite3 unavailable, using JSON fallback:', (err as Error).message);
    memoryFallback = true;
    loadJsonFallback();
    return null;
  }
}

export function closeAgentDatabase(): void {
  db?.close();
  db = null;
}

export function listSessions(includeArchived = false): AgentSessionRecord[] {
  initAgentDatabase();
  if (memoryFallback) {
    return mem.sessions.filter((s) => includeArchived || !s.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const rows = db!
    .prepare(`SELECT * FROM sessions ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY updated_at DESC`)
    .all() as Array<Record<string, unknown>>;
  return rows.map(rowToSession);
}

export function upsertSession(session: AgentSessionRecord): void {
  initAgentDatabase();
  if (memoryFallback) {
    const idx = mem.sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) mem.sessions[idx] = session;
    else mem.sessions.unshift(session);
    saveJsonFallback();
    return;
  }
  db!.prepare(
    `INSERT INTO sessions (id, title, model, provider, project_path, archived, status, created_at, updated_at)
     VALUES (@id, @title, @model, @provider, @projectPath, @archived, @status, @createdAt, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, model=excluded.model, provider=excluded.provider,
       project_path=excluded.project_path, archived=excluded.archived, status=excluded.status, updated_at=excluded.updated_at`,
  ).run({
    id: session.id,
    title: session.title,
    model: session.model,
    provider: session.provider,
    projectPath: session.projectPath ?? null,
    archived: session.archived ? 1 : 0,
    status: session.status ?? null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
}

export function saveMessage(msg: AgentMessageRecord): void {
  initAgentDatabase();
  if (memoryFallback) {
    mem.messages.push(msg);
    saveJsonFallback();
    return;
  }
  db!.prepare(
    `INSERT OR REPLACE INTO messages (id, session_id, role, content, created_at) VALUES (@id, @sessionId, @role, @content, @createdAt)`,
  ).run(msg);
}

export function getMessages(sessionId: string): AgentMessageRecord[] {
  initAgentDatabase();
  if (memoryFallback) {
    return mem.messages.filter((m) => m.sessionId === sessionId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const rows = db!.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    sessionId: String(r.session_id),
    role: r.role as AgentMessageRecord['role'],
    content: String(r.content),
    createdAt: String(r.created_at),
  }));
}

export function saveToolCall(record: ToolCallRecord): void {
  initAgentDatabase();
  if (memoryFallback) {
    mem.toolCalls.push(record);
    saveJsonFallback();
    return;
  }
  db!.prepare(
    `INSERT OR REPLACE INTO tool_calls (id, session_id, tool_name, arguments, result, success, created_at)
     VALUES (@id, @sessionId, @toolName, @arguments, @result, @success, @createdAt)`,
  ).run({
    id: record.id,
    sessionId: record.sessionId,
    toolName: record.toolName,
    arguments: record.arguments,
    result: record.result ?? null,
    success: record.success == null ? null : record.success ? 1 : 0,
    createdAt: record.createdAt,
  });
}

export function saveApproval(record: ApprovalRecord): void {
  initAgentDatabase();
  if (memoryFallback) {
    mem.approvals.push(record);
    saveJsonFallback();
    return;
  }
  db!.prepare(
    `INSERT INTO approval_decisions (id, session_id, tool_name, decision, created_at) VALUES (@id, @sessionId, @toolName, @decision, @createdAt)`,
  ).run(record);
}

export function saveFileChange(record: FileChangeRecord): void {
  initAgentDatabase();
  if (memoryFallback) {
    mem.fileChanges.push(record);
    saveJsonFallback();
    return;
  }
  db!.prepare(
    `INSERT OR REPLACE INTO file_changes (id, session_id, file_path, old_text, new_text, accepted, created_at)
     VALUES (@id, @sessionId, @filePath, @oldText, @newText, @accepted, @createdAt)`,
  ).run({
    id: record.id,
    sessionId: record.sessionId,
    filePath: record.filePath,
    oldText: record.oldText,
    newText: record.newText,
    accepted: record.accepted ? 1 : 0,
    createdAt: record.createdAt,
  });
}

export function getWorkspaceSettings(workspacePath: string): WorkspaceSettings {
  initAgentDatabase();
  if (memoryFallback) {
    return mem.workspaceSettings[workspacePath] ?? { workspacePath, alwaysAllowTools: [] };
  }
  const row = db!.prepare('SELECT * FROM workspace_settings WHERE workspace_path = ?').get(workspacePath) as Record<string, unknown> | undefined;
  if (!row) return { workspacePath, alwaysAllowTools: [] };
  let alwaysAllowTools: string[] = [];
  try {
    alwaysAllowTools = JSON.parse(String(row.always_allow_tools || '[]'));
  } catch { /* empty */ }
  return {
    workspacePath,
    alwaysAllowTools,
    model: row.model ? String(row.model) : undefined,
    provider: row.provider ? (String(row.provider) as WorkspaceSettings['provider']) : undefined,
  };
}

export function saveWorkspaceSettings(settings: WorkspaceSettings): void {
  initAgentDatabase();
  if (memoryFallback) {
    mem.workspaceSettings[settings.workspacePath] = settings;
    saveJsonFallback();
    return;
  }
  db!.prepare(
    `INSERT INTO workspace_settings (workspace_path, always_allow_tools, model, provider)
     VALUES (@workspacePath, @alwaysAllowTools, @model, @provider)
     ON CONFLICT(workspace_path) DO UPDATE SET always_allow_tools=excluded.always_allow_tools, model=excluded.model, provider=excluded.provider`,
  ).run({
    workspacePath: settings.workspacePath,
    alwaysAllowTools: JSON.stringify(settings.alwaysAllowTools),
    model: settings.model ?? null,
    provider: settings.provider ?? null,
  });
}

export function logToolExecution(entry: {
  sessionId?: string;
  toolName: string;
  arguments?: string;
  result?: string;
  success?: boolean;
  workspacePath?: string;
}): void {
  initAgentDatabase();
  const row = { ...entry, createdAt: new Date().toISOString() };
  if (memoryFallback) {
    mem.toolLog.push(row);
    if (mem.toolLog.length > 5000) mem.toolLog.shift();
    saveJsonFallback();
    return;
  }
  db!.prepare(
    `INSERT INTO tool_execution_log (session_id, tool_name, arguments, result, success, workspace_path, created_at)
     VALUES (@sessionId, @toolName, @arguments, @result, @success, @workspacePath, @createdAt)`,
  ).run({
    sessionId: entry.sessionId ?? null,
    toolName: entry.toolName,
    arguments: entry.arguments ?? null,
    result: entry.result ?? null,
    success: entry.success == null ? null : entry.success ? 1 : 0,
    workspacePath: entry.workspacePath ?? null,
    createdAt: row.createdAt,
  });
}

function rowToSession(row: Record<string, unknown>): AgentSessionRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    model: String(row.model),
    provider: String(row.provider) as AgentSessionRecord['provider'],
    projectPath: row.project_path ? String(row.project_path) : undefined,
    archived: Boolean(row.archived),
    status: row.status ? String(row.status) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
