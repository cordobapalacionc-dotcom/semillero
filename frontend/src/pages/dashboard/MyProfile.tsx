import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LIMITS, changePasswordSchema, profileSchema } from '../../shared/validation.js';
import { authApi } from '../../api';
import { PageHeader } from '../../components/layout/SidebarLayout';
import { Badge } from '../../components/ui/Feedback';
import { Field, PasswordInput } from '../../components/ui/Field';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import { formatDate } from '../../lib/format';
import type { Me } from '../../types';

const ROLE_LABEL = { superadmin: '★ Admin principal', admin: 'Administrador', user: 'Usuario' } as const;

function ProfileForm({ user }: { user: Me }) {
  const { setUser } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const form = useForm(profileSchema, { username: user.username, email: user.email, bio: user.bio });

  const changed =
    form.values.username.trim() !== user.username ||
    form.values.email.trim().toLowerCase() !== user.email ||
    form.values.bio.trim() !== user.bio;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.validateAll() || !changed || saving) return;
    setSaving(true);
    try {
      const { user: updated } = await authApi.updateMe({
        username: form.values.username.trim(),
        email: form.values.email.trim(),
        bio: form.values.bio.trim(),
      });
      setUser(updated);
      form.reset({ username: updated.username, email: updated.email, bio: updated.bio });
      toast.success('Perfil actualizado');
    } catch (err) {
      form.applyServerError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form-stack" onSubmit={handleSubmit} noValidate>
      <div className="panel-head">
        <h2>Datos de la cuenta</h2>
        <Badge tone={user.role === 'user' ? 'default' : 'solid'}>{ROLE_LABEL[user.role]}</Badge>
      </div>
      {form.formError && <div className="form-error">{form.formError}</div>}
      <div className="form-row">
        <Field label="Nombre de usuario" htmlFor="username" error={form.errorFor('username')}>
          <input {...form.bind('username')} autoComplete="username" maxLength={LIMITS.usernameMax} />
        </Field>
        <Field label="Correo electrónico" htmlFor="email" error={form.errorFor('email')}>
          <input {...form.bind('email')} type="email" autoComplete="email" />
        </Field>
      </div>
      <Field
        label="Biografía"
        htmlFor="bio"
        error={form.errorFor('bio')}
        status={`${form.values.bio.trim().length}/${LIMITS.bioMax}`}
        hint="Aparece en tu perfil público."
      >
        <textarea {...form.bind('bio')} rows={3} placeholder="Cuéntale a la comunidad quién eres y qué construyes." />
      </Field>
      <div className="form-actions">
        <span className="muted">Miembro desde {formatDate(user.createdAt)}</span>
        <button className="btn btn-primary" disabled={!changed || saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const empty = { currentPassword: '', newPassword: '', confirmPassword: '' };
  const form = useForm(changePasswordSchema, empty);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.validateAll() || saving) return;
    setSaving(true);
    try {
      await authApi.changePassword(form.values);
      toast.success('Contraseña actualizada');
      form.reset(empty);
    } catch (err) {
      form.applyServerError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form-stack" onSubmit={handleSubmit} noValidate>
      <div className="panel-head">
        <h2>Cambiar contraseña</h2>
      </div>
      {form.formError && <div className="form-error">{form.formError}</div>}
      <Field label="Contraseña actual" htmlFor="currentPassword" error={form.errorFor('currentPassword')}>
        <PasswordInput {...form.bind('currentPassword')} autoComplete="current-password" />
      </Field>
      <div className="form-row">
        <Field label="Nueva contraseña" htmlFor="newPassword" error={form.errorFor('newPassword')} hint="Mínimo 8 caracteres, con letras y números.">
          <PasswordInput {...form.bind('newPassword')} autoComplete="new-password" maxLength={LIMITS.passwordMax} />
        </Field>
        <Field label="Confirmar nueva contraseña" htmlFor="confirmPassword" error={form.errorFor('confirmPassword')}>
          <PasswordInput {...form.bind('confirmPassword')} autoComplete="new-password" maxLength={LIMITS.passwordMax} />
        </Field>
      </div>
      <div className="form-actions">
        <span />
        <button className="btn btn-primary" disabled={saving}>
          {saving ? 'Actualizando…' : 'Actualizar contraseña'}
        </button>
      </div>
    </form>
  );
}

export function MyProfile() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <PageHeader
        title="Mi perfil"
        description="Administra tus datos y tu seguridad."
        actions={
          <Link to={`/usuarios/${user.username}`} className="btn btn-ghost">
            Ver perfil público
          </Link>
        }
      />
      <ProfileForm key={user.id} user={user} />
      <PasswordForm />
    </>
  );
}
