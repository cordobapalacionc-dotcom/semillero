import { Link } from 'react-router-dom';
import type { ProjectSummary } from '../../types';
import { timeAgo } from '../../lib/format';
import { Icon } from '../ui/Icon';
import { LikeButton } from './LikeButton';

interface ProjectCardProps {
  project: ProjectSummary;
  onLikeChange?: (id: number, liked: boolean, count: number) => void;
  showOwner?: boolean;
}

export function ProjectCard({ project, onLikeChange, showOwner = true }: ProjectCardProps) {
  return (
    <article className="project-card">
      <Link to={`/proyectos/${project.id}`} className="project-cover" aria-label={`Ver ${project.title}`}>
        {project.coverUrl ? (
          <img src={project.coverUrl} alt="" loading="lazy" />
        ) : (
          <span className="cover-empty">
            <Icon name="image" size={28} />
          </span>
        )}
        <span className="cover-chip">
          <Icon name="image" size={12} /> {project.photoCount}
        </span>
        {project.featured && <span className="cover-chip cover-chip-left">★ Destacado</span>}
      </Link>
      <div className="project-body">
        <div className="project-meta">
          <span className="eyebrow">{project.category}</span>
          <span className="muted">{timeAgo(project.createdAt)}</span>
        </div>
        <h3>
          <Link to={`/proyectos/${project.id}`}>{project.title}</Link>
        </h3>
        <div className="project-foot">
          {showOwner ? (
            <Link to={`/usuarios/${project.owner.username}`} className="owner">
              <span className="avatar avatar-xs">{project.owner.username.slice(0, 1).toUpperCase()}</span>
              {project.owner.username}
            </Link>
          ) : (
            <span />
          )}
          <div className="project-stats">
            <span className="stat-inline" title="Comentarios">
              <Icon name="comment" size={15} /> {project.commentCount}
            </span>
            <LikeButton
              size="sm"
              projectId={project.id}
              liked={project.likedByMe}
              count={project.likeCount}
              onChange={(liked, count) => onLikeChange?.(project.id, liked, count)}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProjectGrid({
  projects,
  onLikeChange,
  showOwner,
}: {
  projects: ProjectSummary[];
  onLikeChange?: (id: number, liked: boolean, count: number) => void;
  showOwner?: boolean;
}) {
  return (
    <div className="project-grid">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} onLikeChange={onLikeChange} showOwner={showOwner} />
      ))}
    </div>
  );
}

export function ProjectGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="project-grid" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="project-card">
          <div className="project-cover skeleton" />
          <div className="project-body">
            <div className="skeleton" style={{ height: 12, width: '40%' }} />
            <div className="skeleton" style={{ height: 18, width: '80%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Actualiza el like de un proyecto dentro de una lista.
export function patchLike<T extends ProjectSummary>(list: T[], id: number, liked: boolean, count: number): T[] {
  return list.map((p) => (p.id === id ? { ...p, likedByMe: liked, likeCount: count } : p));
}
