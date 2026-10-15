// Copia en el cliente de server/src/services/permissions.js. Solo se usa para desactivar
// botones y mostrar el motivo; la API aplica la misma regla de forma independiente.
import type { Role } from '../types';

export type ManageAction = 'suspend' | 'activate' | 'delete' | 'setRole';
export type ManageResult = { ok: true } | { ok: false; reason: string };

interface Subject {
  id: number;
  role: Role;
}

export function canManage(actor: Subject, target: Subject, action: ManageAction): ManageResult {
  if (actor.role !== 'admin' && actor.role !== 'superadmin') {
    return { ok: false, reason: 'No tienes permisos de administrador' };
  }
  if (target.role === 'superadmin') {
    return { ok: false, reason: 'El administrador principal no puede ser modificado' };
  }
  if (actor.id === target.id) {
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
