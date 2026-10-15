import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { LIMITS } from '../../shared/validation.js';
import { HttpError } from './errors.js';
import { detectImageType, newFilename, removeFiles } from '../services/files.js';

// Recibe el campo "photos" en memoria, verifica que cada archivo sea una imagen real y,
// solo si todos lo son, los escribe a disco. Deja en req.savedFiles lo que se guardó.
export function createUpload(uploadsDir) {
  const receive = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: LIMITS.photoMaxBytes, files: LIMITS.photosPerUpload },
  }).array('photos');

  return (req, res, next) => {
    receive(req, res, async (err) => {
      if (err) return next(err);

      const files = req.files ?? [];
      const typed = [];
      for (const file of files) {
        const ext = detectImageType(file.buffer);
        if (!ext) {
          return next(
            new HttpError(
              400,
              `El archivo "${file.originalname}" no es una imagen válida (usa JPG, PNG, WEBP o GIF)`,
            ),
          );
        }
        typed.push({ file, ext });
      }

      const saved = [];
      try {
        for (const { file, ext } of typed) {
          const filename = newFilename(ext);
          await fs.promises.writeFile(path.join(uploadsDir, filename), file.buffer);
          saved.push({ filename, originalName: file.originalname });
        }
      } catch (writeErr) {
        await removeFiles(uploadsDir, saved.map((f) => f.filename));
        return next(writeErr);
      }

      req.files = undefined;
      req.savedFiles = saved;
      next();
    });
  };
}
