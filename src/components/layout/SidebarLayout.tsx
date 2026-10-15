import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';

export interface SidebarLink {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

export function SidebarLayout({ title, subtitle, links }: { title: string; subtitle?: string; links: SidebarLink[] }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const current = links.find((l) =>
    l.end ? location.pathname === l.to : location.pathname.startsWith(l.to),
  );

  return (
    <div className="sidebar-layout">
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-head">
          <span className="eyebrow">{subtitle}</span>
          <strong>{title}</strong>
        </div>
        <button className="sidebar-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span>
            {current && <Icon name={current.icon} size={16} />} {current?.label ?? title}
          </span>
          <Icon name={open ? 'close' : 'menu'} size={16} />
        </button>
        <nav className="sidebar-nav">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              <Icon name={link.icon} size={16} />
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="sidebar-content">
        <Outlet />
      </section>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
