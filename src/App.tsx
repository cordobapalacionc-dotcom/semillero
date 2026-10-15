import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { FeaturedSection } from './components/FeaturedSection';
import { Gallery } from './components/Gallery';
import { AuthModal } from './components/AuthModal';
import { UploadModal } from './components/UploadModal';
import { PhotoModal } from './components/PhotoModal';
import type { Photo } from './types';

export function App() {
  const { loading: authLoading } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [featured, setFeatured] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [category, setCategory] = useState('Todas');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadData() {
    setLoadingPhotos(true);
    setLoadError(null);
    try {
      const [allPhotos, featuredPhotos] = await Promise.all([
        api.listPhotos(),
        api.listFeatured(),
      ]);
      setPhotos(allPhotos);
      setFeatured(featuredPhotos);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar las fotos');
    } finally {
      setLoadingPhotos(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const categories = useMemo(() => {
    const unique = new Set(photos.map((p) => p.category));
    return ['Todas', ...Array.from(unique).sort()];
  }, [photos]);

  const visiblePhotos = useMemo(
    () => (category === 'Todas' ? photos : photos.filter((p) => p.category === category)),
    [photos, category],
  );

  function applyPhotoUpdate(id: number, updater: (photo: Photo) => Photo) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
    setFeatured((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
    setSelectedPhoto((prev) => (prev && prev.id === id ? updater(prev) : prev));
  }

  async function handleToggleLike(photo: Photo) {
    const optimistic = {
      likedByMe: !photo.likedByMe,
      likeCount: photo.likeCount + (photo.likedByMe ? -1 : 1),
    };
    applyPhotoUpdate(photo.id, (p) => ({ ...p, ...optimistic }));

    try {
      const result = await api.toggleLike(photo.id);
      applyPhotoUpdate(photo.id, (p) => ({
        ...p,
        likedByMe: result.liked,
        likeCount: result.likeCount,
      }));
    } catch {
      applyPhotoUpdate(photo.id, (p) => ({
        ...p,
        likedByMe: photo.likedByMe,
        likeCount: photo.likeCount,
      }));
    }
  }

  function handleUploaded(photo: Photo) {
    setPhotos((prev) => [photo, ...prev]);
  }

  function handleDeleted(photoId: number) {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    setFeatured((prev) => prev.filter((p) => p.id !== photoId));
  }

  return (
    <>
      <Navbar onOpenAuth={() => setShowAuth(true)} onOpenUpload={() => setShowUpload(true)} />

      <main className="page">
        {authLoading || loadingPhotos ? (
          <p className="muted center">Cargando galería…</p>
        ) : loadError ? (
          <p className="form-error center">{loadError}</p>
        ) : (
          <>
            <FeaturedSection
              photos={featured}
              onOpen={setSelectedPhoto}
              onToggleLike={handleToggleLike}
            />

            <section className="category-tabs">
              {categories.map((c) => (
                <button
                  key={c}
                  className={c === category ? 'active' : ''}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </section>

            <Gallery
              photos={visiblePhotos}
              onOpen={setSelectedPhoto}
              onToggleLike={handleToggleLike}
            />
          </>
        )}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />
      )}
      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onToggleLike={handleToggleLike}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
