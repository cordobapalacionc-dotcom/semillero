const TOKEN_KEY = 'galeria_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // almacenamiento no disponible (modo privado): la sesión dura lo que la pestaña
  }
}

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
  retryAfterMinutes?: number;
  code?: string;

  constructor(
    status: number,
    message: string,
    body?: { fields?: Record<string, string>; retryAfterMinutes?: number; code?: string },
  ) {
    super(message);
    this.status = status;
    this.fields = body?.fields;
    this.retryAfterMinutes = body?.retryAfterMinutes;
    this.code = body?.code;
  }
}

export const AUTH_EXPIRED_EVENT = 'auth:expired';
export const ROLE_CHANGED_EVENT = 'auth:role-changed';

const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/register'];

// Si el servidor rechaza un token que teníamos (expiró, cuenta eliminada → 401; cuenta
// suspendida → 403 con code ACCOUNT_SUSPENDED), se avisa al AuthContext para que cierre la
// sesión. Otros 403 (p. ej. un admin sin permiso sobre otro admin) no cierran la sesión.
function notifyIfExpired(path: string, error: ApiError, hadToken: boolean) {
  if (!hadToken || AUTH_ENDPOINTS.includes(path)) return;
  if (error.status === 401 || error.code === 'ACCOUNT_SUSPENDED') {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  } else if (error.code === 'ADMIN_REQUIRED') {
    window.dispatchEvent(new Event(ROLE_CHANGED_EVENT));
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let body: { error?: string; fields?: Record<string, string>; retryAfterMinutes?: number; code?: string } | undefined;
  try {
    body = await res.json();
  } catch {
    // respuesta sin JSON
  }
  const fallback = res.status >= 500 ? 'El servidor tuvo un problema. Intenta de nuevo.' : `Error ${res.status}`;
  return new ApiError(res.status, body?.error ?? fallback, body);
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(path, { ...options, headers });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. ¿Está encendido?');
  }

  if (!res.ok) {
    const error = await parseError(res);
    notifyIfExpired(path.split('?')[0], error, Boolean(token));
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

// Subida con progreso (fetch no expone el progreso de subida).
export function uploadWithProgress<T>(
  path: string,
  formData: FormData,
  method: 'POST' | 'PATCH',
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const token = getToken();
    xhr.open(method, path);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new ApiError(0, 'No se pudo conectar con el servidor. ¿Está encendido?'));
    xhr.onload = () => {
      let body: unknown;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        body = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
        return;
      }
      const data = body as { error?: string; fields?: Record<string, string>; code?: string } | undefined;
      const error = new ApiError(xhr.status, data?.error ?? `Error ${xhr.status}`, data);
      notifyIfExpired(path, error, Boolean(token));
      reject(error);
    };
    xhr.send(formData);
  });
}
