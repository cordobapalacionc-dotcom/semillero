import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { makeTestApp, registerUser, auth, tinyImage, createProject, listUploads } from './helpers.js';

let app;
let ctx;
let cleanup;
let token;

beforeEach(async () => {
  ({ app, ctx, cleanup } = await makeTestApp());
  ({ token } = await registerUser(app));
});

afterEach(async () => {
  await cleanup();
});

test('crea proyecto con 3 fotos', async () => {
  const project = await createProject(app, token, { title: 'Brazo robótico', photos: 3 });
  assert.equal(project.title, 'Brazo robótico');
  assert.equal(project.photos.length, 3);
  assert.deepEqual(project.photos.map((p) => p.position), [0, 1, 2]);
  assert.equal(project.coverPhotoId, project.photos[0].id);
  assert.equal(project.coverUrl, project.photos[0].url);
  assert.equal(listUploads(ctx).length, 3);
});

test('crear sin fotos → 400', async () => {
  const res = await request(app)
    .post('/api/me/projects')
    .set(...auth(token))
    .field('title', 'Sin fotos')
    .field('category', 'Robótica');
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Debes subir al menos una foto');
});

test('título de 1 carácter → 400 con fields.title y sin archivos en disco', async () => {
  const res = await request(app)
    .post('/api/me/projects')
    .set(...auth(token))
    .field('title', 'X')
    .field('category', 'Robótica')
    .attach('photos', tinyImage('png'), 'a.png');
  assert.equal(res.status, 400);
  assert.ok(res.body.fields.title);
  assert.equal(listUploads(ctx).length, 0);
});

test('sin sesión → 401', async () => {
  const res = await request(app).post('/api/me/projects').field('title', 'Hola');
  assert.equal(res.status, 401);
});

test('categoría reutiliza la forma existente sin importar mayúsculas', async () => {
  const a = await createProject(app, token, { category: 'Robótica' });
  const b = await createProject(app, token, { category: '  robótica ' });
  const c = await createProject(app, token, { category: 'Inteligencia   Artificial' });
  assert.equal(a.category, 'Robótica');
  assert.equal(b.category, 'Robótica');
  assert.equal(c.category, 'Inteligencia Artificial');
});

test('editar o borrar un proyecto ajeno → 404', async () => {
  const project = await createProject(app, token);
  const other = await registerUser(app);
  const edit = await request(app)
    .patch(`/api/me/projects/${project.id}`)
    .set(...auth(other.token))
    .send({ title: 'Robado' });
  assert.equal(edit.status, 404);
  const del = await request(app).delete(`/api/me/projects/${project.id}`).set(...auth(other.token));
  assert.equal(del.status, 404);
});

test('editar metadatos y portada', async () => {
  const project = await createProject(app, token, { photos: 2 });
  const res = await request(app)
    .patch(`/api/me/projects/${project.id}`)
    .set(...auth(token))
    .send({ title: 'Nuevo título', description: 'Desc', coverPhotoId: project.photos[1].id });
  assert.equal(res.status, 200);
  assert.equal(res.body.title, 'Nuevo título');
  assert.equal(res.body.coverPhotoId, project.photos[1].id);
});

test('portada de otro proyecto → 400', async () => {
  const a = await createProject(app, token);
  const b = await createProject(app, token);
  const res = await request(app)
    .patch(`/api/me/projects/${a.id}`)
    .set(...auth(token))
    .send({ coverPhotoId: b.photos[0].id });
  assert.equal(res.status, 400);
});

test('agregar fotos excediendo 50 → 400 y sin archivos nuevos', async () => {
  const project = await createProject(app, token, { photos: 20 });
  for (let round = 0; round < 1; round++) {
    let req = request(app).post(`/api/me/projects/${project.id}/photos`).set(...auth(token));
    for (let i = 0; i < 20; i++) req = req.attach('photos', tinyImage('png'), `x${i}.png`);
    assert.equal((await req).status, 201);
  }
  const before = listUploads(ctx).length;
  let req = request(app).post(`/api/me/projects/${project.id}/photos`).set(...auth(token));
  for (let i = 0; i < 11; i++) req = req.attach('photos', tinyImage('png'), `y${i}.png`);
  const res = await req;
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Un proyecto puede tener máximo 50 fotos');
  assert.equal(listUploads(ctx).length, before);
});

