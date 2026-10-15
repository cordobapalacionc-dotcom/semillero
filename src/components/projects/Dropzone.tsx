import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { LIMITS } from '../../../shared/validation.js';
import { Icon } from '../ui/Icon';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MB = 1024 * 1024;

interface DropzoneProps {
  // Cuántas fotos más se pueden agregar ahora mismo.
  remaining: number;
  onFiles: (files: File[]) => void;
  onRejected: (messages: string[]) => void;
  disabled?: boolean;
}

// Valida en el navegador antes de subir (el servidor vuelve a validar por contenido).
export function filterImages(files: File[], remaining: number): { accepted: File[]; rejected: string[] } {
  const accepted: File[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    if (!ACCEPTED.includes(file.type)) rejected.push(`«${file.name}» no es JPG, PNG, WEBP ni GIF`);
    else if (file.size > LIMITS.photoMaxBytes) rejected.push(`«${file.name}» pesa más de ${LIMITS.photoMaxBytes / MB} MB`);
    else if (accepted.length >= remaining) rejected.push(`«${file.name}» supera el máximo de fotos permitido`);
    else accepted.push(file);
  }
  return { accepted, rejected };
}

export function Dropzone({ remaining, onFiles, onRejected, disabled }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const blocked = disabled || remaining <= 0;

  function handle(files: File[]) {
    if (blocked || files.length === 0) return;
    const { accepted, rejected } = filterImages(files, remaining);
    if (rejected.length) onRejected(rejected);
    if (accepted.length) onFiles(accepted);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    handle(Array.from(e.dataTransfer.files));
  }

  return (
    <div
      className={`dropzone${over ? ' over' : ''}${blocked ? ' disabled' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!blocked) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => !blocked && inputRef.current?.click()}
      role="button"
      tabIndex={blocked ? -1 : 0}
      aria-disabled={blocked}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !blocked) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <Icon name="upload" size={26} />
      <strong>{blocked ? 'Alcanzaste el máximo de fotos' : 'Arrastra tus fotos aquí o haz clic para elegirlas'}</strong>
      <span className="muted">
        JPG, PNG, WEBP o GIF · máximo {LIMITS.photoMaxBytes / MB} MB cada una
        {!blocked && ` · puedes agregar ${remaining} más`}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        multiple
        hidden
        onChange={(e) => {
          handle(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </div>
  );
}
