const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('auth_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(`${this.baseURL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      let msg = `API Error: ${response.status}`;
      try {
        const j = await response.json();
        const raw = j.message ?? j.error;
        if (Array.isArray(raw)) msg = raw.join(', ');
        else if (typeof raw === 'string') msg = raw;
        else if (raw && typeof raw.message === 'string') msg = raw.message;
      } catch { /* ignore */ }
      if (response.status === 401) {
        msg = 'Sign in via Settings → General to use Xander Assistant.';
      } else if (response.status === 404 && endpoint.includes('/ai/agent')) {
        msg = 'Agent API not found. Rebuild and restart the backend:\ncd apps\\backend && npm run build && npm run dev';
      } else if (response.status >= 500 && msg === `API Error: ${response.status}`) {
        msg = 'Backend unavailable. Start the server on http://localhost:3001 and sign in.';
      }
      throw new Error(msg);
    }
    return response.json();
  }

  setToken(token: string) { this.token = token; localStorage.setItem('auth_token', token); }
  clearToken() { this.token = null; localStorage.removeItem('auth_token'); }
  getToken() { return this.token; }

  async login(email: string, password: string) {
    const result = await this.request<{ access_token: string; user: Record<string, unknown> }>(
      '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }
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

  async indexRepoChunks(rootPath: string, chunks: Array<{ path: string; content: string; chunkIndex?: number }>) {
    return this.request<{ success: boolean; chunksIndexed?: number }>(
      '/repo/index-chunks',
      { method: 'POST', body: JSON.stringify({ rootPath, chunks }) },
    );
  }

  async searchRepo(query: string, limit = 8) {
    return this.request<{ results: Array<{ path: string; content: string; score: number }> }>(
      '/repo/search',
      { method: 'POST', body: JSON.stringify({ query, limit }) },
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

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
