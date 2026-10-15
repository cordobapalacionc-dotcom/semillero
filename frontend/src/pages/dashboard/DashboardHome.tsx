import { Link } from 'react-router-dom';
import { meApi } from '../../api';
import { AreaTrend } from '../../components/charts/Charts';
import { PageHeader } from '../../components/layout/SidebarLayout';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback';
import { Icon } from '../../components/ui/Icon';
import { StatCard } from '../../components/ui/StatCard';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { formatNumber, timeAgo } from '../../lib/format';

export function DashboardHome() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => meApi.stats(), []);

  const likes30 = data?.likesByDay.reduce((sum, d) => sum + d.count, 0) ?? 0;

  return (
    <>
      <PageHeader
        title={`Hola, ${user?.username}`}
        description="Así va tu actividad en la galería."
        actions={
          <Link to="/dashboard/proyectos/nuevo" className="btn btn-primary">
            <Icon name="plus" size={16} /> Nuevo proyecto
          </Link>
        }
      />

      {loading && !data ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState message={error ?? 'Sin datos'} onRetry={reload} />
      ) : data.totals.projects === 0 ? (
        <EmptyState
          icon="folder"
          title="Todavía no tienes proyectos"
          action={
            <Link to="/dashboard/proyectos/nuevo" className="btn btn-primary">
              Crear tu primer proyecto
            </Link>
          }
        >
          Sube fotos de lo que estás construyendo y empieza a recibir likes y comentarios.
        </EmptyState>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Proyectos" value={data.totals.projects} icon="folder" />
            <StatCard label="Fotos" value={data.totals.photos} icon="image" />
            <StatCard label="Likes recibidos" value={data.totals.likes} icon="heart" />
            <StatCard label="Comentarios" value={data.totals.comments} icon="comment" />
          </div>

          <div className="dash-grid two">
            <section className="panel">
              <div className="panel-head">
                <h2>Likes de los últimos 30 días</h2>
                <span className="muted">{formatNumber(likes30)} en total</span>
              </div>
              <AreaTrend data={data.likesByDay} dataKey="count" label="Likes" />
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Tus proyectos más populares</h2>
              </div>
              <ol className="rank-list">
                {data.topProjects.map((p, i) => (
                  <li key={p.id}>
                    <span className="rank-num">{i + 1}</span>
                    {p.coverUrl && <img className="thumb" src={p.coverUrl} alt="" />}
                    <Link to={`/proyectos/${p.id}`} className="rank-main">
                      <strong>{p.title}</strong>
                      <span className="muted">{p.category}</span>
                    </Link>
                    <span className="rank-meta">
                      <Icon name="heart" size={13} /> {p.likeCount}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>Últimos comentarios recibidos</h2>
            </div>
            {data.recentComments.length === 0 ? (
              <p className="muted">Aún nadie ha comentado tus proyectos.</p>
            ) : (
              <ul className="activity-list">
                {data.recentComments.map((c) => (
                  <li key={c.id}>
                    <span className="avatar avatar-xs">{c.author.username.slice(0, 1).toUpperCase()}</span>
                    <div>
                      <p>
                        <strong>{c.author.username}</strong> comentó en{' '}
                        <Link className="link" to={`/proyectos/${c.project?.id}`}>
                          {c.project?.title}
                        </Link>
                      </p>
                      <p className="activity-quote">“{c.content}”</p>
                    </div>
                    <span className="muted rank-meta">{timeAgo(c.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
