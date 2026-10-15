import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import { PageHeader } from '../../components/layout/SidebarLayout';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Badge, EmptyState, ErrorState, Pagination, Spinner } from '../../components/ui/Feedback';
import { Icon } from '../../components/ui/Icon';
import { useConfirm } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { useQueryState } from '../../hooks/useQueryState';
import { canManage } from '../../lib/permissions';
import type { ManageAction } from '../../lib/permissions';
import { errorMessage, formatDate, plural, timeAgo } from '../../lib/format';
import type { AdminUser, Role, Status } from '../../types';

function RoleBadge({ role }: { role: Role }) {
  if (role === 'superadmin') return <Badge tone="solid">★ Principal</Badge>;
  if (role === 'admin') return <Badge tone="outline">Admin</Badge>;
  return <Badge>Usuario</Badge>;
}

function StatusBadge({ status }: { status: Status }) {
  return status === 'active' ? <Badge tone="outline">Activo</Badge> : <Badge tone="muted">Suspendido</Badge>;
}

export function AdminUsers() {
  const { user: me, isSuperadmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [query, setQuery] = useQueryState({ q: '', role: '', status: '', sort: 'createdAt', dir: 'desc', page: '1' });
  const [search, setSearch] = useState(query.q);
  const debounced = useDebounce(search.trim(), 300);
  const page = Math.max(1, Number(query.page) || 1);

  useEffect(() => {
    if (debounced !== query.q) setQuery({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  useEffect(() => setSearch(query.q), [query.q]);

  const { data, loading, error, reload, setData } = useAsync(
    () =>
      adminApi.users({
        q: query.q,
        role: (query.role || undefined) as Role | undefined,
        status: (query.status || undefined) as Status | undefined,
        sort: query.sort,
        dir: query.dir as 'asc' | 'desc',
        page,
      }),
    [query.q, query.role, query.status, query.sort, query.dir, page],
  );

  const replaceRow = (updated: AdminUser) =>
    setData((prev) => (prev ? { ...prev, items: prev.items.map((u) => (u.id === updated.id ? updated : u)) } : prev));

  const check = (target: AdminUser, action: ManageAction) => (me ? canManage(me, target, action) : { ok: false as const, reason: '' });

  async function toggleStatus(u: AdminUser) {
    const suspending = u.status === 'active';
    if (suspending) {
      const ok = await confirm({
        title: `Suspender a ${u.username}`,
        message: 'No podrá iniciar sesión y sus proyectos dejarán de verse en la galería pública hasta que lo reactives.',
        confirmLabel: 'Suspender',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      replaceRow(await adminApi.setStatus(u.id, suspending ? 'suspended' : 'active'));
      toast.success(suspending ? `${u.username} fue suspendido` : `${u.username} fue reactivado`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function toggleRole(u: AdminUser) {
    const promoting = u.role === 'user';
    const ok = await confirm({
      title: promoting ? `Hacer admin a ${u.username}` : `Quitar admin a ${u.username}`,
      message: promoting
        ? 'Podrá moderar proyectos y comentarios y gestionar usuarios normales. No podrá gestionar a otros administradores.'
        : 'Perderá el acceso al panel de administración.',
      confirmLabel: promoting ? 'Hacer admin' : 'Quitar admin',
      danger: !promoting,
    });
    if (!ok) return;
    try {
      replaceRow(await adminApi.setRole(u.id, promoting ? 'admin' : 'user'));
      toast.success(promoting ? `${u.username} ahora es admin` : `${u.username} ya no es admin`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function remove(u: AdminUser) {
    const ok = await confirm({
      title: `Eliminar a ${u.username}`,
      message: (
        <>
          Se eliminará la cuenta y <strong>todo su contenido</strong>: {plural(u.projectCount, 'proyecto', 'proyectos')} con sus fotos, likes y
          comentarios. Esta acción no se puede deshacer.
        </>
      ),
      confirmLabel: 'Eliminar cuenta',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteUser(u.id);
      toast.success(`${u.username} fue eliminado`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  function ActionButton({ u, action, icon, label, onClick }: { u: AdminUser; action: ManageAction; icon: 'ban' | 'check' | 'shield' | 'trash'; label: string; onClick: () => void }) {
    const result = check(u, action);
    return (
      <button
        className="icon-btn"
        onClick={onClick}
        disabled={!result.ok}
        title={result.ok ? label : result.reason}
        aria-label={result.ok ? `${label}: ${u.username}` : `${label} (no disponible): ${result.reason}`}
      >
        <Icon name={icon} size={16} />
      </button>
    );
  }

  const columns: Column<AdminUser>[] = [
    {
      key: 'username',
      header: 'Usuario',
      sortable: true,
      render: (u) => (
        <div className="cell-title">
          <span className="avatar">{u.username.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>
              {u.username} {u.id === me?.id && <span className="muted">(tú)</span>}
            </strong>
            <span className="muted">{u.email}</span>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Rol', render: (u) => <RoleBadge role={u.role} /> },
    { key: 'status', header: 'Estado', render: (u) => <StatusBadge status={u.status} /> },
    {
      key: 'projects',
      header: 'Proyectos',
      sortable: true,
      render: (u) =>
        u.projectCount > 0 ? (
          <Link className="link" to={`/admin/proyectos?q=${encodeURIComponent(u.username)}`}>
            {u.projectCount}
          </Link>
        ) : (
          0
        ),
    },
    { key: 'createdAt', header: 'Registro', sortable: true, render: (u) => formatDate(u.createdAt) },
    { key: 'lastLogin', header: 'Último acceso', sortable: true, render: (u) => (u.lastLoginAt ? timeAgo(u.lastLoginAt) : <span className="muted">Nunca</span>) },
  ];

  return (
    <>
      <PageHeader
        title="Usuarios"
        description={
          isSuperadmin
            ? 'Como admin principal puedes gestionar a todos, incluidos los administradores.'
            : 'Puedes gestionar usuarios normales. Solo el admin principal gestiona administradores.'
        }
      />

      <div className="toolbar">
        <div className="search-input">
          <Icon name="search" size={16} />
          <input className="input" type="search" placeholder="Buscar por usuario o correo…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar usuarios" />
        </div>
        <select className="select" value={query.role} onChange={(e) => setQuery({ role: e.target.value })} aria-label="Rol">
          <option value="">Todos los roles</option>
          <option value="user">Usuarios</option>
          <option value="admin">Admins</option>
          <option value="superadmin">Admin principal</option>
        </select>
        <select className="select" value={query.status} onChange={(e) => setQuery({ status: e.target.value })} aria-label="Estado">
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="suspended">Suspendidos</option>
        </select>
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState message={error ?? 'Sin datos'} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState icon="users" title="Sin usuarios">
          No hay usuarios que coincidan con los filtros.
        </EmptyState>
      ) : (
        <DataTable
          columns={columns}
          rows={data.items}
          getId={(u) => u.id}
          sort={{ sort: query.sort, dir: query.dir as 'asc' | 'desc' }}
          onSortChange={(s) => setQuery({ sort: s.sort, dir: s.dir })}
          actions={(u) => (
            <>
              <ActionButton
                u={u}
                action={u.status === 'active' ? 'suspend' : 'activate'}
                icon={u.status === 'active' ? 'ban' : 'check'}
                label={u.status === 'active' ? 'Suspender' : 'Reactivar'}
                onClick={() => toggleStatus(u)}
              />
              {isSuperadmin && (
                <ActionButton u={u} action="setRole" icon="shield" label={u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'} onClick={() => toggleRole(u)} />
              )}
              <ActionButton u={u} action="delete" icon="trash" label="Eliminar" onClick={() => remove(u)} />
            </>
          )}
        />
      )}

      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => setQuery({ page: String(p) })} />}
    </>
  );
}
