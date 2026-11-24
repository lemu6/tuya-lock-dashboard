import { LockCommandResult, LockLogsResponse, LockStatus } from '../types/lock';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '';

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Erro HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload as T;
}

export const lockApi = {
  getStatus(): Promise<LockStatus> {
    return requestJson<LockStatus>('/api/lock/status');
  },

  getLogs(limit = 20): Promise<LockLogsResponse> {
    return requestJson<LockLogsResponse>(`/api/lock/logs?limit=${limit}`);
  },

  unlock(actor = 'Operador Dashboard'): Promise<LockCommandResult> {
    return requestJson<LockCommandResult>('/api/lock/unlock', {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
  },

  lock(actor = 'Operador Dashboard'): Promise<LockCommandResult> {
    return requestJson<LockCommandResult>('/api/lock/lock', {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
  },
};
