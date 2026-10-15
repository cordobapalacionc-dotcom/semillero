import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api';
import type { RegisterData } from '../api';
import { ApiError, AUTH_EXPIRED_EVENT, ROLE_CHANGED_EVENT, getToken, setToken } from '../api/client';
import { useToast } from './ToastContext';
import type { Me } from '../types';

interface AuthContextValue {
  user: Me | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperadmin: boolean;
  login: (identifier: string, password: string) => Promise<Me>;
  register: (data: RegisterData) => Promise<Me>;
  logout: () => void;
  refresh: () => Promise<void>;
  setUser: (user: Me) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const userRef = useRef<Me | null>(null);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const { user: me } = await authApi.me();
      setUser(me);
    } catch (err) {
      // Solo una respuesta del servidor que rechaza la sesión la invalida. Si el servidor
      // está caído o reiniciándose, se conserva el token para el próximo intento.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setToken(null);
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    function onExpired() {
      setToken(null);
      if (userRef.current) toast.error('Tu sesión expiró o tu cuenta fue suspendida. Inicia sesión de nuevo.');
      setUser(null);
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [toast]);

  // Si el servidor dice que ya no somos admin, se recarga el usuario para ocultar el panel.
  useEffect(() => {
    const onRoleChanged = () => {
      refresh();
    };
    window.addEventListener(ROLE_CHANGED_EVENT, onRoleChanged);
    return () => window.removeEventListener(ROLE_CHANGED_EVENT, onRoleChanged);
  }, [refresh]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const login = useCallback(async (identifier: string, password: string) => {
    const session = await authApi.login(identifier, password);
    setToken(session.token);
    setUser(session.user);
    return session.user;
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const session = await authApi.register(data);
    setToken(session.token);
    setUser(session.user);
    return session.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
      isSuperadmin: user?.role === 'superadmin',
      login,
      register,
      logout,
      refresh,
      setUser,
    }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
