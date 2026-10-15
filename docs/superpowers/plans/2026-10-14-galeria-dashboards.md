# Galería: proyectos, dashboards y panel admin — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la galería de fotos sueltas en una plataforma de proyectos multi-foto con dashboard por usuario, panel admin jerárquico (superadmin/admin) y diseño blanco y negro.

**Architecture:** Backend Express reestructurado con inyección de dependencias (`createApp(ctx)`) para poder probarlo con una BD temporal; reglas de permisos centralizadas en `services/permissions.js`; validación con esquemas zod compartidos (`shared/validation.js`) entre servidor y cliente. Frontend React reescrito sobre `react-router-dom`, con páginas por área (`public`, `auth`, `dashboard`, `admin`) y componentes UI reutilizables.

**Tech Stack:** Node ≥ 22.5 (`node:sqlite`), Express 4, multer, jsonwebtoken, bcryptjs, zod, helmet, express-rate-limit, node:test + supertest; React 19, TypeScript, Vite, react-router-dom 7, recharts.

**Spec:** `docs/superpowers/specs/2026-10-14-galeria-dashboards-design.md` (léelo junto con este plan; los valores de validación, permisos y endpoints salen de ahí).

## Global Constraints

- Todo texto visible al usuario y todos los mensajes de error de la API en **español**.
- Node ≥ 22.5; sin dependencias nativas (nada de `sqlite3`/`better-sqlite3`/`sharp`).
- Formato de error de la API: `{ error: string, fields?: Record<string, string> }`.
- Listas paginadas: `{ items, total, page, pageSize }`; `pageSize` = 12 en público, 20 en dashboard/admin.
- Paleta: solo blanco, negro y grises; las fotos son el único color. Modo oscuro con `[data-theme="dark"]`.
- Límites de validación exactamente como la tabla de la sección 5 del spec.
- Imágenes: JPG/PNG/WEBP/GIF verificadas por magic bytes, ≤ 10 MB c/u, 1–20 por petición, máx. 50 por proyecto.
- Login: 5 intentos fallidos / 15 min por IP+identificador.
- **`README.md` se actualiza al final de cada tarea que cambie comportamiento visible** (requisito del usuario); la tarea 15 lo deja completo.
- Los commits solo se hacen si el usuario lo autorizó al elegir el método de ejecución; si no, se omite el paso "Commit".

## Review Focus

- **Mayúsculas en login/registro:** `Juan` y `juan` son el mismo usuario; `A@B.com` y `a@b.com` el mismo correo → 409 al registrar, login funciona con cualquier variante. (Test en Tarea 2.)
- **Admin intentando actuar sobre otro admin o sobre el superadmin llamando a la API directamente** → 403 aunque el botón esté oculto. (Test de matriz en Tarea 3 + test HTTP en Tarea 8.)
- **Archivo renombrado** (`.exe` → `.jpg`, o texto con `Content-Type: image/png`) → 400 y ningún archivo queda en `uploads/`. (Test en Tarea 4.)
- **Token de usuario suspendido o eliminado** sigue en el navegador → la siguiente petición responde 401/403 y el cliente cierra sesión. (Test en Tarea 2 + interceptor en Tarea 9.)
- **Borrar la portada o reordenar con ids ajenos** → portada se reasigna a la primera foto restante; `photoIds` incompleto o con ids de otro proyecto → 400. (Test en Tarea 5.)

---

## Estructura de archivos

```
galeria/
  shared/validation.js            esquemas zod compartidos
  server/
    .env.example
    src/
      index.js                    arranque: loadConfig → openDb → ensureSuperadmin → createApp → listen
      app.js                      createApp(ctx)
      config.js                   loadConfig()
      db.js                       openDb(path) (esquema + backup de esquema viejo)
      middleware/{auth,errors,validate,upload}.js
      services/{permissions,files,stats,dto,seed}.js
      routes/{auth,projects,me,admin,users}.js
    test/
      helpers.js
      *.test.js
  src/
    main.tsx, App.tsx (router)
    api/{client,auth,projects,me,admin}.ts
    types.ts
    context/{AuthContext,ThemeContext,ToastContext}.tsx
    hooks/{useDebounce,useAsync}.ts
    lib/{permissions,format}.ts
    components/ui/{Button,Field,PasswordInput,ConfirmDialog,Modal,StatCard,DataTable,Badge,EmptyState,Spinner}.tsx
    components/layout/{Navbar,Footer,SidebarLayout,ProtectedRoute}.tsx
    components/projects/{ProjectCard,ProjectGrid,Lightbox,Comments,LikeButton,CategoryInput,Dropzone,SortablePhotos}.tsx
    pages/public/{HomePage,ProjectPage,UserPage,NotFoundPage}.tsx
    pages/auth/{LoginPage,RegisterPage}.tsx
    pages/dashboard/{DashboardHome,MyProjects,ProjectForm,MyProfile}.tsx
    pages/admin/{AdminHome,AdminProjects,AdminUsers,AdminComments}.tsx
    styles/{tokens,base,components,pages}.css
```

Se eliminan: `server/src/routes/{photos,comments}.js`, `src/api.ts`, `src/components/{AuthModal,FeaturedSection,Gallery,PhotoCard,PhotoModal,UploadModal}.tsx`, `src/styles/index.css`.

