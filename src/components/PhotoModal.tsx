import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Comment, Photo } from '../types';

interface PhotoModalProps {
  photo: Photo;
  onClose: () => void;
  onToggleLike: (photo: Photo) => void;
  onDeleted: (photoId: number) => void;
}

export function PhotoModal({ photo, onClose, onToggleLike, onDeleted }: PhotoModalProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingComments(true);
    api
      .listComments(photo.id)
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingComments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [photo.id]);

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setError(null);
    try {
      const comment = await api.addComment(photo.id, newComment.trim());
      setComments((prev) => [...prev, comment]);
      setNewComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo comentar');
    }
  }

  async function handleDeleteComment(id: number) {
    try {
      await api.deleteComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el comentario');
    }
  }

  async function handleDeletePhoto() {
    if (!confirm('¿Eliminar esta foto de forma permanente?')) return;
    setDeleting(true);
    try {
      await api.deletePhoto(photo.id);
      onDeleted(photo.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la foto');
      setDeleting(false);
    }
  }

  const isOwner = user?.id === photo.uploader.id;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal photo-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        <div className="photo-modal-image">
          <img src={photo.imageUrl} alt={photo.title} />
        </div>

        <div className="photo-modal-content">
          <span className="photo-card-category">{photo.category}</span>
          <h2>{photo.title}</h2>
          <p className="photo-modal-author">por {photo.uploader.username}</p>
          {photo.description && <p className="photo-modal-description">{photo.description}</p>}

          <div className="photo-card-actions">
            <button
              className={`like-btn${photo.likedByMe ? ' liked' : ''}`}
              onClick={() => onToggleLike(photo)}
              disabled={!user}
            >
              {photo.likedByMe ? '❤️' : '🤍'} {photo.likeCount} me gusta
            </button>

            {isOwner && (
              <button className="btn btn-danger" onClick={handleDeletePhoto} disabled={deleting}>
                {deleting ? 'Eliminando…' : '🗑 Eliminar foto'}
              </button>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="comments-section">
            <h3>💬 Comentarios ({comments.length})</h3>

            {loadingComments ? (
              <p className="muted">Cargando comentarios…</p>
            ) : (
              <ul className="comments-list">
                {comments.map((c) => (
                  <li key={c.id}>
                    <div>
                      <strong>{c.author.username}</strong>
                      <p>{c.content}</p>
                    </div>
                    {user?.id === c.author.id && (
                      <button className="link-btn" onClick={() => handleDeleteComment(c.id)}>
                        eliminar
                      </button>
                    )}
                  </li>
                ))}
                {comments.length === 0 && (
                  <li className="muted">Sé la primera persona en comentar.</li>
                )}
              </ul>
            )}

            {user ? (
              <form onSubmit={handleAddComment} className="comment-form">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escribe un comentario…"
                  maxLength={500}
                />
                <button type="submit" className="btn btn-primary">
                  Enviar
                </button>
              </form>
            ) : (
              <p className="muted">Inicia sesión para comentar.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
