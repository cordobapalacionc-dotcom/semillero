# Galería: proyectos, dashboards y panel de administración — Diseño

Fecha: 2026-10-14
Estado: aprobado (2026-10-14)

## 1. Objetivo

Transformar la galería de fotos sueltas en una plataforma de **proyectos** (cada proyecto agrupa varias fotos), con:

- Diseño blanco y negro (con modo oscuro).
- Dashboard personal interactivo para cada usuario, desde donde crea y gestiona sus proyectos.
- Categorías libres escritas por el usuario (sin lista fija).
- Panel de administración interactivo con jerarquía de admins (admin principal + sub-admins).
- Registro con correo, usuario y contraseña validados; login con usuario **o** correo.
- Proyecto robusto: validación en servidor y cliente, transacciones, rate limiting, verificación de archivos.
- **Todo documentado en `README.md`.**

### Supuestos acordados

- La galería pública de inicio se mantiene, con likes y comentarios (ahora sobre proyectos).
- "Interactivo" = estadísticas, gráficas con tooltip, búsqueda, filtros, ordenamiento y acciones en línea sin recargar.

### Fuera de alcance

- Recuperación de contraseña por correo (no hay servidor de correo).
- Verificación de correo.
- Despliegue a producción.

## 2. Decisiones técnicas

| Tema | Decisión |
|---|---|
| Navegación | `react-router-dom` con rutas protegidas por rol |
| Gráficas | `recharts` |
| Validación | `zod`, esquemas compartidos entre servidor y cliente (`shared/validation.js`) |
| Base de datos | SQLite (`node:sqlite`, Node ≥ 22.5). Si se detecta el esquema viejo, se renombra `galeria.db` → `galeria.backup.db` y se crea uno nuevo |
| Configuración | `server/.env` (con `server/.env.example`), cargado con `process.loadEnvFile` de Node |
| Seguridad | `helmet`, `express-rate-limit`, límites de body, CORS restringido al origen del frontend, verificación de magic bytes de imágenes |

## 3. Datos

### Tablas

| Tabla | Campos |
|---|---|
| `users` | `id`, `username` (único, `COLLATE NOCASE`), `email` (único, se guarda en minúsculas), `password_hash`, `role` (`user` \| `admin` \| `superadmin`), `status` (`active` \| `suspended`), `bio`, `created_at`, `last_login_at` |
| `projects` | `id`, `owner_id` → users, `title`, `description`, `category`, `cover_photo_id` → photos (nullable), `featured` (0/1), `created_at`, `updated_at` |
| `photos` | `id`, `project_id` → projects, `image_path`, `caption`, `position`, `created_at` |
| `likes` | `id`, `project_id`, `user_id`, `created_at`, `UNIQUE(project_id, user_id)` |
| `comments` | `id`, `project_id`, `user_id`, `content`, `created_at` |

- Todas las FK con `ON DELETE CASCADE` (excepto `cover_photo_id`: `ON DELETE SET NULL`, y se reasigna a la primera foto restante).
- Índices en `projects(owner_id)`, `projects(category)`, `photos(project_id)`, `likes(project_id)`, `comments(project_id)`.
- Al borrar proyectos o usuarios, el servidor recoge primero los `image_path` afectados, borra en transacción y luego elimina los archivos del disco.

### Categorías libres

- Texto libre (2–40 caracteres). Al guardar, si ya existe una categoría igual sin distinguir mayúsculas, se reutiliza su forma original (evita "Diseño" vs "diseño").
- El formulario ofrece autocompletado con las categorías existentes.

## 4. Roles y permisos

| Rol | Descripción |
|---|---|
| `superadmin` | Admin principal. Único. Se crea desde `.env` al arrancar si no existe. |
| `admin` | Sub-admin, nombrado por el superadmin. |
| `user` | Usuario normal. |

| Acción | Visitante | User | Admin | Superadmin |
|---|---|---|---|---|
| Ver galería y proyectos | ✓ | ✓ | ✓ | ✓ |
| Like y comentar | | ✓ | ✓ | ✓ |
| CRUD de **sus** proyectos y fotos | | ✓ | ✓ | ✓ |
| Panel admin, estadísticas | | | ✓ | ✓ |
| Eliminar cualquier proyecto o comentario, destacar | | | ✓ | ✓ |
| Suspender / reactivar / eliminar **users** | | | ✓ | ✓ |
| Suspender / reactivar / eliminar **admins** | | | | ✓ |
| Dar / quitar rol admin | | | | ✓ |

Reglas:

