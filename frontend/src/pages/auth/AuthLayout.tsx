import type { ReactNode } from 'react';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-aside" aria-hidden>
        <span className="eyebrow">Feria de Innovación Tecnológica</span>
        <p className="auth-quote">
          Muestra lo que
          <br />
          construyes.
        </p>
        <ul className="auth-points">
          <li>Publica tus proyectos con varias fotos</li>
          <li>Recibe likes y comentarios de la comunidad</li>
          <li>Sigue tus estadísticas en tu propio dashboard</li>
        </ul>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
          {children}
          <div className="auth-footer">{footer}</div>
        </div>
      </section>
    </div>
  );
}
