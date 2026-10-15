import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LIMITS, projectSchema } from '../../shared/validation.js';
import { meApi, projectsApi } from '../../api';
import { PageHeader } from '../../components/layout/SidebarLayout';
import { CategoryInput } from '../../components/projects/CategoryInput';
import { Dropzone } from '../../components/projects/Dropzone';
import { SortablePhotos } from '../../components/projects/SortablePhotos';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback';
import { Field } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { useConfirm } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { useForm } from '../../hooks/useForm';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { errorMessage, plural } from '../../lib/format';
import type { Category, ProjectDetail } from '../../types';

interface LocalFile {
  key: string;
  file: File;
  url: string;
}

let localCounter = 0;
const toLocal = (files: File[]): LocalFile[] =>
  files.map((file) => ({ key: `local-${++localCounter}`, file, url: URL.createObjectURL(file) }));

// Libera las vistas previas (object URLs) cuando el componente se desmonta.
function useObjectUrlCleanup(files: LocalFile[]) {
  const ref = useRef(files);
  ref.current = files;
  useEffect(() => () => ref.current.forEach((f) => URL.revokeObjectURL(f.url)), []);
}

type MetaForm = ReturnType<typeof useForm<{ title: string; description: string; category: string }>>;

function MetadataFields({ form, categories }: { form: MetaForm; categories: Category[] }) {
  const titleLen = form.values.title.trim().length;
  const descLen = form.values.description.trim().length;
  return (
    <>
      <Field label="Título" htmlFor="title" error={form.errorFor('title')} status={`${titleLen}/${LIMITS.titleMax}`}>
        <input {...form.bind('title')} maxLength={LIMITS.titleMax} placeholder="Ej. Brazo robótico controlado por voz" />
      </Field>
      <Field label="Categoría" htmlFor="category" error={form.errorFor('category')} hint="Elige una existente o escribe la tuya.">
        <CategoryInput
          id="category"
          value={form.values.category}
          onChange={(category) => form.setValues((prev) => ({ ...prev, category }))}
          onBlur={form.bind('category').onBlur}
          categories={categories}
          invalid={Boolean(form.errorFor('category'))}
        />
      </Field>
      <Field label="Descripción" htmlFor="description" error={form.errorFor('description')} status={`${descLen}/${LIMITS.descriptionMax}`}>
        <textarea {...form.bind('description')} rows={6} placeholder="¿Qué problema resuelve? ¿Cómo lo construiste? ¿Qué tecnologías usaste?" />
      </Field>
    </>
  );
}

