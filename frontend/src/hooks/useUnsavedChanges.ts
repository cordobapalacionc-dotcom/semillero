import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { useConfirm } from '../components/ui/Modal';

// Registro global de formularios con cambios, para acciones que no pasan por el router
// (por ejemplo, cerrar sesión desmonta el formulario antes de que el bloqueo pueda avisar).
const dirtyForms = new Set<symbol>();
let bypass = false;

export function hasUnsavedChanges(): boolean {
  return dirtyForms.size > 0;
}

// Permite la siguiente navegación sin preguntar (el usuario ya confirmó por otra vía).
export function discardUnsavedChanges(): void {
  bypass = true;
  dirtyForms.clear();
}

export const UNSAVED_MESSAGE = 'Si sales ahora, se perderán los cambios y las fotos que no hayas subido.';

// Avisa antes de salir de la página (navegación interna o cerrar la pestaña) si hay cambios.
export function useUnsavedChanges(dirty: boolean) {
  const confirm = useConfirm();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && !bypass && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    bypass = false;
    if (!dirty) return;
    const id = Symbol('form');
    dirtyForms.add(id);
    return () => {
      dirtyForms.delete(id);
    };
  }, [dirty]);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    confirm({
      title: 'Tienes cambios sin guardar',
      message: UNSAVED_MESSAGE,
      confirmLabel: 'Salir sin guardar',
      danger: true,
    }).then((leave) => (leave ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}