- Nadie (ni él mismo) puede suspender, eliminar ni degradar al superadmin.
- Nadie puede actuar sobre sí mismo (suspenderse, eliminarse ni cambiar su rol) desde el panel.
- Un admin no puede actuar sobre otro admin.
- La regla vive en una sola función `canManage(actor, target, action)` en el servidor; el cliente usa la misma lógica solo para desactivar botones.
- `requireAuth` carga al usuario desde la BD en **cada** petición: si está suspendido o eliminado, responde 401/403 aunque el token sea válido.
- Usuario suspendido: no puede iniciar sesión; sus proyectos se ocultan de la galería pública y de su perfil público.
- Si se cambia `ADMIN_PASSWORD` en `.env`, no se sobrescribe la contraseña guardada.

## 5. Validación

| Campo | Regla |
|---|---|
| email | formato válido, ≤ 254, se normaliza a minúsculas y sin espacios |
| username | 3–20, `[a-zA-Z0-9_.-]`, no puede ser solo números |
| password | 8–72, al menos una letra y un número |
| confirmPassword | igual a password |
| bio | ≤ 300 |
| title (proyecto) | 2–80 |
| description | ≤ 2000 |
| category | 2–40 |
| caption (foto) | ≤ 200 |
| comment | 1–500 tras `trim` |
| imágenes | JPG/PNG/WEBP/GIF por magic bytes, ≤ 10 MB c/u, 1–20 por petición |

Errores de validación: `400 { error, fields: { campo: mensaje } }`.

## 6. API

Formato de error uniforme: `{ error: string, fields?: Record<string,string> }`. IDs validados como enteros positivos (si no, 400). Listas paginadas devuelven `{ items, total, page, pageSize }`.

### Auth — `/api/auth`

| Endpoint | Detalle |
|---|---|
| `POST /register` | `email, username, password, confirmPassword`. 409 con `fields` si el correo o el usuario ya existen. Devuelve `{ token, user }` |
| `POST /login` | `identifier` (usuario o correo) + `password`. Error genérico "Credenciales incorrectas". 403 si está suspendido. Rate limit: 5 fallos / 15 min por IP+identificador; 429 con minutos restantes |
| `GET /check?username=&email=` | Disponibilidad en vivo para el formulario de registro |
| `GET /me` | Usuario actual (desde la BD) |
| `PATCH /me` | `bio`, `email`, `username` |
| `POST /me/password` | `currentPassword, newPassword, confirmPassword` |

JWT con `sub` = id, expira en 7 días, secreto desde `.env` (o generado y guardado en `server/.jwt-secret` si falta).

### Público — `/api/projects`

| Endpoint | Detalle |
|---|---|
| `GET /` | `q, category, sort=recent\|popular\|commented, page`. Excluye dueños suspendidos |
| `GET /featured` | Proyectos destacados |
| `GET /categories` | `[{ name, count }]` |
| `GET /:id` | Detalle con fotos ordenadas por `position` |
| `POST /:id/like` | Toggle; devuelve `{ liked, likeCount }` |
| `GET /:id/comments`, `POST /:id/comments` | Comentarios |
| `DELETE /comments/:id` | Autor del comentario, dueño del proyecto o admin |
| `GET /api/users/:username` | Perfil público + proyectos |

### Mi dashboard — `/api/me`

| Endpoint | Detalle |
|---|---|
| `GET /stats` | Totales, likes por día (30 días), top 5 proyectos, últimos comentarios recibidos |
| `GET /projects` | `q, category, sort` |
| `POST /projects` | multipart: campos + `photos[]` (1–20). Transacción; si falla, se borran los archivos |
| `PATCH /projects/:id` | `title, description, category, coverPhotoId` |
| `DELETE /projects/:id` | |
| `POST /projects/:id/photos` | Agrega fotos (máx. 50 por proyecto en total) |
| `PATCH /projects/:id/photos/order` | `{ photoIds: number[] }` (debe contener exactamente las fotos del proyecto) |
| `PATCH /projects/:id/photos/:photoId` | `caption` |
| `DELETE /projects/:id/photos/:photoId` | No se permite borrar la última foto |

### Admin — `/api/admin` (requiere `admin` o `superadmin`)

| Endpoint | Detalle |
|---|---|
| `GET /stats?range=7\|30\|90` | Totales + variación vs periodo anterior, actividad por día (registros/proyectos/comentarios), top categorías, top usuarios |
| `GET /projects` | `q` (título o autor), `category, featured, sort, dir, page` |
| `PATCH /projects/:id/featured` | `{ featured: boolean }` |
| `DELETE /projects/:id` | |
| `POST /projects/bulk-delete` | `{ ids: number[] }` (máx. 100) |
| `GET /comments` | `q, page` |
| `DELETE /comments/:id`, `POST /comments/bulk-delete` | |
| `GET /users` | `q, role, status, sort, page`, con conteo de proyectos y `last_login_at` |
| `PATCH /users/:id/status` | `{ status }`, sujeto a `canManage` |
| `PATCH /users/:id/role` | `{ role: 'user'\|'admin' }`, solo superadmin |
| `DELETE /users/:id` | Sujeto a `canManage`; borra contenido y archivos |

