# Galería — Feria de Innovación Tecnológica

Galería fotográfica colaborativa para una feria de innovación tecnológica.
Cualquier persona registrada puede subir fotos de sus proyectos, darles
like, comentarlas y eliminar únicamente las suyas. Las fotos con más likes
aparecen automáticamente en la sección **Destacadas**.

## Funcionalidades

- **Cuentas de usuario** (registro / login con usuario y contraseña, sesión con JWT).
- **Subir y eliminar fotos**: cualquier usuario logueado puede subir una foto
  (título, categoría, descripción, imagen) y solo puede eliminar las que subió él mismo.
- **Likes**: un like por usuario y foto, se puede quitar volviendo a pulsar.
- **Comentarios**: cualquier usuario logueado puede comentar; solo puede borrar los suyos.
- **Destacadas**: las 6 fotos con más likes se muestran arriba de la galería.
- **Filtro por categoría** (Robótica, IA, Software, Hardware, etc.).

## Arquitectura

```
galeria/
  src/            Frontend: React + TypeScript + Vite
  server/         Backend: Node.js + Express + SQLite (node:sqlite, sin dependencias nativas)
    uploads/      Imágenes subidas (no se versiona en git)
    galeria.db    Base de datos SQLite (no se versiona en git)
```

El frontend habla con el backend a través de `/api/*`; en desarrollo, Vite
redirige (`proxy`) esas rutas al servidor en `http://localhost:4000`.

## Requisitos

- Node.js 22.5+ (usa el módulo nativo `node:sqlite`; probado en Node 24).

## Puesta en marcha

Instala las dependencias una vez, en cada carpeta:

```bash
npm install               # frontend (raíz de galeria/)
npm install --prefix server   # backend
```

Levanta frontend y backend juntos con un solo comando:

```bash
npm run dev:all
```

Esto abre:
- Frontend en `http://localhost:5173` (o el siguiente puerto libre)
- API en `http://localhost:4000`

También puedes correrlos por separado en dos terminales: `npm run dev` (frontend) y `npm run server` (backend).

## Notas técnicas

- Las contraseñas se guardan con hash `bcrypt`.
- El secreto usado para firmar los JWT se genera automáticamente en
  `server/.jwt-secret` la primera vez que arranca el servidor (o se puede
  fijar con la variable de entorno `JWT_SECRET`).
- Los archivos subidos se validan por tipo (JPG, PNG, WEBP, GIF) y tamaño
  (máx. 10 MB) y se guardan en `server/uploads/`.
