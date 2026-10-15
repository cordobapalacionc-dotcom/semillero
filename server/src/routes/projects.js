import { Router } from 'express';
import { commentSchema, listQuerySchema } from '../../../shared/validation.js';
import { HttpError } from '../middleware/errors.js';
import { ADMIN_ROLES } from '../middleware/auth.js';
import { parseId, validate } from '../middleware/validate.js';
import { toComment } from '../services/dto.js';
import {
  PUBLIC_SORTS,
  getProjectDetail,
  normalizeCategory,
  projectFilters,
  queryProjects,
} from '../services/projects.js';

const PUBLIC_PAGE_SIZE = 12;
const FEATURED_LIMIT = 12;

const COMMENT_SELECT = `
  SELECT c.*, u.username AS author_username
  FROM comments c
  JOIN users u ON u.id = c.user_id
`;

export function createProjectsRouter(ctx, { requireAuth, optionalAuth }) {
  const { db } = ctx;
  const router = Router();

  // Proyecto visible públicamente (existe y su dueño está activo), o 404.
  function findVisibleProject(id) {
    const row = db
      .prepare(
        `SELECT p.id, p.owner_id FROM projects p JOIN users u ON u.id = p.owner_id
         WHERE p.id = ? AND u.status = 'active'`,
      )
      .get(id);
    if (!row) throw new HttpError(404, 'Proyecto no encontrado');
    return row;
  }

  router.get('/', optionalAuth, validate(listQuerySchema, 'query'), (req, res) => {
    const { q, category, sort, page } = req.validatedQuery;
    const { where, params } = projectFilters({
      q,
      category: category ? normalizeCategory(db, category) : '',
      onlyActiveOwners: true,
    });
    res.json(
      queryProjects(db, {
        where,
        params,
        orderBy: PUBLIC_SORTS[sort],
        page,
        pageSize: PUBLIC_PAGE_SIZE,
        viewerId: req.user?.id ?? 0,
      }),
    );
  });

  router.get('/featured', optionalAuth, (req, res) => {
    const { where, params } = projectFilters({ onlyActiveOwners: true, featured: true });
    const { items } = queryProjects(db, {
      where,
      params,
      orderBy: 'p.updated_at DESC, p.id DESC',
      pageSize: FEATURED_LIMIT,
      viewerId: req.user?.id ?? 0,
    });
    res.json(items);
  });

  router.get('/categories', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT p.category AS name, COUNT(*) AS count
         FROM projects p JOIN users u ON u.id = p.owner_id
         WHERE u.status = 'active'
         GROUP BY p.category
         ORDER BY count DESC, name COLLATE NOCASE`,
      )
      .all();
    res.json(rows.map((r) => ({ name: r.name, count: Number(r.count) })));
  });

  router.delete('/comments/:id', requireAuth, (req, res, next) => {
    try {
      const comment = db
        .prepare(
          `SELECT c.id, c.user_id, p.owner_id FROM comments c
           JOIN projects p ON p.id = c.project_id WHERE c.id = ?`,
        )
        .get(parseId(req.params.id));
      if (!comment) throw new HttpError(404, 'Comentario no encontrado');

      const allowed =
        Number(comment.user_id) === req.user.id ||
        Number(comment.owner_id) === req.user.id ||
        ADMIN_ROLES.has(req.user.role);
      if (!allowed) throw new HttpError(403, 'No puedes eliminar este comentario');

      db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', optionalAuth, (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      findVisibleProject(id);
      res.json(getProjectDetail(db, id, req.user?.id ?? 0));
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/like', requireAuth, (req, res, next) => {
    try {
      const project = findVisibleProject(parseId(req.params.id));
      const existing = db
        .prepare('SELECT id FROM likes WHERE project_id = ? AND user_id = ?')
        .get(project.id, req.user.id);

      if (existing) db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
      else db.prepare('INSERT OR IGNORE INTO likes (project_id, user_id) VALUES (?, ?)').run(project.id, req.user.id);

      const { n } = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE project_id = ?').get(project.id);
      res.json({ liked: !existing, likeCount: Number(n) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/comments', (req, res, next) => {
    try {
      const project = findVisibleProject(parseId(req.params.id));
      const rows = db
        .prepare(`${COMMENT_SELECT} WHERE c.project_id = ? ORDER BY c.created_at ASC, c.id ASC`)
        .all(project.id);
      res.json(rows.map(toComment));
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/comments', requireAuth, validate(commentSchema), (req, res, next) => {
    try {
      const project = findVisibleProject(parseId(req.params.id));
      const result = db
        .prepare('INSERT INTO comments (project_id, user_id, content) VALUES (?, ?, ?)')
        .run(project.id, req.user.id, req.body.content);
      const row = db.prepare(`${COMMENT_SELECT} WHERE c.id = ?`).get(Number(result.lastInsertRowid));
      res.status(201).json(toComment(row));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
