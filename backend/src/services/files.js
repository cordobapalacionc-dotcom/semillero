import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const startsWith = (buf, bytes, offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

const ascii = (s) => [...Buffer.from(s, 'ascii')];

// Detecta el tipo real de imagen por sus primeros bytes (no confía en extensión ni Content-Type).
export function detectImageType(buf) {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(buf, ascii('GIF87a')) || startsWith(buf, ascii('GIF89a'))) return 'gif';
  if (startsWith(buf, ascii('RIFF')) && startsWith(buf, ascii('WEBP'), 8)) return 'webp';
  return null;
}

export function newFilename(ext) {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
}

function assertSafeName(name) {
  if (typeof name !== 'string' || !name || /[/\\]/.test(name) || name.includes('..')) {
    throw new Error(`Nombre de archivo no permitido: ${name}`);
  }
}

export async function removeFiles(uploadsDir, filenames) {
  filenames.forEach(assertSafeName);
  await Promise.all(
    filenames.map((name) =>
      fs.promises.unlink(path.join(uploadsDir, name)).catch((err) => {
        if (err.code !== 'ENOENT') console.error(`[files] No se pudo borrar ${name}:`, err.message);
      }),
    ),
  );
}

export function collectProjectFiles(db, projectIds) {
  if (projectIds.length === 0) return [];
  const placeholders = projectIds.map(() => '?').join(',');
  return db
    .prepare(`SELECT image_path FROM photos WHERE project_id IN (${placeholders})`)
    .all(...projectIds)
    .map((r) => r.image_path);
}

export function collectUserFiles(db, userId) {
  return db
    .prepare(
      `SELECT ph.image_path FROM photos ph
       JOIN projects p ON p.id = ph.project_id
       WHERE p.owner_id = ?`,
    )
    .all(userId)
    .map((r) => r.image_path);
}
