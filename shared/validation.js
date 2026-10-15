// Esquemas de validación compartidos entre el servidor (Express) y el cliente (React).
import { z } from 'zod';

export const LIMITS = {
  usernameMin: 3,
  usernameMax: 20,
  emailMax: 254,
  passwordMin: 8,
  passwordMax: 72,
  bioMax: 300,
  titleMin: 2,
  titleMax: 80,
  descriptionMax: 2000,
  categoryMin: 2,
  categoryMax: 40,
  captionMax: 200,
  commentMax: 500,
  searchMax: 100,
  photosPerUpload: 20,
  photosPerProject: 50,
  photoMaxBytes: 10 * 1024 * 1024,
  bulkMax: 100,
};

const text = (required) => z.string({ required_error: required, invalid_type_error: required });

export const emailSchema = text('El correo es obligatorio')
  .trim()
  .toLowerCase()
  .min(1, 'El correo es obligatorio')
  .max(LIMITS.emailMax, 'El correo es demasiado largo')
  .email('Ingresa un correo válido');

export const usernameSchema = text('El usuario es obligatorio')
  .trim()
  .min(LIMITS.usernameMin, `El usuario debe tener al menos ${LIMITS.usernameMin} caracteres`)
  .max(LIMITS.usernameMax, `El usuario debe tener máximo ${LIMITS.usernameMax} caracteres`)
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Solo letras, números y los símbolos _ . -')
  .refine((v) => !/^\d+$/.test(v), 'El usuario no puede ser solo números');

export const passwordSchema = text('La contraseña es obligatoria')
  .min(LIMITS.passwordMin, `La contraseña debe tener al menos ${LIMITS.passwordMin} caracteres`)
  .max(LIMITS.passwordMax, `La contraseña debe tener máximo ${LIMITS.passwordMax} caracteres`)
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
  .regex(/\d/, 'La contraseña debe incluir al menos un número');

const passwordsMatch = (field) => (data, ctx) => {
  if (data[field] !== data.confirmPassword) {
    ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Las contraseñas no coinciden' });
  }
};

export const registerSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: text('Confirma tu contraseña').min(1, 'Confirma tu contraseña'),
  })
  .superRefine(passwordsMatch('password'));

export const loginSchema = z.object({
  identifier: text('Ingresa tu usuario o correo')
    .trim()
    .min(1, 'Ingresa tu usuario o correo')
    .max(LIMITS.emailMax, 'Usuario o correo demasiado largo'),
  password: text('Ingresa tu contraseña')
    .min(1, 'Ingresa tu contraseña')
    .max(LIMITS.passwordMax, 'Contraseña demasiado larga'),
});

export const bioSchema = z
  .string()
  .trim()
  .max(LIMITS.bioMax, `La biografía debe tener máximo ${LIMITS.bioMax} caracteres`);

export const profileSchema = z.object({
  username: usernameSchema.optional(),
  email: emailSchema.optional(),
  bio: bioSchema.optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: text('Ingresa tu contraseña actual').min(1, 'Ingresa tu contraseña actual'),
    newPassword: passwordSchema,
    confirmPassword: text('Confirma tu contraseña').min(1, 'Confirma tu contraseña'),
  })
  .superRefine(passwordsMatch('newPassword'));

export const titleSchema = text('El título es obligatorio')
  .trim()
  .min(LIMITS.titleMin, `El título debe tener al menos ${LIMITS.titleMin} caracteres`)
  .max(LIMITS.titleMax, `El título debe tener máximo ${LIMITS.titleMax} caracteres`);

export const descriptionSchema = z
  .string()
  .trim()
  .max(LIMITS.descriptionMax, `La descripción debe tener máximo ${LIMITS.descriptionMax} caracteres`);

export const categorySchema = text('La categoría es obligatoria')
  .trim()
  .min(LIMITS.categoryMin, `La categoría debe tener al menos ${LIMITS.categoryMin} caracteres`)
  .max(LIMITS.categoryMax, `La categoría debe tener máximo ${LIMITS.categoryMax} caracteres`);

const positiveId = z.coerce.number().int().positive();

export const projectSchema = z.object({
  title: titleSchema,
  description: descriptionSchema.default(''),
  category: categorySchema,
});

export const projectUpdateSchema = z.object({
  title: titleSchema.optional(),
  description: descriptionSchema.optional(),
  category: categorySchema.optional(),
  coverPhotoId: positiveId.optional(),
});

export const captionSchema = z.object({
  caption: z
    .string({ required_error: 'El pie de foto es obligatorio' })
    .trim()
    .max(LIMITS.captionMax, `El pie de foto debe tener máximo ${LIMITS.captionMax} caracteres`),
});

export const commentSchema = z.object({
  content: text('El comentario no puede estar vacío')
    .trim()
    .min(1, 'El comentario no puede estar vacío')
    .max(LIMITS.commentMax, `El comentario debe tener máximo ${LIMITS.commentMax} caracteres`),
});

export const photoOrderSchema = z.object({
  photoIds: z.array(positiveId).min(1).max(LIMITS.photosPerProject),
});

export const bulkIdsSchema = z.object({
  ids: z
    .array(positiveId)
    .min(1, 'Selecciona al menos un elemento')
    .max(LIMITS.bulkMax, `Máximo ${LIMITS.bulkMax} elementos por operación`),
});

const page = z.coerce.number().int().min(1).max(10000).default(1);
const search = z.string().trim().max(LIMITS.searchMax).default('');

export const listQuerySchema = z.object({
  q: search,
  category: z.string().trim().max(LIMITS.categoryMax).default(''),
  sort: z.enum(['recent', 'popular', 'commented']).default('recent'),
  page,
});

export const adminListQuerySchema = z.object({
  q: search,
  category: z.string().trim().max(LIMITS.categoryMax).default(''),
  featured: z.enum(['true', 'false']).optional(),
  role: z.enum(['user', 'admin', 'superadmin']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  sort: z.string().trim().max(20).optional(),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page,
});
