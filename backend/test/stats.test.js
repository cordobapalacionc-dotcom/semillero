import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { makeTestApp, registerUser, auth, createProject, promote } from './helpers.js';
import { getAdminStats, getMeStats } from '../src/services/stats.js';

let app;
let ctx;
let cleanup;

const NOW = new Date('2026-10-14T12:00:00Z');

beforeEach(async () => {
  ({ app, ctx, cleanup } = await makeTestApp());
});

afterEach(async () => {
  await cleanup();
});

function addLike(projectId, userId, date) {
  ctx.db
    .prepare('INSERT INTO likes (project_id, user_id, created_at) VALUES (?, ?, ?)')
    .run(projectId, userId, `${date} 10:00:00`);
}

test('likesByDay tiene 30 entradas y cuenta solo likes de mis proyectos', async () => {
  const me = await registerUser(app);
  const other = await registerUser(app);
  const fan = await registerUser(app);
  const mine = await createProject(app, me.token);
  const theirs = await createProject(app, other.token);

  addLike(mine.id, fan.user.id, '2026-10-14');
  addLike(mine.id, other.user.id, '2026-10-13');
  addLike(theirs.id, fan.user.id, '2026-10-14');
  addLike(mine.id, me.user.id, '2026-08-01'); // fuera del rango de 30 días

  const stats = getMeStats(ctx.db, me.user.id, NOW);
  assert.equal(stats.likesByDay.length, 30);
  assert.equal(stats.likesByDay[0].date, '2026-09-15');
  assert.deepEqual(stats.likesByDay.at(-1), { date: '2026-10-14', count: 1 });
  assert.deepEqual(stats.likesByDay.at(-2), { date: '2026-10-13', count: 1 });
  assert.deepEqual(stats.totals, { projects: 1, photos: 1, likes: 3, comments: 0 });
});

test('topProjects máximo 5 ordenado por likes y recentComments excluye los propios', async () => {
  const me = await registerUser(app);
  const fan = await registerUser(app);
  const projects = [];
  for (let i = 0; i < 6; i++) projects.push(await createProject(app, me.token, { title: `P${i}` }));
  addLike(projects[3].id, fan.user.id, '2026-10-10');
  addLike(projects[3].id, me.user.id, '2026-10-10');
  addLike(projects[5].id, fan.user.id, '2026-10-10');

  const url = `/api/projects/${projects[0].id}/comments`;
  await request(app).post(url).set(...auth(fan.token)).send({ content: 'Buen trabajo' });
  await request(app).post(url).set(...auth(me.token)).send({ content: 'Gracias' });

  const stats = getMeStats(ctx.db, me.user.id, NOW);
  assert.equal(stats.topProjects.length, 5);
  assert.deepEqual(stats.topProjects.slice(0, 2).map((p) => p.title), ['P3', 'P5']);
  assert.equal(stats.recentComments.length, 1);
  assert.equal(stats.recentComments[0].content, 'Buen trabajo');
  assert.deepEqual(stats.recentComments[0].project, { id: projects[0].id, title: 'P0' });
});

test('GET /api/me/stats responde con la forma esperada', async () => {
  const me = await registerUser(app);
  const res = await request(app).get('/api/me/stats').set(...auth(me.token));
  assert.equal(res.status, 200);
  assert.equal(res.body.likesByDay.length, 30);
  assert.deepEqual(res.body.totals, { projects: 0, photos: 0, likes: 0, comments: 0 });
});

test('admin: activity tiene range entradas y deltas', async () => {
  const setDate = (table, date) => ctx.db.prepare(`UPDATE ${table} SET created_at = ?`).run(`${date} 09:00:00`);

  const a = await registerUser(app);
  await createProject(app, a.token, { category: 'Hardware' });
  setDate('users', '2026-10-01');
  setDate('projects', '2026-10-01');

  let stats = getAdminStats(ctx.db, 7, NOW);
  assert.equal(stats.range, 7);
  assert.equal(stats.activity.length, 7);
  assert.equal(stats.activity[0].date, '2026-10-08');
  assert.equal(stats.deltas.users, -100); // periodo anterior (01–07 oct) tiene 1, actual 0

  // Dos registros dentro del periodo actual: 1 → 2
  const b = await registerUser(app);
  const c = await registerUser(app);
  ctx.db.prepare('UPDATE users SET created_at = ? WHERE id IN (?, ?)').run('2026-10-12 09:00:00', b.user.id, c.user.id);

  stats = getAdminStats(ctx.db, 7, NOW);
  assert.equal(stats.totals.users, 3);
  assert.equal(stats.deltas.users, 100); // 1 → 2
  assert.equal(stats.activity.find((d) => d.date === '2026-10-12').users, 2);
});

test('admin: deltas null con periodo anterior vacío', async () => {
  await registerUser(app); // creado "hoy" según SQLite; usamos el reloj real
  const stats = getAdminStats(ctx.db, 30);
  assert.equal(stats.deltas.users, null);
  assert.equal(stats.activity.length, 30);
});

test('admin: topCategories ordenado desc y topUsers', async () => {
  const a = await registerUser(app, { username: 'ana' });
  const b = await registerUser(app, { username: 'beto' });
  await createProject(app, a.token, { category: 'Software' });
  await createProject(app, a.token, { category: 'Software' });
  await createProject(app, b.token, { category: 'Hardware' });

  const stats = getAdminStats(ctx.db, 30, NOW);
  assert.deepEqual(stats.topCategories, [
    { name: 'Software', count: 2 },
    { name: 'Hardware', count: 1 },
  ]);
  assert.deepEqual(stats.topUsers.map((u) => [u.username, u.projects]), [
    ['ana', 2],
    ['beto', 1],
  ]);
});

test('GET /api/admin/stats: user normal 403, range inválido 400, admin 200', async () => {
  const user = await registerUser(app);
  assert.equal((await request(app).get('/api/admin/stats').set(...auth(user.token))).status, 403);

  promote(ctx, user.user.id, 'admin');
  assert.equal((await request(app).get('/api/admin/stats').query({ range: 15 }).set(...auth(user.token))).status, 400);

  const ok = await request(app).get('/api/admin/stats').query({ range: 90 }).set(...auth(user.token));
  assert.equal(ok.status, 200);
  assert.equal(ok.body.activity.length, 90);
});
