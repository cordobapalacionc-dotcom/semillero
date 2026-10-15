import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import {
  changePasswordSchema,
  loginSchema,
  profileSchema,
  registerSchema,
} from '../../../shared/validation.js';
import { HttpError } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { ACCOUNT_SUSPENDED, signToken } from '../middleware/auth.js';
import { toMe } from '../services/dto.js';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 5;
// Hash de relleno para que "usuario inexistente" tarde lo mismo que "contraseña incorrecta".
const DUMMY_HASH = bcrypt.hashSync('relleno-para-tiempo-constante', 10);

function conflictFields(db, { username, email }, excludeId = 0) {
  const fields = {};
  if (username && db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(username, excludeId)) {
    fields.username = 'Ese usuario ya está en uso';
  }
  if (email && db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email, excludeId)) {
    fields.email = 'Ese correo ya está registrado';
  }
  return Object.keys(fields).length ? fields : null;
}

function isUniqueViolation(err) {
  return typeof err?.message === 'string' && err.message.includes('UNIQUE constraint failed');
}

export function createAuthRouter(ctx, { requireAuth }) {
  const { db } = ctx;
  const router = Router();
  const selectMe = db.prepare('SELECT * FROM users WHERE id = ?');

  const loginLimiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: LOGIN_MAX_FAILS,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const identifier = String(req.body?.identifier ?? '').trim().toLowerCase();
      return `${ipKeyGenerator(req.ip ?? '')}:${identifier}`;
    },
    handler: (req, res) => {
      const resetTime = req.rateLimit?.resetTime;
      const ms = resetTime ? resetTime.getTime() - Date.now() : LOGIN_WINDOW_MS;
      const minutes = Math.max(1, Math.ceil(ms / 60000));
      res.status(429).json({
        error: `Demasiados intentos. Intenta de nuevo en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`,
        retryAfterMinutes: minutes,
      });
    },
  });

  router.post('/register', validate(registerSchema), async (req, res, next) => {
    try {
      const { email, username, password } = req.body;
      const conflicts = conflictFields(db, { username, email });
      if (conflicts) throw new HttpError(409, 'Ya existe una cuenta con esos datos', conflicts);

      const hash = await bcrypt.hash(password, 10);
      let result;
      try {
        result = db
          .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
          .run(username, email, hash);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new HttpError(409, 'Ya existe una cuenta con esos datos', conflictFields(db, { username, email }) ?? {});
        }
        throw err;
      }

      const row = selectMe.get(Number(result.lastInsertRowid));
      res.status(201).json({ token: signToken(row, ctx.jwtSecret), user: toMe(row) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
    try {
      const { identifier, password } = req.body;
      const row = db
        .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
        .get(identifier, identifier.toLowerCase());

      const valid = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
      if (!row || !valid) throw new HttpError(401, 'Credenciales incorrectas');
      if (row.status === 'suspended') {
        throw new HttpError(403, 'Tu cuenta está suspendida. Contacta a un administrador.', undefined, ACCOUNT_SUSPENDED);
      }

      db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(row.id);
      res.json({ token: signToken(row, ctx.jwtSecret), user: toMe(selectMe.get(row.id)) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/check', (req, res) => {
    const result = {};
    if (typeof req.query.username === 'string') {
      result.usernameAvailable = !db
        .prepare('SELECT 1 FROM users WHERE username = ?')
        .get(req.query.username.trim());
    }
    if (typeof req.query.email === 'string') {
      result.emailAvailable = !db
        .prepare('SELECT 1 FROM users WHERE email = ?')
        .get(req.query.email.trim().toLowerCase());
    }
    res.json(result);
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: toMe(selectMe.get(req.user.id)) });
  });

  router.patch('/me', requireAuth, validate(profileSchema), (req, res, next) => {
    try {
      const { username, email, bio } = req.body;
      const conflicts = conflictFields(db, { username, email }, req.user.id);
      if (conflicts) throw new HttpError(409, 'Ya existe una cuenta con esos datos', conflicts);

      const current = selectMe.get(req.user.id);
      db.prepare('UPDATE users SET username = ?, email = ?, bio = ? WHERE id = ?').run(
        username ?? current.username,
        email ?? current.email,
        bio ?? current.bio,
        req.user.id,
      );
      res.json({ user: toMe(selectMe.get(req.user.id)) });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return next(new HttpError(409, 'Ya existe una cuenta con esos datos', {}));
      }
      next(err);
    }
  });

  router.post('/me/password', requireAuth, validate(changePasswordSchema), async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const row = selectMe.get(req.user.id);
      if (!(await bcrypt.compare(currentPassword, row.password_hash))) {
        throw new HttpError(400, 'La contraseña actual no es correcta', {
          currentPassword: 'La contraseña actual no es correcta',
        });
      }
      const hash = await bcrypt.hash(newPassword, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
