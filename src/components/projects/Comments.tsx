import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LIMITS } from '../../../shared/validation.js';
import { projectsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { errorMessage, timeAgo } from '../../lib/format';
import { useConfirm } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { Spinner } from '../ui/Feedback';

export function Comments({ projectId, ownerId, onCountChange }: { projectId: number; ownerId: number; onCountChange: (delta: number) => void }) {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const location = useLocation();
  const { data: comments, loading, error, setData, reload } = useAsync(() => projectsApi.comments(projectId), [projectId]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const trimmed = content.trim();
  const tooLong = trimmed.length > LIMITS.commentMax;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || tooLong || sending) return;
    setSending(true);
    try {
      const comment = await projectsApi.addComment(projectId, trimmed);
      setData((prev) => [...(prev ?? []), comment]);
      onCountChange(1);
      setContent('');
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo publicar el comentario'));
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: number) {
    const ok = await confirm({
      title: 'Eliminar comentario',
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await projectsApi.deleteComment(id);
      setData((prev) => (prev ?? []).filter((c) => c.id !== id));
      onCountChange(-1);
      toast.success('Comentario eliminado');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const canDelete = (authorId: number) => Boolean(user && (user.id === authorId || user.id === ownerId || isAdmin));

  return (
    <section className="comments" aria-labelledby="comments-title">
      <h2 id="comments-title">Comentarios {comments && <span className="muted">({comments.length})</span>}</h2>

      {user ? (
        <form className="comment-form" onSubmit={handleSubmit}>
          <span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span>
          <div className="comment-input">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe un comentario…"
              rows={2}
              aria-label="Comentario"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e);
              }}
            />
            <div className="comment-actions">
              <span className={`muted counter${tooLong ? ' over' : ''}`}>
                {trimmed.length}/{LIMITS.commentMax}
              </span>
              <button className="btn btn-primary btn-sm" disabled={!trimmed || tooLong || sending}>
                {sending ? 'Publicando…' : 'Comentar'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <p className="muted comment-login">
          <Link className="link" to={`/login?next=${encodeURIComponent(location.pathname)}`}>
            Inicia sesión
          </Link>{' '}
          para comentar.
        </p>
      )}

      {loading && !comments ? (
        <Spinner label="Cargando comentarios…" />
      ) : error ? (
        <p className="muted">
          {error}{' '}
          <button className="link" onClick={reload}>
            Reintentar
          </button>
        </p>
      ) : comments && comments.length === 0 ? (
        <p className="muted">Todavía no hay comentarios. ¡Sé el primero!</p>
      ) : (
        <ul className="comment-list">
          {comments?.map((c) => (
            <li key={c.id}>
              <span className="avatar">{c.author.username.slice(0, 1).toUpperCase()}</span>
              <div className="comment-body">
                <div className="comment-head">
                  <Link to={`/usuarios/${c.author.username}`}>
                    <strong>{c.author.username}</strong>
                  </Link>
                  {c.author.id === ownerId && <span className="badge badge-outline">Autor</span>}
                  <span className="muted">{timeAgo(c.createdAt)}</span>
                  {canDelete(c.author.id) && (
                    <button className="icon-btn comment-delete" onClick={() => handleDelete(c.id)} aria-label="Eliminar comentario" title="Eliminar">
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </div>
                <p>{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