## Contratos compartidos (DTOs)

Producidos por `server/src/services/dto.js`, reflejados en `src/types.ts`:

```ts
type Role = 'user' | 'admin' | 'superadmin';
type Status = 'active' | 'suspended';
interface UserRef { id: number; username: string }
interface User extends UserRef { role: Role; status: Status; bio: string; createdAt: string }
interface Me extends User { email: string }
interface AdminUser extends Me { projectCount: number; lastLoginAt: string | null }
interface Photo { id: number; url: string; caption: string; position: number }
interface ProjectSummary {
  id: number; title: string; description: string; category: string;
  coverUrl: string | null; photoCount: number; likeCount: number; commentCount: number;
  likedByMe: boolean; featured: boolean; createdAt: string; updatedAt: string; owner: UserRef;
}
interface ProjectDetail extends ProjectSummary { photos: Photo[]; coverPhotoId: number | null }
interface Comment { id: number; content: string; createdAt: string; author: UserRef; project?: { id: number; title: string } }
interface Paginated<T> { items: T[]; total: number; page: number; pageSize: number }
interface MeStats {
  totals: { projects: number; photos: number; likes: number; comments: number };
  likesByDay: { date: string; count: number }[];        // 30 entradas, YYYY-MM-DD, días sin datos = 0
  topProjects: ProjectSummary[];                          // máx. 5 por likes
  recentComments: Comment[];                              // máx. 5, con project
}
interface AdminStats {
  range: 7 | 30 | 90;
  totals: { users: number; projects: number; photos: number; comments: number; likes: number };
  deltas: { users: number | null; projects: number | null; comments: number | null }; // % vs periodo anterior, null si el anterior = 0
  activity: { date: string; users: number; projects: number; comments: number }[];   // `range` entradas
  topCategories: { name: string; count: number }[];       // máx. 8
  topUsers: { id: number; username: string; projects: number; likes: number }[]; // máx. 5
}
```

---

### Task 1: Base del servidor (config, BD, app, errores, validación compartida)

**Files:**
- Create: `server/src/app.js`, `server/src/middleware/errors.js`, `server/src/middleware/validate.js`, `shared/validation.js`, `server/.env.example`, `server/test/helpers.js`, `server/test/foundation.test.js`
- Modify: `server/src/config.js`, `server/src/db.js`, `server/src/index.js`, `server/package.json`, `package.json`, `.gitignore`
- Delete: `server/src/routes/photos.js`, `server/src/routes/comments.js`

**Interfaces:**
- Produces:
  - `loadConfig(): { port, dbPath, uploadsDir, jwtSecret, corsOrigin, admin: { username, email, password } }` — llama `process.loadEnvFile(server/.env)` en try/catch; `jwtSecret` de `JWT_SECRET` o de `server/.jwt-secret` (crearlo si falta, como hoy); `corsOrigin` default `http://localhost:5173`.
  - `openDb(dbPath: string): DatabaseSync` — si existe tabla `users` sin columna `email`: cierra, renombra a `galeria.backup.db` (si ya existe, `galeria.backup-<timestamp>.db`), loguea un aviso y reabre. Crea el esquema del spec §3 (con `CHECK` para `role` y `status`), índices, `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode = WAL`. Acepta `':memory:'`.
  - `createApp(ctx: { db, uploadsDir, jwtSecret, corsOrigin }): express.Application` — helmet (`crossOriginResourcePolicy: 'cross-origin'`), cors al origen, `express.json({ limit: '100kb' })`, `/uploads` estático, routers montados (los de tareas siguientes), `GET /api/health`, 404 JSON para `/api/*`, `errorHandler` al final.
  - `class HttpError extends Error { constructor(status: number, message: string, fields?: Record<string,string>) }` y `errorHandler` en `middleware/errors.js`: `ZodError` → 400 `{ error: 'Datos inválidos', fields }` (primer mensaje por ruta), `MulterError` → 400 con mensaje en español (`LIMIT_FILE_SIZE` → `'Cada imagen debe pesar máximo 10 MB'`, `LIMIT_FILE_COUNT` → `'Máximo 20 imágenes por subida'`), `HttpError` → su status, resto → 500 `'Error interno del servidor'` + `console.error`.
  - `validate(schema, source = 'body')` middleware: reemplaza `req[source]` por el resultado parseado (para `source = 'query'` guarda el resultado en `req.validatedQuery` y no toca `req.query`, así funciona igual si se migra a Express 5).
  - `parseId(value): number` (lanza `HttpError(400, 'Identificador inválido')`) en `middleware/validate.js`.
  - `shared/validation.js` exporta: `emailSchema, usernameSchema, passwordSchema, registerSchema, loginSchema, profileSchema, changePasswordSchema, projectSchema, projectUpdateSchema, captionSchema, commentSchema, photoOrderSchema, listQuerySchema, adminListQuerySchema, LIMITS` con los mensajes en español del spec §5. `registerSchema` usa `.refine` para `confirmPassword` en el path `confirmPassword`. `usernameSchema` rechaza solo dígitos (`'El usuario no puede ser solo números'`). `emailSchema` hace `trim().toLowerCase()`.
  - `test/helpers.js`: `makeTestApp(): Promise<{ app, ctx, cleanup }>` (BD `:memory:`, `uploadsDir` en `fs.mkdtemp(os.tmpdir())`, secreto fijo), `registerUser(app, overrides?) → { token, user }` (default único por contador), `promote(ctx, userId, role)`, `auth(token) → ['Authorization', 'Bearer …']`, `tinyImage(type: 'png'|'jpeg'|'gif'|'webp'): Buffer` (bytes mínimos válidos con magic bytes correctos).
