// Reglas de jerarquía de administración. La copia del cliente vive en src/lib/permissions.ts
// y solo sirve para desactivar botones; esta es la que realmente protege la API.

const ADMIN_ROLES = new Set(['admin', 'superadmin']);

export function canManage(actor, target, action) {
  if (!ADMIN_ROLES.has(actor.role)) {
    return { ok: false, reason: 'No tienes permisos de administrador' };
  }
  if (target.role === 'superadmin') {
    return { ok: false, reason: 'El administrador principal no puede ser modificado' };
  }
  if (Number(actor.id) === Number(target.id)) {
    return { ok: false, reason: 'No puedes realizar esta acción sobre tu propia cuenta' };
  }
  if (action === 'setRole' && actor.role !== 'superadmin') {
    return { ok: false, reason: 'Solo el administrador principal puede cambiar roles' };
  }
  if (target.role === 'admin' && actor.role !== 'superadmin') {
    return { ok: false, reason: 'Solo el administrador principal puede gestionar a otros administradores' };
  }
  return { ok: true };
}
