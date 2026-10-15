import type { Comment, Photo, User } from './types';

const TOKEN_KEY = 'galeria_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);

  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...options, headers });

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // respuesta sin cuerpo JSON
    }
    throw new ApiError(message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  register: (username: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  login: (username: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: () => request<{ user: User }>('/api/auth/me'),

  listPhotos: () => request<Photo[]>('/api/photos'),

  listFeatured: () => request<Photo[]>('/api/photos/featured'),

  uploadPhoto: (formData: FormData) =>
    request<Photo>('/api/photos', { method: 'POST', body: formData }),

  deletePhoto: (id: number) => request<void>(`/api/photos/${id}`, { method: 'DELETE' }),

  toggleLike: (id: number) =>
    request<{ liked: boolean; likeCount: number }>(`/api/photos/${id}/like`, {
      method: 'POST',
    }),

  listComments: (photoId: number) => request<Comment[]>(`/api/photos/${photoId}/comments`),

  addComment: (photoId: number, content: string) =>
    request<Comment>(`/api/photos/${photoId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  deleteComment: (id: number) => request<void>(`/api/comments/${id}`, { method: 'DELETE' }),
};
