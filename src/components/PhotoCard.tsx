import { useAuth } from '../context/AuthContext';
import type { Photo } from '../types';

interface PhotoCardProps {
  photo: Photo;
  onOpen: (photo: Photo) => void;
  onToggleLike: (photo: Photo) => void;
  featured?: boolean;
}

export function PhotoCard({ photo, onOpen, onToggleLike, featured }: PhotoCardProps) {
  const { user } = useAuth();

  return (
    <article className={`photo-card${featured ? ' photo-card-featured' : ''}`}>
      <button className="photo-card-image" onClick={() => onOpen(photo)}>
        <img src={photo.imageUrl} alt={photo.title} loading="lazy" />
        <span className="photo-card-category">{photo.category}</span>
      </button>

      <div className="photo-card-body">
        <h3 onClick={() => onOpen(photo)}>{photo.title}</h3>
        <p className="photo-card-author">por {photo.uploader.username}</p>

        <div className="photo-card-actions">
          <button
            className={`like-btn${photo.likedByMe ? ' liked' : ''}`}
            onClick={() => onToggleLike(photo)}
            disabled={!user}
            title={user ? 'Me gusta' : 'Inicia sesión para dar like'}
          >
            {photo.likedByMe ? '❤️' : '🤍'} {photo.likeCount}
          </button>
          <button className="comment-btn" onClick={() => onOpen(photo)}>
            💬 {photo.commentCount}
          </button>
        </div>
      </div>
    </article>
  );
}
