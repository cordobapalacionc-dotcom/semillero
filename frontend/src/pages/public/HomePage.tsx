import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { projectsApi } from '../../api';
import { ProjectGrid, ProjectGridSkeleton, patchLike } from '../../components/projects/ProjectCard';
import { LikeButton } from '../../components/projects/LikeButton';
import { EmptyState, ErrorState } from '../../components/ui/Feedback';
import { Icon } from '../../components/ui/Icon';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { errorMessage, formatNumber } from '../../lib/format';
import type { ProjectSort, ProjectSummary } from '../../types';

const SORTS: { value: ProjectSort; label: string }[] = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'popular', label: 'Más populares' },
  { value: 'commented', label: 'Más comentados' },
];

function FeaturedCarousel({ projects, onLike }: { projects: ProjectSummary[]; onLike: (id: number, liked: boolean, count: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (track) track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section className="featured" aria-labelledby="featured-title">
      <div className="section-head">
        <div>
          <span className="eyebrow">Selección del jurado</span>
          <h2 id="featured-title">Destacados</h2>
        </div>
        {projects.length > 1 && (
          <div className="carousel-controls">
            <button className="icon-btn" onClick={() => scroll(-1)} aria-label="Anterior">
              <Icon name="left" />
            </button>
            <button className="icon-btn" onClick={() => scroll(1)} aria-label="Siguiente">
              <Icon name="right" />
            </button>
          </div>
        )}
      </div>
      <div className="carousel" ref={trackRef}>
        {projects.map((p) => (
          <Link key={p.id} to={`/proyectos/${p.id}`} className="featured-card">
            {p.coverUrl && <img src={p.coverUrl} alt="" loading="lazy" />}
            <div className="featured-info">
              <span className="eyebrow">{p.category}</span>
              <h3>{p.title}</h3>
              <div className="featured-foot">
                <span>por {p.owner.username}</span>
                <LikeButton size="sm" projectId={p.id} liked={p.likedByMe} count={p.likeCount} onChange={(l, c) => onLike(p.id, l, c)} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const sort = (SORTS.some((s) => s.value === params.get('sort')) ? params.get('sort') : 'recent') as ProjectSort;

  const [search, setSearch] = useState(q);
  const debouncedSearch = useDebounce(search, 300);

  const featured = useAsync(() => projectsApi.featured(), [user?.id]);
  const categories = useAsync(() => projectsApi.categories(), []);

  const [items, setItems] = useState<ProjectSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const [reloadTick, setReloadTick] = useState(0);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  function updateParam(key: string, value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  useEffect(() => {
    if (debouncedSearch.trim() !== q) updateParam('q', debouncedSearch.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => setSearch(q), [q]);

  // Al cambiar los filtros se reinicia la lista desde la página 1.
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    setLoadingMore(false);
    setLoadMoreError(null);
    projectsApi
      .list({ q, category, sort, page: 1 })
      .then((res) => {
        if (id !== requestId.current) return;
        setItems(res.items);
        setTotal(res.total);
        setPage(1);
      })
      .catch((err) => id === requestId.current && setError(errorMessage(err)))
      .finally(() => id === requestId.current && setLoading(false));
  }, [q, category, sort, user?.id, reloadTick]);

  async function loadMore() {
    // Si los filtros cambian mientras carga, la respuesta pertenece a otra lista y se descarta.
    const id = requestId.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const res = await projectsApi.list({ q, category, sort, page: page + 1 });
      if (id !== requestId.current) return;
      setItems((prev) => [...prev, ...res.items.filter((p) => !prev.some((x) => x.id === p.id))]);
      setTotal(res.total);
      setPage(page + 1);
    } catch (err) {
      if (id === requestId.current) setLoadMoreError(errorMessage(err));
    } finally {
      if (id === requestId.current) setLoadingMore(false);
    }
  }

  function onLike(id: number, liked: boolean, count: number) {
    setItems((prev) => patchLike(prev, id, liked, count));
    featured.setData((prev) => (prev ? patchLike(prev, id, liked, count) : prev));
  }

  const filtering = Boolean(q || category);

  return (
    <div className="page home">
      <section className="hero">
        <span className="eyebrow">Feria de Innovación Tecnológica</span>
        <h1>
          Proyectos que se
          <br />
          construyen aquí.
        </h1>
        <p className="muted">
          Explora lo que crea la comunidad: robótica, software, hardware y mucho más. {total > 0 && !filtering && `${formatNumber(total)} proyectos publicados.`}
        </p>
        {!user && (
          <div className="hero-actions">
            <Link to="/registro" className="btn btn-primary">
              Publicar mi proyecto
            </Link>
            <a href="#explorar" className="btn btn-ghost">
              Explorar
            </a>
          </div>
        )}
      </section>

      {!filtering && featured.data && featured.data.length > 0 && <FeaturedCarousel projects={featured.data} onLike={onLike} />}

      <section id="explorar" className="explore" aria-label="Explorar proyectos">
        <div className="toolbar">
          <div className="search-input">
            <Icon name="search" size={16} />
            <input
              className="input"
              type="search"
              placeholder="Buscar por título, descripción o categoría…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar proyectos"
              maxLength={100}
            />
          </div>
          <select className="select" value={sort} onChange={(e) => updateParam('sort', e.target.value === 'recent' ? '' : e.target.value)} aria-label="Ordenar">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="chips" role="tablist" aria-label="Categorías">
          <button role="tab" aria-selected={!category} className={`chip${!category ? ' active' : ''}`} onClick={() => updateParam('category', '')}>
            Todas
          </button>
          {categories.data?.map((c) => (
            <button
              key={c.name}
              role="tab"
              aria-selected={category.toLowerCase() === c.name.toLowerCase()}
              className={`chip${category.toLowerCase() === c.name.toLowerCase() ? ' active' : ''}`}
              onClick={() => updateParam('category', c.name)}
            >
              {c.name} <span className="chip-count">{c.count}</span>
            </button>
          ))}
        </div>

        {filtering && !loading && (
          <p className="muted results-line">
            {total === 1 ? '1 resultado' : `${formatNumber(total)} resultados`}
            {q && <> para «{q}»</>}
            {category && <> en {category}</>} ·{' '}
            <button className="link" onClick={() => setParams({}, { replace: true })}>
              Limpiar filtros
            </button>
          </p>
        )}

        {loading ? (
          <ProjectGridSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadTick((t) => t + 1)} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="search"
            title={filtering ? 'Sin resultados' : 'Aún no hay proyectos'}
            action={
              !filtering && (
                <Link to={user ? '/dashboard/proyectos/nuevo' : '/registro'} className="btn btn-primary">
                  Publicar el primero
                </Link>
              )
            }
          >
            {filtering ? 'Prueba con otras palabras o quita los filtros.' : 'Sé la primera persona en compartir su proyecto.'}
          </EmptyState>
        ) : (
          <>
            <ProjectGrid projects={items} onLikeChange={onLike} />
            {items.length < total && (
              <div className="load-more">
                {loadMoreError && <p className="muted" role="alert">{loadMoreError}</p>}
                <button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Cargando…' : `Cargar más (${formatNumber(total - items.length)} restantes)`}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
