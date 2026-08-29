# Contrato de API del Panel Admin — Canal de Denuncias ARH

Este documento define las rutas, formas de datos y convenciones que TODOS los agentes deben respetar.
No cambiar estas firmas sin actualizar este documento.

## Stack y convenciones
- Backend: Express en `server.ts`, dev via `tsx server.ts` (puerto 3000, Vite en middleware mode).
- DB: `better-sqlite3` (síncrono). Archivo `data/app.db` (crear carpeta `data/`, ya en .gitignore).
- Auth: JWT firmado con `process.env.JWT_SECRET` (fallback dev), enviado en cookie httpOnly `admin_token`. `cookie-parser` habilitado.
- Passwords: `bcryptjs`.
- Todas las rutas admin bajo prefijo `/api/admin/*` y protegidas por middleware `requireAuth`, EXCEPTO `/api/admin/login`.
- Contenido CMS público (para el Wizard) se sirve SIN auth en `/api/content`.

## Módulo de base de datos: `src/server/db.ts`
Exporta una instancia `db` de better-sqlite3 y funciones helper. Inicializa tablas si no existen.

### Tablas
```sql
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS denuncias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folio TEXT UNIQUE NOT NULL,
  estatus TEXT NOT NULL DEFAULT 'recibida',        -- recibida | en_revision | en_investigacion | resuelta | desestimada
  tipo TEXT,
  empresa TEXT,
  centro TEXT,
  modo TEXT,                                        -- anonimo | identificado
  denunciante_nombre TEXT,
  denunciante_correo TEXT,
  descripcion TEXT,
  payload_json TEXT,                                -- JSON completo del formData
  notas_admin TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_key TEXT UNIQUE NOT NULL,   -- ej: 'home.titulo', 'home.subtitulo', 'footer.texto'
  label TEXT NOT NULL,              -- nombre legible para el editor
  type TEXT NOT NULL DEFAULT 'text',-- text | textarea | html
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
```

### Seed inicial
- Crear admin por defecto si no existe ninguno: username `admin`, password `admin123` (hasheada). Loguear aviso para cambiarla.
- Sembrar content_blocks por defecto (ver lista abajo).

### Bloques de contenido por defecto (block_key : label : type : value)
- `home.titulo` : "Título principal" : text : "Canal Ético de Denuncias"
- `home.subtitulo` : "Subtítulo" : textarea : "Reporta de forma segura y confidencial cualquier conducta irregular."
- `home.descripcion` : "Descripción de inicio" : html : "<p>Tu denuncia será tratada con total confidencialidad...</p>"
- `home.aviso_privacidad` : "Aviso de privacidad" : html : "<p>Los datos proporcionados...</p>"
- `footer.texto` : "Texto del pie de página" : text : "ARH Consultores © 2026 — Todos los derechos reservados"
- `contacto.email` : "Correo de contacto del comité" : text : "denunciasconsultoresarh@gmail.com"

## Endpoints

### Auth
- `POST /api/admin/login` — body `{ username, password }`. Setea cookie `admin_token`. Respuesta `{ ok: true, user: { username } }` o 401 `{ error }`.
- `POST /api/admin/logout` — limpia cookie. `{ ok: true }`.
- `GET /api/admin/me` — protegido. `{ user: { username } }` o 401.

### Folios (protegido)
- `GET /api/admin/folios?estatus=&q=&page=&pageSize=` — lista paginada. Respuesta:
  `{ items: Denuncia[], total: number, page: number, pageSize: number }`.
  Filtros: `estatus` exacto, `q` busca en folio/tipo/empresa/descripcion. Orden por created_at desc.
- `GET /api/admin/folios/:folio` — detalle completo (incluye payload_json parseado como `payload`).
- `PATCH /api/admin/folios/:folio` — body `{ estatus?, notas_admin? }`. Actualiza y devuelve el registro.

### CMS (protegido para escritura)
- `GET /api/admin/content` — lista todos los content_blocks.
- `PUT /api/admin/content/:block_key` — body `{ value }`. Actualiza y devuelve el bloque.

### Contenido público (sin auth, para el Wizard)
- `GET /api/content` — devuelve objeto `{ [block_key]: value }` con todos los bloques.

### Tracking público (sin auth)
- `GET /api/folios/:folio/status` — devuelve `{ folio, estatus, updated_at }` o 404. NO expone datos sensibles.

### Persistencia en send-email (existente)
- El endpoint `POST /api/send-email` en server.ts YA genera `folio`. Debe además INSERTAR la denuncia en la tabla `denuncias` con todos los campos derivados del body (tipo, empresa, centro, modo, denunciante, descripcion, payload_json = JSON.stringify del body relevante), estatus 'recibida'. Mantener la respuesta `{ message, folio }`.

## Tipos TypeScript compartidos: `src/types/admin.ts`
Definir e exportar interfaces `Denuncia`, `ContentBlock`, `AdminUser`, `EstatusFolio`, y `ESTATUS_LABELS` mapa de estatus->etiqueta español.

## Frontend
- Rutas nuevas en `src/App.tsx`: `/admin/login` (público) y `/admin/*` (protegido con guard).
- Contexto de auth en `src/admin/AuthContext.tsx` usando `/api/admin/me`.
- Layout admin en `src/admin/AdminLayout.tsx` con sidebar (Folios, Contenido, Cerrar sesión).
- Página folios: `src/admin/pages/FoliosPage.tsx` (lista + filtros + detalle/modal + cambio estatus).
- Página CMS: `src/admin/pages/ContenidoPage.tsx` (lista de bloques editables, guardar por bloque).
- Login: `src/admin/pages/LoginPage.tsx`.
- Usar Tailwind, paleta del proyecto: azul `#1a237e`, acento `#f57c00`/`#ffc107`. Logo en `/logo-arh.png`.
- fetch con `credentials: 'include'` en todas las llamadas admin.

## Reglas
- NO romper el Wizard ni el flujo de envío existente.
- NO cambiar el puerto ni la estructura de server.ts salvo agregar rutas/imports.
- El código debe pasar `npm run lint` (tsc --noEmit) y `npm run build`.
