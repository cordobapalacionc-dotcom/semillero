import { Router } from 'express';
import {
  LIMITS,
  captionSchema,
  listQuerySchema,
  photoOrderSchema,
  projectSchema,
  projectUpdateSchema,
} from '../../shared/validation.js';
import { transaction } from '../db.js';
import { HttpError } from '../middleware/errors.js';
import { parseId, validate } from '../middleware/validate.js';
import { createUpload } from '../middleware/upload.js';
import { removeFiles } from '../services/files.js';
import { getMeStats } from '../services/stats.js';
import {
  PUBLIC_SORTS,
  deleteProjects,
  ensureCover,
  findOwnedProject,
  getProjectDetail,
  normalizeCategory,
  projectFilters,
  queryProjects,
  touchProject,
} from '../services/projects.js';

const DASHBOARD_PAGE_SIZE = 20;

export function createMeRouter(ctx, { requireAuth }) {
  const { db } = ctx;
  const router = Router();
  const uploadPhotos = createUpload(ctx.uploadsDir);

  router.use(requireAuth);

  // Si algo falla después de guardar las imágenes, se borran para no dejar huérfanas.
  const discardUploads = (req) => removeFiles(ctx.uploadsDir, (req.savedFiles ?? []).map((f) => f.filename));

  const loadOwned = (req, _res, next) => {
    try {
      req.project = findOwnedProject(db, parseId(req.params.id), req.user.id);
      next();
    } catch (err) {
      next(err);
    }
  };

  router.get('/stats', (req, res) => {
    res.json(getMeStats(db, req.user.id));
  });

  router.get('/projects', validate(listQuerySchema, 'query'), (req, res) => {
    const { q, category, sort, page } = req.validatedQuery;
    const { where, params } = projectFilters({
      q,
      category: category ? normalizeCategory(db, category) : '',
      ownerId: req.user.id,
    });
    res.json(
      queryProjects(db, {
        where,
        params,
        orderBy: PUBLIC_SORTS[sort],
        page,
        pageSize: DASHBOARD_PAGE_SIZE,
        viewerId: req.user.id,
      }),
    );
  });

  router.post('/projects', uploadPhotos, async (req, res, next) => {
    try {
      const parsed = projectSchema.safeParse(req.body ?? {});
      if (!parsed.success) throw parsed.error;
      if (req.savedFiles.length === 0) throw new HttpError(400, 'Debes subir al menos una foto');

      const { title, description, category } = parsed.data;
      const projectId = transaction(db, () => {
        const result = db
          .prepare('INSERT INTO projects (owner_id, title, description, category) VALUES (?, ?, ?, ?)')
          .run(req.user.id, title, description, normalizeCategory(db, category));
        const id = Number(result.lastInsertRowid);
        const insertPhoto = db.prepare('INSERT INTO photos (project_id, image_path, position) VALUES (?, ?, ?)');
        req.savedFiles.forEach((file, index) => insertPhoto.run(id, file.filename, index));
        ensureCover(db, id);
        return id;
      });

      res.status(201).json(getProjectDetail(db, projectId, req.user.id));
    } catch (err) {
      await discardUploads(req);
      next(err);
    }
  });

  router.patch('/projects/:id', loadOwned, validate(projectUpdateSchema), (req, res, next) => {
    try {
      const { title, description, category, coverPhotoId } = req.body;
      const project = req.project;

      if (coverPhotoId !== undefined) {
        const photo = db
          .prepare('SELECT id FROM photos WHERE id = ? AND project_id = ?')
          .get(coverPhotoId, project.id);
        if (!photo) throw new HttpError(400, 'La portada debe ser una foto de este proyecto');
      }

      db.prepare(
        `UPDATE projects
         SET title = ?, description = ?, category = ?, cover_photo_id = ?, updated_at = datetime('now')
         WHERE id = ?`,
      ).run(
        title ?? project.title,
        description ?? project.description,
        category !== undefined ? normalizeCategory(db, category) : project.category,
        coverPhotoId ?? project.cover_photo_id,
        project.id,
      );

      res.json(getProjectDetail(db, project.id, req.user.id));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/projects/:id', loadOwned, async (req, res, next) => {
    try {
      await deleteProjects(ctx, [req.project.id]);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.post('/projects/:id/photos', loadOwned, uploadPhotos, async (req, res, next) => {
    try {
      const projectId = req.project.id;
      if (req.savedFiles.length === 0) throw new HttpError(400, 'Debes subir al menos una foto');

      transaction(db, () => {
        const { n, maxPos } = db
          .prepare('SELECT COUNT(*) AS n, COALESCE(MAX(position), -1) AS maxPos FROM photos WHERE project_id = ?')
          .get(projectId);
        if (Number(n) + req.savedFiles.length > LIMITS.photosPerProject) {
          throw new HttpError(400, `Un proyecto puede tener máximo ${LIMITS.photosPerProject} fotos`);
        }
        const insertPhoto = db.prepare('INSERT INTO photos (project_id, image_path, position) VALUES (?, ?, ?)');
        req.savedFiles.forEach((file, index) => insertPhoto.run(projectId, file.filename, Number(maxPos) + 1 + index));
        ensureCover(db, projectId);
        touchProject(db, projectId);
      });

      res.status(201).json(getProjectDetail(db, projectId, req.user.id));
    } catch (err) {
      await discardUploads(req);
      next(err);
    }
  });

  // Debe ir antes de /photos/:photoId para que "order" no se interprete como un id.
  router.patch('/projects/:id/photos/order', loadOwned, validate(photoOrderSchema), (req, res, next) => {
    try {
      const projectId = req.project.id;
      const { photoIds } = req.body;
      const current = db
        .prepare('SELECT id FROM photos WHERE project_id = ?')
        .all(projectId)
        .map((r) => Number(r.id));

      const sameSet =
        photoIds.length === current.length &&
        new Set(photoIds).size === photoIds.length &&
        photoIds.every((id) => current.includes(id));
      if (!sameSet) throw new HttpError(400, 'El orden enviado no coincide con las fotos del proyecto');

      transaction(db, () => {
        const update = db.prepare('UPDATE photos SET position = ? WHERE id = ?');
        photoIds.forEach((id, index) => update.run(index, id));
        touchProject(db, projectId);
      });

      res.json(getProjectDetail(db, projectId, req.user.id));
    } catch (err) {
      next(err);
    }
  });

  const loadPhoto = (req) => {
    const photo = db
      .prepare('SELECT * FROM photos WHERE id = ? AND project_id = ?')
      .get(parseId(req.params.photoId), req.project.id);
    if (!photo) throw new HttpError(404, 'Foto no encontrada');
    return photo;
  };

  router.patch('/projects/:id/photos/:photoId', loadOwned, validate(captionSchema), (req, res, next) => {
    try {
      const photo = loadPhoto(req);
      db.prepare('UPDATE photos SET caption = ? WHERE id = ?').run(req.body.caption, photo.id);
      touchProject(db, req.project.id);
      res.json(getProjectDetail(db, req.project.id, req.user.id));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/projects/:id/photos/:photoId', loadOwned, async (req, res, next) => {
    try {
      const projectId = req.project.id;
      const photo = loadPhoto(req);
      const { n } = db.prepare('SELECT COUNT(*) AS n FROM photos WHERE project_id = ?').get(projectId);
      if (Number(n) <= 1) throw new HttpError(400, 'El proyecto debe tener al menos una foto');

      transaction(db, () => {
        db.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
        ensureCover(db, projectId);
        touchProject(db, projectId);
      });
      await removeFiles(ctx.uploadsDir, [photo.image_path]);

      res.json(getProjectDetail(db, projectId, req.user.id));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
