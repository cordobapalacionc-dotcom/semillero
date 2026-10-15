import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '..');

function loadOrCreateSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  const secretPath = path.join(serverRoot, '.jwt-secret');
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, 'utf8').trim();
  }

  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretPath, secret, 'utf8');
  return secret;
}

export function loadConfig() {
  try {
    process.loadEnvFile(path.join(serverRoot, '.env'));
  } catch {
    // sin .env: se usan las variables de entorno y los valores por defecto
  }

  return {
    port: process.env.PORT ? Number(process.env.PORT) : 4000,
    dbPath: path.join(serverRoot, 'galeria.db'),
    uploadsDir: path.join(serverRoot, 'uploads'),
    jwtSecret: loadOrCreateSecret(),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    admin: {
      username: process.env.ADMIN_USERNAME,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    },
  };
}
