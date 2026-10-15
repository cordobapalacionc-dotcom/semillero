import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { projectsApi } from '../../api';
import { Comments } from '../../components/projects/Comments';
import { Lightbox } from '../../components/projects/Lightbox';
import { LikeButton } from '../../components/projects/LikeButton';
import { ErrorState, Spinner } from '../../components/ui/Feedback';
import { Icon } from '../../components/ui/Icon';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { formatDate, plural } from '../../lib/format';
import { NotFoundPage } from './NotFoundPage';

export function ProjectPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const { user } = useAuth();
  const { data: project, loading, error, setData, reload } = useAsync(() => projectsApi.get(projectId), [projectId, user?.id]);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (!Number.isInteger(projectId) || projectId <= 0) return <NotFoundPage />;
  if (loading && !project) return <Spinner label="Cargando proyecto…" />;
  if (error === 'Proyecto no encontrado') return <NotFoundPage />;
  if (error || !project)
    return (
      <div className="page">
        <ErrorState message={error ?? 'No se encontró el proyecto'} onRetry={reload} />
      </div>
    );

  const photos = project.photos;
  const current = photos[Math.min(active, photos.length - 1)];
  const isOwner = user?.id === project.owner.id;

  return (
    <div className="page project-page">
      <nav className="breadcrumb" aria-label="Ruta">
        <Link to="/">Explorar</Link>
        <span aria-hidden>/</span>
        <Link to={`/?category=${encodeURIComponent(project.category)}`}>{project.category}</Link>
      </nav>

      <div className="project-layout">
        <div className="gallery">
          {current && (
            <button className="gallery-main" onClick={() => setLightbox(true)} aria-label="Ver en pantalla completa">
              <img src={current.url} alt={current.caption || project.title} />
              <span className="gallery-zoom">
                <Icon name="eye" size={14} /> Pantalla completa
              </span>
            </button>
          )}
          {current?.caption && <p className="gallery-caption muted">{current.caption}</p>}
          {photos.length > 1 && (
            <div className="thumbs" role="list">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  role="listitem"
                  className={`thumb-btn${i === active ? ' active' : ''}`}
                  onClick={() => setActive(i)}
                  aria-label={`Foto ${i + 1}`}
                  aria-current={i === active}
                >
                  <img src={p.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="project-info">
          <span className="eyebrow">{project.category}</span>
          <h1>{project.title}</h1>
          {project.featured && <span className="badge badge-solid">★ Destacado</span>}

          <Link to={`/usuarios/${project.owner.username}`} className="owner owner-lg">
            <span className="avatar">{project.owner.username.slice(0, 1).toUpperCase()}</span>
            <span>
              <strong>{project.owner.username}</strong>
              <span className="muted">Publicado el {formatDate(project.createdAt)}</span>
            </span>
          </Link>

          <div className="project-actions">
            <LikeButton
              projectId={project.id}
              liked={project.likedByMe}
              count={project.likeCount}
              onChange={(liked, likeCount) => setData((prev) => (prev ? { ...prev, likedByMe: liked, likeCount } : prev))}
            />
            <span className="stat-inline">
              <Icon name="comment" /> {plural(project.commentCount, 'comentario', 'comentarios')}
            </span>
            <span className="stat-inline">
              <Icon name="image" /> {plural(photos.length, 'foto', 'fotos')}
            </span>
          </div>

          {isOwner && (
            <Link to={`/dashboard/proyectos/${project.id}/editar`} className="btn btn-ghost btn-sm">
              <Icon name="edit" size={14} /> Editar proyecto
            </Link>
          )}

          {project.description ? (
            <div className="description">{project.description}</div>
          ) : (
            <p className="muted">Este proyecto no tiene descripción.</p>
          )}
        </aside>
      </div>

      <Comments
        projectId={project.id}
        ownerId={project.owner.id}
        onCountChange={(delta) => setData((prev) => (prev ? { ...prev, commentCount: prev.commentCount + delta } : prev))}
      />

      {lightbox && (
        <Lightbox photos={photos} index={active} onIndexChange={setActive} onClose={() => setLightbox(false)} title={project.title} />
      )}
    </div>
  );
}
