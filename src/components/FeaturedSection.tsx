import type { Photo } from '../types';
import { PhotoCard } from './PhotoCard';

interface FeaturedSectionProps {
  photos: Photo[];
  onOpen: (photo: Photo) => void;
  onToggleLike: (photo: Photo) => void;
}

export function FeaturedSection({ photos, onOpen, onToggleLike }: FeaturedSectionProps) {
  if (photos.length === 0) return null;

  return (
    <section className="featured-section">
      <h2>🌟 Destacadas</h2>
      <div className="featured-track">
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onOpen={onOpen}
            onToggleLike={onToggleLike}
            featured
          />
        ))}
      </div>
    </section>
  );
}
