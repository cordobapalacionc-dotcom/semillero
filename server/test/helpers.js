import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

export async function makeTestApp() {
  const uploadsDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'galeria-test-'));
  const db = openDb(':memory:');
  const ctx = { db, uploadsDir, jwtSecret: 'test-secret', corsOrigin: 'http://localhost:5173' };
  const app = createApp(ctx);
  const cleanup = async () => {
    db.close();
    await fs.promises.rm(uploadsDir, { recursive: true, force: true });
  };
  return { app, ctx, cleanup };
}

let counter = 0;

export async function registerUser(app, overrides = {}) {
  counter += 1;
  const data = {
    email: `user${counter}@test.com`,
    username: `user${counter}`,
    password: 'Password123',
    confirmPassword: 'Password123',
    ...overrides,
  };
  if (overrides.password && !overrides.confirmPassword) data.confirmPassword = overrides.password;
  const res = await request(app).post('/api/auth/register').send(data);
  if (res.status !== 201) {
    throw new Error(`registerUser falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, user: res.body.user };
}

export function promote(ctx, userId, role) {
  ctx.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
}

export function auth(token) {
  return ['Authorization', `Bearer ${token}`];
}

const SIGNATURES = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff, 0xe0],
  gif: [...Buffer.from('GIF89a')],
  webp: [...Buffer.from('RIFF'), 0x24, 0, 0, 0, ...Buffer.from('WEBPVP8 ')],
};

export function tinyImage(type) {
  return Buffer.concat([Buffer.from(SIGNATURES[type]), Buffer.alloc(32, 1)]);
}

export function listUploads(ctx) {
  return fs.readdirSync(ctx.uploadsDir);
}

export async function createProject(app, token, { title = 'Proyecto', category = 'Robótica', description = '', photos = 1 } = {}) {
  let req = request(app)
    .post('/api/me/projects')
    .set('Authorization', `Bearer ${token}`)
    .field('title', title)
    .field('category', category)
    .field('description', description);
  for (let i = 0; i < photos; i++) req = req.attach('photos', tinyImage('png'), `foto${i}.png`);
  const res = await req;
  if (res.status !== 201) {
    throw new Error(`createProject falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body;
}
