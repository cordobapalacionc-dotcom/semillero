import bcrypt from 'bcryptjs';
import { emailSchema, passwordSchema, usernameSchema } from '../../shared/validation.js';

// Crea el administrador principal a partir de las variables de .env si todavía no existe.
// Nunca sobrescribe la contraseña de uno existente.
export function ensureSuperadmin(db, { username, email, password }) {
  const existing = db.prepare("SELECT id FROM users WHERE role = 'superadmin'").get();
  if (existing) return;

  if (!username || !email || !password) {
    console.warn(
      '[seed] No hay administrador principal. Define ADMIN_USERNAME, ADMIN_EMAIL y ADMIN_PASSWORD en server/.env y reinicia.',
    );
    return;
  }

  const parsed = {
    username: usernameSchema.safeParse(username),
    email: emailSchema.safeParse(email),
    password: passwordSchema.safeParse(password),
  };
  for (const [field, result] of Object.entries(parsed)) {
    if (!result.success) {
      console.warn(`[seed] ADMIN_${field.toUpperCase()} inválido: ${result.error.issues[0].message}`);
      return;
    }
  }

  const taken = db
    .prepare('SELECT id, password_hash FROM users WHERE username = ? OR email = ?')
    .get(parsed.username.data, parsed.email.data);
  if (taken) {
    // Solo se promueve si quien configura el servidor conoce la contraseña de esa cuenta;
    // si no, cualquiera que se registre primero con esos datos se adueñaría del panel.
    if (!bcrypt.compareSync(parsed.password.data, taken.password_hash)) {
      console.warn(
        '[seed] Ya existe una cuenta con ADMIN_USERNAME o ADMIN_EMAIL y su contraseña no coincide con ADMIN_PASSWORD. No se creó el administrador principal: usa otros datos en server/.env.',
      );
      return;
    }
    db.prepare("UPDATE users SET role = 'superadmin', status = 'active' WHERE id = ?").run(taken.id);
    console.log(`[seed] La cuenta existente "${parsed.username.data}" ahora es el administrador principal.`);
    return;
  }

  db.prepare(
    "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'superadmin')",
  ).run(parsed.username.data, parsed.email.data, bcrypt.hashSync(parsed.password.data, 10));
  console.log(`[seed] Administrador principal "${parsed.username.data}" creado.`);
}
