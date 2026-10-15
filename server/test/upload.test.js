import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { createUpload } from '../src/middleware/upload.js';
import { errorHandler } from '../src/middleware/errors.js';
import { detectImageType, removeFiles } from '../src/services/files.js';
import { tinyImage } from './helpers.js';

let dir;
let app;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'galeria-upload-'));
  app = express();
  app.post('/up', createUpload(dir), (req, res) => res.json({ saved: req.savedFiles }));
  app.use(errorHandler);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

test('detectImageType reconoce las firmas', () => {
  assert.equal(detectImageType(tinyImage('png')), 'png');
  assert.equal(detectImageType(tinyImage('jpeg')), 'jpg');
  assert.equal(detectImageType(tinyImage('gif')), 'gif');
  assert.equal(detectImageType(tinyImage('webp')), 'webp');
  assert.equal(detectImageType(Buffer.from('hola mundo')), null);
});

test('acepta png/jpeg/gif/webp válidos y usa la extensión detectada', async () => {
  const res = await request(app)
    .post('/up')
    .attach('photos', tinyImage('png'), { filename: 'a.jpg', contentType: 'image/jpeg' })
    .attach('photos', tinyImage('jpeg'), 'b.jpeg')
    .attach('photos', tinyImage('gif'), 'c.gif')
    .attach('photos', tinyImage('webp'), 'd.webp');
  assert.equal(res.status, 200);
  assert.equal(res.body.saved.length, 4);
  const exts = res.body.saved.map((f) => path.extname(f.filename)).sort();
  assert.deepEqual(exts, ['.gif', '.jpg', '.png', '.webp']);
  assert.equal(fs.readdirSync(dir).length, 4);
});

test('rechaza texto con Content-Type image/png y no deja archivos', async () => {
  const res = await request(app)
    .post('/up')
    .attach('photos', tinyImage('png'), 'ok.png')
    .attach('photos', Buffer.from('no soy una imagen'), { filename: 'falsa.png', contentType: 'image/png' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /falsa\.png/);
  assert.equal(fs.readdirSync(dir).length, 0);
});

test('rechaza un .exe renombrado a .jpg', async () => {
  const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64, 0)]);
  const res = await request(app).post('/up').attach('photos', exe, { filename: 'virus.jpg', contentType: 'image/jpeg' });
  assert.equal(res.status, 400);
  assert.equal(fs.readdirSync(dir).length, 0);
});

test('rechaza más de 20 archivos', async () => {
  let req = request(app).post('/up');
  for (let i = 0; i < 21; i++) req = req.attach('photos', tinyImage('png'), `f${i}.png`);
  const res = await req;
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Máximo 20 imágenes por subida');
  assert.equal(fs.readdirSync(dir).length, 0);
});

test('rechaza archivos de más de 10 MB', async () => {
  const big = Buffer.concat([tinyImage('png'), Buffer.alloc(10 * 1024 * 1024 + 1)]);
  const res = await request(app).post('/up').attach('photos', big, 'grande.png');
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Cada imagen debe pesar máximo 10 MB');
});

test('removeFiles ignora inexistentes y rechaza rutas peligrosas', async () => {
  fs.writeFileSync(path.join(dir, 'existe.png'), 'x');
  await removeFiles(dir, ['existe.png', 'no-existe.png']);
  assert.equal(fs.existsSync(path.join(dir, 'existe.png')), false);
  await assert.rejects(removeFiles(dir, ['../fuera.png']));
  await assert.rejects(removeFiles(dir, ['sub\\x.png']));
});
