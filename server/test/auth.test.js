import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { makeTestApp, registerUser, auth } from './helpers.js';
import { ensureSuperadmin } from '../src/services/seed.js';

let app;
let ctx;
let cleanup;

beforeEach(async () => {
  ({ app, ctx, cleanup } = await makeTestApp());
});

afterEach(async () => {
  await cleanup();
});

const valid = {
  email: 'juan@test.com',
  username: 'Juan',
  password: 'Password123',
  confirmPassword: 'Password123',
};

describe('registro', () => {
  test('registra con correo, usuario y contraseña', async () => {
    const res = await request(app).post('/api/auth/register').send(valid);
    assert.equal(res.status, 201);
    assert.equal(typeof res.body.token, 'string');
    assert.equal(res.body.user.role, 'user');
    assert.equal(res.body.user.email, 'juan@test.com');
    assert.equal(res.body.user.password_hash, undefined);
    assert.equal(res.body.user.passwordHash, undefined);
  });

  test('rechaza datos inválidos con fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'no-es-correo', username: 'ok_user', password: 'corta', confirmPassword: 'otra' });
    assert.equal(res.status, 400);
    assert.ok(res.body.fields.email);
    assert.ok(res.body.fields.password);
    assert.ok(res.body.fields.confirmPassword);
  });

  test('usuario y correo son únicos sin importar mayúsculas', async () => {
    await registerUser(app, { username: 'Juan', email: 'J@X.com' });

    const dupUser = await request(app)
      .post('/api/auth/register')
      .send({ ...valid, username: 'juan', email: 'otro@x.com' });
    assert.equal(dupUser.status, 409);
    assert.ok(dupUser.body.fields.username);

    const dupEmail = await request(app)
      .post('/api/auth/register')
      .send({ ...valid, username: 'otro', email: 'j@x.com' });
    assert.equal(dupEmail.status, 409);
    assert.ok(dupEmail.body.fields.email);
  });
});

describe('login', () => {
  beforeEach(async () => {
    await registerUser(app, { username: 'Juan', email: 'juan@test.com', password: 'Password123' });
  });

  test('login con usuario, con correo y sin importar mayúsculas', async () => {
    for (const identifier of ['Juan', 'juan@test.com', 'JUAN', 'JUAN@TEST.COM']) {
      const res = await request(app).post('/api/auth/login').send({ identifier, password: 'Password123' });
      assert.equal(res.status, 200, `falló con ${identifier}`);
      assert.equal(res.body.user.username, 'Juan');
    }
  });

  test('login incorrecto es genérico', async () => {
    const noUser = await request(app).post('/api/auth/login').send({ identifier: 'nadie', password: 'Password123' });
    const badPass = await request(app).post('/api/auth/login').send({ identifier: 'Juan', password: 'Mala12345' });
    assert.equal(noUser.status, 401);
    assert.equal(badPass.status, 401);
    assert.equal(noUser.body.error, 'Credenciales incorrectas');
    assert.equal(badPass.body.error, 'Credenciales incorrectas');
  });

  test('bloquea tras 5 fallos', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/login').send({ identifier: 'Juan', password: 'Mala12345' });
      assert.equal(res.status, 401);
    }
    const blocked = await request(app).post('/api/auth/login').send({ identifier: 'Juan', password: 'Password123' });
    assert.equal(blocked.status, 429);
    assert.equal(typeof blocked.body.retryAfterMinutes, 'number');
  });

  test('actualiza last_login_at', async () => {
    await request(app).post('/api/auth/login').send({ identifier: 'Juan', password: 'Password123' });
    const row = ctx.db.prepare('SELECT last_login_at FROM users WHERE username = ?').get('Juan');
    assert.ok(row.last_login_at);
  });
});

