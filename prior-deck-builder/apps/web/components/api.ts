export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'x-user-id': 'dev-user',
};

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...DEFAULT_HEADERS,
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed');
  }
  return payload as T;
}
