import { Router } from 'express';
import { z } from 'zod';
import { adminListQuerySchema, bulkIdsSchema } from '../../../shared/validation.js';
import { transaction } from '../db.js';
import { HttpError } from '../middleware/errors.js';
import { parseId, validate } from '../middleware/validate.js';
import { toAdminUser, toComment } from '../services/dto.js';
import { collectUserFiles, removeFiles } from '../services/files.js';
import { canManage } from '../services/permissions.js';
import {
  deleteProjects,
  escapeLike,
  getProjectDetail,
  normalizeCategory,
  projectFilters,
  queryProjects,
} from '../services/projects.js';
import { ADMIN_RANGES, getAdminStats } from '../services/stats.js';

const ADMIN_PAGE_SIZE = 20;

// Listas blancas: el cliente elige una clave, nunca un fragmento SQL.
const PROJECT_SORTS = {
  createdAt: 'p.created_at',
  title: 'p.title COLLATE NOCASE',
  likes: 'like_count',
  photos: 'photo_count',
  comments: 'comment_count',
  owner: 'owner_username COLLATE NOCASE',
};

const USER_SORTS = {
  createdAt: 'u.created_at',
  username: 'u.username COLLATE NOCASE',
  projects: 'project_count',
  lastLogin: 'u.last_login_at',
};

const featuredSchema = z.object({ featured: z.boolean({ invalid_type_error: 'featured debe ser true o false' }) });
const statusSchema = z.object({ status: z.enum(['active', 'suspended'], { message: 'Estado inválido' }) });
const roleSchema = z.object({ role: z.enum(['user', 'admin'], { message: 'Rol inválido' }) });

function orderBy(sorts, sort, dir, tiebreak) {
  const key = sort ?? 'createdAt';
  if (!sorts[key]) throw new HttpError(400, 'Criterio de orden no permitido');
  return `${sorts[key]} ${dir === 'asc' ? 'ASC' : 'DESC'}, ${tiebreak}`;
}

const USER_SELECT = `
  SELECT u.*, (SELECT COUNT(*) FROM projects WHERE owner_id = u.id) AS project_count
  FROM users u
`;

const COMMENT_SELECT = `
  SELECT c.*, u.username AS author_username, p.title AS project_title
  FROM comments c
  JOIN users u ON u.id = c.user_id
  JOIN projects p ON p.id = c.project_id
`;

