import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ApiError } from '../api/client';

interface Issue {
  path: (string | number)[];
  message: string;
}
interface Schema {
  safeParse: (data: unknown) => { success: true } | { success: false; error: { issues: Issue[] } };
}

export function issuesToFields(issues: Issue[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '_');
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

// Estado de formulario validado en vivo con un esquema zod compartido con el servidor.
// Los errores de cada campo se muestran después de tocarlo (blur) o de intentar enviar.
export function useForm<T extends Record<string, string>>(schema: Schema, initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const clientErrors = useMemo(() => {
    const result = schema.safeParse(values);
    return result.success ? {} : issuesToFields(result.error.issues);
  }, [schema, values]);

  const errorFor = useCallback(
    (name: keyof T & string) => {
      if (serverErrors[name]) return serverErrors[name];
      if (!touched[name] && !submitted) return null;
      return clientErrors[name] ?? null;
    },
    [serverErrors, touched, submitted, clientErrors],
  );

  const bind = useCallback(
    (name: keyof T & string) => ({
      id: name,
      name,
      value: values[name],
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = e.target.value;
        setValues((prev) => ({ ...prev, [name]: value }));
        setServerErrors((prev) => {
          if (!prev[name]) return prev;
          const next = { ...prev };
          delete next[name];
          return next;
        });
        setFormError(null);
      },
      onBlur: () => setTouched((prev) => ({ ...prev, [name]: true })),
      'aria-invalid': Boolean(errorFor(name)) || undefined,
      'aria-describedby': errorFor(name) ? `${name}-error` : undefined,
    }),
    [values, errorFor],
  );

  // Marca el intento de envío; devuelve true si no hay errores locales.
  const validateAll = useCallback(() => {
    setSubmitted(true);
    return Object.keys(clientErrors).length === 0;
  }, [clientErrors]);

  const applyServerError = useCallback((err: unknown) => {
    if (err instanceof ApiError) {
      const hasFields = Boolean(err.fields && Object.keys(err.fields).length > 0);
      if (hasFields) setServerErrors(err.fields!);
      setFormError(hasFields ? null : err.message);
    } else {
      setFormError('Ocurrió un error inesperado');
    }
  }, []);

  // Vuelve a un estado limpio (p. ej. tras guardar), sin mostrar errores de campos vacíos.
  const reset = useCallback((next: T) => {
    setValues(next);
    setTouched({});
    setSubmitted(false);
    setServerErrors({});
    setFormError(null);
  }, []);

  return {
    reset,
    values,
    setValues,
    bind,
    errorFor,
    clientErrors,
    validateAll,
    applyServerError,
    setServerErrors,
    formError,
    setFormError,
    hasErrors: Object.keys(clientErrors).length > 0 || Object.keys(serverErrors).length > 0,
  };
}
