import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canManage } from '../src/services/permissions.js';

const user = { id: 1, role: 'user' };
const otherUser = { id: 2, role: 'user' };
const admin = { id: 10, role: 'admin' };
const otherAdmin = { id: 11, role: 'admin' };
const superadmin = { id: 99, role: 'superadmin' };
const ACTIONS = ['suspend', 'activate', 'delete', 'setRole'];

// [actor, target, acción, permitido]
const CASES = [];
for (const action of ACTIONS) {
  // Un usuario normal nunca puede administrar a nadie.
  CASES.push([user, otherUser, action, false]);
  CASES.push([user, admin, action, false]);
  CASES.push([user, superadmin, action, false]);
  // Nadie puede tocar al superadmin, ni siquiera él mismo.
  CASES.push([admin, superadmin, action, false]);
  CASES.push([superadmin, superadmin, action, false]);
  // Nadie actúa sobre sí mismo.
  CASES.push([admin, admin, action, false]);
  // Un admin no gestiona a otros admins.
  CASES.push([admin, otherAdmin, action, false]);
  // El superadmin gestiona usuarios y admins.
  CASES.push([superadmin, user, action, true]);
  CASES.push([superadmin, admin, action, true]);
  // Un admin gestiona usuarios normales, salvo cambiarles el rol.
  CASES.push([admin, user, action, action !== 'setRole']);
}

for (const [actor, target, action, expected] of CASES) {
  test(`${actor.role}#${actor.id} → ${target.role}#${target.id} ${action} = ${expected}`, () => {
    const result = canManage(actor, target, action);
    assert.equal(result.ok, expected);
    if (!expected) assert.equal(typeof result.reason, 'string');
  });
}

test('los motivos explican la regla aplicada', () => {
  assert.equal(canManage(admin, superadmin, 'delete').reason, 'El administrador principal no puede ser modificado');
  assert.equal(canManage(admin, admin, 'suspend').reason, 'No puedes realizar esta acción sobre tu propia cuenta');
  assert.equal(canManage(admin, user, 'setRole').reason, 'Solo el administrador principal puede cambiar roles');
  assert.equal(
    canManage(admin, otherAdmin, 'suspend').reason,
    'Solo el administrador principal puede gestionar a otros administradores',
  );
  assert.equal(canManage(user, otherUser, 'delete').reason, 'No tienes permisos de administrador');
});