- Dependencias: `npm i zod@^3` en raíz y en `server`; `npm i helmet express-rate-limit` y `npm i -D supertest` en `server`. Script server `"test": "node --test test/"`. En raíz: `"test": "npm test --prefix server"`.
- `.gitignore`: añadir `server/.env`, `server/galeria.backup*.db`.

- [ ] **Step 1: Escribir `server/test/foundation.test.js`** con:
  - `openDb crea todas las tablas` → `sqlite_master` contiene `users, projects, photos, likes, comments`.
  - `openDb respalda una BD con esquema viejo` → crear en tmp un archivo con `CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password_hash TEXT)`; tras `openDb`, existe `galeria.backup.db` y la nueva `users` tiene columna `email`.
  - `role inválido es rechazado por CHECK` → `INSERT … role='root'` lanza.
  - `GET /api/health → 200 { ok: true }`; `GET /api/nada → 404 { error }` JSON.
  - `registerSchema` (importado de `../../shared/validation.js`): `'abc'` sin número → error en `password`; `confirmPassword` distinto → error en `confirmPassword`; `'12345'` como usuario → `'El usuario no puede ser solo números'`; email `' A@B.COM '` se normaliza a `'a@b.com'`.
- [ ] **Step 2:** `cd server && npm test` → FAIL (módulos inexistentes).
- [ ] **Step 3:** Implementar los archivos del bloque Interfaces; `index.js` hace `loadConfig → mkdir uploads → openDb → createApp → listen` (el seed llega en Tarea 2).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** — `feat(server): base con createApp, esquema de proyectos y validación compartida`

---

### Task 2: Autenticación y admin principal

**Files:**
- Create: `server/src/routes/auth.js` (reescribir), `server/src/services/dto.js`, `server/src/services/seed.js`, `server/test/auth.test.js`
- Modify: `server/src/middleware/auth.js`, `server/src/app.js`, `server/src/index.js`

**Interfaces:**
- Consumes: `registerSchema, loginSchema, profileSchema, changePasswordSchema`, `HttpError`, `validate`.
- Produces:
  - `createAuthMiddleware(ctx) → { requireAuth, optionalAuth, requireAdmin }`. `requireAuth` verifica JWT y **carga el usuario de la BD**: no existe → 401 `'Sesión inválida o expirada'`; `suspended` → 403 `'Tu cuenta está suspendida'`. Deja `req.user = { id, username, email, role, status }`. `optionalAuth` ignora tokens inválidos o de usuarios suspendidos. `requireAdmin` = `requireAuth` + rol `admin|superadmin` (403 `'Acceso solo para administradores'`).
  - `dto.js`: `toUser(row)`, `toMe(row)`, `toAdminUser(row)`, `toProjectSummary(row)`, `toPhoto(row)`, `toComment(row)` según los contratos.
  - `ensureSuperadmin(db, { username, email, password })`: si no hay fila `role='superadmin'`, la crea (si faltan variables, `console.warn` y no crea). Nunca sobrescribe contraseña.
  - `signToken(user, secret)` → JWT `{ sub }`, 7 días.
  - Rutas del spec §6 "Auth". Login busca `WHERE username = ? COLLATE NOCASE OR email = lower(?)`; actualiza `last_login_at`. Limiter: `rateLimit({ windowMs: 15*60*1000, limit: 5, skipSuccessfulRequests: true, keyGenerator: ip + ':' + identifier.toLowerCase(), handler → 429 { error: 'Demasiados intentos. Intenta de nuevo en N minutos.', retryAfterMinutes } })`, creado dentro de la factory del router (un store por app → tests aislados).
  - `GET /check` → `{ usernameAvailable?: boolean, emailAvailable?: boolean }` (solo las claves pedidas).
  - Unicidad en register/PATCH me → 409 `{ error: 'Ya existe una cuenta con esos datos', fields: { username: 'Ese usuario ya está en uso' } | { email: 'Ese correo ya está registrado' } }`.

