import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { makeTestApp, registerUser, auth, createProject, promote, listUploads } from './helpers.js';

let app;
let ctx;
let cleanup;
let superadmin;
let admin;
let user;

beforeEach(async () => {
  ({ app, ctx, cleanup } = await makeTestApp());
  superadmin = await registerUser(app, { username: 'jefa' });
  promote(ctx, superadmin.user.id, 'superadmin');
  admin = await registerUser(app, { username: 'moderador' });
  promote(ctx, admin.user.id, 'admin');
  user = await registerUser(app, { username: 'normal' });
});

afterEach(async () => {
  await cleanup();
});

const as = (who) => ({
  get: (url) => request(app).get(url).set(...auth(who.token)),
  patch: (url) => request(app).patch(url).set(...auth(who.token)),
  post: (url) => request(app).post(url).set(...auth(who.token)),
  delete: (url) => request(app).delete(url).set(...auth(who.token)),
});

test('usuario normal → 403 en todo /api/admin', async () => {
  for (const url of ['/api/admin/projects', '/api/admin/users', '/api/admin/comments']) {
    const res = await as(user).get(url);
    assert.equal(res.status, 403, url);
    assert.equal(res.body.code, 'ADMIN_REQUIRED', url);
  }
  assert.equal((await as(user).patch(`/api/admin/users/${admin.user.id}/status`).send({ status: 'suspended' })).status, 403);
});

test('lista proyectos con orden por likes, filtros y búsqueda por autor', async () => {
  const a = await createProject(app, user.token, { title: 'Alfa', category: 'Hardware' });
  await createProject(app, admin.token, { title: 'Beta', category: 'Software' });
  await as(superadmin).post(`/api/projects/${a.id}/like`);

  const byLikes = await as(admin).get('/api/admin/projects').query({ sort: 'likes', dir: 'desc' });
  assert.equal(byLikes.status, 200);
  assert.equal(byLikes.body.pageSize, 20);
  assert.deepEqual(byLikes.body.items.map((p) => p.title), ['Alfa', 'Beta']);

  const byTitleAsc = await as(admin).get('/api/admin/projects').query({ sort: 'title', dir: 'asc' });
  assert.deepEqual(byTitleAsc.body.items.map((p) => p.title), ['Alfa', 'Beta']);

  const byOwner = await as(admin).get('/api/admin/projects').query({ q: 'normal' });
  assert.deepEqual(byOwner.body.items.map((p) => p.title), ['Alfa']);

  const byCat = await as(admin).get('/api/admin/projects').query({ category: 'software' });
  assert.deepEqual(byCat.body.items.map((p) => p.title), ['Beta']);
});

test('sort no permitido → 400', async () => {
  const res = await as(admin).get('/api/admin/projects').query({ sort: 'password_hash' });
  assert.equal(res.status, 400);
});

test('el admin ve proyectos de usuarios suspendidos', async () => {
  await createProject(app, user.token);
  ctx.db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(user.user.id);
  const res = await as(admin).get('/api/admin/projects');
  assert.equal(res.body.total, 1);
});

test('destacar y quitar destacado', async () => {
  const p = await createProject(app, user.token);
  const on = await as(admin).patch(`/api/admin/projects/${p.id}/featured`).send({ featured: true });
  assert.equal(on.status, 200);
  assert.equal(on.body.featured, true);
  const onlyFeatured = await as(admin).get('/api/admin/projects').query({ featured: 'true' });
  assert.equal(onlyFeatured.body.total, 1);
  const off = await as(admin).patch(`/api/admin/projects/${p.id}/featured`).send({ featured: false });
  assert.equal(off.body.featured, false);
  assert.equal((await as(admin).patch(`/api/admin/projects/${p.id}/featured`).send({ featured: 'sí' })).status, 400);
});

test('eliminar un proyecto y borrado masivo eliminan archivos', async () => {
  const a = await createProject(app, user.token, { photos: 2 });
  const b = await createProject(app, user.token);
  const c = await createProject(app, user.token);

  assert.equal((await as(admin).delete(`/api/admin/projects/${a.id}`)).status, 204);
  assert.equal(listUploads(ctx).length, 2);

  const bulk = await as(admin).post('/api/admin/projects/bulk-delete').send({ ids: [b.id, c.id] });
  assert.equal(bulk.status, 200);
  assert.deepEqual(bulk.body, { deleted: 2 });
  assert.equal(listUploads(ctx).length, 0);

  assert.equal((await as(admin).post('/api/admin/projects/bulk-delete').send({ ids: [] })).status, 400);
  assert.equal((await as(admin).delete('/api/admin/projects/9999')).status, 404);
});

test('admin suspende a un usuario y su token deja de funcionar; luego lo reactiva', async () => {
  const res = await as(admin).patch(`/api/admin/users/${user.user.id}/status`).send({ status: 'suspended' });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'suspended');
  assert.equal((await as(user).get('/api/auth/me')).status, 403);

  const back = await as(admin).patch(`/api/admin/users/${user.user.id}/status`).send({ status: 'active' });
  assert.equal(back.body.status, 'active');
  assert.equal((await as(user).get('/api/auth/me')).status, 200);
});

