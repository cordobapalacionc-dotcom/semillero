# Galería — Feria de Innovación Tecnológica

Plataforma donde la comunidad publica sus **proyectos** (cada proyecto tiene varias fotos), los comenta y les da like.
Cada usuario tiene su propio **dashboard** con estadísticas, y un **panel de administración** con jerarquía de
administradores permite moderar todo el contenido.

Diseño en **blanco y negro** (con modo oscuro): las fotos son el único color de la interfaz.

---

## Índice

1. [Funcionalidades](#funcionalidades)
2. [Requisitos](#requisitos)
3. [Instalación y arranque](#instalación-y-arranque)
4. [Configuración (`backend/.env`)](#configuración-backendenv)
5. [Administrador principal](#administrador-principal)
6. [Roles y permisos](#roles-y-permisos)
7. [Reglas de validación](#reglas-de-validación)
8. [API](#api)
9. [Base de datos](#base-de-datos)
10. [Estructura del proyecto](#estructura-del-proyecto)
11. [Scripts](#scripts)
12. [Pruebas](#pruebas)
13. [Seguridad y robustez](#seguridad-y-robustez)
14. [Solución de problemas](#solución-de-problemas)

---

## Funcionalidades

### Público (sin iniciar sesión)
- **Inicio**: carrusel de proyectos **destacados**, buscador (título, descripción y categoría), filtro por categoría
  con contador, orden (recientes, populares, más comentados) y botón "Cargar más". Los filtros quedan en la URL,
  así que se pueden recargar y compartir.
- **Detalle de proyecto** (`/proyectos/:id`): galería con miniaturas y **visor a pantalla completa** (flechas ← → y
  Esc), descripción, autor, likes y comentarios.
- **Perfil público** (`/usuarios/:usuario`): biografía, cantidad de proyectos, likes totales y sus proyectos.

### Cuenta
- **Registro** con **correo, nombre de usuario y contraseña** (y confirmación). Validación **en vivo** campo por campo,
  medidor de fuerza de la contraseña con lista de requisitos y comprobación instantánea de si el usuario o el correo
  ya están en uso.
- **Inicio de sesión con usuario _o_ correo** y contraseña (sin importar mayúsculas en el usuario ni en el correo).
  Tras 5 intentos fallidos se bloquea 15 minutos y se muestra cuánto falta.
- Si intentas entrar a una página protegida sin sesión, te lleva al login y luego te devuelve a donde ibas.

### Mi dashboard (`/dashboard`, usuarios con sesión)
- **Resumen**: tarjetas animadas (proyectos, fotos, likes y comentarios recibidos), **gráfica de likes de los últimos
  30 días** con tooltip, top 5 de tus proyectos y últimos comentarios recibidos.
- **Mis proyectos**: vista en **cuadrícula o lista** (se recuerda), búsqueda instantánea, filtro por categoría, orden,
  paginación y acciones ver / editar / eliminar (con confirmación).
- **Nuevo proyecto**: título, descripción, **categoría libre con autocompletado** de las existentes, zona para
  **arrastrar y soltar** fotos con vista previa, **reordenar arrastrando** (o con botones ← →), elegir portada (★) y
  barra de **progreso de subida**.
- **Editar proyecto**: cambia los datos, reordena (se guarda al soltar), cambia la portada, edita el pie de cada foto,
  quita fotos (no se puede quitar la última) y agrega más. Si intentas salir con cambios sin guardar, te avisa.
- **Mi perfil**: edita usuario, correo y biografía; cambia la contraseña (pide la actual).

### Panel de administración (`/admin`, admins y admin principal)
- **Resumen**: totales con **variación porcentual** frente al periodo anterior, selector de **7 / 30 / 90 días**,
  gráfica de actividad diaria (proyectos, registros, comentarios) con **leyenda interactiva** para mostrar u ocultar
  series, **barras de categorías clicables** (llevan a los proyectos de esa categoría) y usuarios más activos.
- **Proyectos**: tabla con miniatura, autor, fotos, likes, comentarios y fecha; **columnas ordenables**, búsqueda
  (también por autor), filtros de categoría y destacados, **interruptor de destacado**, **vista previa** en panel
  lateral y **selección múltiple con borrado en lote**.
- **Usuarios**: rol y estado como etiquetas, cantidad de proyectos, registro y último acceso; filtros por rol y estado;
  **suspender / reactivar**, **eliminar** y (solo el admin principal) **dar o quitar admin**. Los botones que no te
  corresponden aparecen desactivados y al pasar el mouse explican por qué.
- **Comentarios**: búsqueda por texto, autor o proyecto; borrado individual o en lote.

### Interfaz
- Blanco y negro, tipografía Inter, **modo oscuro** (botón en la barra; se recuerda y respeta la preferencia del sistema).
- Responsive: en el celular las tablas se convierten en tarjetas y la barra lateral en un menú desplegable.
- Notificaciones ("toasts") y diálogo de confirmación antes de cualquier borrado. Si intentas salir o cerrar sesión
  con un proyecto sin guardar, te pide confirmación.
- El dashboard y el panel admin (con sus gráficas) se cargan bajo demanda, así la galería pública carga más rápido.
- Si tu cuenta es suspendida o eliminada mientras tienes la sesión abierta, la siguiente acción cierra la sesión y te avisa
  (la API responde `403` con `code: "ACCOUNT_SUSPENDED"` o `401`). Si te quitan el rol de admin, el panel desaparece en
  tu siguiente acción (`403` con `code: "ADMIN_REQUIRED"`). Si el servidor está caído o reiniciándose, tu sesión se conserva.

---

## Requisitos

- **Node.js 22.5 o superior** (usa el módulo nativo `node:sqlite`; probado en Node 24). No hay dependencias nativas que compilar.

## Instalación y arranque

`frontend/` y `backend/` son dos proyectos npm **independientes y autocontenidos** (cada uno
con su propio `package.json`): se pueden instalar, construir y desplegar por separado. El
`package.json` de la raíz es solo un **orquestador de desarrollo** (no tiene código propio).

```bash
# 1. Dependencias de los tres proyectos (raíz, frontend y backend)
npm install
npm run install:all

# 2. Configuración del backend: copia la plantilla y edítala (sobre todo ADMIN_PASSWORD)
cp backend/.env.example backend/.env

# 3. Arranca frontend + backend juntos
npm run dev:all
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000` (Vite reenvía `/api` y `/uploads` a este puerto)

También se pueden correr por separado: `npm run dev` (frontend) y `npm run server` (backend),
o entrando a cada carpeta (`cd frontend && npm run dev` / `cd backend && npm run dev`).

## Configuración (`backend/.env`)

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `4000` | Puerto de la API |
| `CORS_ORIGIN` | `http://localhost:5173` | Origen permitido para peticiones del navegador |
| `JWT_SECRET` | (generado) | Secreto para firmar las sesiones. Si se deja vacío se genera uno y se guarda en `backend/.jwt-secret` |
| `ADMIN_USERNAME` | — | Usuario del administrador principal |
| `ADMIN_EMAIL` | — | Correo del administrador principal |
| `ADMIN_PASSWORD` | — | Contraseña inicial del administrador principal (mín. 8, letras y números) |

`backend/.env` no se sube a git. `backend/.env.example` es la plantilla.

## Administrador principal

- Al arrancar, si **no existe** un administrador principal, el servidor lo crea con `ADMIN_USERNAME`, `ADMIN_EMAIL` y
  `ADMIN_PASSWORD`. Si alguna falta o no es válida, muestra un aviso en la consola y no lo crea.
- Si ya existe una cuenta con ese usuario o correo, solo se convierte en administrador principal si su contraseña
  coincide con `ADMIN_PASSWORD`; si no, el servidor avisa en la consola y no hace nada (así nadie puede adueñarse del
  panel registrándose antes con esos datos).
- **Cambiar `ADMIN_PASSWORD` después no sobrescribe** la contraseña guardada: se cambia desde *Mi perfil → Cambiar contraseña*.
- Con la plantilla, el acceso inicial es **`admin` / `Cambiame123`**. Cámbialo.

## Roles y permisos

| Rol | Quién es |
|---|---|
| `superadmin` | **Admin principal.** Único, creado desde `.env`. |
| `admin` | Sub-administrador, nombrado por el admin principal. |
| `user` | Usuario normal. |

| Acción | Visitante | Usuario | Admin | Admin principal |
|---|:-:|:-:|:-:|:-:|
| Ver galería, proyectos y perfiles | ✓ | ✓ | ✓ | ✓ |
| Dar like y comentar | | ✓ | ✓ | ✓ |
| Crear, editar y eliminar **sus** proyectos y fotos | | ✓ | ✓ | ✓ |
| Borrar comentarios en **sus** proyectos | | ✓ | ✓ | ✓ |
| Panel admin y estadísticas globales | | | ✓ | ✓ |
| Eliminar cualquier proyecto o comentario, destacar proyectos | | | ✓ | ✓ |
| Suspender, reactivar o eliminar **usuarios normales** | | | ✓ | ✓ |
| Suspender, reactivar o eliminar **otros admins** | | | | ✓ |
| Dar o quitar el rol de admin | | | | ✓ |

Reglas de la jerarquía (se aplican en el servidor, en `backend/src/services/permissions.js`):

1. **Nadie** puede suspender, eliminar ni cambiar el rol del admin principal, ni siquiera él mismo.
2. Nadie puede actuar sobre su propia cuenta desde el panel.
3. Un admin no puede gestionar a otro admin.
4. Solo el admin principal cambia roles, y solo entre `user` y `admin` (nunca crea otro principal).

Un usuario **suspendido** no puede iniciar sesión, su sesión abierta deja de funcionar al instante y sus proyectos
dejan de verse en la galería pública y en su perfil (el panel admin sí los muestra).

## Reglas de validación

Las mismas reglas se usan en el navegador y en el servidor: `frontend/src/shared/validation.js`
y `backend/shared/validation.js` son la **misma lógica duplicada a propósito** (esquemas de
Zod), porque frontend y backend se despliegan por separado y no comparten disco en producción.
Si cambias una regla, actualiza las dos copias.

| Campo | Regla |
|---|---|
| Correo | formato válido, máx. 254; se guarda en minúsculas |
| Usuario | 3–20 caracteres: letras, números, `_ . -`; no puede ser solo números; único sin importar mayúsculas |
| Contraseña | 8–72 caracteres, al menos una letra y un número |
| Biografía | máx. 300 |
| Título del proyecto | 2–80 |
| Descripción | máx. 2000 |
| Categoría | 2–40, texto libre. Si ya existe una igual sin importar mayúsculas (“robótica” = “Robótica”), se reutiliza |
| Pie de foto | máx. 200 |
| Comentario | 1–500 (sin contar espacios al inicio y al final) |
| Imágenes | JPG, PNG, WEBP o GIF **verificadas por su contenido**; máx. 10 MB cada una; 1–20 por subida; máx. 50 por proyecto |

Los errores de validación de la API tienen la forma `{ "error": "Datos inválidos", "fields": { "campo": "mensaje" } }`.

## API

Todas las rutas empiezan con `/api`. Las rutas protegidas usan `Authorization: Bearer <token>`.
Las listas paginadas devuelven `{ items, total, page, pageSize }` (12 por página en público y 20 en dashboard y admin).

### Autenticación — `/api/auth`

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/register` | público | `email, username, password, confirmPassword` → `{ token, user }` |
| POST | `/login` | público | `identifier` (usuario o correo) + `password`. Límite: 5 fallos / 15 min |
| GET | `/check?username=&email=` | público | Disponibilidad: `{ usernameAvailable?, emailAvailable? }` |
| GET | `/me` | sesión | Usuario actual |
| PATCH | `/me` | sesión | `username?, email?, bio?` |
| POST | `/me/password` | sesión | `currentPassword, newPassword, confirmPassword` |

### Galería pública — `/api/projects` y `/api/users`

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/projects?q=&category=&sort=recent\|popular\|commented&page=` | público | Lista paginada |
| GET | `/projects/featured` | público | Destacados |
| GET | `/projects/categories` | público | `[{ name, count }]` |
| GET | `/projects/:id` | público | Detalle con fotos |
| POST | `/projects/:id/like` | sesión | Da o quita like → `{ liked, likeCount }` |
| GET | `/projects/:id/comments` | público | Comentarios |
| POST | `/projects/:id/comments` | sesión | `content` |
| DELETE | `/projects/comments/:id` | autor, dueño del proyecto o admin | Borra un comentario |
| GET | `/users/:username` | público | Perfil público y sus proyectos |

### Mi dashboard — `/api/me` (requiere sesión)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/stats` | Totales, likes por día (30), top 5, últimos comentarios |
| GET | `/projects?q=&category=&sort=&page=` | Mis proyectos |
| POST | `/projects` | `multipart/form-data`: `title, description, category` + `photos` (1–20) |
| PATCH | `/projects/:id` | `title?, description?, category?, coverPhotoId?` |
| DELETE | `/projects/:id` | Elimina el proyecto, sus fotos y sus archivos |
| POST | `/projects/:id/photos` | Agrega fotos (`photos`) |
| PATCH | `/projects/:id/photos/order` | `{ photoIds: [...] }` con **todas** las fotos en el nuevo orden |
| PATCH | `/projects/:id/photos/:photoId` | `{ caption }` |
| DELETE | `/projects/:id/photos/:photoId` | Quita una foto (no la última) |

### Administración — `/api/admin` (requiere `admin` o `superadmin`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/stats?range=7\|30\|90` | Totales, variación, actividad diaria, top categorías y usuarios |
| GET | `/projects?q=&category=&featured=&sort=&dir=&page=` | `sort`: `createdAt, title, likes, photos, comments, owner` |
| GET | `/projects/:id` | Detalle (incluye proyectos de usuarios suspendidos) |
| PATCH | `/projects/:id/featured` | `{ featured: true\|false }` |
| DELETE | `/projects/:id` | Elimina un proyecto |
| POST | `/projects/bulk-delete` | `{ ids: [...] }` (máx. 100) → `{ deleted }` |
| GET | `/comments?q=&page=` | Moderación de comentarios |
| DELETE | `/comments/:id` | Elimina un comentario |
| POST | `/comments/bulk-delete` | `{ ids: [...] }` → `{ deleted }` |
| GET | `/users?q=&role=&status=&sort=&dir=&page=` | `sort`: `createdAt, username, projects, lastLogin` |
| PATCH | `/users/:id/status` | `{ status: "active"\|"suspended" }` (según jerarquía) |
| PATCH | `/users/:id/role` | `{ role: "user"\|"admin" }` (solo admin principal) |
| DELETE | `/users/:id` | Elimina la cuenta y todo su contenido (según jerarquía) |

## Base de datos

SQLite en `backend/galeria.db` (no se sube a git). Las tablas se crean solas al arrancar.

| Tabla | Contenido |
|---|---|
| `users` | usuario, correo, hash de contraseña, `role`, `status`, bio, fechas de registro y último acceso |
| `projects` | dueño, título, descripción, categoría, portada, destacado, fechas |
| `photos` | proyecto, archivo, pie de foto, posición |
| `likes` | uno por usuario y proyecto |
| `comments` | proyecto, autor, texto |

- Al borrar un proyecto o un usuario se borra en cascada todo lo relacionado **y los archivos de imagen del disco**.
- **Base de datos de la versión anterior:** si al arrancar se detecta el esquema viejo (fotos sueltas, usuarios sin
  correo), el archivo se renombra a `backend/galeria.backup.db` y se crea una base de datos nueva. No se borra nada.
- Las imágenes viven en `backend/uploads/` (tampoco se suben a git).

## Estructura del proyecto

`frontend/` y `backend/` son dos proyectos separados (cada uno con su propio `package.json`,
`node_modules` y ciclo de vida), pensados para desplegarse de forma independiente — por ejemplo
el frontend como sitio estático y el backend como servicio Node con disco persistente. El
`package.json` de la raíz solo orquesta el modo desarrollo (`npm run dev:all`); no es parte de
ninguno de los dos proyectos.

```
galeria/
  package.json                 Orquestador de desarrollo (concurrently); sin código propio
  frontend/
    index.html, vite.config.ts, tsconfig*.json
    src/
      shared/validation.js     Copia de los esquemas zod (ver "Reglas de validación")
      api/                     Cliente HTTP (manejo de errores, subida con progreso)
      context/                 Sesión, tema y notificaciones
      hooks/                   useAsync, useForm, useQueryState, useUnsavedChanges…
      lib/                     Formatos y copia de las reglas de permisos
      components/              ui/ (tabla, modal, tarjetas…), layout/, projects/, charts/
      pages/                   public/, auth/, dashboard/, admin/
      styles/                  tokens (colores), base, componentes y páginas
  backend/
    .env.example               Plantilla de configuración
    shared/validation.js       Copia de los esquemas zod (ver "Reglas de validación")
    src/
      index.js                 Arranque: config → BD → admin principal → app
      app.js                   createApp(ctx): middlewares y rutas
      config.js, db.js         Configuración y esquema SQLite
      middleware/               auth (sesión y roles), errors, validate, upload
      services/                 permissions (jerarquía), projects, stats, files, dto, seed
      routes/                   auth, projects, users, me, admin
    test/                       Pruebas (node:test + supertest)
```

## Scripts

Desde la raíz (orquestador):

| Comando | Qué hace |
|---|---|
| `npm run install:all` | Instala dependencias de `frontend/` y `backend/` |
| `npm run dev:all` | Frontend y backend juntos |
| `npm run dev` | Solo frontend (Vite) |
| `npm run server` | Solo backend (se reinicia al guardar cambios) |
| `npm run build` | Revisa tipos y genera el frontend en `frontend/dist/` |
| `npm test` | Pruebas del backend |

También puedes entrar a cada carpeta y usar sus scripts propios (`frontend/package.json`:
`dev`, `build`, `preview`; `backend/package.json`: `dev`, `start`, `test`).

## Pruebas

```bash
npm test
```

123 pruebas automáticas del servidor sobre una base de datos temporal en memoria: registro y login (con usuario o
correo, mayúsculas, bloqueo por intentos), validaciones, sesión de usuarios suspendidos o eliminados, la **matriz
completa de permisos** de la jerarquía de admins, subida de imágenes (archivos disfrazados, límites), CRUD de
proyectos y fotos (portada, orden, límites), galería pública, estadísticas y todos los endpoints de administración,
incluido que los archivos se borren del disco.

## Seguridad y robustez

- Contraseñas con `bcrypt`; el login responde lo mismo si falla el usuario o la contraseña, y tarda lo mismo.
- Límite de intentos de login por IP y usuario (en desarrollo, el proxy de Vite reenvía la IP real con `xfwd`).
- La sesión (JWT, 7 días) se valida contra la base de datos en **cada** petición.
- Imágenes verificadas por sus primeros bytes, no por la extensión; los archivos se escriben solo si todos son válidos
  y se limpian si algo falla después.
- Operaciones múltiples (crear proyecto, borrados en lote, eliminar usuario) dentro de **transacciones**.
- `helmet` (cabeceras de seguridad), CORS restringido, límite de 100 KB para JSON, IDs validados.
- El orden de las listas se elige de una lista blanca; nunca se mete texto del cliente en el SQL.
- La búsqueda escapa `%` y `_`.

## Solución de problemas

| Síntoma | Causa y solución |
|---|---|
| `http proxy error … ECONNREFUSED` en la consola de Vite | El backend no está corriendo. Usa `npm run dev:all` o `npm run server` |
| Error sobre `node:sqlite` al arrancar el servidor | Node es anterior a 22.5. Actualiza Node (`node -v`) |
| `[seed] No hay administrador principal…` | Falta `backend/.env` o alguna variable `ADMIN_*`. Copia `.env.example` y reinicia |
| `Cannot find package 'zod'` al arrancar el servidor | Falta `npm install --prefix backend` (o `npm run install:all` desde la raíz) |
| `Cannot find module '.../shared/validation.js'` | `frontend/` y `backend/` tienen cada uno su **propia copia** de `shared/validation.js` (ver "Reglas de validación"); revisa que la ruta relativa del import apunte a la copia de su propia carpeta, no a la del otro proyecto |
| `EADDRINUSE :::4000` | Ya hay un servidor corriendo en ese puerto. Ciérralo o cambia `PORT` |
| Desapareció mi contenido viejo | La base de datos anterior se respaldó en `backend/galeria.backup.db` |
| "No se encuentra localhost" / el navegador no conecta | Ningún servidor está corriendo (comprueba con `npm run dev:all`), o quedó un proceso viejo colgado en el puerto. En Windows: `netstat -ano \| findstr :5173` (o `:4000`) para ver el PID y `taskkill /PID <pid> /F` para cerrarlo; luego vuelve a arrancar |
| El backend se reinicia solo en bucle (`Change detected in '...node_modules...'`) | Si el proyecto vive dentro de OneDrive, la sincronización toca archivos de `node_modules` y `node --watch` lo detecta como cambio. Ya está resuelto: `backend/package.json` usa `node --watch-path=src` para vigilar solo el código propio |
| Pantalla de error al navegar entre páginas (`destroy is not a function`) | Bug ya corregido: el `useEffect` de `<ScrollToTop>` en `frontend/src/App.tsx` devolvía el resultado de `window.scrollTo(...)` en vez de nada, y React lo interpretaba como función de limpieza |
| `[API] Failed running 'src/index.js'. Waiting for file changes before restarting…` | Hay **más de un `npm run dev:all` corriendo a la vez** (por ejemplo, uno en la terminal de VS Code y otro ya abierto antes) y están peleando por el puerto 4000: el segundo pierde y se queda esperando. Revisa si tienes varias terminales con `dev:all` abiertas y cierra las repetidas; en Windows puedes ver todos los procesos con `Get-CimInstance Win32_Process -Filter "name='node.exe'"` y cerrar los que sobren con `taskkill /PID <pid> /F`. Solo debe quedar **una** instancia |