- [ ] **Step 1: Escribir `server/test/auth.test.js`:**
  - `registra con correo, usuario y contraseña` → 201, `user.role === 'user'`, sin `password_hash` en la respuesta.
  - `rechaza datos inválidos con fields` → 400 y `fields.email`, `fields.password`, `fields.confirmPassword` presentes.
  - `usuario y correo son únicos sin importar mayúsculas` → registrar `Juan`/`J@X.com`, luego `juan`/`otro@x.com` → 409 `fields.username`; `otro`/`j@x.com` → 409 `fields.email`.
  - `login con usuario o con correo` → ambos 200; `JUAN` también 200.
  - `login incorrecto es genérico` → usuario inexistente y contraseña mala devuelven el mismo `error: 'Credenciales incorrectas'`.
  - `bloquea tras 5 fallos` → 6.º intento 429 con `retryAfterMinutes`.
  - `usuario suspendido no puede loguear ni usar su token` → tras `UPDATE status='suspended'`: login 403, `GET /me` con token viejo 403.
  - `token de usuario eliminado → 401`.
  - `GET /check` refleja disponibilidad.
  - `PATCH /me` cambia bio; `POST /me/password` exige la contraseña actual (400 `fields.currentPassword` si es incorrecta).
  - `ensureSuperadmin crea uno solo y no pisa la contraseña` → llamar dos veces con contraseñas distintas; 1 superadmin, login con la primera.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar; `index.js` llama `ensureSuperadmin(db, config.admin)` antes de `listen`. Crear `server/.env.example` con `PORT=4000`, `CORS_ORIGIN=http://localhost:5173`, `JWT_SECRET=`, `ADMIN_USERNAME=admin`, `ADMIN_EMAIL=admin@galeria.local`, `ADMIN_PASSWORD=Cambiame123`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** — `feat(server): registro con correo, login por usuario o correo y admin principal`

---

### Task 3: Reglas de permisos (`canManage`)

**Files:**
- Create: `server/src/services/permissions.js`, `server/test/permissions.test.js`, `src/lib/permissions.ts`

**Interfaces:**
- Produces: `canManage(actor: {id, role}, target: {id, role}, action: 'suspend'|'activate'|'delete'|'setRole'): { ok: true } | { ok: false, reason: string }`. Mismo algoritmo copiado en `src/lib/permissions.ts` (TS) para desactivar botones; los mensajes `reason` son los tooltips.
- Reglas (en este orden):
  1. actor no admin/superadmin → `'No tienes permisos de administrador'`
  2. `target.role === 'superadmin'` → `'El administrador principal no puede ser modificado'`
  3. `actor.id === target.id` → `'No puedes realizar esta acción sobre tu propia cuenta'`
  4. `action === 'setRole'` y actor no superadmin → `'Solo el administrador principal puede cambiar roles'`
  5. `target.role === 'admin'` y actor no superadmin → `'Solo el administrador principal puede gestionar a otros administradores'`
  6. ok.

- [ ] **Step 1:** Test de tabla: para cada combinación actor ∈ {user, admin, superadmin} × target ∈ {user, admin, otro admin, superadmin, sí mismo} × las 4 acciones, `ok` esperado según la matriz del spec §4. Casos explícitos: admin→admin `suspend` false; superadmin→admin `setRole` true; superadmin→sí mismo `delete` false; admin→user `setRole` false; admin→user `delete` true.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar ambos archivos.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** — `feat: reglas de jerarquía de administradores`

---

### Task 4: Subida segura de imágenes y limpieza de archivos

**Files:**
- Create: `server/src/middleware/upload.js`, `server/src/services/files.js`, `server/test/upload.test.js`

**Interfaces:**
- Produces:
  - `createUpload(uploadsDir)` → middleware `uploadPhotos` = multer `memoryStorage`, `limits: { fileSize: 10*1024*1024, files: 20 }`, campo `photos`. Luego, en el mismo middleware, `detectImageType(buffer)` por magic bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, GIF `GIF87a|GIF89a`, WEBP `RIFF....WEBP`); si alguno falla → `HttpError(400, 'El archivo "<nombre>" no es una imagen válida (usa JPG, PNG, WEBP o GIF)')` sin escribir nada. Si todos pasan, los escribe a disco con nombre `${Date.now()}-${randomHex16}.${extDetectada}` y deja `req.savedFiles: { filename, originalName }[]`.
  - `detectImageType(buf: Buffer): 'jpg'|'png'|'gif'|'webp'|null`.
  - `removeFiles(uploadsDir, filenames: string[]): Promise<void>` — `fs.promises.unlink` ignorando `ENOENT`; rechaza nombres con `/`, `\` o `..`.
  - `collectProjectFiles(db, projectIds: number[]): string[]` y `collectUserFiles(db, userId): string[]`.
- Montaje de prueba: el test monta `createUpload` en un mini-app express propio con `errorHandler`.

- [ ] **Step 1: Tests:** `acepta png/jpeg/gif/webp válidos` (archivos en disco con extensión detectada); `rechaza texto con Content-Type image/png` → 400 y `uploadsDir` vacío; `rechaza .exe renombrado a .jpg` (buffer `MZ…`) → 400; `rechaza 21 archivos` → 400 `'Máximo 20 imágenes por subida'`; `rechaza > 10 MB` → 400; `removeFiles ignora inexistentes y rechaza '../x'`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(server): subida de imágenes verificada por contenido`

---

### Task 5: Proyectos del usuario (`/api/me/projects`)

**Files:**
- Create: `server/src/routes/me.js`, `server/src/services/projects.js`, `server/test/me-projects.test.js`
- Modify: `server/src/app.js`

