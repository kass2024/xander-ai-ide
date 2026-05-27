const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(url, { ...options, headers });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = Array.isArray(body.message)
        ? body.message.join(', ')
        : body.message || body.error || `API Error: ${response.status}`;
      throw new Error(message);
    }

    return body as T;
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') localStorage.removeItem('auth_token');
  }

  getToken() {
    return this.token;
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{
      access_token: string;
      user: { id: string; email: string; fullName?: string; role?: string; avatar?: string };
    }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  }

  async register(email: string, password: string, fullName?: string) {
    return this.request<{ access_token: string; user: Record<string, unknown> }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password, fullName }) },
    );
  }

  async getMe() {
    return this.request<Record<string, unknown>>('/auth/me');
  }

  async refreshToken() {
    return this.request<{ access_token: string }>('/auth/refresh', { method: 'POST' });
  }

  // Users
  async getProfile() {
    return this.request<Record<string, unknown>>('/users/me');
  }

  async updateProfile(data: { fullName?: string; avatar?: string }) {
    return this.request('/users/me', { method: 'PATCH', body: JSON.stringify(data) });
  }

  async getAnalytics(period?: string) {
    const query = period ? `?period=${period}` : '';
    return this.request<Record<string, unknown>>(`/users/me/analytics${query}`);
  }

  async getContributions(period?: string) {
    const query = period ? `?period=${period}` : '';
    return this.request<Array<{ date: string; count: number; level: number }>>(
      `/users/me/contributions${query}`,
    );
  }

  async getNotifications() {
    return this.request<{ notifications: Array<Record<string, unknown>>; unreadCount: number }>(
      '/users/me/notifications',
    );
  }

  async markNotificationAsRead(notificationId: string) {
    return this.request(`/users/me/notifications/${notificationId}/read`, { method: 'PATCH' });
  }

  async getSettings() {
    return this.request<Record<string, unknown>>('/users/me/settings');
  }

  async updateSettings(data: Record<string, unknown>) {
    return this.request('/users/me/settings', { method: 'PATCH', body: JSON.stringify(data) });
  }

  async getUserUsage() {
    return this.request('/users/me/usage');
  }

  // Billing
  async getUsage<T = Record<string, unknown>>(period?: string) {
    const query = period ? `?period=${period}` : '';
    return this.request<T>(`/billing/usage${query}`);
  }

  async purchaseUsage(amount: number) {
    return this.request<{ success: boolean; checkoutUrl?: string; message?: string }>(
      '/billing/purchase-usage',
      { method: 'POST', body: JSON.stringify({ amount }) },
    );
  }

  async updateAutoRecharge(enabled: boolean, threshold?: number, amount?: number) {
    return this.request<{
      success: boolean;
      autoRecharge: { enabled: boolean; threshold: number; amount: number };
    }>('/billing/auto-recharge', {
      method: 'PUT',
      body: JSON.stringify({ enabled, threshold, amount }),
    });
  }

  async getCreditHistory(page = 1, limit = 10, type?: string) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (type) params.append('type', type);
    return this.request<{
      transactions: Array<{
        id: string;
        type: string;
        amount: number;
        balance: number;
        description: string;
        date: string;
      }>;
      pagination: { page: number; limit: number; total: number; pages: number };
      currentBalance: number;
    }>(`/billing/credit-history?${params}`);
  }

  async getCurrentSubscription() {
    return this.request<Record<string, unknown>>('/billing/subscription');
  }

  async getAvailablePlans() {
    return this.request('/billing/plans');
  }

  async updateSubscription(data: { planId: string; interval?: string }) {
    return this.request<{ checkoutUrl?: string; requiresPayment?: boolean }>(
      '/billing/subscription',
      { method: 'PUT', body: JSON.stringify(data) },
    );
  }

  async createCheckoutSession(planId: string, interval?: string) {
    return this.request<{ url: string }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId, interval }),
    });
  }

  async createPortalSession() {
    return this.request<{ url: string }>('/billing/portal', { method: 'POST' });
  }

  async confirmCheckout(sessionId: string) {
    return this.request<Record<string, unknown>>('/billing/confirm-checkout', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  async syncBilling() {
    return this.request<Record<string, unknown>>('/billing/sync', { method: 'POST' });
  }

  async cancelSubscription() {
    return this.request('/billing/subscription', { method: 'DELETE' });
  }

  async getInvoices(page = 1) {
    return this.request(`/billing/invoices?page=${page}`);
  }

  async getBillingAnalytics(period?: string) {
    const query = period ? `?period=${period}` : '';
    return this.request(`/billing/analytics${query}`);
  }

  // Admin
  async getAdminUsers(page = 1, limit = 50) {
    return this.request<{ users: Array<Record<string, unknown>>; pagination: Record<string, number> }>(
      `/admin/users?page=${page}&limit=${limit}`,
    );
  }

  async getAdminUsage(period = 'month') {
    return this.request(`/admin/usage?period=${period}`);
  }

  async getAdminSubscriptions(page = 1, limit = 50) {
    return this.request(`/admin/subscriptions?page=${page}&limit=${limit}`);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
