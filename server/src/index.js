import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import { PORT, UPLOADS_DIR } from './config.js';
import { authRouter } from './routes/auth.js';
import { photosRouter } from './routes/photos.js';
import { commentsRouter } from './routes/comments.js';
import './db.js';

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

app.use('/api/auth', authRouter);
app.use('/api/photos', photosRouter);
app.use('/api', commentsRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Galería API escuchando en http://localhost:${PORT}`);
});
