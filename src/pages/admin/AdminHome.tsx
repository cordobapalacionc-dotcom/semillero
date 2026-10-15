import { Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api';
import { HorizontalBars, MultiLine } from '../../components/charts/Charts';
import { PageHeader } from '../../components/layout/SidebarLayout';
import { ErrorState, Spinner } from '../../components/ui/Feedback';
import { Icon } from '../../components/ui/Icon';
import { StatCard } from '../../components/ui/StatCard';
import { useAsync } from '../../hooks/useAsync';
import { useQueryState } from '../../hooks/useQueryState';
import type { AdminRange } from '../../types';

const RANGES: AdminRange[] = [7, 30, 90];

export function AdminHome() {
  const navigate = useNavigate();
  const [query, setQuery] = useQueryState({ range: '30' });
  const range = (RANGES.includes(Number(query.range) as AdminRange) ? Number(query.range) : 30) as AdminRange;
  const { data, loading, error, reload } = useAsync(() => adminApi.stats(range), [range]);
  const deltaLabel = `vs. ${range} días anteriores`;

  return (
    <>
      <PageHeader
        title="Resumen general"
        description="Actividad de toda la plataforma."
        actions={
          <div className="segmented" role="group" aria-label="Rango de días">
            {RANGES.map((r) => (
              <button key={r} className={r === range ? 'active' : ''} onClick={() => setQuery({ range: String(r) })} aria-pressed={r === range}>
                {r} días
              </button>
            ))}
          </div>
        }
      />

      {loading && !data ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState message={error ?? 'Sin datos'} onRetry={reload} />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Usuarios" value={data.totals.users} icon="users" delta={data.deltas.users} deltaLabel={deltaLabel} />
            <StatCard label="Proyectos" value={data.totals.projects} icon="folder" delta={data.deltas.projects} deltaLabel={deltaLabel} />
            <StatCard label="Comentarios" value={data.totals.comments} icon="comment" delta={data.deltas.comments} deltaLabel={deltaLabel} />
            <StatCard label="Fotos" value={data.totals.photos} icon="image" />
            <StatCard label="Likes" value={data.totals.likes} icon="heart" />
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>Actividad diaria</h2>
              <span className="muted">Toca la leyenda para mostrar u ocultar series</span>
            </div>
            <MultiLine
              data={data.activity}
              series={[
                { key: 'projects', label: 'Proyectos', style: 'solid' },
                { key: 'users', label: 'Registros', style: 'dashed' },
                { key: 'comments', label: 'Comentarios', style: 'dotted' },
              ]}
            />
          </section>

          <div className="dash-grid halves">
            <section className="panel">
              <div className="panel-head">
                <h2>Categorías más usadas</h2>
                <span className="muted">Clic para ver sus proyectos</span>
              </div>
              {data.topCategories.length === 0 ? (
                <p className="muted">Aún no hay proyectos.</p>
              ) : (
                <HorizontalBars
                  data={data.topCategories}
                  label="Proyectos"
                  onSelect={(name) => navigate(`/admin/proyectos?category=${encodeURIComponent(name)}`)}
                />
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Usuarios más activos</h2>
              </div>
              {data.topUsers.length === 0 ? (
                <p className="muted">Aún no hay actividad.</p>
              ) : (
                <ol className="rank-list">
                  {data.topUsers.map((u, i) => (
                    <li key={u.id}>
                      <span className="rank-num">{i + 1}</span>
                      <span className="avatar avatar-xs">{u.username.slice(0, 1).toUpperCase()}</span>
                      <Link to={`/admin/usuarios?q=${encodeURIComponent(u.username)}`} className="rank-main">
                        <strong>{u.username}</strong>
                      </Link>
                      <span className="rank-meta">
                        <Icon name="folder" size={13} /> {u.projects} · <Icon name="heart" size={13} /> {u.likes}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
