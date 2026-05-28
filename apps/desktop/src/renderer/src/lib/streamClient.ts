export type GenerationStep =
  | 'idle'
  | 'planning'
  | 'creating_folders'
  | 'writing'
  | 'running_command'
  | 'fixing'
  | 'completed'
  | 'error'
  | 'cancelled';

export type FileGenerationStatus = 'pending' | 'generating' | 'complete' | 'error' | 'applied' | 'rejected';

export interface GeneratedFile {
  path: string;
  content: string;
  originalContent?: string;
  status: FileGenerationStatus;
  language?: string;
  size?: number;
  error?: string;
}

export interface GenerationPlan {
  title?: string;
  description?: string;
  fileCount?: number;
  folders?: string[];
  files?: Array<{ path: string; description?: string }>;
}

export interface StreamEvent {
  type: string;
  step?: string;
  message?: string;
  path?: string;
  delta?: string;
  content?: string;
  originalContent?: string;
  size?: number;
  language?: string;
  command?: string;
  requiresApproval?: boolean;
  plan?: GenerationPlan;
  summary?: {
    title?: string;
    filesGenerated?: number;
    totalFiles?: number;
    tokens?: number;
    cost?: number;
  };
  action?: {
    type: string;
    path?: string;
    content?: string;
    command?: string;
  };
  quota?: {
    used: number;
    limit: number;
    warning?: boolean;
    warningMessage?: string;
  };
}

export type StreamEventHandler = (event: StreamEvent) => void;

import { getApiBaseUrl } from './apiConfig';

const BUILD_ENDPOINTS = ['/ai/build', '/ai/builder', '/ai/project/build', '/ai/composer/stream'];

function formatStreamError(status: number, raw: string, endpoint: string): string {
  if (status === 404 || raw.includes('Cannot POST')) {
    return `Backend missing Project Builder API (${endpoint}). Restart backend:\ncd apps\\backend && pnpm build && pnpm dev`;
  }
  if (status === 401) return 'Not signed in. Open Settings → General and sign in.';
  if (status === 400) return raw || 'Bad request — open a project folder in the IDE first (File → Open Folder).';
  if (status >= 500) return `Backend error (${status}). Ensure PostgreSQL is running and restart the backend.`;
  return raw || `Request failed (${status})`;
}

export class StreamClient {
  private abortController: AbortController | null = null;

  async stream(
    endpoint: string,
    body: Record<string, unknown>,
    onEvent: StreamEventHandler,
  ): Promise<void> {
    this.abortController = new AbortController();
    const token = localStorage.getItem('auth_token');

    const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      let msg = `API Error: ${response.status}`;
      try {
        const j = await response.json();
        const raw = j.message ?? j.error;
        msg = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.join(', ') : msg;
      } catch { /* ignore */ }
      throw new Error(formatStreamError(response.status, msg, endpoint));
    }

    await this.consumeSSE(response, onEvent);
  }

  /** Try multiple build endpoints until one works (handles outdated backends). */
  async streamBuild(
    body: Record<string, unknown>,
    onEvent: StreamEventHandler,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (const endpoint of BUILD_ENDPOINTS) {
      try {
        await this.stream(endpoint, body, onEvent);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const msg = lastError.message;
        if (msg.includes('404') || msg.includes('Cannot POST') || msg.includes('missing Project Builder')) {
          continue;
        }
        throw lastError;
      }
    }

    throw lastError || new Error('Project Builder unavailable. Restart backend: cd apps\\backend && pnpm build && pnpm dev');
  }

  async checkBackend(): Promise<{
    ok: boolean;
    projectBuilder: boolean;
    message: string;
    providers?: { openai: boolean; anthropic: boolean; google: boolean };
    agentClaude?: boolean;
  }> {
    try {
      const health = await fetch(`${getApiBaseUrl()}/health`);
      if (!health.ok) {
        return { ok: false, projectBuilder: false, message: `Backend offline at ${getApiBaseUrl()}` };
      }
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${getApiBaseUrl()}/ai/capabilities`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        return {
          ok: true,
          projectBuilder: !!data.projectBuilder,
          providers: data.providers,
          message: 'Connected',
        };
      }
      if (res.status === 401) {
        return { ok: true, projectBuilder: false, message: 'Sign in via Settings' };
      }
      if (res.status === 404) {
        return { ok: true, projectBuilder: false, message: 'Backend outdated — run: pnpm build && pnpm dev' };
      }
      return { ok: false, projectBuilder: false, message: `Backend error ${res.status}` };
    } catch {
      return { ok: false, projectBuilder: false, message: `Backend offline at ${getApiBaseUrl()}` };
    }
  }

  private async consumeSSE(response: Response, onEvent: StreamEventHandler): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            onEvent(JSON.parse(line.slice(6)) as StreamEvent);
          } catch { /* skip */ }
        }
      }
    }

    if (buffer.startsWith('data: ')) {
      try {
        onEvent(JSON.parse(buffer.slice(6)) as StreamEvent);
      } catch { /* skip */ }
    }
  }

  cancel(): void {
    this.abortController?.abort();
    this.abortController = null;
  }
}

export const streamClient = new StreamClient();

export function isLargeProjectPrompt(prompt: string): boolean {
  const keywords = [
    'create', 'build', 'generate', 'full', 'complete', 'entire',
    'management system', 'website', 'application', 'project', 'shop',
    'saas', 'api', 'backend', 'frontend', 'multi-page', 'laravel', 'stock',
  ];
  const lower = prompt.toLowerCase();
  return (keywords.some((k) => lower.includes(k)) && prompt.length > 40) || lower.includes('sample project');
}
