import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, projectsApi } from '../../api';
import { PageHeader } from '../../components/layout/SidebarLayout';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { EmptyState, ErrorState, Pagination, Spinner } from '../../components/ui/Feedback';
import { Icon } from '../../components/ui/Icon';
import { Drawer, useConfirm } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { useQueryState } from '../../hooks/useQueryState';
import { errorMessage, formatDate, plural } from '../../lib/format';
import type { ProjectSummary } from '../../types';

function ProjectPreview({ project, onClose }: { project: ProjectSummary; onClose: () => void }) {
  const { data, loading, error } = useAsync(() => adminApi.project(project.id), [project.id]);
  return (
    <Drawer title="Vista previa" onClose={onClose}>
      <div>
        <span className="eyebrow">{project.category}</span>
        <h2>{project.title}</h2>
        <p className="muted">
          por {project.owner.username} · {formatDate(project.createdAt)}
        </p>
      </div>
      {loading ? (
        <Spinner />
      ) : error || !data ? (
        <p className="muted">{error}</p>
      ) : (
        <>
          {data.description && <p className="description">{data.description}</p>}
          <div className="preview-photos">
            {data.photos.map((p) => (
              <img key={p.id} src={p.url} alt={p.caption} loading="lazy" />
            ))}
          </div>
        </>
      )}
      <Link to={`/proyectos/${project.id}`} className="btn btn-ghost">
        Abrir página pública
      </Link>
    </Drawer>
  );
}