test('agregar fotos continúa la numeración de position', async () => {
  const project = await createProject(app, token, { photos: 2 });
  const res = await request(app)
    .post(`/api/me/projects/${project.id}/photos`)
    .set(...auth(token))
    .attach('photos', tinyImage('jpeg'), 'z.jpg');
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.photos.map((p) => p.position), [0, 1, 2]);
});

test('borrar la portada reasigna a la primera foto restante', async () => {
  const project = await createProject(app, token, { photos: 3 });
  const res = await request(app)
    .delete(`/api/me/projects/${project.id}/photos/${project.photos[0].id}`)
    .set(...auth(token));
  assert.equal(res.status, 200);
  assert.equal(res.body.photos.length, 2);
  assert.equal(res.body.coverPhotoId, project.photos[1].id);
  assert.equal(listUploads(ctx).length, 2);
});

test('no se puede borrar la última foto', async () => {
  const project = await createProject(app, token, { photos: 1 });
  const res = await request(app)
    .delete(`/api/me/projects/${project.id}/photos/${project.photos[0].id}`)
    .set(...auth(token));
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'El proyecto debe tener al menos una foto');
});

test('reordenar con id ajeno o incompleto → 400', async () => {
  const a = await createProject(app, token, { photos: 2 });
  const b = await createProject(app, token, { photos: 1 });
  const foreign = await request(app)
    .patch(`/api/me/projects/${a.id}/photos/order`)
    .set(...auth(token))
    .send({ photoIds: [a.photos[0].id, b.photos[0].id] });
  assert.equal(foreign.status, 400);
  assert.equal(foreign.body.error, 'El orden enviado no coincide con las fotos del proyecto');

  const partial = await request(app)
    .patch(`/api/me/projects/${a.id}/photos/order`)
    .set(...auth(token))
    .send({ photoIds: [a.photos[0].id] });
  assert.equal(partial.status, 400);
});

test('reordenar válido cambia position', async () => {
  const project = await createProject(app, token, { photos: 3 });
  const [p0, p1, p2] = project.photos.map((p) => p.id);
  const res = await request(app)
    .patch(`/api/me/projects/${project.id}/photos/order`)
    .set(...auth(token))
    .send({ photoIds: [p2, p0, p1] });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.photos.map((p) => p.id), [p2, p0, p1]);
});

test('editar el pie de foto', async () => {
  const project = await createProject(app, token);
  const res = await request(app)
    .patch(`/api/me/projects/${project.id}/photos/${project.photos[0].id}`)
    .set(...auth(token))
    .send({ caption: 'Vista frontal' });
  assert.equal(res.status, 200);
  assert.equal(res.body.photos[0].caption, 'Vista frontal');
});

test('eliminar proyecto borra filas y archivos del disco', async () => {
  const project = await createProject(app, token, { photos: 2 });
  const res = await request(app).delete(`/api/me/projects/${project.id}`).set(...auth(token));
  assert.equal(res.status, 204);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM photos').get().n, 0);
  assert.equal(listUploads(ctx).length, 0);
});

test('GET /me/projects filtra por q y category', async () => {
  await createProject(app, token, { title: 'Dron agrícola', category: 'Hardware' });
  await createProject(app, token, { title: 'Chatbot', category: 'Software' });
  const other = await registerUser(app);
  await createProject(app, other.token, { title: 'Dron ajeno', category: 'Hardware' });

  const all = await request(app).get('/api/me/projects').set(...auth(token));
  assert.equal(all.status, 200);
  assert.equal(all.body.total, 2);

  const byQ = await request(app).get('/api/me/projects').query({ q: 'dron' }).set(...auth(token));
  assert.deepEqual(byQ.body.items.map((p) => p.title), ['Dron agrícola']);

  const byCat = await request(app).get('/api/me/projects').query({ category: 'software' }).set(...auth(token));
  assert.deepEqual(byCat.body.items.map((p) => p.title), ['Chatbot']);
});

test('id no numérico → 400', async () => {
  const res = await request(app).patch('/api/me/projects/abc').set(...auth(token)).send({ title: 'Hola' });
  assert.equal(res.status, 400);
});
