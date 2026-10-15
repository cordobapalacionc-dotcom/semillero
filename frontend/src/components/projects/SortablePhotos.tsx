import { useState } from 'react';
import { LIMITS } from '../../shared/validation.js';
import { Icon } from '../ui/Icon';

export interface SortableItem {
  key: string;
  url: string;
  caption?: string;
  pending?: boolean;
}

interface SortablePhotosProps {
  items: SortableItem[];
  coverKey: string | null;
  onReorder: (keys: string[]) => void;
  onRemove: (key: string) => void;
  onSetCover: (key: string) => void;
  onCaptionCommit?: (key: string, caption: string) => void;
  canRemove: boolean;
  disabled?: boolean;
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Reordenar arrastrando (HTML5) o con los botones ← → para teclado y pantallas táctiles.
export function SortablePhotos({ items, coverKey, onReorder, onRemove, onSetCover, onCaptionCommit, canRemove, disabled }: SortablePhotosProps) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const keys = items.map((i) => i.key);

  function shift(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    onReorder(move(keys, index, target));
  }

  function drop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return;
    onReorder(move(keys, keys.indexOf(dragKey), keys.indexOf(targetKey)));
  }

  return (
    <ol className="sortable">
      {items.map((item, index) => (
        <li
          key={item.key}
          className={`sortable-item${dragKey === item.key ? ' dragging' : ''}${overKey === item.key && dragKey !== item.key ? ' over' : ''}`}
          draggable={!disabled}
          onDragStart={(e) => {
            setDragKey(item.key);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => {
            setDragKey(null);
            setOverKey(null);
          }}
          onDragOver={(e) => {
            if (!dragKey) return;
            e.preventDefault();
            setOverKey(item.key);
          }}
          onDrop={(e) => {
            e.preventDefault();
            drop(item.key);
            setDragKey(null);
            setOverKey(null);
          }}
        >
          <div className="sortable-media">
            <img src={item.url} alt={item.caption || `Foto ${index + 1}`} draggable={false} />
            <span className="sortable-index">{index + 1}</span>
            {coverKey === item.key && <span className="cover-chip cover-chip-left">★ Portada</span>}
            {item.pending && <span className="cover-chip">Sin subir</span>}
            <span className="drag-handle" aria-hidden>
              <Icon name="drag" size={16} />
            </span>
          </div>
          {onCaptionCommit && !item.pending && (
            <input
              className="input caption-input"
              defaultValue={item.caption}
              maxLength={LIMITS.captionMax}
              placeholder="Pie de foto (opcional)"
              aria-label={`Pie de la foto ${index + 1}`}
              onBlur={(e) => {
                if (e.target.value.trim() !== (item.caption ?? '')) onCaptionCommit(item.key, e.target.value.trim());
              }}
              disabled={disabled}
            />
          )}
          <div className="sortable-actions">
            <button type="button" className="icon-btn" onClick={() => shift(index, -1)} disabled={disabled || index === 0} aria-label="Mover a la izquierda" title="Mover antes">
              <Icon name="left" size={15} />
            </button>
            <button type="button" className="icon-btn" onClick={() => shift(index, 1)} disabled={disabled || index === items.length - 1} aria-label="Mover a la derecha" title="Mover después">
              <Icon name="right" size={15} />
            </button>
            <button
              type="button"
              className={`icon-btn${coverKey === item.key ? ' active' : ''}`}
              onClick={() => onSetCover(item.key)}
              disabled={disabled || coverKey === item.key || item.pending}
              aria-label="Usar como portada"
              title={item.pending ? 'Sube la foto para usarla como portada' : 'Usar como portada'}
            >
              <Icon name="star" size={15} filled={coverKey === item.key} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => onRemove(item.key)}
              disabled={disabled || !canRemove}
              aria-label="Quitar foto"
              title={canRemove ? 'Quitar foto' : 'El proyecto debe tener al menos una foto'}
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
