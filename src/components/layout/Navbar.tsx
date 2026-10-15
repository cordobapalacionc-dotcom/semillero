import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Icon } from '../ui/Icon';
import { useConfirm } from '../ui/Modal';
import { UNSAVED_MESSAGE, discardUnsavedChanges, hasUnsavedChanges } from '../../hooks/useUnsavedChanges';

export function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    if (hasUnsavedChanges()) {
      const leave = await confirm({
        title: 'Tienes cambios sin guardar',
        message: UNSAVED_MESSAGE,
        confirmLabel: 'Cerrar sesión igualmente',
        danger: true,
      });
      if (!leave) return;
      discardUnsavedChanges();
    }
    logout();
    navigate('/');
  }

  const loginHref = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;

  return (
    <header className="navbar">
      <Link to="/" className="brand" aria-label="Galería, inicio">
        <span className="brand-mark" aria-hidden>
          G
        </span>
        <span className="brand-text">
          Galería<span className="brand-sub">Feria de Innovación</span>
        </span>
      </Link>

      <nav className="nav-links" aria-label="Principal">
        <NavLink to="/" end>
          Explorar
        </NavLink>
        {user && <NavLink to="/dashboard">Mi dashboard</NavLink>}
        {isAdmin && <NavLink to="/admin">Admin</NavLink>}
      </nav>

      <div className="nav-actions">
        <button
          className="icon-btn"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>

        {user ? (
          <>
            <Link to="/dashboard/proyectos/nuevo" className="btn btn-primary btn-sm hide-sm">
              <Icon name="plus" size={14} /> Nuevo proyecto
            </Link>
            <div className="user-menu" ref={menuRef}>
              <button
                className="avatar-btn"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Menú de usuario"
              >
                <span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span>
              </button>
              {menuOpen && (
                <div className="dropdown" role="menu">
                  <div className="dropdown-head">
                    <strong>{user.username}</strong>
                    <span className="muted">{user.email}</span>
                  </div>
                  <Link role="menuitem" to="/dashboard">
                    <Icon name="chart" size={16} /> Mi dashboard
                  </Link>
                  <Link role="menuitem" to="/dashboard/proyectos">
                    <Icon name="folder" size={16} /> Mis proyectos
                  </Link>
                  <Link role="menuitem" to={`/usuarios/${user.username}`}>
                    <Icon name="user" size={16} /> Perfil público
                  </Link>
                  {isAdmin && (
                    <Link role="menuitem" to="/admin">
                      <Icon name="shield" size={16} /> Panel admin
                    </Link>
                  )}
                  <button role="menuitem" onClick={handleLogout}>
                    <Icon name="logout" size={16} /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link to={loginHref} className="btn btn-ghost btn-sm">
              Iniciar sesión
            </Link>
            <Link to="/registro" className="btn btn-primary btn-sm">
              Crear cuenta
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <span>Galería · Feria de Innovación Tecnológica</span>
      <span className="muted">Hecho por la comunidad del semillero</span>
    </footer>
  );
}