## 7. Frontend

### Estilo

- Tokens CSS en `:root`: blanco/negro/escala de grises; modo oscuro invierte (`[data-theme="dark"]` + `prefers-color-scheme`), toggle en navbar guardado en `localStorage`.
- Fuente Inter (Google Fonts). Bordes de 1px, sin sombras de color; las fotos son el único color.
- Responsive: tablas → tarjetas en móvil; sidebar → menú desplegable.
- Toasts globales; diálogo de confirmación para todo borrado.

### Rutas

| Ruta | Página |
|---|---|
| `/` | Inicio: carrusel de destacados, buscador, chips de categorías, orden, grilla, "Cargar más" |
| `/proyectos/:id` | Detalle: fotos con visor a pantalla completa (flechas/teclado), like, comentarios |
| `/usuarios/:username` | Perfil público |
| `/login`, `/registro` | Autenticación; redirige al destino original tras iniciar sesión |
| `/dashboard`, `/dashboard/proyectos`, `/dashboard/proyectos/nuevo`, `/dashboard/proyectos/:id/editar`, `/dashboard/perfil` | Mi dashboard (requiere sesión) |
| `/admin`, `/admin/proyectos`, `/admin/usuarios`, `/admin/comentarios` | Panel admin (requiere admin/superadmin) |
| `*` | 404 |

### Funcionalidad clave

- **Registro**: validación en vivo por campo (zod compartido), medidor de fuerza + checklist, disponibilidad en vivo (debounce), mostrar/ocultar contraseña.
- **Login**: un campo "Usuario o correo"; muestra los minutos de bloqueo si hay 429.
- **Dashboard → Resumen**: tarjetas con contador animado, gráfica de área de likes (30 días) con tooltip, top 5, últimos comentarios.
- **Dashboard → Mis proyectos**: grilla/lista, búsqueda instantánea, filtro, orden, acciones editar/ver/eliminar.
- **Formulario de proyecto**: autocompletado de categoría, drag & drop de archivos con vista previa, progreso de subida (XHR), reordenar arrastrando, elegir portada, quitar fotos, aviso de cambios sin guardar.
- **Admin → Resumen**: KPIs con variación, selector 7/30/90, gráfica de líneas con leyenda conmutable, barras de categorías clicables (filtran proyectos), top usuarios.
- **Admin → Proyectos**: tabla ordenable, búsqueda, filtros, selección múltiple, borrado masivo, toggle destacado, panel lateral de vista previa.
- **Admin → Usuarios**: badges de rol/estado, ★ para superadmin, acciones según `canManage` con tooltip explicativo cuando están desactivadas.
- **Admin → Comentarios**: búsqueda, enlace al proyecto, borrado individual y múltiple.

### Estructura de código

- `src/pages/` (una carpeta por área: `public/`, `auth/`, `dashboard/`, `admin/`), `src/components/` (UI reutilizable: `DataTable`, `StatCard`, `ConfirmDialog`, `Toast`, `Dropzone`, etc.), `src/hooks/`, `src/api/` (cliente por dominio).
- Servidor: `routes/` por dominio (`auth`, `projects`, `me`, `admin`, `users`), `services/` (`permissions.js` con `canManage`, `files.js`, `stats.js`), `middleware/` (`auth`, `validate`, `errors`, `upload`).

## 8. Errores y robustez

- Middleware central de errores: errores de zod → 400 con `fields`; errores de multer → 400; desconocidos → 500 con log, sin filtrar detalles.
- Operaciones múltiples (crear proyecto, borrar usuario, borrado masivo) en transacción.
- Archivos huérfanos: limpiados si la transacción falla.
- Cliente: interceptor que ante 401 cierra la sesión y redirige al login; estados de carga, vacío y error en cada vista.

## 9. Pruebas

- Servidor: pruebas con `node:test` + `supertest` sobre una BD temporal: registro/login (usuario y correo), validaciones, rate limit, permisos `canManage` (matriz completa), CRUD de proyectos y fotos, borrado en cascada con archivos, endpoints admin.
- Cliente: `npm run build` (typecheck) sin errores; verificación manual de flujos principales en el navegador.

## 10. README

`README.md` documentará: requisitos (Node ≥ 22.5), instalación, `.env` (variables y ejemplo), cómo arrancar (`npm run dev:all`), admin principal, roles y matriz de permisos, reglas de validación, tabla completa de endpoints, estructura de carpetas, scripts, pruebas y la nota sobre el respaldo de la BD vieja.
