import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { Photo } from '../types';

interface UploadModalProps {
  onClose: () => void;
  onUploaded: (photo: Photo) => void;
}

const CATEGORY_SUGGESTIONS = [
  'Inteligencia Artificial',
  'Robótica',
  'Software',
  'Hardware',
  'IoT',
  'Videojuegos',
  'Sostenibilidad',
  'Ciberseguridad',
];

export function UploadModal({ onClose, onUploaded }: UploadModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setPreview(null);
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Selecciona una imagen');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category || 'General');
    formData.append('image', file);

    setSubmitting(true);
    try {
      const photo = await api.uploadPhoto(formData);
      onUploaded(photo);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la foto');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal upload-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        <h2>Compartir un proyecto</h2>

        <form onSubmit={handleSubmit} className="upload-form">
          <label className="file-drop">
            {preview ? (
              <img src={preview} alt="Vista previa" />
            ) : (
              <span>📷 Haz clic para elegir una imagen</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileChange}
              required
              hidden
            />
          </label>

          <label>
            Título
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={2}
              maxLength={120}
              required
              placeholder="Ej: Brazo robótico clasificador"
            />
          </label>

          <label>
            Categoría
            <input
              type="text"
              list="category-suggestions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej: Robótica"
            />
            <datalist id="category-suggestions">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label>
            Descripción
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Cuenta de qué trata el proyecto…"
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Subiendo…' : 'Publicar foto'}
          </button>
        </form>
      </div>
    </div>
  );
}
