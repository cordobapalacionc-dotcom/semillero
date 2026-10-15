import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import { openDb } from '../src/db.js';
import { makeTestApp } from './helpers.js';
import { registerSchema } from '../../shared/validation.js';

function tables(db) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((r) => r.name);
}

test('openDb crea todas las tablas', () => {
  const db = openDb(':memory:');
  const names = tables(db);
  for (const t of ['users', 'projects', 'photos', 'likes', 'comments']) {
    assert.ok(names.includes(t), `falta la tabla ${t}`);
  }
  db.close();
});

test('openDb respalda una BD con esquema viejo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'galeria-legacy-'));
  const dbPath = path.join(dir, 'galeria.db');
  const legacy = new DatabaseSync(dbPath);
  legacy.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password_hash TEXT)');
  legacy.close();

  const db = openDb(dbPath);
  assert.ok(fs.existsSync(path.join(dir, 'galeria.backup.db')));
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  assert.ok(cols.includes('email'));
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('role inválido es rechazado por CHECK', () => {
  const db = openDb(':memory:');
  assert.throws(() =>
    db
      .prepare("INSERT INTO users (username, email, password_hash, role) VALUES ('a', 'a@a.com', 'x', 'root')")
      .run(),
  );
  db.close();
});

test('GET /api/health responde ok y rutas desconocidas dan 404 JSON', async () => {
  const { app, cleanup } = await makeTestApp();
  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { ok: true });

  const missing = await request(app).get('/api/nada');
  assert.equal(missing.status, 404);
  assert.equal(typeof missing.body.error, 'string');
  await cleanup();
});

test('registerSchema valida contraseña, confirmación, usuario y normaliza correo', () => {
  const base = { email: 'a@b.com', username: 'juan', password: 'Password1', confirmPassword: 'Password1' };

  const weak = registerSchema.safeParse({ ...base, password: 'abcdefgh', confirmPassword: 'abcdefgh' });
  assert.equal(weak.success, false);
  assert.ok(weak.error.issues.some((i) => i.path[0] === 'password'));

  const mismatch = registerSchema.safeParse({ ...base, confirmPassword: 'Otra12345' });
  assert.equal(mismatch.success, false);
  assert.ok(mismatch.error.issues.some((i) => i.path[0] === 'confirmPassword'));

  const digits = registerSchema.safeParse({ ...base, username: '12345' });
  assert.equal(digits.success, false);
  assert.ok(digits.error.issues.some((i) => i.message === 'El usuario no puede ser solo números'));

  const ok = registerSchema.parse({ ...base, email: ' A@B.COM ' });
  assert.equal(ok.email, 'a@b.com');
});