test('admin no puede suspender a otro admin ni al superadmin', async () => {
  const other = await registerUser(app);
  promote(ctx, other.user.id, 'admin');

  const toAdmin = await as(admin).patch(`/api/admin/users/${other.user.id}/status`).send({ status: 'suspended' });
  assert.equal(toAdmin.status, 403);
  assert.equal(toAdmin.body.error, 'Solo el administrador principal puede gestionar a otros administradores');

  const toSuper = await as(admin).patch(`/api/admin/users/${superadmin.user.id}/status`).send({ status: 'suspended' });
  assert.equal(toSuper.status, 403);
  const delSuper = await as(admin).delete(`/api/admin/users/${superadmin.user.id}`);
  assert.equal(delSuper.status, 403);

  const self = await as(superadmin).delete(`/api/admin/users/${superadmin.user.id}`);
  assert.equal(self.status, 403);
});

test('superadmin promueve y degrada; admin no puede cambiar roles', async () => {
  const up = await as(superadmin).patch(`/api/admin/users/${user.user.id}/role`).send({ role: 'admin' });
  assert.equal(up.status, 200);
  assert.equal(up.body.role, 'admin');
  assert.equal((await as(user).get('/api/admin/users')).status, 200);

  const down = await as(superadmin).patch(`/api/admin/users/${user.user.id}/role`).send({ role: 'user' });
  assert.equal(down.body.role, 'user');

  const byAdmin = await as(admin).patch(`/api/admin/users/${user.user.id}/role`).send({ role: 'admin' });
  assert.equal(byAdmin.status, 403);
  assert.equal(byAdmin.body.error, 'Solo el administrador principal puede cambiar roles');
});

test("role 'superadmin' en el body → 400", async () => {
  const res = await as(superadmin).patch(`/api/admin/users/${user.user.id}/role`).send({ role: 'superadmin' });
  assert.equal(res.status, 400);
});

test('eliminar usuario borra sus proyectos, comentarios y archivos', async () => {
  const p = await createProject(app, user.token, { photos: 2 });
  const other = await createProject(app, admin.token);
  await as(user).post(`/api/projects/${other.id}/comments`).send({ content: 'hola' });

  const res = await as(admin).delete(`/api/admin/users/${user.user.id}`);
  assert.equal(res.status, 204);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM projects WHERE id = ?').get(p.id).n, 0);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM comments').get().n, 0);
  assert.equal(listUploads(ctx).length, 1);
  assert.equal((await as(admin).delete('/api/admin/users/9999')).status, 404);
});

test('GET /admin/users filtra por rol y estado e incluye projectCount', async () => {
  await createProject(app, user.token);
  await createProject(app, user.token);
  ctx.db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(user.user.id);

  const all = await as(admin).get('/api/admin/users');
  assert.equal(all.body.total, 3);
  const normal = all.body.items.find((u) => u.username === 'normal');
  assert.equal(normal.projectCount, 2);
  assert.equal(normal.email, user.user.email);
  assert.equal(normal.password_hash, undefined);

  const admins = await as(admin).get('/api/admin/users').query({ role: 'admin' });
  assert.deepEqual(admins.body.items.map((u) => u.username), ['moderador']);
  const suspended = await as(admin).get('/api/admin/users').query({ status: 'suspended' });
  assert.deepEqual(suspended.body.items.map((u) => u.username), ['normal']);
  const search = await as(admin).get('/api/admin/users').query({ q: 'jef' });
  assert.deepEqual(search.body.items.map((u) => u.username), ['jefa']);
  const sorted = await as(admin).get('/api/admin/users').query({ sort: 'projects', dir: 'desc' });
  assert.equal(sorted.body.items[0].username, 'normal');
});

test('moderación de comentarios: lista, busca y borra (individual y masivo)', async () => {
  const p = await createProject(app, admin.token, { title: 'Expo' });
  const ids = [];
  for (const content of ['spam uno', 'spam dos', 'comentario útil']) {
    ids.push((await as(user).post(`/api/projects/${p.id}/comments`).send({ content })).body.id);
  }

  const list = await as(admin).get('/api/admin/comments');
  assert.equal(list.status, 200);
  assert.equal(list.body.total, 3);
  assert.deepEqual(list.body.items[0].project, { id: p.id, title: 'Expo' });

  const search = await as(admin).get('/api/admin/comments').query({ q: 'spam' });
  assert.equal(search.body.total, 2);

  assert.equal((await as(admin).delete(`/api/admin/comments/${ids[2]}`)).status, 204);
  const bulk = await as(admin).post('/api/admin/comments/bulk-delete').send({ ids: [ids[0], ids[1]] });
  assert.deepEqual(bulk.body, { deleted: 2 });
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM comments').get().n, 0);
});

test('detalle admin de un proyecto incluye fotos aunque el dueño esté suspendido', async () => {
  const p = await createProject(app, user.token, { photos: 2 });
  ctx.db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(user.user.id);
  assert.equal((await request(app).get(`/api/projects/${p.id}`)).status, 404);

  const res = await as(admin).get(`/api/admin/projects/${p.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.photos.length, 2);
  assert.equal((await as(admin).get('/api/admin/projects/9999')).status, 404);
  assert.equal((await as(user).get(`/api/admin/projects/${p.id}`)).status, 403);
});