export function createAdminRouter(ctx, { requireAdmin }) {
  const { db } = ctx;
  const router = Router();

  router.use(requireAdmin);

  router.get('/stats', (req, res, next) => {
    try {
      const range = req.query.range === undefined ? 30 : Number(req.query.range);
      if (!ADMIN_RANGES.includes(range)) throw new HttpError(400, 'El rango debe ser 7, 30 o 90 días');
      res.json(getAdminStats(db, range));
    } catch (err) {
      next(err);
    }
  });

  // ---- Proyectos ----

  router.get('/projects', validate(adminListQuerySchema, 'query'), (req, res, next) => {
    try {
      const { q, category, featured, sort, dir, page } = req.validatedQuery;
      const { where, params } = projectFilters({
        q,
        category: category ? normalizeCategory(db, category) : '',
        featured: featured === undefined ? undefined : featured === 'true',
        searchOwner: true,
      });
      res.json(
        queryProjects(db, {
          where,
          params,
          orderBy: orderBy(PROJECT_SORTS, sort, dir, 'p.id DESC'),
          page,
          pageSize: ADMIN_PAGE_SIZE,
          viewerId: req.user.id,
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  // A diferencia de la ruta pública, muestra también proyectos de usuarios suspendidos.
  router.get('/projects/:id', (req, res, next) => {
    try {
      const project = getProjectDetail(db, parseId(req.params.id), req.user.id);
      if (!project) throw new HttpError(404, 'Proyecto no encontrado');
      res.json(project);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/projects/:id/featured', validate(featuredSchema), (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const result = db.prepare('UPDATE projects SET featured = ? WHERE id = ?').run(req.body.featured ? 1 : 0, id);
      if (result.changes === 0) throw new HttpError(404, 'Proyecto no encontrado');
      res.json(getProjectDetail(db, id, req.user.id));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/projects/:id', async (req, res, next) => {
    try {
      const deleted = await deleteProjects(ctx, [parseId(req.params.id)]);
      if (deleted === 0) throw new HttpError(404, 'Proyecto no encontrado');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.post('/projects/bulk-delete', validate(bulkIdsSchema), async (req, res, next) => {
    try {
      const deleted = await deleteProjects(ctx, [...new Set(req.body.ids)]);
      res.json({ deleted });
    } catch (err) {
      next(err);
    }
  });

  // ---- Comentarios ----

  router.get('/comments', validate(adminListQuerySchema, 'query'), (req, res) => {
    const { q, page } = req.validatedQuery;
    const where = q
      ? "WHERE (c.content LIKE :q ESCAPE '\\' OR u.username LIKE :q ESCAPE '\\' OR p.title LIKE :q ESCAPE '\\')"
      : '';
    const params = q ? { q: escapeLike(q) } : {};
    const total = Number(
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM comments c
           JOIN users u ON u.id = c.user_id JOIN projects p ON p.id = c.project_id ${where}`,
        )
        .get(params).n,
    );
    const items = db
      .prepare(`${COMMENT_SELECT} ${where} ORDER BY c.created_at DESC, c.id DESC LIMIT :limit OFFSET :offset`)
      .all({ ...params, limit: ADMIN_PAGE_SIZE, offset: (page - 1) * ADMIN_PAGE_SIZE })
      .map(toComment);
    res.json({ items, total, page, pageSize: ADMIN_PAGE_SIZE });
  });

  router.delete('/comments/:id', (req, res, next) => {
    try {
      const result = db.prepare('DELETE FROM comments WHERE id = ?').run(parseId(req.params.id));
      if (result.changes === 0) throw new HttpError(404, 'Comentario no encontrado');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.post('/comments/bulk-delete', validate(bulkIdsSchema), (req, res) => {
    const ids = [...new Set(req.body.ids)];
    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM comments WHERE id IN (${placeholders})`).run(...ids);
    res.json({ deleted: Number(result.changes) });
  });

  // ---- Usuarios ----

  const loadUserRow = (id) => db.prepare(`${USER_SELECT} WHERE u.id = ?`).get(id);

  function loadTarget(req, action) {
    const target = loadUserRow(parseId(req.params.id));
    if (!target) throw new HttpError(404, 'Usuario no encontrado');
    const check = canManage(req.user, { id: Number(target.id), role: target.role }, action);
    if (!check.ok) throw new HttpError(403, check.reason);
    return target;
  }

  router.get('/users', validate(adminListQuerySchema, 'query'), (req, res, next) => {
    try {
      const { q, role, status, sort, dir, page } = req.validatedQuery;
      const where = [];
      const params = {};
      if (q) {
        where.push("(u.username LIKE :q ESCAPE '\\' OR u.email LIKE :q ESCAPE '\\')");
        params.q = escapeLike(q);
      }
      if (role) {
        where.push('u.role = :role');
        params.role = role;
      }
      if (status) {
        where.push('u.status = :status');
        params.status = status;
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const order = orderBy(USER_SORTS, sort, dir, 'u.id DESC');

      const total = Number(db.prepare(`SELECT COUNT(*) AS n FROM users u ${whereSql}`).get(params).n);
      const items = db
        .prepare(`${USER_SELECT} ${whereSql} ORDER BY ${order} LIMIT :limit OFFSET :offset`)
        .all({ ...params, limit: ADMIN_PAGE_SIZE, offset: (page - 1) * ADMIN_PAGE_SIZE })
        .map(toAdminUser);
      res.json({ items, total, page, pageSize: ADMIN_PAGE_SIZE });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/users/:id/status', validate(statusSchema), (req, res, next) => {
    try {
      const { status } = req.body;
      const target = loadTarget(req, status === 'suspended' ? 'suspend' : 'activate');
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, target.id);
      res.json(toAdminUser(loadUserRow(target.id)));
    } catch (err) {
      next(err);
    }
  });

  router.patch('/users/:id/role', validate(roleSchema), (req, res, next) => {
    try {
      const target = loadTarget(req, 'setRole');
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(req.body.role, target.id);
      res.json(toAdminUser(loadUserRow(target.id)));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/users/:id', async (req, res, next) => {
    try {
      const target = loadTarget(req, 'delete');
      const files = collectUserFiles(db, target.id);
      transaction(db, () => db.prepare('DELETE FROM users WHERE id = ?').run(target.id));
      await removeFiles(ctx.uploadsDir, files);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