**Interfaces:**
- Consumes: `requireAuth`, `uploadPhotos`, `removeFiles`, `collectProjectFiles`, `projectSchema`, `projectUpdateSchema`, `photoOrderSchema`, `captionSchema`, `toProjectSummary`.
- Produces (`services/projects.js`, reutilizado por tareas 6–8):
  - `PROJECT_SUMMARY_SQL` — SELECT con `photoCount, likeCount, commentCount`, `cover_path` (portada o, si es null, foto de menor `position`), owner.
  - `getProjectDetail(db, id, viewerId?) → ProjectDetail | null`.
  - `normalizeCategory(db, raw: string): string` — trim, colapsa espacios; si existe una categoría igual con `COLLATE NOCASE`, devuelve la existente.
  - `deleteProjects(ctx, ids: number[]): Promise<number>` — junta archivos, borra en transacción (`BEGIN/COMMIT/ROLLBACK`), luego `removeFiles`; devuelve cantidad borrada.
  - `findOwnedProject(db, id, userId)` → fila o `HttpError(404, 'Proyecto no encontrado')` (404 también si es de otro usuario, no 403, para no filtrar existencia).
- Rutas del spec §6 "Mi dashboard" (salvo `/stats`, Tarea 7). Crear: transacción que inserta proyecto + fotos (`position` 0..n-1) y fija `cover_photo_id` a la primera; si falla, `removeFiles(req.savedFiles)`. Agregar fotos: si `actuales + nuevas > 50` → 400 `'Un proyecto puede tener máximo 50 fotos'` y se borran los archivos recién escritos. Borrar foto: si es la única → 400 `'El proyecto debe tener al menos una foto'`; si era portada → portada = menor `position` restante. Orden: `photoIds` debe ser permutación exacta de las fotos del proyecto → si no, 400 `'El orden enviado no coincide con las fotos del proyecto'`. Cada cambio actualiza `updated_at`.
- Campos de texto del multipart se validan con `projectSchema` **después** de multer; si fallan, se borran los archivos guardados.

- [ ] **Step 1: Tests:** `crea proyecto con 3 fotos` (201, `photos.length 3`, `coverPhotoId` = primera); `crear sin fotos → 400`; `título de 1 carácter → 400 fields.title y sin archivos en disco`; `categoría reutiliza mayúsculas existentes` ('Robótica' luego 'robótica' → ambos 'Robótica'); `editar proyecto ajeno → 404`; `agregar fotos excediendo 50 → 400`; `borrar portada reasigna`; `no se puede borrar la última foto`; `reordenar con id ajeno → 400`, `reordenar válido cambia position`; `eliminar proyecto borra filas y archivos del disco`; `GET /me/projects filtra por q y category`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(server): CRUD de proyectos y fotos del usuario`

---

### Task 6: Galería pública, likes, comentarios y perfiles

**Files:**
- Create: `server/src/routes/projects.js`, `server/src/routes/users.js`, `server/test/public.test.js`
- Modify: `server/src/app.js`

**Interfaces:**
- Consumes: `PROJECT_SUMMARY_SQL`, `getProjectDetail`, `optionalAuth`, `requireAuth`, `listQuerySchema` (`q ≤ 100`, `category`, `sort: recent|popular|commented` default `recent`, `page ≥ 1` default 1), `commentSchema`.
- Produces: rutas del spec §6 "Público". Todas filtran `owner.status = 'active'`. `GET /:id` de dueño suspendido → 404. `q` busca en título, descripción y categoría con `LIKE` escapando `%` y `_`. Borrar comentario: autor, dueño del proyecto o admin/superadmin; si no → 403 `'No puedes eliminar este comentario'`. Like/comentario sobre proyecto inexistente → 404.

- [ ] **Step 1: Tests:** `lista paginada {items,total,page,pageSize:12}`; `sort=popular ordena por likes`; `filtra por category y q`; `q con '%' no devuelve todo`; `oculta proyectos de suspendidos (lista, detalle 404, perfil)`; `featured solo devuelve destacados`; `categories devuelve conteos`; `like alterna y likedByMe refleja al viewer`; `comentario vacío 400; >500 400`; `dueño del proyecto puede borrar comentario ajeno; tercero 403`; `GET /api/users/:username` devuelve `user` sin email + `projects`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(server): galería pública, likes, comentarios y perfiles`

---

### Task 7: Estadísticas (usuario y admin)

**Files:**
- Create: `server/src/services/stats.js`, `server/test/stats.test.js`
- Modify: `server/src/routes/me.js` (`GET /stats`), crear `server/src/routes/admin.js` solo con `GET /stats`, montar en `app.js` bajo `requireAdmin`.

**Interfaces:**
- Produces: `getMeStats(db, userId, now = new Date()): MeStats` y `getAdminStats(db, range: 7|30|90, now = new Date()): AdminStats` según contratos. Series diarias rellenadas con 0 (generar las fechas en JS y unir con los conteos `GROUP BY date(created_at)`). `deltas`: `round((actual - anterior) / anterior * 100)`; `null` si `anterior === 0`. `range` inválido → 400.

