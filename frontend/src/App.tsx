import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { Footer, Navbar } from './components/layout/Navbar';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { SidebarLayout } from './components/layout/SidebarLayout';
import type { SidebarLink } from './components/layout/SidebarLayout';
import { useAuth } from './context/AuthContext';
import { HomePage } from './pages/public/HomePage';
import { ProjectPage } from './pages/public/ProjectPage';
import { UserPage } from './pages/public/UserPage';
import { NotFoundPage } from './pages/public/NotFoundPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { Spinner } from './components/ui/Feedback';

// Dashboard y admin se cargan bajo demanda: incluyen las gráficas (recharts), que el
// visitante de la galería pública no necesita descargar.
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome').then((m) => ({ default: m.DashboardHome })));
const MyProjects = lazy(() => import('./pages/dashboard/MyProjects').then((m) => ({ default: m.MyProjects })));
const ProjectForm = lazy(() => import('./pages/dashboard/ProjectForm').then((m) => ({ default: m.ProjectForm })));
const MyProfile = lazy(() => import('./pages/dashboard/MyProfile').then((m) => ({ default: m.MyProfile })));
const AdminHome = lazy(() => import('./pages/admin/AdminHome').then((m) => ({ default: m.AdminHome })));
const AdminProjects = lazy(() => import('./pages/admin/AdminProjects').then((m) => ({ default: m.AdminProjects })));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers').then((m) => ({ default: m.AdminUsers })));
const AdminComments = lazy(() => import('./pages/admin/AdminComments').then((m) => ({ default: m.AdminComments })));

const DASHBOARD_LINKS: SidebarLink[] = [
  { to: '/dashboard', label: 'Resumen', icon: 'chart', end: true },
  { to: '/dashboard/proyectos', label: 'Mis proyectos', icon: 'folder', end: true },
  { to: '/dashboard/proyectos/nuevo', label: 'Nuevo proyecto', icon: 'plus' },
  { to: '/dashboard/perfil', label: 'Mi perfil', icon: 'user' },
];

const ADMIN_LINKS: SidebarLink[] = [
  { to: '/admin', label: 'Resumen', icon: 'chart', end: true },
  { to: '/admin/proyectos', label: 'Proyectos', icon: 'folder' },
  { to: '/admin/usuarios', label: 'Usuarios', icon: 'users' },
  { to: '/admin/comentarios', label: 'Comentarios', icon: 'comment' },
];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function GuestOnly() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export function App() {
  const { isSuperadmin } = useAuth();

  return (
    <div className="app">
      <ScrollToTop />
      <Navbar />
      <main className="main">
        <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/proyectos/:id" element={<ProjectPage />} />
          <Route path="/usuarios/:username" element={<UserPage />} />

          <Route element={<GuestOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registro" element={<RegisterPage />} />
          </Route>

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <SidebarLayout title="Mi dashboard" subtitle="Tu espacio" links={DASHBOARD_LINKS} />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="proyectos" element={<MyProjects />} />
            <Route path="proyectos/nuevo" element={<ProjectForm />} />
            <Route path="proyectos/:id/editar" element={<ProjectForm />} />
            <Route path="perfil" element={<MyProfile />} />
          </Route>

          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <SidebarLayout
                  title="Administración"
                  subtitle={isSuperadmin ? '★ Admin principal' : 'Administrador'}
                  links={ADMIN_LINKS}
                />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminHome />} />
            <Route path="proyectos" element={<AdminProjects />} />
            <Route path="usuarios" element={<AdminUsers />} />
            <Route path="comentarios" element={<AdminComments />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
