import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Photo } from '../../types';
import { useOverlay } from '../ui/Modal';
import { Icon } from '../ui/Icon';

interface LightboxProps {
  photos: Photo[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  title: string;
}

export function Lightbox({ photos, index, onIndexChange, onClose, title }: LightboxProps) {
  useOverlay(true, onClose);
  const count = photos.length;
  const photo = photos[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onIndexChange((index + 1) % count);
      if (e.key === 'ArrowLeft') onIndexChange((index - 1 + count) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, count, onIndexChange]);

  if (!photo) return null;

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Fotos de ${title}`} onClick={onClose}>
      <div className="lightbox-top" onClick={(e) => e.stopPropagation()}>
        <span>
          {index + 1} / {count}
        </span>
        <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
          <Icon name="close" />
        </button>
      </div>
      <figure className="lightbox-figure" onClick={(e) => e.stopPropagation()}>
        <img src={photo.url} alt={photo.caption || `${title} — foto ${index + 1}`} />
        {photo.caption && <figcaption>{photo.caption}</figcaption>}
      </figure>
      {count > 1 && (
        <>
          <button
            className="lightbox-nav prev"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((index - 1 + count) % count);
            }}
            aria-label="Foto anterior"
          >
            <Icon name="left" size={22} />
          </button>
          <button
            className="lightbox-nav next"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((index + 1) % count);
            }}
            aria-label="Foto siguiente"
          >
            <Icon name="right" size={22} />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
