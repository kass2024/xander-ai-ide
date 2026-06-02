import { getApiBaseUrl } from './apiConfig';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly invalidateSession: boolean,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function shouldInvalidateSession(status: number, message: string): boolean {
  if (status !== 401) return false;
  const m = message.toLowerCase();
  if (m.includes('quota') || m.includes('subscription') || m.includes('credits')) {
    return false;
  }
  if (m.includes('invalid credentials') || m.includes('deactivated')) return false;
  return (
    m.includes('unauthorized') ||
    m.includes('jwt') ||
    m.includes('token') ||
    m.includes('session') ||
    m.includes('expired') ||
    m === 'api error: 401'
  );
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.syncTokenFromStorage();
  }

  syncTokenFromStorage(): void {
    this.token = localStorage.getItem('auth_token');
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  setBaseURL(url: string): void {
    this.baseURL = url.replace(/\/$/, '');
  }

  syncBaseURL(): void {
    this.setBaseURL(getApiBaseUrl());
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, retried = false): Promise<T> {
    this.syncTokenFromStorage();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}${endpoint}`, { ...options, headers });
    } catch {
      throw new Error(
        `Cannot reach Xander cloud at ${this.baseURL}. Check internet and https://api.xanderai.online/health`,
      );
    }
    if (!response.ok) {
      let msg = `API Error: ${response.status}`;
      try {
        const j = await response.json();
        const raw = j.message ?? j.error;
        if (Array.isArray(raw)) msg = raw.join(', ');
        else if (typeof raw === 'string') msg = raw;
        else if (raw && typeof raw.message === 'string') msg = raw.message;
      } catch { /* ignore */ }

      if (
        response.status === 401 &&
        !retried &&
        this.token &&
        !endpoint.startsWith('/auth/login') &&
        !endpoint.startsWith('/auth/refresh')
      ) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) return this.request(endpoint, options, true);
      }

      if (response.status === 404 && endpoint.includes('/ai/agent')) {
        msg = 'Agent API not found. Rebuild and restart the backend:\ncd apps\\backend && npm run build && npm run dev';
      } else if (response.status >= 500 && msg === `API Error: ${response.status}`) {
        msg = `Xander cloud unavailable at ${this.baseURL}. Try again in a moment.`;
      }

      const invalidate = shouldInvalidateSession(response.status, msg);
      throw new ApiError(msg, response.status, invalidate);
    }
    return response.json();
  }

  /** Refresh JWT without logging the user out (keeps desktop session alive). */
  async tryRefreshToken(): Promise<boolean> {
    this.syncTokenFromStorage();
    if (!this.token) return false;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      };
      const res = await fetch(`${this.baseURL}/auth/refresh`, { method: 'POST', headers });
      if (!res.ok) return false;
      const data = (await res.json()) as { access_token?: string };
      if (data.access_token) {
        this.setToken(data.access_token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }
  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('xander_user_cache');
  }
  getToken() {
    this.syncTokenFromStorage();
    return this.token;
  }
  hasValidToken(): boolean {
    return !!this.getToken();
  }

  async login(email: string, password: string) {
    const result = await this.request<{ access_token: string; user: Record<string, unknown> }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      },
    );
    this.setToken(result.access_token);
    return result;
  }

  async getProfile() { return this.request<Record<string, unknown>>('/auth/me'); }
  async getCurrentSubscription() { return this.request<Subscription>('/billing/subscription'); }
  async getAvailablePlans() { return this.request<Plan[]>('/billing/plans'); }
  async getUsage(period?: string) {
    return this.request<UsageData>(`/billing/usage${period ? `?period=${period}` : ''}`);
  }
  async updateSubscription(planId: string, interval?: string) {
    return this.request<{ checkoutUrl?: string; requiresPayment?: boolean; plan?: Subscription }>(
      '/billing/subscription',
      { method: 'PUT', body: JSON.stringify({ planId, interval }) },
    );
  }
  async createCheckoutSession(planId: string, interval?: string) {
    return this.request<{ url: string }>('/billing/checkout', {
      method: 'POST', body: JSON.stringify({ planId, interval }),
    });
  }
  async createPortalSession() {
    return this.request<{ url: string }>('/billing/portal', { method: 'POST' });
  }
  async syncBilling() {
    return this.request<Subscription>('/billing/sync', { method: 'POST' });
  }
  async cancelSubscription() {
    return this.request<Subscription>('/billing/subscription', { method: 'DELETE' });
  }

  async aiChat(message: string, context?: Record<string, unknown>, model?: string) {
    return this.request<{ id: string; content: string; tokens: number; cost: number }>(
      '/ai/chat',
      { method: 'POST', body: JSON.stringify({ message, context, model }) }
    );
  }

  async aiAgent(prompt: string, context?: Record<string, unknown>, model?: string) {
    return this.request<{ id: string; content: string; tokens: number; cost: number }>(
      '/ai/agent',
      { method: 'POST', body: JSON.stringify({ prompt, context, model }) },
    );
  }

  async aiAgentStep(body: {
    messages: Array<{
      role: string;
      content?: string | null;
      tool_call_id?: string;
      tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
    }>;
    context?: Record<string, unknown>;
    model?: string;
    conversationId?: string;
  }) {
    return this.request<{
      conversationId: string;
      message: {
        role: string;
        content?: string | null;
        tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
      };
      finishReason: 'stop' | 'tool_calls' | 'length';
      tokens: number;
      cost: number;
      provider?: string;
      model?: string;
      screenshotAnalysis?: string;
    }>('/ai/agent/step', { method: 'POST', body: JSON.stringify(body) });
  }

  async aiAnalyzeScreenshot(body: {
    images: Array<{ mediaType: string; data: string }>;
    prompt?: string;
  }) {
    return this.request<{ analysis: string; provider: string; model: string }>(
      '/ai/agent/analyze-screenshot',
      { method: 'POST', body: JSON.stringify(body) },
    );
  }

  async indexRepoChunks(
    rootPath: string,
    chunks: Array<{ path: string; content: string; chunkIndex?: number }>,
    options?: { userRequested?: boolean },
  ) {
    return this.request<{ success: boolean; chunksIndexed?: number }>(
      '/repo/index-chunks',
      {
        method: 'POST',
        body: JSON.stringify({ rootPath, chunks, userRequested: options?.userRequested ?? true }),
      },
    );
  }

  async searchRepo(query: string, limit = 8) {
    return this.request<{ results: Array<{ path: string; content: string; score: number }> }>(
      '/repo/search',
      { method: 'POST', body: JSON.stringify({ query, limit, userRequested: true }) },
    );
  }

  async repoHealth() {
    return this.request<{ qdrant: boolean }>('/repo/health', { method: 'POST' });
  }

  async aiComposer(instruction: string, files: Array<{ path: string; content: string }>, model?: string) {
    return this.request<{ changes?: Array<{ path: string; content: string; originalContent?: string }> }>(
      '/ai/composer',
      { method: 'POST', body: JSON.stringify({ instruction, files, model }) },
    );
  }

  async aiAutocomplete(params: {
    prefix: string;
    suffix: string;
    filename: string;
    language: string;
    maxTokens?: number;
    userRequested?: boolean;
  }) {
    return this.request<{ completion: string }>(
      '/ai/autocomplete',
      { method: 'POST', body: JSON.stringify(params) },
    );
  }

  async getModels() {
    return this.request<{ models: Array<{ id: string; name: string; description: string; tier?: string }> }>('/ai/models');
  }

  async aiBuildProject(
    instruction: string,
    context: Record<string, unknown>,
    model?: string,
    onEvent?: (event: Record<string, unknown>) => void,
  ): Promise<void> {
    return this.streamRequest('/ai/build', { instruction, context, model }, onEvent);
  }

  async aiComposerStream(
    instruction: string,
    files: Array<{ path: string; content: string }>,
    model?: string,
    onEvent?: (event: Record<string, unknown>) => void,
  ): Promise<void> {
    return this.streamRequest('/ai/composer/stream', { instruction, files, model }, onEvent);
  }

  async aiChatStream(
    message: string,
    context?: Record<string, unknown>,
    model?: string,
    onEvent?: (event: Record<string, unknown>) => void,
  ): Promise<void> {
    return this.streamRequest('/ai/stream', { message, context, model }, onEvent);
  }

  private async streamRequest(
    endpoint: string,
    body: Record<string, unknown>,
    onEvent?: (event: Record<string, unknown>) => void,
  ): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let msg = `API Error: ${response.status}`;
      try {
        const j = await response.json();
        msg = j.message || msg;
      } catch { /* ignore */ }
      throw new Error(msg);
    }

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
            const event = JSON.parse(line.slice(6));
            onEvent?.(event);
          } catch { /* skip */ }
        }
      }
    }
  }
}

export interface Plan {
  id: string; name: string; price: number; interval: string;
  features: string[]; limits: { tokens: string; requests: string; models: string; support: string };
  popular?: boolean;
}
export interface Subscription {
  id: string; plan: { id?: string; name: string; price: number; interval: string };
  status: string; currentPeriodStart: string; currentPeriodEnd: string; isPaid?: boolean;
}
export interface UsageData {
  totalUsage: { tokensUsed: number; requests: number; cost: number };
  limits: { tokens: number; requests: number; cost: number };
  quota?: { daily: { used: number; limit: number }; weekly: { used: number; limit: number } };
}

export const apiClient = new ApiClient(getApiBaseUrl());

export function configureApiClient(): string {
  const url = getApiBaseUrl();
  apiClient.setBaseURL(url);
  return url;
}

export default apiClient;