describe('sesión', () => {
  test('usuario suspendido no puede loguear ni usar su token', async () => {
    const { token, user } = await registerUser(app, { password: 'Password123' });
    ctx.db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(user.id);

    const login = await request(app).post('/api/auth/login').send({ identifier: user.username, password: 'Password123' });
    assert.equal(login.status, 403);

    const me = await request(app).get('/api/auth/me').set(...auth(token));
    assert.equal(me.status, 403);
    assert.equal(me.body.code, 'ACCOUNT_SUSPENDED');
    assert.equal(login.body.code, 'ACCOUNT_SUSPENDED');
  });

  test('token de usuario eliminado → 401', async () => {
    const { token, user } = await registerUser(app);
    ctx.db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    const me = await request(app).get('/api/auth/me').set(...auth(token));
    assert.equal(me.status, 401);
  });

  test('token inválido → 401', async () => {
    const me = await request(app).get('/api/auth/me').set('Authorization', 'Bearer basura');
    assert.equal(me.status, 401);
  });

  test('GET /check refleja disponibilidad', async () => {
    await registerUser(app, { username: 'ocupado', email: 'ocupado@test.com' });
    const res = await request(app).get('/api/auth/check').query({ username: 'OCUPADO', email: 'libre@test.com' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { usernameAvailable: false, emailAvailable: true });

    const onlyEmail = await request(app).get('/api/auth/check').query({ email: 'Ocupado@Test.com' });
    assert.deepEqual(onlyEmail.body, { emailAvailable: false });
  });

  test('PATCH /me cambia la bio y valida unicidad', async () => {
    await registerUser(app, { username: 'otro', email: 'otro@test.com' });
    const { token } = await registerUser(app);

    const ok = await request(app).patch('/api/auth/me').set(...auth(token)).send({ bio: 'Hola' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.bio, 'Hola');

    const dup = await request(app).patch('/api/auth/me').set(...auth(token)).send({ username: 'OTRO' });
    assert.equal(dup.status, 409);
    assert.ok(dup.body.fields.username);
  });

  test('POST /me/password exige la contraseña actual', async () => {
    const { token, user } = await registerUser(app, { password: 'Password123' });

    const bad = await request(app)
      .post('/api/auth/me/password')
      .set(...auth(token))
      .send({ currentPassword: 'Mala12345', newPassword: 'Nueva12345', confirmPassword: 'Nueva12345' });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.fields.currentPassword);

    const ok = await request(app)
      .post('/api/auth/me/password')
      .set(...auth(token))
      .send({ currentPassword: 'Password123', newPassword: 'Nueva12345', confirmPassword: 'Nueva12345' });
    assert.equal(ok.status, 204);

    const login = await request(app).post('/api/auth/login').send({ identifier: user.username, password: 'Nueva12345' });
    assert.equal(login.status, 200);
  });
});

describe('admin principal', () => {
  test('ensureSuperadmin crea uno solo y no pisa la contraseña', async () => {
    ensureSuperadmin(ctx.db, { username: 'admin', email: 'admin@test.com', password: 'Primera123' });
    ensureSuperadmin(ctx.db, { username: 'admin', email: 'admin@test.com', password: 'Segunda123' });

    const count = ctx.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin'").get().n;
    assert.equal(count, 1);

    const first = await request(app).post('/api/auth/login').send({ identifier: 'admin', password: 'Primera123' });
    assert.equal(first.status, 200);
    assert.equal(first.body.user.role, 'superadmin');
  });

  test('ensureSuperadmin no promueve una cuenta existente con otra contraseña', async () => {
    const intruder = await registerUser(app, { username: 'admin', email: 'admin@test.com', password: 'Intruso123' });
    ensureSuperadmin(ctx.db, { username: 'admin', email: 'admin@test.com', password: 'Operador123' });
    const row = ctx.db.prepare('SELECT role FROM users WHERE id = ?').get(intruder.user.id);
    assert.equal(row.role, 'user');
    assert.equal(ctx.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin'").get().n, 0);
  });

  test('ensureSuperadmin promueve una cuenta existente si la contraseña coincide', async () => {
    const own = await registerUser(app, { username: 'admin', email: 'admin@test.com', password: 'Operador123' });
    ensureSuperadmin(ctx.db, { username: 'admin', email: 'admin@test.com', password: 'Operador123' });
    assert.equal(ctx.db.prepare('SELECT role FROM users WHERE id = ?').get(own.user.id).role, 'superadmin');
  });

  test('ensureSuperadmin sin variables no crea nada', () => {
    ensureSuperadmin(ctx.db, { username: undefined, email: undefined, password: undefined });
    const count = ctx.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin'").get().n;
    assert.equal(count, 0);
  });
});