function UploadProgress({ percent }: { percent: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${percent}%` }} />
      <em>{percent < 100 ? `Subiendo… ${percent}%` : 'Procesando…'}</em>
    </div>
  );
}

// ---------------- Crear ----------------

function CreateProject({ categories }: { categories: Category[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const form = useForm(projectSchema, { title: '', description: '', category: '' });
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  useObjectUrlCleanup(files);

  const dirty = createdId === null && (files.length > 0 || Object.values(form.values).some((v) => v.trim() !== ''));
  useUnsavedChanges(dirty);

  // Se navega después del render en que dirty pasa a false, para que el aviso no bloquee.
  useEffect(() => {
    if (createdId !== null) navigate(`/proyectos/${createdId}`);
  }, [createdId, navigate]);

  const effectiveCover = coverKey && files.some((f) => f.key === coverKey) ? coverKey : (files[0]?.key ?? null);

  function addFiles(list: File[]) {
    setFiles((prev) => [...prev, ...toLocal(list)]);
    setPhotoError(null);
  }

  function removeFile(key: string) {
    setFiles((prev) => {
      const target = prev.find((f) => f.key === key);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((f) => f.key !== key);
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const valid = form.validateAll();
    if (files.length === 0) setPhotoError('Agrega al menos una foto');
    if (!valid || files.length === 0 || progress !== null) return;

    const data = new FormData();
    data.append('title', form.values.title.trim());
    data.append('description', form.values.description.trim());
    data.append('category', form.values.category.trim());
    files.forEach((f) => data.append('photos', f.file, f.file.name));

    setProgress(0);
    try {
      const project = await meApi.create(data, setProgress);
      // El proyecto ya existe: aunque falle el cambio de portada, no se debe volver a enviar.
      const coverIndex = files.findIndex((f) => f.key === effectiveCover);
      if (coverIndex > 0) {
        try {
          await meApi.update(project.id, { coverPhotoId: project.photos[coverIndex].id });
        } catch {
          toast.error('El proyecto se publicó, pero no se pudo cambiar la portada. Puedes cambiarla al editarlo.');
        }
      }
      toast.success('¡Proyecto publicado!');
      setCreatedId(project.id);
    } catch (err) {
      form.applyServerError(err);
      setProgress(null);
    }
  }

  return (
    <>
      <PageHeader title="Nuevo proyecto" description="Cuéntale a la comunidad qué construiste y sube sus fotos." />
      <form className="project-form" onSubmit={handleSubmit} noValidate>
        <section className="panel form-stack">
          <h2>Información</h2>
          {form.formError && <div className="form-error" role="alert">{form.formError}</div>}
          <MetadataFields form={form} categories={categories} />
        </section>

        <section className="panel form-stack">
          <div className="panel-head">
            <h2>Fotos</h2>
            <span className="muted">
              {files.length}/{LIMITS.photosPerUpload}
            </span>
          </div>
          <Dropzone
            remaining={LIMITS.photosPerUpload - files.length}
            onFiles={addFiles}
            onRejected={(msgs) => toast.error(msgs.join(' · '))}
            disabled={progress !== null}
          />
          {photoError && <p className="field-error">{photoError}</p>}
          {files.length > 0 && (
            <>
              <p className="muted small">Arrastra para ordenar. La ★ marca la portada.</p>
              <SortablePhotos
                items={files.map((f) => ({ key: f.key, url: f.url }))}
                coverKey={effectiveCover}
                onReorder={(keys) => setFiles((prev) => keys.map((k) => prev.find((f) => f.key === k)!))}
                onRemove={removeFile}
                onSetCover={setCoverKey}
                canRemove
                disabled={progress !== null}
              />
            </>
          )}
        </section>

        <div className="form-footer">
          {progress !== null ? <UploadProgress percent={progress} /> : <span />}
          <div className="page-actions">
            <Link to="/dashboard/proyectos" className="btn btn-ghost">
              Cancelar
            </Link>
            <button className="btn btn-primary" disabled={progress !== null}>
              {progress !== null ? 'Publicando…' : 'Publicar proyecto'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

// ---------------- Editar ----------------

function EditProject({ initial, categories }: { initial: ProjectDetail; categories: Category[] }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [project, setProject] = useState(initial);
  const form = useForm(projectSchema, {
    title: initial.title,
    description: initial.description,
    category: initial.category,
  });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<LocalFile[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  useObjectUrlCleanup(pending);

  const metaDirty =
    form.values.title.trim() !== project.title ||
    form.values.description.trim() !== project.description ||
    form.values.category.trim() !== project.category;
  useUnsavedChanges(metaDirty || pending.length > 0);

  const remaining = Math.min(
    LIMITS.photosPerUpload - pending.length,
    LIMITS.photosPerProject - project.photos.length - pending.length,
  );

  async function run<T>(action: () => Promise<T>, success?: string): Promise<T | null> {
    setBusy(true);
    try {
      const result = await action();
      if (success) toast.success(success);
      return result;
    } catch (err) {
      toast.error(errorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    if (!form.validateAll() || !metaDirty || saving) return;
    setSaving(true);
    try {
      const updated = await meApi.update(project.id, {
        title: form.values.title.trim(),
        description: form.values.description.trim(),
        category: form.values.category.trim(),
      });
      setProject(updated);
      form.reset({ title: updated.title, description: updated.description, category: updated.category });
      toast.success('Cambios guardados');
    } catch (err) {
      form.applyServerError(err);
    } finally {
      setSaving(false);
    }
  }

  async function reorder(keys: string[]) {
    const ids = keys.map(Number);
    const previous = project;
    const byId = new Map(project.photos.map((p) => [p.id, p]));
    setProject({ ...project, photos: ids.map((id, position) => ({ ...byId.get(id)!, position })) });
    const updated = await run(() => meApi.reorder(project.id, ids));
    setProject(updated ?? previous);
  }

  async function setCover(key: string) {
    const updated = await run(() => meApi.update(project.id, { coverPhotoId: Number(key) }), 'Portada actualizada');
    if (updated) setProject(updated);
  }

  async function commitCaption(key: string, caption: string) {
    const updated = await run(() => meApi.updateCaption(project.id, Number(key), caption), 'Pie de foto guardado');
    if (updated) setProject(updated);
  }

  async function removePhoto(key: string) {
    const ok = await confirm({
      title: 'Quitar foto',
      message: 'La foto se eliminará del proyecto de forma permanente.',
      confirmLabel: 'Quitar foto',
      danger: true,
    });
    if (!ok) return;
    const updated = await run(() => meApi.removePhoto(project.id, Number(key)), 'Foto eliminada');
    if (updated) setProject(updated);
  }

  function removePending(key: string) {
    setPending((prev) => {
      const target = prev.find((f) => f.key === key);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((f) => f.key !== key);
    });
  }

  async function uploadPending() {
    if (pending.length === 0 || progress !== null) return;
    const data = new FormData();
    pending.forEach((f) => data.append('photos', f.file, f.file.name));
    setProgress(0);
    try {
      const updated = await meApi.addPhotos(project.id, data, setProgress);
      pending.forEach((f) => URL.revokeObjectURL(f.url));
      setPending([]);
      setProject(updated);
      toast.success(`${plural(pending.length, 'foto subida', 'fotos subidas')}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setProgress(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Editar proyecto"
        description={project.title}
        actions={
          <Link to={`/proyectos/${project.id}`} className="btn btn-ghost">
            <Icon name="eye" size={16} /> Ver publicado
          </Link>
        }
      />

      <form className="panel form-stack" onSubmit={saveMeta} noValidate>
        <h2>Información</h2>
        {form.formError && <div className="form-error" role="alert">{form.formError}</div>}
        <MetadataFields form={form} categories={categories} />
        <div className="form-actions">
          <span className="muted">{metaDirty ? 'Hay cambios sin guardar' : 'Todo guardado'}</span>
          <button className="btn btn-primary" disabled={!metaDirty || saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      <section className="panel form-stack">
        <div className="panel-head">
          <h2>Fotos</h2>
          <span className="muted">
            {project.photos.length}/{LIMITS.photosPerProject}
          </span>
        </div>
        <p className="muted small">Arrastra para ordenar (se guarda al soltar). La ★ marca la portada.</p>
        <SortablePhotos
          items={project.photos.map((p) => ({ key: String(p.id), url: p.url, caption: p.caption }))}
          coverKey={project.coverPhotoId ? String(project.coverPhotoId) : null}
          onReorder={reorder}
          onRemove={removePhoto}
          onSetCover={setCover}
          onCaptionCommit={commitCaption}
          canRemove={project.photos.length > 1}
          disabled={busy || progress !== null}
        />

        <h3 className="subhead">Agregar fotos</h3>
        <Dropzone remaining={remaining} onFiles={(f) => setPending((prev) => [...prev, ...toLocal(f)])} onRejected={(m) => toast.error(m.join(' · '))} disabled={progress !== null} />
        {pending.length > 0 && (
          <>
            <SortablePhotos
              items={pending.map((f) => ({ key: f.key, url: f.url, pending: true }))}
              coverKey={null}
              onReorder={(keys) => setPending((prev) => keys.map((k) => prev.find((f) => f.key === k)!))}
              onRemove={removePending}
              onSetCover={() => undefined}
              canRemove
              disabled={progress !== null}
            />
            <div className="form-actions">
              {progress !== null ? <UploadProgress percent={progress} /> : <span className="muted">{plural(pending.length, 'foto lista', 'fotos listas')} para subir</span>}
              <button type="button" className="btn btn-primary" onClick={uploadPending} disabled={progress !== null}>
                <Icon name="upload" size={16} /> Subir {plural(pending.length, 'foto', 'fotos')}
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

export function ProjectForm() {
  const { id } = useParams();
  const { user } = useAuth();
  const categories = useAsync(() => projectsApi.categories(), []);
  const projectId = Number(id);
  const editing = id !== undefined;
  const project = useAsync(() => (editing ? projectsApi.get(projectId) : Promise.resolve(null)), [projectId, editing]);

  if (!editing) return <CreateProject categories={categories.data ?? []} />;
  if (project.loading) return <Spinner label="Cargando proyecto…" />;
  if (project.error && project.error !== 'Proyecto no encontrado')
    return <ErrorState message={project.error} onRetry={project.reload} />;
  if (!project.data || project.data.owner.id !== user?.id)
    return (
      <EmptyState icon="folder" title="Proyecto no encontrado" action={<Link to="/dashboard/proyectos" className="btn btn-primary">Ir a mis proyectos</Link>}>
        No existe o no te pertenece.
      </EmptyState>
    );
  return <EditProject key={project.data.id} initial={project.data} categories={categories.data ?? []} />;
}
