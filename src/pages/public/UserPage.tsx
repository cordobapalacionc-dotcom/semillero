import { useParams } from 'react-router-dom';
import { projectsApi } from '../../api';
import { ProjectGrid, ProjectGridSkeleton, patchLike } from '../../components/projects/ProjectCard';
import { Badge, EmptyState, ErrorState } from '../../components/ui/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { formatDate, formatNumber, plural } from '../../lib/format';
import { NotFoundPage } from './NotFoundPage';

export function UserPage() {
  const { username = '' } = useParams();
  const { user: me } = useAuth();
  const { data, loading, error, setData, reload } = useAsync(() => projectsApi.user(username), [username, me?.id]);

  if (error === 'Usuario no encontrado') return <NotFoundPage />;

  const totalLikes = data?.projects.reduce((sum, p) => sum + p.likeCount, 0) ?? 0;

  return (
    <div className="page">
      {loading && !data ? (
        <ProjectGridSkeleton count={3} />
      ) : error || !data ? (
        <ErrorState message={error ?? 'No se pudo cargar el perfil'} onRetry={reload} />
      ) : (
        <>
          <header className="profile-head">
            <span className="avatar avatar-lg">{data.user.username.slice(0, 1).toUpperCase()}</span>
            <div>
              <h1>
                {data.user.username}{' '}
                {data.user.role === 'superadmin' && <Badge tone="solid">★ Admin principal</Badge>}
                {data.user.role === 'admin' && <Badge tone="outline">Admin</Badge>}
              </h1>
              <p className="muted">Miembro desde {formatDate(data.user.createdAt)}</p>
              {data.user.bio && <p className="profile-bio">{data.user.bio}</p>}
            </div>
            <dl className="profile-stats">
              <div>
                <dt>Proyectos</dt>
                <dd>{formatNumber(data.projectCount)}</dd>
              </div>
              <div>
                <dt>Likes</dt>
                <dd>{formatNumber(totalLikes)}</dd>
              </div>
            </dl>
          </header>

          {data.projects.length === 0 ? (
            <EmptyState icon="folder" title="Sin proyectos todavía">
              {me?.username === data.user.username ? 'Publica tu primer proyecto desde tu dashboard.' : 'Esta persona aún no ha publicado proyectos.'}
            </EmptyState>
          ) : (
            <>
              <h2 className="section-title">{plural(data.projectCount, 'proyecto', 'proyectos')}</h2>
              <ProjectGrid
                projects={data.projects}
                showOwner={false}
                onLikeChange={(id, liked, count) =>
                  setData((prev) => (prev ? { ...prev, projects: patchLike(prev.projects, id, liked, count) } : prev))
                }
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
