import { transaction } from '../db.js';
import { HttpError } from '../middleware/errors.js';
import { collectProjectFiles, removeFiles } from './files.js';
import { toPhoto, toProjectSummary } from './dto.js';

// Columnas de un resumen de proyecto. Requiere el parámetro con nombre :viewer (0 = visitante).
const SUMMARY_SELECT = `
  SELECT
    p.*,
    u.username AS owner_username,
    COALESCE(
      (SELECT image_path FROM photos WHERE id = p.cover_photo_id),
      (SELECT image_path FROM photos WHERE project_id = p.id ORDER BY position, id LIMIT 1)
    ) AS cover_path,
    (SELECT COUNT(*) FROM photos WHERE project_id = p.id) AS photo_count,
    (SELECT COUNT(*) FROM likes WHERE project_id = p.id) AS like_count,
    (SELECT COUNT(*) FROM comments WHERE project_id = p.id) AS comment_count,
    EXISTS (SELECT 1 FROM likes WHERE project_id = p.id AND user_id = :viewer) AS liked_by_me
  FROM projects p
  JOIN users u ON u.id = p.owner_id
`;

export const PUBLIC_SORTS = {
  recent: 'p.created_at DESC, p.id DESC',
  popular: 'like_count DESC, p.created_at DESC, p.id DESC',
  commented: 'comment_count DESC, p.created_at DESC, p.id DESC',
};

export function escapeLike(value) {
  return `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// Construye las condiciones comunes de búsqueda. Devuelve fragmentos SQL y parámetros con nombre.
export function projectFilters({ q, category, ownerId, onlyActiveOwners, featured, searchOwner = false }) {
  const where = [];
  const params = {};
  if (q) {
    const fields = ['p.title', 'p.description', 'p.category'];
    if (searchOwner) fields.push('u.username');
    where.push(`(${fields.map((f) => `${f} LIKE :q ESCAPE '\\'`).join(' OR ')})`);
    params.q = escapeLike(q);
  }
  if (category) {
    where.push('p.category = :category');
    params.category = category;
  }
  if (ownerId !== undefined) {
    where.push('p.owner_id = :ownerId');
    params.ownerId = ownerId;
  }
  if (onlyActiveOwners) where.push("u.status = 'active'");
  if (featured !== undefined) {
    where.push('p.featured = :featured');
    params.featured = featured ? 1 : 0;
  }
  return { where, params };
}

export function queryProjects(db, { where = [], params = {}, orderBy, page = 1, pageSize = 12, viewerId = 0 }) {
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number(
    db
      .prepare(`SELECT COUNT(*) AS n FROM projects p JOIN users u ON u.id = p.owner_id ${whereSql}`)
      .get(params).n,
  );
  const rows = db
    .prepare(`${SUMMARY_SELECT} ${whereSql} ORDER BY ${orderBy} LIMIT :limit OFFSET :offset`)
    .all({ ...params, viewer: viewerId, limit: pageSize, offset: (page - 1) * pageSize });
  return { items: rows.map(toProjectSummary), total, page, pageSize };
}

export function getProjectSummaryRow(db, id, viewerId = 0) {
  return db.prepare(`${SUMMARY_SELECT} WHERE p.id = :id`).get({ id, viewer: viewerId });
}

export function getProjectDetail(db, id, viewerId = 0) {
  const row = getProjectSummaryRow(db, id, viewerId);
  if (!row) return null;
  const photos = db
    .prepare('SELECT * FROM photos WHERE project_id = ? ORDER BY position, id')
    .all(id)
    .map(toPhoto);
  return {
    ...toProjectSummary(row),
    coverPhotoId: row.cover_photo_id === null ? (photos[0]?.id ?? null) : Number(row.cover_photo_id),
    photos,
  };
}

// Limpia espacios y reutiliza la forma ya existente de la categoría (sin distinguir mayúsculas).
export function normalizeCategory(db, raw) {
  const clean = raw.trim().replace(/\s+/g, ' ');
  const key = clean.toLocaleLowerCase('es');
  const existing = db
    .prepare('SELECT DISTINCT category FROM projects')
    .all()
    .find((r) => r.category.toLocaleLowerCase('es') === key);
  return existing ? existing.category : clean;
}

export function findOwnedProject(db, id, userId) {
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND owner_id = ?').get(id, userId);
  if (!row) throw new HttpError(404, 'Proyecto no encontrado');
  return row;
}

export function touchProject(db, id) {
  db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(id);
}

// Si el proyecto no tiene portada válida, usa la primera foto según el orden.
export function ensureCover(db, projectId) {
  db.prepare(
    `UPDATE projects
     SET cover_photo_id = (SELECT id FROM photos WHERE project_id = :id ORDER BY position, id LIMIT 1)
     WHERE id = :id
       AND (cover_photo_id IS NULL OR cover_photo_id NOT IN (SELECT id FROM photos WHERE project_id = :id))`,
  ).run({ id: projectId });
}

export async function deleteProjects(ctx, ids) {
  if (ids.length === 0) return 0;
  const files = collectProjectFiles(ctx.db, ids);
  const placeholders = ids.map(() => '?').join(',');
  const deleted = transaction(ctx.db, () =>
    Number(ctx.db.prepare(`DELETE FROM projects WHERE id IN (${placeholders})`).run(...ids).changes),
  );
  await removeFiles(ctx.uploadsDir, files);
  return deleted;
}
