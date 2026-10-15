import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { registerSchema } from '../../../shared/validation.js';
import { authApi } from '../../api';
import { Field, PasswordInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDebounce } from '../../hooks/useDebounce';
import { useForm } from '../../hooks/useForm';
import { passwordChecks, passwordStrength } from '../../lib/format';
import { AuthLayout } from './AuthLayout';
import { safeNext } from './LoginPage';

type Availability = 'checking' | 'free' | 'taken' | null;

const TAKEN = {
  username: 'Ese usuario ya está en uso',
  email: 'Ese correo ya está registrado',
} as const;

// Consulta en vivo si el valor está libre, solo cuando ya es válido localmente.
function useAvailability(field: 'username' | 'email', value: string, locallyValid: boolean): Availability {
  const debounced = useDebounce(value.trim(), 400);
  const [state, setState] = useState<Availability>(null);

  useEffect(() => {
    if (!debounced || !locallyValid) {
      setState(null);
      return;
    }
    let cancelled = false;
    setState('checking');
    authApi
      .check({ [field]: debounced })
      .then((res) => {
        if (cancelled) return;
        const free = field === 'username' ? res.usernameAvailable : res.emailAvailable;
        setState(free ? 'free' : 'taken');
      })
      .catch(() => !cancelled && setState(null));
    return () => {
      cancelled = true;
    };
  }, [field, debounced, locallyValid]);

  return state;
}

function AvailabilityStatus({ state }: { state: Availability }) {
  if (state === 'checking') return <span>Comprobando…</span>;
  if (state === 'free')
    return (
      <span className="status-ok">
        <Icon name="check" size={12} /> Disponible
      </span>
    );
  if (state === 'taken') return <span>En uso</span>;
  return null;
}

export function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm(registerSchema, { email: '', username: '', password: '', confirmPassword: '' });

  const usernameState = useAvailability('username', form.values.username, !form.clientErrors.username);
  const emailState = useAvailability('email', form.values.email, !form.clientErrors.email);

  const errorWithAvailability = (field: 'username' | 'email', state: Availability) =>
    form.errorFor(field) ?? (state === 'taken' ? TAKEN[field] : null);

  const strength = passwordStrength(form.values.password);
  const checks = passwordChecks(form.values.password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const valid = form.validateAll();
    if (!valid || usernameState === 'taken' || emailState === 'taken' || submitting) return;
    setSubmitting(true);
    try {
      const user = await register(form.values);
      toast.success(`¡Bienvenido, ${user.username}! Tu cuenta está lista.`);
      navigate(safeNext(params.get('next')), { replace: true });
    } catch (err) {
      form.applyServerError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Regístrate para publicar tus proyectos."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link className="link" to="/login">
            Iniciar sesión
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

        <Field
          label="Correo electrónico"
          htmlFor="email"
          error={errorWithAvailability('email', emailState)}
          status={<AvailabilityStatus state={emailState} />}
        >
          <input {...form.bind('email')} type="email" autoComplete="email" autoFocus placeholder="tu@correo.com" />
        </Field>

        <Field
          label="Nombre de usuario"
          htmlFor="username"
          error={errorWithAvailability('username', usernameState)}
          status={<AvailabilityStatus state={usernameState} />}
          hint="3 a 20 caracteres: letras, números y _ . -"
        >
          <input {...form.bind('username')} autoComplete="username" placeholder="tu_usuario" maxLength={20} />
        </Field>

        <Field
          label="Contraseña"
          htmlFor="password"
          error={form.errorFor('password')}
          status={strength.label && <span className={`strength strength-${strength.score}`}>{strength.label}</span>}
        >
          <PasswordInput {...form.bind('password')} autoComplete="new-password" maxLength={72} />
          <div className="strength-bar" aria-hidden>
            {[1, 2, 3].map((n) => (
              <span key={n} className={strength.score >= n ? 'on' : ''} />
            ))}
          </div>
          <ul className="checklist">
            {checks.map((c) => (
              <li key={c.label} className={c.ok ? 'ok' : ''}>
                <Icon name={c.ok ? 'check' : 'close'} size={12} /> {c.label}
              </li>
            ))}
          </ul>
        </Field>

        <Field label="Confirmar contraseña" htmlFor="confirmPassword" error={form.errorFor('confirmPassword')}>
          <PasswordInput {...form.bind('confirmPassword')} autoComplete="new-password" maxLength={72} />
        </Field>

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
    </AuthLayout>
  );
}