export function AdminProjects() {
  const toast = useToast();
  const confirm = useConfirm();
  const [query, setQuery] = useQueryState({ q: '', category: '', featured: '', sort: 'createdAt', dir: 'desc', page: '1' });
  const [search, setSearch] = useState(query.q);
  const debounced = useDebounce(search.trim(), 300);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<ProjectSummary | null>(null);
  const page = Math.max(1, Number(query.page) || 1);

  useEffect(() => {
    if (debounced !== query.q) setQuery({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const categories = useAsync(() => projectsApi.categories(), []);
  const { data, loading, error, reload, setData } = useAsync(
    () =>
      adminApi.projects({
        q: query.q,
        category: query.category,
        featured: (query.featured || undefined) as 'true' | 'false' | undefined,
        sort: query.sort,
        dir: query.dir as 'asc' | 'desc',
        page,
      }),
    [query.q, query.category, query.featured, query.sort, query.dir, page],
  );

  // Al cambiar filtros, orden o página, la selección se limpia para no borrar filas que ya no se ven.
  useEffect(() => setSelected(new Set()), [query.q, query.category, query.featured, query.sort, query.dir, page]);

  async function toggleFeatured(p: ProjectSummary) {
    const next = !p.featured;
    setData((prev) => (prev ? { ...prev, items: prev.items.map((x) => (x.id === p.id ? { ...x, featured: next } : x)) } : prev));
    try {
      await adminApi.setFeatured(p.id, next);
      toast.success(next ? 'Proyecto destacado' : 'Destacado quitado');
    } catch (err) {
      setData((prev) => (prev ? { ...prev, items: prev.items.map((x) => (x.id === p.id ? { ...x, featured: !next } : x)) } : prev));
      toast.error(errorMessage(err));
    }
  }

  async function remove(ids: number[], title?: string) {
    const ok = await confirm({
      title: ids.length === 1 ? 'Eliminar proyecto' : `Eliminar ${ids.length} proyectos`,
      message: (
        <>
          {title ? (
            <>
              Se eliminará <strong>{title}</strong>
            </>
          ) : (
            `Se eliminarán ${plural(ids.length, 'proyecto', 'proyectos')}`
          )}{' '}
          con todas sus fotos, likes y comentarios. Esta acción no se puede deshacer.
        </>
      ),
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      if (ids.length === 1) await adminApi.deleteProject(ids[0]);
      else await adminApi.bulkDeleteProjects(ids);
      toast.success(ids.length === 1 ? 'Proyecto eliminado' : `${plural(ids.length, 'proyecto eliminado', 'proyectos eliminados')}`);
      setSelected(new Set());
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const columns: Column<ProjectSummary>[] = [
    {
      key: 'title',
      header: 'Proyecto',
      sortable: true,
      render: (p) => (
        <button className="cell-title cell-button" onClick={() => setPreview(p)} title="Vista previa">
          {p.coverUrl ? <img className="thumb" src={p.coverUrl} alt="" /> : <span className="thumb" />}
          <div>
            <strong>{p.title}</strong>
            <span className="muted">{p.category}</span>
          </div>
        </button>
      ),
    },
    {
      key: 'owner',
      header: 'Autor',
      sortable: true,
      render: (p) => (
        <Link className="link" to={`/admin/usuarios?q=${encodeURIComponent(p.owner.username)}`}>
          {p.owner.username}
        </Link>
      ),
    },
    { key: 'photos', header: 'Fotos', sortable: true, render: (p) => p.photoCount },
    { key: 'likes', header: 'Likes', sortable: true, render: (p) => p.likeCount },
    { key: 'comments', header: 'Coment.', sortable: true, render: (p) => p.commentCount },
    {
      key: 'featured',
      header: 'Destacado',
      render: (p) => (
        <button
          className="switch"
          role="switch"
          aria-checked={p.featured}
          onClick={() => toggleFeatured(p)}
          aria-label={p.featured ? `Quitar destacado de ${p.title}` : `Destacar ${p.title}`}
        />
      ),
    },
    { key: 'createdAt', header: 'Fecha', sortable: true, render: (p) => formatDate(p.createdAt) },
  ];

  return (
    <>
      <PageHeader title="Proyectos" description={data ? plural(data.total, 'proyecto', 'proyectos') : undefined} />

      <div className="toolbar">
        <div className="search-input">
          <Icon name="search" size={16} />
          <input
            className="input"
            type="search"
            placeholder="Buscar por título, descripción, categoría o autor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar proyectos"
          />
        </div>
        <select className="select" value={query.category} onChange={(e) => setQuery({ category: e.target.value })} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {query.category && !categories.data?.some((c) => c.name === query.category) && <option value={query.category}>{query.category}</option>}
          {categories.data?.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.count})
            </option>
          ))}
        </select>
        <select className="select" value={query.featured} onChange={(e) => setQuery({ featured: e.target.value })} aria-label="Destacados">
          <option value="">Todos</option>
          <option value="true">Solo destacados</option>
          <option value="false">No destacados</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar" role="region" aria-label="Acciones en lote">
          <span>{plural(selected.size, 'seleccionado', 'seleccionados')}</span>
          <div className="page-actions">
            <button className="btn btn-sm" onClick={() => setSelected(new Set())}>
              Deseleccionar
            </button>
            <button className="btn btn-sm" onClick={() => remove([...selected])}>
              <Icon name="trash" size={14} /> Eliminar seleccionados ({selected.size})
            </button>
          </div>
        </div>
      )}

      {loading && !data ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState message={error ?? 'Sin datos'} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState icon="folder" title="Sin proyectos">
          No hay proyectos que coincidan con los filtros.
        </EmptyState>
      ) : (
        <DataTable
          columns={columns}
          rows={data.items}
          getId={(p) => p.id}
          selected={selected}
          onSelectChange={setSelected}
          sort={{ sort: query.sort, dir: query.dir as 'asc' | 'desc' }}
          onSortChange={(s) => setQuery({ sort: s.sort, dir: s.dir })}
          actions={(p) => (
            <>
              <button className="icon-btn" onClick={() => setPreview(p)} title="Vista previa" aria-label={`Vista previa de ${p.title}`}>
                <Icon name="eye" size={16} />
              </button>
              <button className="icon-btn" onClick={() => remove([p.id], p.title)} title="Eliminar" aria-label={`Eliminar ${p.title}`}>
                <Icon name="trash" size={16} />
              </button>
            </>
          )}
        />
      )}

      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => setQuery({ page: String(p) })} />}
      {preview && <ProjectPreview project={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
