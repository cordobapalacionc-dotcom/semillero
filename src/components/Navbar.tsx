import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  onOpenAuth: () => void;
  onOpenUpload: () => void;
}

export function Navbar({ onOpenAuth, onOpenUpload }: NavbarProps) {
  const { user, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">⚡</span>
        <div>
          <h1>Feria de Innovación Tecnológica</h1>
          <p>Galería colaborativa de proyectos</p>
        </div>
      </div>

      <div className="navbar-actions">
        {user ? (
          <>
            <button className="btn btn-primary" onClick={onOpenUpload}>
              + Subir foto
            </button>
            <span className="navbar-user">👤 {user.username}</span>
            <button className="btn btn-ghost" onClick={logout}>
              Salir
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={onOpenAuth}>
            Ingresar
          </button>
        )}
      </div>
    </header>
  );
}
