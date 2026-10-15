import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, hint, status, children }: FieldProps) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <div className="field-top">
        <label htmlFor={htmlFor}>{label}</label>
        {status && <span className="field-status">{status}</span>}
      </div>
      {children}
      {error ? (
        <p className="field-error" id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="field-hint">{hint}</p>
      )}
    </div>
  );
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        <Icon name={visible ? 'ban' : 'eye'} size={16} />
      </button>
    </div>
  );
}