- [ ] **Step 1: Tests:** `likesByDay tiene 30 entradas y cuenta solo likes de mis proyectos` (insertar likes con `created_at` fijados por SQL); `topProjects máx 5 ordenado por likes`; `admin activity tiene range entradas`; `deltas null con periodo anterior vacío y 100 con 1→2`; `topCategories ordenado desc`; `GET /api/admin/stats con user normal → 403`; `range=15 → 400`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(server): estadísticas de dashboard y panel admin`

---

### Task 8: Endpoints de administración

**Files:**
- Modify: `server/src/routes/admin.js`
- Create: `server/test/admin.test.js`

**Interfaces:**
- Consumes: `canManage`, `deleteProjects`, `collectUserFiles`, `removeFiles`, `toAdminUser`, `adminListQuerySchema` (`q, category, featured: 'true'|'false', role, status, sort, dir: asc|desc, page`).
- Produces: rutas del spec §6 "Admin". `sort` validado contra lista blanca por recurso (proyectos: `createdAt|title|likes|photos|owner`; usuarios: `createdAt|username|projects|lastLogin`) — nunca interpolar texto del cliente en SQL. `bulk-delete`: `ids` 1–100 enteros. Acciones sobre usuarios: `canManage` falla → 403 con `reason`. `PATCH /users/:id/role` solo acepta `'user'|'admin'` (nunca crea superadmin). `DELETE /users/:id`: junta archivos, borra en transacción, limpia disco. Admin puede ver proyectos de usuarios suspendidos (no filtra por estado).

- [ ] **Step 1: Tests:** `user normal → 403 en todo /api/admin`; `lista proyectos con sort=likes&dir=desc`; `sort=password → 400`; `destacar/quitar destacado`; `bulk-delete borra 2 y sus archivos`; `admin suspende user → 200 y ese user ya no puede usar su token`; `admin suspende otro admin → 403 con reason`; `admin intenta suspender al superadmin → 403`; `superadmin promueve user a admin y lo degrada`; `admin intenta cambiar rol → 403`; `role='superadmin' en body → 400`; `eliminar user borra sus proyectos, comentarios y archivos`; `GET /admin/users filtra role y status, incluye projectCount`; `moderación: lista y borra comentarios (individual y bulk)`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Actualizar `README.md` con la tabla de endpoints y la matriz de permisos.
- [ ] **Step 6: Commit** — `feat(server): panel de administración con jerarquía de roles`

---

### Task 9: Base del frontend (router, tema B/N, cliente API, contexts, UI)

**Files:**
- Create: `src/api/{client,auth,projects,me,admin}.ts`, `src/context/{ThemeContext,ToastContext}.tsx`, `src/hooks/{useDebounce,useAsync}.ts`, `src/lib/format.ts`, `src/components/ui/*`, `src/components/layout/*`, `src/styles/{tokens,base,components,pages}.css`, `src/pages/public/NotFoundPage.tsx`
- Modify: `src/main.tsx`, `src/App.tsx`, `src/types.ts`, `src/context/AuthContext.tsx`, `index.html` (Inter de Google Fonts, `<title>Galería</title>`), `tsconfig.app.json` (`"include": ["src", "shared"]`, `"allowJs": true`)
- Delete: archivos viejos listados en "Estructura de archivos".

**Interfaces:**
- Produces:
  - `request<T>(path, opts?) → Promise<T>`; lanza `ApiError { status, message, fields?, retryAfterMinutes? }`. Ante 401/403 con sesión activa en rutas que no sean `/api/auth/login|register`, emite el evento `auth:expired` (AuthContext lo escucha → logout + toast `'Tu sesión expiró o tu cuenta fue suspendida'`).
  - `uploadWithProgress<T>(path, formData, method, onProgress: (pct:number)=>void) → Promise<T>` con `XMLHttpRequest`.
  - Módulos `api/*` con una función por endpoint del spec (nombres: `authApi.register/login/check/me/updateMe/changePassword`, `projectsApi.list/featured/categories/get/toggleLike/comments/addComment/deleteComment/user`, `meApi.stats/projects/create/update/remove/addPhotos/reorder/updateCaption/removePhoto`, `adminApi.stats/projects/setFeatured/deleteProject/bulkDeleteProjects/comments/deleteComment/bulkDeleteComments/users/setStatus/setRole/deleteUser`).
  - `useAuth(): { user: Me | null, loading, login(identifier, password), register(data), logout(), refresh(), isAdmin, isSuperadmin }`.
  - `useToast(): { success(msg), error(msg) }`; `useTheme(): { theme: 'light'|'dark', toggle() }` (localStorage en try/catch; default `prefers-color-scheme`).
  - `useConfirm(): (opts: { title, message, confirmLabel?, danger? }) => Promise<boolean>` (provisto por `ConfirmDialog` montado una vez).
  - `<ProtectedRoute role?: 'admin'>` — sin sesión → `/login?next=<ruta>`; sin rol → página "Acceso denegado".
  - `<SidebarLayout title links={{ to, label, icon }[]}>` con `<Outlet/>`; en < 768px el sidebar es un menú desplegable.
  - `<DataTable<T> columns rows getId selectable? selected? onSelectChange? sort? onSortChange?>` — columnas `{ key, header, render, sortable? }`; en móvil renderiza tarjetas.
  - `<StatCard label value delta?>` — cuenta animada (requestAnimationFrame, 600 ms).
  - CSS: tokens `--bg, --surface, --text, --muted, --border, --invert-bg, --invert-text, --danger` en `:root`, redefinidos en `[data-theme="dark"]`.
  - Rutas en `App.tsx` según spec §7 (páginas aún no creadas → componentes placeholder `<p>Próximamente</p>` que las tareas 10–14 reemplazan).

- [ ] **Step 1:** `npm i react-router-dom@^7 recharts` en raíz.
- [ ] **Step 2:** Implementar todo lo anterior.
- [ ] **Step 3:** `npm run build` → sin errores de TypeScript.
- [ ] **Step 4:** `npm run dev:all`, abrir `http://localhost:5173`: navbar B/N, toggle de tema persiste al recargar, `/dashboard` sin sesión redirige a `/login?next=%2Fdashboard`, ruta inexistente muestra 404.
- [ ] **Step 5: Commit** — `feat(web): router, tema blanco y negro y componentes base`

---

### Task 10: Login y registro

**Files:**
- Create: `src/pages/auth/{LoginPage,RegisterPage}.tsx`, `src/components/ui/{PasswordInput,PasswordStrength}.tsx`

**Interfaces:**
- Consumes: `registerSchema`, `loginSchema` de `shared/validation.js`; `authApi.check`; `useAuth`; `useDebounce`.
- Produces:
  - Validación por campo con `schema.safeParse` en `onChange` tras el primer `blur` de cada campo; errores del servidor (`fields`) se pintan en el mismo lugar.
  - `passwordStrength(pw): { score: 0|1|2|3, label: 'Débil'|'Media'|'Fuerte' }` en `src/lib/format.ts`; checklist: ≥ 8 caracteres, una letra, un número, (opcional para "Fuerte") un símbolo o ≥ 12.
  - Disponibilidad: `authApi.check` con debounce de 400 ms solo si el campo es válido localmente; muestra "✓ Disponible" / "En uso".
  - Login: campo `Usuario o correo`; 429 → mensaje con `retryAfterMinutes`; éxito → `navigate(next ?? '/dashboard')`.
  - Botón de envío deshabilitado mientras hay errores o se envía.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** `npm run build` → OK.
- [ ] **Step 3: Verificación manual:** registrar con correo inválido (error en vivo), contraseña `abc` (checklist incompleto), usuario existente (marca "En uso"); registro válido lleva al dashboard; logout; login con correo en MAYÚSCULAS funciona; 6 intentos fallidos muestran los minutos de bloqueo.
- [ ] **Step 4: Commit** — `feat(web): login y registro con validación en vivo`

---

### Task 11: Páginas públicas (inicio, detalle, perfil)

**Files:**
- Create: `src/pages/public/{HomePage,ProjectPage,UserPage}.tsx`, `src/components/projects/{ProjectCard,ProjectGrid,Lightbox,Comments,LikeButton}.tsx`

**Interfaces:**
- Consumes: `projectsApi.*`, `useAuth`, `useConfirm`, `useToast`.
- Produces:
  - Home: carrusel de destacados (scroll-snap, flechas), buscador (debounce 300 ms), chips de `categories` + "Todas", select de orden, `ProjectGrid` con "Cargar más" (append de páginas). Filtros sincronizados con la URL (`?q=&category=&sort=`).
  - `LikeButton` optimista con rollback; sin sesión → navega a `/login?next=…`.
  - `ProjectPage`: foto de portada grande + tira de miniaturas; `Lightbox` (Esc cierra, ←/→ navegan, bloquea scroll del body); `Comments` con borrar visible si eres autor, dueño o admin.
  - `UserPage`: bio, conteo y grilla de proyectos.
  - Estados de carga (skeleton), vacío (`EmptyState`) y error en cada página.

- [ ] **Step 1:** Implementar. **Step 2:** `npm run build` → OK.
- [ ] **Step 3: Verificación manual:** filtros cambian la URL y sobreviven a recargar; lightbox con teclado; like sin sesión redirige; comentar y borrar.
- [ ] **Step 4: Commit** — `feat(web): galería pública de proyectos`

---

### Task 12: Dashboard del usuario (resumen, mis proyectos, perfil)

**Files:**
- Create: `src/pages/dashboard/{DashboardHome,MyProjects,MyProfile}.tsx`

**Interfaces:**
- Consumes: `meApi.stats/projects/remove`, `authApi.updateMe/changePassword`, `SidebarLayout`, `StatCard`, `DataTable`, recharts (`AreaChart` con `Tooltip`, en `var(--text)` sobre `var(--surface)`).
- Produces:
  - Resumen: 4 `StatCard`, gráfica de likes 30 días, top 5 (enlaces a `/proyectos/:id`), últimos comentarios (enlace al proyecto). Estado vacío con CTA "Crear tu primer proyecto".
  - Mis proyectos: toggle cuadrícula/lista (persistido en localStorage), búsqueda instantánea, filtro de categoría, orden; acciones Ver / Editar / Eliminar (con `useConfirm` y toast).
  - Mi perfil: formulario bio/correo/usuario (`profileSchema`), formulario de cambio de contraseña (`changePasswordSchema`); tras guardar, `refresh()` del AuthContext.

- [ ] **Step 1:** Implementar. **Step 2:** `npm run build` → OK.
- [ ] **Step 3: Verificación manual:** contadores animan; tooltip de la gráfica; eliminar pide confirmación y desaparece de la lista; cambiar usuario actualiza la navbar.
- [ ] **Step 4: Commit** — `feat(web): dashboard personal`

---

### Task 13: Formulario de proyecto (crear y editar)

**Files:**
- Create: `src/pages/dashboard/ProjectForm.tsx`, `src/components/projects/{CategoryInput,Dropzone,SortablePhotos}.tsx`

**Interfaces:**
- Consumes: `meApi.create/update/addPhotos/reorder/updateCaption/removePhoto`, `projectsApi.categories`, `uploadWithProgress`, `projectSchema`.
- Produces:
  - `CategoryInput`: input + lista sugerida filtrada (teclado ↑/↓/Enter/Esc, `role="listbox"`); permite texto nuevo.
  - `Dropzone`: arrastrar o elegir archivos; valida en cliente tipo (`image/jpeg|png|webp|gif`), ≤ 10 MB y el tope de 20/50, mostrando qué archivo se rechazó; vistas previas con `URL.createObjectURL` (revocar en cleanup).
  - `SortablePhotos`: reordenar con drag & drop HTML5 nativo **y** botones ←/→ (accesible); marcar portada (★); quitar.
  - Modo crear: un solo `POST` multipart con barra de progreso → navega a `/dashboard/proyectos` con toast.
  - Modo editar: guarda metadatos con `PATCH`; fotos nuevas con `addPhotos` (progreso); reorden con `reorder` al soltar; captions con `updateCaption` al blur; quitar foto con confirmación.
  - Aviso de cambios sin guardar: `useBlocker` de react-router + `beforeunload`.

- [ ] **Step 1:** Implementar. **Step 2:** `npm run build` → OK.
- [ ] **Step 3: Verificación manual:** crear con 3 fotos arrastradas, ver progreso; archivo `.txt` rechazado con mensaje; editar: reordenar, cambiar portada, quitar foto (la última no se puede), salir con cambios muestra el aviso.
- [ ] **Step 4: Commit** — `feat(web): creación y edición de proyectos con fotos`

---

### Task 14: Panel de administración

**Files:**
- Create: `src/pages/admin/{AdminHome,AdminProjects,AdminUsers,AdminComments}.tsx`, `src/components/ui/Badge.tsx` (si no existe), `src/components/ui/Drawer.tsx`

**Interfaces:**
- Consumes: `adminApi.*`, `canManage` de `src/lib/permissions.ts`, `DataTable`, `StatCard`, `useConfirm`, `useToast`, recharts (`LineChart` con `Legend` clicable que alterna series; `BarChart` con `onClick` en barra).
- Produces:
  - Resumen: selector 7/30/90 (en URL `?range=`), 5 `StatCard` con `delta` ("+12% vs. periodo anterior"; `null` → "—"), gráfica de actividad, barras de categorías (clic → `/admin/proyectos?category=<name>`), top usuarios.
  - Proyectos: `DataTable` con miniatura, título, autor, categoría, fotos, likes, fecha; orden por columna (en URL), búsqueda, filtros categoría/destacados, selección múltiple + "Eliminar seleccionados (N)", interruptor de destacado optimista, `Drawer` de vista previa con las fotos.
  - Usuarios: badges de rol (`★ Principal`, `Admin`, `Usuario`) y estado; acciones Suspender/Reactivar, Hacer admin/Quitar admin (solo visibles para superadmin), Eliminar; cada botón usa `canManage(me, row, action)` → `disabled` + `title={reason}`; confirmación que advierte que eliminar borra todo su contenido.
  - Comentarios: búsqueda, enlace al proyecto, selección múltiple y borrado.
  - Navbar muestra el enlace "Admin" solo a admin/superadmin.

- [ ] **Step 1:** Implementar. **Step 2:** `npm run build` → OK.
- [ ] **Step 3: Verificación manual** con el superadmin del `.env` y un admin creado desde el panel: el admin ve deshabilitados (con tooltip) los botones sobre el superadmin y sobre otros admins; el superadmin puede promover/degradar; clic en una barra de categoría filtra proyectos; borrado masivo con confirmación; suspender a un usuario con sesión abierta en otra ventana → esa ventana se desloguea en la siguiente acción.
- [ ] **Step 4: Commit** — `feat(web): panel de administración interactivo`

---

### Task 15: README completo y verificación final

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** Reescribir `README.md` (español) con las secciones del spec §10: descripción, funcionalidades por rol, requisitos, instalación (`npm install` en raíz y en `server/` — la raíz también provee `zod` a `shared/`), configuración `.env` (tabla de variables), arranque (`npm run dev:all`), admin principal y cómo cambiar sus datos, roles y matriz de permisos, reglas de validación, tabla completa de endpoints, estructura de carpetas, scripts (`dev`, `server`, `dev:all`, `build`, `test`), pruebas, nota del respaldo `galeria.backup.db`, solución de problemas (`ECONNREFUSED` = backend apagado; `node:sqlite` = Node < 22.5).
- [ ] **Step 2:** `npm test` (raíz) → todas las pruebas PASS; `npm run build` → OK.
- [ ] **Step 3:** Arranque limpio: borrar `server/galeria.db`, `npm run dev:all`, verificar que el superadmin se crea y que el flujo completo registro → crear proyecto → like/comentario → admin destaca/elimina funciona.
- [ ] **Step 4: Commit** — `docs: README completo de la galería`
