import { Platform } from 'react-native';

import { authClient } from './auth-client';
import { API_URL } from './config';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: { field?: string; missing?: string[] } & Record<string, unknown> = {},
  ) {
    super(message);
  }
}

type ApiInit = Omit<RequestInit, 'body'> & { json?: unknown; body?: BodyInit };

/** Fetch wrapper for SOON API routes. Attaches the session cookie on native. */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const h = new Headers(headers);
  if (json !== undefined) h.set('Content-Type', 'application/json');
  if (Platform.OS !== 'web') {
    const cookie = await authClient.getCookie();
    if (cookie) h.set('Cookie', cookie);
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: h,
    credentials: 'include',
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    const data = ((await res.json().catch(() => null)) ?? {}) as { error?: string } & Record<string, unknown>;
    throw new ApiError(res.status, data.error ?? res.statusText, data);
  }
  return (await res.json()) as T;
}

/** A user-facing Hebrew message for any thrown error. */
export function errorMessage(err: unknown, fallback = 'משהו השתבש. נסו שוב.') {
  if (err instanceof ApiError) {
    // Server messages in Hebrew are user-facing; English ones are developer-facing.
    return /[֐-׿]/.test(err.message) ? err.message : fallback;
  }
  return fallback;
}
