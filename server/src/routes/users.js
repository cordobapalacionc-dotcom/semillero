import { Router } from 'express';
import { HttpError } from '../middleware/errors.js';
import { toUser } from '../services/dto.js';
import { projectFilters, queryProjects } from '../services/projects.js';

const PROFILE_PROJECTS_LIMIT = 100;

export function createUsersRouter(ctx, { optionalAuth }) {
  const { db } = ctx;
  const router = Router();

  router.get('/:username', optionalAuth, (req, res, next) => {
    try {
      const row = db
        .prepare("SELECT * FROM users WHERE username = ? AND status = 'active'")
        .get(String(req.params.username));
      if (!row) throw new HttpError(404, 'Usuario no encontrado');

      const { where, params } = projectFilters({ ownerId: Number(row.id) });
      const { items, total } = queryProjects(db, {
        where,
        params,
        orderBy: 'p.created_at DESC, p.id DESC',
        pageSize: PROFILE_PROJECTS_LIMIT,
        viewerId: req.user?.id ?? 0,
      });
      res.json({ user: toUser(row), projects: items, projectCount: total });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
