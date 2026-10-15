import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const commentsRouter = Router();

function mapComment(row) {
  return {
    id: Number(row.id),
    content: row.content,
    createdAt: row.createdAt,
    author: { id: Number(row.authorId), username: row.authorUsername },
  };
}

commentsRouter.get('/photos/:photoId/comments', (req, res) => {
  const photoId = Number(req.params.photoId);
  const rows = db
    .prepare(
      `SELECT c.id, c.content, c.created_at AS createdAt, u.id AS authorId, u.username AS authorUsername
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.photo_id = ?
       ORDER BY c.created_at ASC`,
    )
    .all(photoId);

  res.json(rows.map(mapComment));
});

commentsRouter.post('/photos/:photoId/comments', requireAuth, (req, res) => {
  const photoId = Number(req.params.photoId);
  const photo = db.prepare('SELECT id FROM photos WHERE id = ?').get(photoId);

  if (!photo) {
    return res.status(404).json({ error: 'Foto no encontrada' });
  }

  const { content } = req.body ?? {};
  if (typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'El comentario no puede estar vacío' });
  }
  if (content.trim().length > 500) {
    return res.status(400).json({ error: 'El comentario es demasiado largo (máx. 500 caracteres)' });
  }

  const result = db
    .prepare('INSERT INTO comments (photo_id, user_id, content) VALUES (?, ?, ?)')
    .run(photoId, req.user.id, content.trim());

  const row = db
    .prepare(
      `SELECT c.id, c.content, c.created_at AS createdAt, u.id AS authorId, u.username AS authorUsername
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
    )
    .get(Number(result.lastInsertRowid));

  res.status(201).json(mapComment(row));
});

commentsRouter.delete('/comments/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);

  if (!comment) {
    return res.status(404).json({ error: 'Comentario no encontrado' });
  }
  if (Number(comment.user_id) !== req.user.id) {
    return res.status(403).json({ error: 'Solo puedes eliminar tus propios comentarios' });
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(id);
  res.status(204).end();
});
