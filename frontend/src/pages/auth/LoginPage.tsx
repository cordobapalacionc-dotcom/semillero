import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loginSchema } from '../../shared/validation.js';
import { Field, PasswordInput } from '../../components/ui/Field';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import { AuthLayout } from './AuthLayout';

// Solo se permiten redirecciones internas para evitar enviar al usuario a otro sitio.
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/dashboard';
}

export function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm(loginSchema, { identifier: '', password: '' });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.validateAll() || submitting) return;
    setSubmitting(true);
    try {
      const user = await login(form.values.identifier.trim(), form.values.password);
      toast.success(`¡Hola de nuevo, ${user.username}!`);
      navigate(safeNext(params.get('next')), { replace: true });
    } catch (err) {
      form.applyServerError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Entra con tu nombre de usuario o tu correo."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link className="link" to={`/registro${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`}>
            Crear una cuenta
          </Link>
        </>
      }
    >
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        {form.formError && (
          <div className="form-error" role="alert">
            {form.formError}
          </div>
        )}
        <Field label="Usuario o correo" htmlFor="identifier" error={form.errorFor('identifier')}>
          <input {...form.bind('identifier')} autoComplete="username" autoFocus placeholder="tu_usuario o tu@correo.com" />
        </Field>
        <Field label="Contraseña" htmlFor="password" error={form.errorFor('password')}>
          <PasswordInput {...form.bind('password')} autoComplete="current-password" />
        </Field>
        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </AuthLayout>
  );
}
