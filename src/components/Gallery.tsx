import type { Photo } from '../types';
import { PhotoCard } from './PhotoCard';

interface GalleryProps {
  photos: Photo[];
  onOpen: (photo: Photo) => void;
  onToggleLike: (photo: Photo) => void;
}

export function Gallery({ photos, onOpen, onToggleLike }: GalleryProps) {
  if (photos.length === 0) {
    return (
      <div className="empty-state">
        <p>Todavía no hay fotos en esta categoría.</p>
        <p>¡Sé la primera persona en compartir un proyecto! 🚀</p>
      </div>
    );
  }

  return (
    <div className="gallery-grid">
      {photos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} onOpen={onOpen} onToggleLike={onToggleLike} />
      ))}
    </div>
  );
}
