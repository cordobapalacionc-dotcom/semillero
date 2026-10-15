import { useState } from 'react';
import { Link } from 'react-router-dom';
import { meApi, projectsApi } from '../../api';
import { PageHeader } from '../../components/layout/SidebarLayout';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { EmptyState, ErrorState, Pagination, Spinner } from '../../components/ui/Feedback';
import { Icon } from '../../components/ui/Icon';
import { useConfirm } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { errorMessage, formatDate, plural } from '../../lib/format';
import type { ProjectSort, ProjectSummary } from '../../types';

const VIEW_KEY = 'galeria_projects_view';
type View = 'grid' | 'list';

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function MyProjects() {
  const toast = useToast();
  const confirm = useConfirm();
  const [view, setView] = useState<View>(savedView);
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 250);
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<ProjectSort>('recent');
  const [page, setPage] = useState(1);

  const categories = useAsync(() => projectsApi.categories(), []);
  const { data, loading, error, reload, setData } = useAsync(
    () => meApi.projects({ q, category, sort, page }),
    [q, category, sort, page],
  );

  function changeView(next: View) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // sin almacenamiento
    }
  }

  async function handleDelete(project: ProjectSummary) {
    const ok = await confirm({
      title: 'Eliminar proyecto',
      message: (
        <>
          Se eliminará <strong>{project.title}</strong> junto con sus {plural(project.photoCount, 'foto', 'fotos')}, likes y comentarios.
          Esta acción no se puede deshacer.
        </>
      ),
      confirmLabel: 'Eliminar proyecto',
      danger: true,
    });
    if (!ok) return;
    try {
      await meApi.remove(project.id);
      setData((prev) => (prev ? { ...prev, items: prev.items.filter((p) => p.id !== project.id), total: prev.total - 1 } : prev));
      toast.success('Proyecto eliminado');
      if (data && data.items.length === 1 && page > 1) setPage(page - 1);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const actions = (p: ProjectSummary) => (
    <>
      <Link to={`/proyectos/${p.id}`} className="icon-btn" title="Ver" aria-label={`Ver ${p.title}`}>
        <Icon name="eye" size={16} />
      </Link>
      <Link to={`/dashboard/proyectos/${p.id}/editar`} className="icon-btn" title="Editar" aria-label={`Editar ${p.title}`}>
        <Icon name="edit" size={16} />
      </Link>
      <button className="icon-btn" onClick={() => handleDelete(p)} title="Eliminar" aria-label={`Eliminar ${p.title}`}>
        <Icon name="trash" size={16} />
      </button>
    </>
  );

  const columns: Column<ProjectSummary>[] = [
    {
      key: 'title',
      header: 'Proyecto',
      render: (p) => (
        <div className="cell-title">
          {p.coverUrl ? <img className="thumb" src={p.coverUrl} alt="" /> : <span className="thumb" />}
          <div>
            <strong>{p.title}</strong>
            <span className="muted">{p.category}</span>
          </div>
        </div>
      ),
    },
    { key: 'photos', header: 'Fotos', render: (p) => p.photoCount },
    { key: 'likes', header: 'Likes', render: (p) => p.likeCount },
    { key: 'comments', header: 'Comentarios', render: (p) => p.commentCount },
    { key: 'date', header: 'Creado', render: (p) => formatDate(p.createdAt) },
  ];

  const filtering = Boolean(q || category);

  return (
    <>
      <PageHeader
        title="Mis proyectos"
        description={data ? plural(data.total, 'proyecto', 'proyectos') : undefined}
        actions={
          <Link to="/dashboard/proyectos/nuevo" className="btn btn-primary">
            <Icon name="plus" size={16} /> Nuevo proyecto
          </Link>
        }
      />

      <div className="toolbar">
        <div className="search-input">
          <Icon name="search" size={16} />
          <input
            className="input"
            type="search"
            placeholder="Buscar en mis proyectos…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Buscar en mis proyectos"
          />
        </div>
        <select
          className="select"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {categories.data?.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as ProjectSort)} aria-label="Ordenar">
          <option value="recent">Más recientes</option>
          <option value="popular">Más likes</option>
          <option value="commented">Más comentados</option>
        </select>
        <div className="segmented" role="group" aria-label="Vista">
          <button className={view === 'grid' ? 'active' : ''} onClick={() => changeView('grid')} aria-pressed={view === 'grid'} title="Cuadrícula">
            <Icon name="grid" size={15} />
          </button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => changeView('list')} aria-pressed={view === 'list'} title="Lista">
            <Icon name="list" size={15} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState message={error ?? 'Sin datos'} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={filtering ? 'search' : 'folder'}
          title={filtering ? 'Sin resultados' : 'Aún no tienes proyectos'}
          action={
            !filtering && (
              <Link to="/dashboard/proyectos/nuevo" className="btn btn-primary">
                Crear proyecto
              </Link>
            )
          }
        >
          {filtering ? 'Prueba con otra búsqueda o categoría.' : 'Crea tu primer proyecto y sube sus fotos.'}
        </EmptyState>
      ) : view === 'list' ? (
        <DataTable columns={columns} rows={data.items} getId={(p) => p.id} actions={actions} />
      ) : (
        <div className="manage-grid">
          {data.items.map((p) => (
            <article key={p.id} className="manage-card">
              <Link to={`/proyectos/${p.id}`} className="project-cover">
                {p.coverUrl && <img src={p.coverUrl} alt="" loading="lazy" />}
                {p.featured && <span className="cover-chip cover-chip-left">★ Destacado</span>}
              </Link>
              <div className="manage-body">
                <span className="eyebrow">{p.category}</span>
                <strong>{p.title}</strong>
                <div className="manage-stats muted">
                  <span>
                    <Icon name="image" size={13} /> {p.photoCount}
                  </span>
                  <span>
                    <Icon name="heart" size={13} /> {p.likeCount}
                  </span>
                  <span>
                    <Icon name="comment" size={13} /> {p.commentCount}
                  </span>
                </div>
              </div>
              <div className="manage-actions">{actions(p)}</div>
            </article>
          ))}
        </div>
      )}

      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </>
  );
}
