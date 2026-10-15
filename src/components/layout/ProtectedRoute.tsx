import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { EmptyState, Spinner } from '../ui/Feedback';

export function ProtectedRoute({ role, children }: { role?: 'admin'; children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Verificando sesión…" />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (role === 'admin' && !isAdmin) {
    return (
      <main className="page">
        <EmptyState icon="shield" title="Acceso denegado" action={<Link to="/" className="btn btn-primary">Volver al inicio</Link>}>
          Esta sección es solo para administradores.
        </EmptyState>
      </main>
    );
  }
  return <>{children}</>;
}
