import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errors.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createAuthRouter } from './routes/auth.js';
import { createMeRouter } from './routes/me.js';
import { createProjectsRouter } from './routes/projects.js';
import { createUsersRouter } from './routes/users.js';
import { createAdminRouter } from './routes/admin.js';

export function createApp(ctx) {
  const app = express();
  const guards = createAuthMiddleware(ctx);

  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: ctx.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/uploads', express.static(ctx.uploadsDir, { fallthrough: false, index: false }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', createAuthRouter(ctx, guards));
  app.use('/api/me', createMeRouter(ctx, guards));
  app.use('/api/projects', createProjectsRouter(ctx, guards));
  app.use('/api/users', createUsersRouter(ctx, guards));
  app.use('/api/admin', createAdminRouter(ctx, guards));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
  app.use(errorHandler);

  return app;
}
