import multer from 'multer';

export class HttpError extends Error {
  // code: identificador estable para que el cliente reaccione sin depender del texto.
  constructor(status, message, fields, code) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.code = code;
  }
}

export function zodFields(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: 'Cada imagen debe pesar máximo 10 MB',
  LIMIT_FILE_COUNT: 'Máximo 20 imágenes por subida',
  LIMIT_UNEXPECTED_FILE: 'Campo de archivo inesperado (usa "photos")',
};

export function errorHandler(err, _req, res, _next) {
  // Se compara por nombre: shared/ y server/ pueden resolver copias distintas de zod.
  if (err?.name === 'ZodError' && Array.isArray(err.issues)) {
    return res.status(400).json({ error: 'Datos inválidos', fields: zodFields(err) });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: MULTER_MESSAGES[err.code] ?? 'Error al subir los archivos' });
  }
  if (err instanceof HttpError) {
    const body = { error: err.message };
    if (err.fields) body.fields = err.fields;
    if (err.code) body.code = err.code;
    return res.status(err.status).json(body);
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La petición es demasiado grande' });
  }
  if (err?.status === 404 && err?.expose) {
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }

  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}
