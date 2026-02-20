/**
 * DEALT/SLIDE - useApi Hook
 * React hook that wraps the ApiClient for use in components.
 * Provides loading states, error handling, and automatic retries.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  status: number | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useApi<T = any>(
  method: ApiMethod,
  path: string,
  options: {
    immediate?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
    transform?: (raw: any) => T;
  } = {}
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
    status: null,
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (body?: any): Promise<T | null> => {
      if (!mountedRef.current) return null;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await apiClient.request<T>(method, path, body);

        if (!mountedRef.current) return null;

        if (result.ok) {
          const data = options.transform ? options.transform(result.data) : result.data;
          setState({ data, loading: false, error: null, status: result.status });
          options.onSuccess?.(data);
          return data;
        } else {
          const error = result.error || 'Request failed';
          setState({ data: null, loading: false, error, status: result.status });
          options.onError?.(error);
          return null;
        }
      } catch (err: any) {
        if (!mountedRef.current) return null;
        const error = err.message || 'Unknown error';
        setState({ data: null, loading: false, error, status: 0 });
        options.onError?.(error);
        return null;
      }
    },
    [method, path]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null, status: null });
  }, []);

  // Auto-execute on mount for GET requests
  useEffect(() => {
    if (options.immediate && method === 'GET') {
      execute();
    }
  }, []);

  return { ...state, execute, reset };
}

// ─── Convenience Hooks ───────────────────────────────────────────────────────

export function useApiGet<T = any>(
  path: string,
  options: {
    immediate?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
    transform?: (raw: any) => T;
  } = {}
): UseApiReturn<T> {
  return useApi<T>('GET', path, options);
}

export function useApiPost<T = any>(
  path: string,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
    transform?: (raw: any) => T;
  } = {}
): UseApiReturn<T> {
  return useApi<T>('POST', path, options);
}

export function useApiPut<T = any>(
  path: string,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
  } = {}
): UseApiReturn<T> {
  return useApi<T>('PUT', path, options);
}

export function useApiDelete<T = any>(
  path: string,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
  } = {}
): UseApiReturn<T> {
  return useApi<T>('DELETE', path, options);
}
