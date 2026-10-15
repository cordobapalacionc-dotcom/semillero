// SQLite guarda fechas en UTC como "YYYY-MM-DD HH:MM:SS".
export function parseDate(value: string): Date {
  return new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
}

const dateFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const numberFmt = new Intl.NumberFormat('es');

export const formatDate = (value: string) => dateFmt.format(parseDate(value));
export const formatDay = (isoDay: string) => shortFmt.format(new Date(`${isoDay}T00:00:00Z`));
export const formatNumber = (n: number) => numberFmt.format(n);

export function timeAgo(value: string): string {
  const seconds = Math.round((Date.now() - parseDate(value).getTime()) / 1000);
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
  return formatDate(value);
}

export const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

export function passwordChecks(pw: string): PasswordCheck[] {
  return [
    { label: 'Al menos 8 caracteres', ok: pw.length >= 8 },
    { label: 'Al menos una letra', ok: /[A-Za-z]/.test(pw) },
    { label: 'Al menos un número', ok: /\d/.test(pw) },
    { label: 'Un símbolo o 12+ caracteres (recomendado)', ok: /[^A-Za-z0-9]/.test(pw) || pw.length >= 12 },
  ];
}

export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { score: 0, label: '' };
  const [len, letter, digit, extra] = passwordChecks(pw).map((c) => c.ok);
  if (!(len && letter && digit)) return { score: 1, label: 'Débil' };
  if (!extra) return { score: 2, label: 'Media' };
  return { score: 3, label: 'Fuerte' };
}

export function errorMessage(err: unknown, fallback = 'Ocurrió un error'): string {
  return err instanceof Error ? err.message : fallback;
}
