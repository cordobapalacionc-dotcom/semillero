import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { db } from '../db.js';
import { UPLOADS_DIR } from '../config.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

export const photosRouter = Router();

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      cb(new Error('Formato de imagen no soportado (usa JPG, PNG, WEBP o GIF)'));
      return;
    }
    cb(null, true);
  },
});

const SELECT_PHOTOS_BASE = `
  SELECT
    p.id,
    p.title,
    p.description,
    p.category,
    p.image_path AS imagePath,
    p.created_at AS createdAt,
    u.id AS uploaderId,
    u.username AS uploaderUsername,
    (SELECT COUNT(*) FROM likes l WHERE l.photo_id = p.id) AS likeCount,
    (SELECT COUNT(*) FROM comments c WHERE c.photo_id = p.id) AS commentCount
  FROM photos p
  JOIN users u ON u.id = p.uploader_id
`;

function mapPhotoRow(row, currentUserId) {
  const likedByMe = currentUserId
    ? !!db
        .prepare('SELECT 1 FROM likes WHERE photo_id = ? AND user_id = ?')
        .get(row.id, currentUserId)
    : false;

  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    category: row.category,
    imageUrl: `/uploads/${row.imagePath}`,
    createdAt: row.createdAt,
    uploader: { id: Number(row.uploaderId), username: row.uploaderUsername },
    likeCount: Number(row.likeCount),
    commentCount: Number(row.commentCount),
    likedByMe,
  };
}

photosRouter.get('/', optionalAuth, (req, res) => {
  const rows = db.prepare(`${SELECT_PHOTOS_BASE} ORDER BY p.created_at DESC`).all();
  res.json(rows.map((row) => mapPhotoRow(row, req.user?.id)));
});

photosRouter.get('/featured', optionalAuth, (req, res) => {
  const rows = db
    .prepare(
      `${SELECT_PHOTOS_BASE}
       WHERE (SELECT COUNT(*) FROM likes l WHERE l.photo_id = p.id) > 0
       ORDER BY likeCount DESC, p.created_at DESC
       LIMIT 6`,
    )
    .all();
  res.json(rows.map((row) => mapPhotoRow(row, req.user?.id)));
});

photosRouter.post('/', requireAuth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { title, description = '', category = 'General' } = req.body ?? {};

    if (!req.file) {
      return res.status(400).json({ error: 'Debes adjuntar una imagen' });
    }
    if (typeof title !== 'string' || title.trim().length < 2) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'El título debe tener al menos 2 caracteres' });
    }

    const result = db
      .prepare(
        'INSERT INTO photos (title, description, category, image_path, uploader_id) VALUES (?, ?, ?, ?, ?)',
      )
      .run(title.trim(), description.trim(), category.trim() || 'General', req.file.filename, req.user.id);

    const row = db
      .prepare(`${SELECT_PHOTOS_BASE} WHERE p.id = ?`)
      .get(Number(result.lastInsertRowid));

    res.status(201).json(mapPhotoRow(row, req.user.id));
  });
});

photosRouter.delete('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);

  if (!photo) {
    return res.status(404).json({ error: 'Foto no encontrada' });
  }
  if (Number(photo.uploader_id) !== req.user.id) {
    return res.status(403).json({ error: 'Solo puedes eliminar tus propias fotos' });
  }

  db.prepare('DELETE FROM photos WHERE id = ?').run(id);

  const filePath = path.join(UPLOADS_DIR, photo.image_path);
  fs.unlink(filePath, () => {});

  res.status(204).end();
});

photosRouter.post('/:id/like', requireAuth, (req, res) => {
  const photoId = Number(req.params.id);
  const photo = db.prepare('SELECT id FROM photos WHERE id = ?').get(photoId);

  if (!photo) {
    return res.status(404).json({ error: 'Foto no encontrada' });
  }

  const existing = db
    .prepare('SELECT id FROM likes WHERE photo_id = ? AND user_id = ?')
    .get(photoId, req.user.id);

  if (existing) {
    db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO likes (photo_id, user_id) VALUES (?, ?)').run(photoId, req.user.id);
  }

  const likeCount = Number(
    db.prepare('SELECT COUNT(*) AS count FROM likes WHERE photo_id = ?').get(photoId).count,
  );

  res.json({ liked: !existing, likeCount });
});
