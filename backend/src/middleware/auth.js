import jwt from 'jsonwebtoken';
import { HttpError } from './errors.js';

export const ADMIN_ROLES = new Set(['admin', 'superadmin']);
export const ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED';

export function signToken(user, secret) {
  return jwt.sign({ sub: String(user.id) }, secret, { expiresIn: '7d' });
}

function readToken(req) {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

export function createAuthMiddleware(ctx) {
  const findUser = ctx.db.prepare('SELECT id, username, email, role, status FROM users WHERE id = ?');

  // Devuelve el usuario vigente del token, o lanza HttpError. Se consulta la BD en cada
  // petición para que suspender o eliminar una cuenta tenga efecto inmediato.
  function resolveUser(token) {
    let payload;
    try {
      payload = jwt.verify(token, ctx.jwtSecret);
    } catch {
      throw new HttpError(401, 'Sesión inválida o expirada');
    }
    const row = findUser.get(Number(payload.sub));
    if (!row) throw new HttpError(401, 'Sesión inválida o expirada');
    if (row.status === 'suspended') {
      throw new HttpError(403, 'Tu cuenta está suspendida', undefined, ACCOUNT_SUSPENDED);
    }
    return { id: Number(row.id), username: row.username, email: row.email, role: row.role, status: row.status };
  }

  function requireAuth(req, _res, next) {
    const token = readToken(req);
    if (!token) return next(new HttpError(401, 'Debes iniciar sesión'));
    try {
      req.user = resolveUser(token);
      next();
    } catch (err) {
      next(err);
    }
  }

  function optionalAuth(req, _res, next) {
    const token = readToken(req);
    if (token) {
      try {
        req.user = resolveUser(token);
      } catch {
        // token inválido o cuenta suspendida: se trata como visitante
      }
    }
    next();
  }

  function requireAdmin(req, res, next) {
    requireAuth(req, res, (err) => {
      if (err) return next(err);
      if (!ADMIN_ROLES.has(req.user.role)) {
        return next(new HttpError(403, 'Acceso solo para administradores', undefined, 'ADMIN_REQUIRED'));
      }
      next();
    });
  }

  return { requireAuth, optionalAuth, requireAdmin };
}
