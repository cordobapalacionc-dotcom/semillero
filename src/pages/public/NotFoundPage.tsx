import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="page not-found">
      <span className="not-found-code">404</span>
      <h1>Esta página no existe</h1>
      <p className="muted">Puede que el enlace esté mal escrito o que el contenido haya sido eliminado.</p>
      <Link to="/" className="btn btn-primary">
        Volver a la galería
      </Link>
    </div>
  );
}
