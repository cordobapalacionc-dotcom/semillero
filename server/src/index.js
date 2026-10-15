import fs from 'node:fs';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { ensureSuperadmin } from './services/seed.js';

const config = loadConfig();
fs.mkdirSync(config.uploadsDir, { recursive: true });

const db = openDb(config.dbPath);
ensureSuperadmin(db, config.admin);

const app = createApp({
  db,
  uploadsDir: config.uploadsDir,
  jwtSecret: config.jwtSecret,
  corsOrigin: config.corsOrigin,
});

app.listen(config.port, () => {
  console.log(`Galería API escuchando en http://localhost:${config.port}`);
});
