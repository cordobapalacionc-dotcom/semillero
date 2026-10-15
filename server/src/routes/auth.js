import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { JWT_SECRET } from '../config.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,20}$/;

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

authRouter.post('/register', (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return res.status(400).json({
      error: 'El usuario debe tener 3-20 caracteres (letras, números, _ . -)',
    });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Ese usuario ya existe' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(username, passwordHash);

  const user = { id: Number(result.lastInsertRowid), username };
  const token = signToken(user);
  res.status(201).json({ token, user });
});

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }

  const row = db
    .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
    .get(username);

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  const user = { id: Number(row.id), username: row.username };
  const token = signToken(user);
  res.json({ token, user });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
