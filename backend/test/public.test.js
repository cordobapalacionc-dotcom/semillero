import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { makeTestApp, registerUser, auth, createProject, promote } from './helpers.js';

let app;
let ctx;
let cleanup;
let owner;

beforeEach(async () => {
  ({ app, ctx, cleanup } = await makeTestApp());
  owner = await registerUser(app, { username: 'creadora', email: 'creadora@test.com' });
});

afterEach(async () => {
  await cleanup();
});

const like = (id, token) => request(app).post(`/api/projects/${id}/like`).set(...auth(token));

test('lista paginada con pageSize 12', async () => {
  for (let i = 0; i < 13; i++) await createProject(app, owner.token, { title: `Proyecto ${i}` });
  const page1 = await request(app).get('/api/projects');
  assert.equal(page1.status, 200);
  assert.equal(page1.body.total, 13);
  assert.equal(page1.body.pageSize, 12);
  assert.equal(page1.body.items.length, 12);
  const page2 = await request(app).get('/api/projects').query({ page: 2 });
  assert.equal(page2.body.items.length, 1);
});

test('sort=popular ordena por likes', async () => {
  const a = await createProject(app, owner.token, { title: 'Poco' });
  const b = await createProject(app, owner.token, { title: 'Mucho' });
  const fan1 = await registerUser(app);
  const fan2 = await registerUser(app);
  await like(b.id, fan1.token);
  await like(b.id, fan2.token);
  await like(a.id, fan1.token);
  const res = await request(app).get('/api/projects').query({ sort: 'popular' });
  assert.deepEqual(res.body.items.map((p) => p.title), ['Mucho', 'Poco']);
});

test('filtra por category y q', async () => {
  await createProject(app, owner.token, { title: 'Dron', category: 'Hardware' });
  await createProject(app, owner.token, { title: 'App', category: 'Software', description: 'drones' });
  const byCat = await request(app).get('/api/projects').query({ category: 'HARDWARE' });
  assert.deepEqual(byCat.body.items.map((p) => p.title), ['Dron']);
  const byQ = await request(app).get('/api/projects').query({ q: 'dron' });
  assert.equal(byQ.body.total, 2);
});

test("q con '%' no devuelve todo", async () => {
  await createProject(app, owner.token, { title: 'Normal' });
  await createProject(app, owner.token, { title: 'Eficiencia 100%' });
  const res = await request(app).get('/api/projects').query({ q: '%' });
  assert.deepEqual(res.body.items.map((p) => p.title), ['Eficiencia 100%']);
});

test('sort inválido → 400', async () => {
  const res = await request(app).get('/api/projects').query({ sort: 'DROP TABLE' });
  assert.equal(res.status, 400);
});

test('oculta proyectos de usuarios suspendidos', async () => {
  const project = await createProject(app, owner.token);
  ctx.db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(owner.user.id);

  const list = await request(app).get('/api/projects');
  assert.equal(list.body.total, 0);
  const detail = await request(app).get(`/api/projects/${project.id}`);
  assert.equal(detail.status, 404);
  const profile = await request(app).get('/api/users/creadora');
  assert.equal(profile.status, 404);
  const cats = await request(app).get('/api/projects/categories');
  assert.deepEqual(cats.body, []);
});

test('featured solo devuelve destacados', async () => {
  const a = await createProject(app, owner.token, { title: 'Destacado' });
  await createProject(app, owner.token, { title: 'Normal' });
  ctx.db.prepare('UPDATE projects SET featured = 1 WHERE id = ?').run(a.id);
  const res = await request(app).get('/api/projects/featured');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((p) => p.title), ['Destacado']);
});

test('categories devuelve conteos ordenados', async () => {
  await createProject(app, owner.token, { category: 'Hardware' });
  await createProject(app, owner.token, { category: 'hardware' });
  await createProject(app, owner.token, { category: 'Software' });
  const res = await request(app).get('/api/projects/categories');
  assert.deepEqual(res.body, [
    { name: 'Hardware', count: 2 },
    { name: 'Software', count: 1 },
  ]);
});

test('detalle incluye fotos ordenadas', async () => {
  const project = await createProject(app, owner.token, { photos: 2 });
  const res = await request(app).get(`/api/projects/${project.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.photos.length, 2);
  assert.equal(res.body.owner.username, 'creadora');
});

test('like alterna y likedByMe refleja al viewer', async () => {
  const project = await createProject(app, owner.token);
  const fan = await registerUser(app);

  const on = await like(project.id, fan.token);
  assert.deepEqual(on.body, { liked: true, likeCount: 1 });
  const seen = await request(app).get(`/api/projects/${project.id}`).set(...auth(fan.token));
  assert.equal(seen.body.likedByMe, true);
  const anon = await request(app).get(`/api/projects/${project.id}`);
  assert.equal(anon.body.likedByMe, false);

  const off = await like(project.id, fan.token);
  assert.deepEqual(off.body, { liked: false, likeCount: 0 });
});

test('like sin sesión → 401 y sobre proyecto inexistente → 404', async () => {
  const project = await createProject(app, owner.token);
  assert.equal((await request(app).post(`/api/projects/${project.id}/like`)).status, 401);
  assert.equal((await like(9999, owner.token)).status, 404);
});

test('comentarios: validación y listado', async () => {
  const project = await createProject(app, owner.token);
  const fan = await registerUser(app);
  const url = `/api/projects/${project.id}/comments`;

  assert.equal((await request(app).post(url).set(...auth(fan.token)).send({ content: '   ' })).status, 400);
  assert.equal((await request(app).post(url).set(...auth(fan.token)).send({ content: 'x'.repeat(501) })).status, 400);

  const ok = await request(app).post(url).set(...auth(fan.token)).send({ content: '  ¡Genial!  ' });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.content, '¡Genial!');
  assert.equal(ok.body.author.id, fan.user.id);

  const list = await request(app).get(url);
  assert.equal(list.body.length, 1);
  assert.equal((await request(app).post('/api/projects/9999/comments').set(...auth(fan.token)).send({ content: 'hola' })).status, 404);
});

test('borrar comentario: autor, dueño del proyecto o admin; tercero 403', async () => {
  const project = await createProject(app, owner.token);
  const fan = await registerUser(app);
  const stranger = await registerUser(app);
  const adminUser = await registerUser(app);
  promote(ctx, adminUser.user.id, 'admin');

  const post = async () =>
    (await request(app).post(`/api/projects/${project.id}/comments`).set(...auth(fan.token)).send({ content: 'hola' })).body.id;

  const c1 = await post();
  const denied = await request(app).delete(`/api/projects/comments/${c1}`).set(...auth(stranger.token));
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error, 'No puedes eliminar este comentario');

  assert.equal((await request(app).delete(`/api/projects/comments/${c1}`).set(...auth(owner.token))).status, 204);
  const c2 = await post();
  assert.equal((await request(app).delete(`/api/projects/comments/${c2}`).set(...auth(fan.token))).status, 204);
  const c3 = await post();
  assert.equal((await request(app).delete(`/api/projects/comments/${c3}`).set(...auth(adminUser.token))).status, 204);
});

test('perfil público sin correo y con proyectos', async () => {
  await createProject(app, owner.token, { title: 'Mío' });
  const res = await request(app).get('/api/users/CREADORA');
  assert.equal(res.status, 200);
  assert.equal(res.body.user.username, 'creadora');
  assert.equal(res.body.user.email, undefined);
  assert.deepEqual(res.body.projects.map((p) => p.title), ['Mío']);
  assert.equal((await request(app).get('/api/users/nadie')).status, 404);
});
