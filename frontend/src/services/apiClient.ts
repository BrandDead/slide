/**
 * DEALT/SLIDE - Advanced API Client
 * Handles authentication, retry logic, request queuing, and offline support.
 * Wraps fetch with interceptors for JWT token management.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApiClientConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

interface ApiResponse<T = any> {
  data: T;
  status: number;
  ok: boolean;
  error?: string;
}

interface QueuedRequest {
  id: string;
  method: string;
  url: string;
  body?: any;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  retryCount: number;
  timestamp: number;
}

type TokenRefreshCallback = () => Promise<string | null>;

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ApiClientConfig = {
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 15000,
  maxRetries: 3,
  retryDelay: 1000,
};

// ─── Token Storage ───────────────────────────────────────────────────────────

const TOKEN_KEY = 'dealt-slide-access-token';
const REFRESH_KEY = 'dealt-slide-refresh-token';

function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_KEY, token);
}

function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ─── API Client Class ────────────────────────────────────────────────────────

class ApiClient {
  private config: ApiClientConfig;
  private queue: QueuedRequest[] = [];
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];
  private onTokenRefresh: TokenRefreshCallback | null = null;
  private onAuthFailure: (() => void) | null = null;

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── Configuration ─────────────────────────────────────────────────────

  setTokenRefreshCallback(cb: TokenRefreshCallback): void {
    this.onTokenRefresh = cb;
  }

  setAuthFailureCallback(cb: () => void): void {
    this.onAuthFailure = cb;
  }

  // ─── Core Request Method ───────────────────────────────────────────────

  async request<T = any>(
    method: string,
    path: string,
    body?: any,
    options: { skipAuth?: boolean; retryCount?: number } = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${path}`;
    const retryCount = options.retryCount ?? 0;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Attach auth token
    if (!options.skipAuth) {
      const token = getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        credentials: 'include',
      });

      clearTimeout(timeoutId);

      // Handle 401 - attempt token refresh
      if (response.status === 401 && !options.skipAuth) {
        return this.handle401<T>(method, path, body);
      }

      // Parse response
      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        return {
          data: data as T,
          status: response.status,
          ok: false,
          error: data?.error || data?.message || `HTTP ${response.status}`,
        };
      }

      return { data: data as T, status: response.status, ok: true };

    } catch (error: any) {
      // Retry on network errors
      if (retryCount < this.config.maxRetries && this.isRetryable(error)) {
        await this.delay(this.config.retryDelay * (retryCount + 1));
        return this.request<T>(method, path, body, {
          ...options,
          retryCount: retryCount + 1,
        });
      }

      // Queue for offline
      if (error.name === 'TypeError' && !navigator.onLine) {
        return this.queueRequest<T>(method, path, body);
      }

      return {
        data: null as any,
        status: 0,
        ok: false,
        error: error.message || 'Network error',
      };
    }
  }

  // ─── HTTP Method Shortcuts ─────────────────────────────────────────────

  get<T = any>(path: string, skipAuth = false): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, { skipAuth });
  }

  post<T = any>(path: string, body?: any, skipAuth = false): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body, { skipAuth });
  }

  put<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body);
  }

  delete<T = any>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path);
  }

  // ─── Auth Methods ──────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<ApiResponse<{
    user: any;
    access_token: string;
    refresh_token: string;
  }>> {
    const result = await this.post('/api/auth/login', { email, password }, true);
    if (result.ok && result.data) {
      setAccessToken(result.data.access_token);
      setRefreshToken(result.data.refresh_token);
    }
    return result;
  }

  async register(email: string, password: string, username: string): Promise<ApiResponse<{
    user: any;
    access_token: string;
    refresh_token: string;
  }>> {
    const result = await this.post('/api/auth/register', { email, password, username }, true);
    if (result.ok && result.data) {
      setAccessToken(result.data.access_token);
      setRefreshToken(result.data.refresh_token);
    }
    return result;
  }

  async logout(): Promise<void> {
    await this.post('/api/auth/logout');
    clearTokens();
    this.onAuthFailure?.();
  }

  async getMe(): Promise<ApiResponse<{ user: any }>> {
    return this.get('/api/auth/me');
  }

  // ─── Token Refresh ─────────────────────────────────────────────────────

  private async handle401<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<ApiResponse<T>> {
    if (this.isRefreshing) {
      // Wait for the current refresh to complete
      return new Promise((resolve) => {
        this.refreshSubscribers.push((newToken: string) => {
          resolve(this.request<T>(method, path, body));
        });
      });
    }

    this.isRefreshing = true;

    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const refreshResult = await this.post<{ access_token: string }>(
        '/api/auth/refresh',
        { refresh_token: refreshToken },
        true
      );

      if (refreshResult.ok && refreshResult.data?.access_token) {
        setAccessToken(refreshResult.data.access_token);

        // Notify all waiting requests
        this.refreshSubscribers.forEach((cb) => cb(refreshResult.data.access_token));
        this.refreshSubscribers = [];

        // Retry the original request
        return this.request<T>(method, path, body);
      } else {
        throw new Error('Refresh failed');
      }
    } catch (error) {
      clearTokens();
      this.onAuthFailure?.();
      return {
        data: null as any,
        status: 401,
        ok: false,
        error: 'Authentication expired. Please log in again.',
      };
    } finally {
      this.isRefreshing = false;
    }
  }

  // ─── Offline Queue ─────────────────────────────────────────────────────

  private queueRequest<T>(method: string, url: string, body?: any): Promise<ApiResponse<T>> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        id: Date.now().toString(),
        method,
        url,
        body,
        resolve,
        reject,
        retryCount: 0,
        timestamp: Date.now(),
      });
    });
  }

  async flushQueue(): Promise<void> {
    const pending = [...this.queue];
    this.queue = [];

    for (const req of pending) {
      try {
        const result = await this.request(req.method, req.url, req.body);
        req.resolve(result);
      } catch (error) {
        req.reject(error);
      }
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private isRetryable(error: any): boolean {
    if (error.name === 'AbortError') return true; // timeout
    if (error.name === 'TypeError') return true;  // network error
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────────

export const apiClient = new ApiClient();

// Listen for online event to flush queue
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (apiClient.getQueueSize() > 0) {
      console.log(`[ApiClient] Back online — flushing ${apiClient.getQueueSize()} queued requests`);
      apiClient.flushQueue();
    }
  });
}

// Re-export token helpers for use in stores
export { getAccessToken, setAccessToken, clearTokens };
