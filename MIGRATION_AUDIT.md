# MIGRATION_AUDIT.md — Canal de Denuncias ARH

> **Generado:** 2026-09-26  
> **Basado en:** 5 reportes de auditoría de sub-agentes (estructura, base de datos, uso de Supabase, auth/API, storage)  
> **Estado del documento:** BORRADOR — requiere revisión antes de ejecutar migración

---

## 1. Arquitectura Actual

### Descripción general

Aplicación web full-stack para envío y seguimiento de denuncias éticas con panel de administración. Arquitectura **dual** con dos capas de servidor según entorno:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER (React SPA)                         │
│  src/App.tsx · src/components/ · src/admin/ · src/main.tsx         │
│  Vite + React 19 + React Router 7 + Tailwind CSS 4                 │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ HTTP (fetch + credentials: include)
         ┌────────────┴────────────┐
         │                         │
┌────────▼──────────┐   ┌─────────▼──────────────┐
│  DESARROLLO LOCAL  │   │      PRODUCCIÓN         │
│  server.ts         │   │   Netlify Functions     │
│  (Express puerto   │   │   netlify/functions/    │
│   3000)            │   │   admin.js              │
│  src/server/       │   │   send-email.js         │
│  routes.ts         │   │   _data.js (helper)     │
│  db.ts             │   │   _mail.js (helper)     │
│  auth.ts           │   └─────────┬──────────────┘
│  mail.ts           │             │
│  supabase.ts       │             │
└────────┬───────────┘             │
         │                         │
         └────────────┬────────────┘
                      │ @supabase/supabase-js (service_role)
              ┌───────▼────────────┐
              │   SUPABASE         │
              │   PostgreSQL       │
              │   3 tablas         │
              │   RLS habilitado   │
              │   sin Storage      │
              └────────────────────┘
```

### Patrones clave (CONFIRMADO)

- **Sin Supabase Auth** — autenticación propia con `bcryptjs` + JWT en cookie HttpOnly.
- **Sin Supabase Storage** — archivos van embebidos en email como base64; logos del CMS se guardan como data URLs en la tabla `content_blocks`.
- **Sin Supabase Realtime** — no hay suscripciones.
- **Sin RPC** — no se usan funciones PostgreSQL/Edge Functions de Supabase.
- **Acceso a BD exclusivamente server-side** — el cliente React nunca llama a Supabase directamente.
- **Supabase se usa únicamente como capa de base de datos PostgreSQL** vía su REST API (PostgREST), accedida con la `service_role key`.

---

## 2. Dependencias y Stack Tecnológico

### Frontend (CONFIRMADO)

| Paquete | Versión | Rol |
|---------|---------|-----|
| react | ^19.0.0 | UI framework |
| react-dom | ^19.0.0 | Renderizado DOM |
| react-router-dom | ^7.13.1 | Enrutamiento SPA |
| react-hot-toast | ^2.6.0 | Notificaciones |
| lucide-react | ^0.546.0 | Iconos |
| tailwindcss | ^4.1.14 | Estilos utilitarios |
| vite | ^6.2.0 | Bundler + dev server |

### Backend Express — desarrollo local (CONFIRMADO)

| Paquete | Versión | Rol |
|---------|---------|-----|
| express | ^4.21.2 | Servidor HTTP |
| @supabase/supabase-js | ^2.47.10 | Cliente BD (PostgreSQL) |
| bcryptjs | ^2.4.3 | Hash de contraseñas |
| jsonwebtoken | ^9.0.2 | Firma y verificación JWT |
| cookie-parser | ^1.4.7 | Lectura de cookies |
| nodemailer | ^8.0.3 | Envío de emails (Gmail SMTP) |
| dotenv | ^17.2.3 | Variables de entorno |
| better-sqlite3 | ^11.8.1 | ⚠️ RESIDUAL — dependencia legada de SQLite; no se usa activamente |

### Backend Netlify Functions — producción (CONFIRMADO)

| Paquete | Versión | Archivo |
|---------|---------|---------|
| @supabase/supabase-js | ^2.47.10 | netlify/functions/package.json |
| nodemailer | ^8.0.3 | netlify/functions/package.json |
| jsonwebtoken | ^9.0.2 | netlify/functions/package.json |
| bcryptjs | ^2.4.3 | netlify/functions/package.json |

> Las Netlify Functions tienen su propio `package.json` y `package-lock.json` independientes.

### Tooling (CONFIRMADO)

| Herramienta | Versión | Uso |
|------------|---------|-----|
| typescript | ~5.8.2 | Tipos estáticos |
| tsx | ^4.21.0 | Ejecutar TypeScript en Node (dev) |
| @vitejs/plugin-react | ^5.0.4 | Plugin React para Vite |
| @tailwindcss/vite | ^4.1.14 | Integración Tailwind con Vite |

### Plataforma de despliegue (CONFIRMADO)

- **Hosting:** Netlify (configurado en `netlify.toml`)
- **Build:** `npm run build` → genera `dist/`
- **Functions bundler:** esbuild

---

## 3. Base de Datos

### 3.1 Tablas encontradas (con columnas, tipos, constraints, RLS)

> Fuente: `supabase/schema.sql` — CONFIRMADO

#### Tabla `public.admins`

| Columna | Tipo | Constraints |
|---------|------|-------------|
| id | bigint | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY |
| username | text | NOT NULL, UNIQUE |
| password_hash | text | NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |

- RLS: HABILITADO
- Políticas públicas: NINGUNA (deny-all para anon)

#### Tabla `public.denuncias`

| Columna | Tipo | Constraints |
|---------|------|-------------|
| id | bigint | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY |
| folio | text | NOT NULL, UNIQUE |
| estatus | text | NOT NULL, DEFAULT 'recibida' |
| tipo | text | NULL |
| empresa | text | NULL |
| centro | text | NULL |
| modo | text | NULL |
| denunciante_nombre | text | NULL |
| denunciante_correo | text | NULL |
| descripcion | text | NULL |
| payload_json | text | NULL ⚠️ almacenado como text, no jsonb |
| notas_admin | text | NOT NULL, DEFAULT '' |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

- RLS: HABILITADO
- Políticas públicas: NINGUNA (deny-all para anon)
- Índices explícitos:
  - `idx_denuncias_estatus` ON `denuncias(estatus)`
  - `idx_denuncias_created_at` ON `denuncias(created_at DESC)`

#### Tabla `public.content_blocks`

| Columna | Tipo | Constraints |
|---------|------|-------------|
| id | bigint | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY |
| block_key | text | NOT NULL, UNIQUE |
| label | text | NOT NULL |
| type | text | NOT NULL, DEFAULT 'text' |
| value | text | NOT NULL, DEFAULT '' ⚠️ puede contener base64 de logos |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

- RLS: HABILITADO
- Políticas públicas: NINGUNA (deny-all para anon)

#### Datos semilla en `content_blocks` (CONFIRMADO)

| block_key | type | Descripción |
|-----------|------|-------------|
| home.titulo | text | Título principal del sitio |
| home.subtitulo | textarea | Subtítulo |
| home.descripcion | html | Descripción HTML |
| home.aviso_privacidad | html | HTML aviso de privacidad |
| home.terminos | html | HTML términos y condiciones |
| footer.texto | text | Texto del pie de página |
| footer.logos | image_list | JSON array de data URLs base64 de logos |
| contacto.email | text | Email de contacto del comité |

Seed es idempotente (usa `ON CONFLICT DO NOTHING`).

### 3.2 Relaciones entre tablas

**CONFIRMADO: No existen Foreign Keys entre tablas.**

El diseño es plano e independiente:
- `admins` ↔ `denuncias`: sin relación FK
- `admins` ↔ `content_blocks`: sin relación FK
- `denuncias` ↔ `content_blocks`: sin relación FK

> Apropiado para el caso de uso; simplifica la migración de datos.

### 3.3 Funciones y Triggers

**CONFIRMADO: No existen funciones PostgreSQL ni triggers.**

- Las columnas `updated_at` en `denuncias` y `content_blocks` **no tienen trigger BEFORE UPDATE**. Se actualizan manualmente desde la aplicación.
- No hay stored procedures.
- No hay Edge Functions de Supabase.

### 3.4 Políticas RLS

**CONFIRMADO: RLS habilitado en las 3 tablas sin ninguna política CREATE POLICY.**

```sql
alter table public.admins enable row level security;
alter table public.denuncias enable row level security;
alter table public.content_blocks enable row level security;
```

Resultado: acceso **deny-all** para la `anon key`. El backend usa la `service_role key` que bypasea RLS completamente. No hay acceso directo de cliente al proyecto de Supabase.

---

## 4. Storage

### 4.1 Buckets identificados

**CONFIRMADO: No existe ningún bucket de Supabase Storage en el proyecto.**

No se encontraron referencias a `supabase.storage`, `.upload()`, `.download()`, `.remove()`, `.createSignedUrl()`, ni `.getPublicUrl()` en ningún archivo del proyecto.

### 4.2 Estructura de rutas

No aplica — no hay sistema de storage implementado.

El almacenamiento de archivos funciona así:

| Tipo de archivo | Mecanismo | Persistencia |
|-----------------|-----------|--------------|
| Evidencias del Wizard | Base64 en body JSON → adjunto en email | Solo en el correo del destinatario |
| Logos del CMS | Base64 data URL en columna `value` de `content_blocks` | Supabase Postgres |
| Comprobante PDF | Generado en el navegador vía `window.open` + `print()` | Solo en el dispositivo del usuario |

### 4.3 Operaciones de storage en código

**CONFIRMADO: Ninguna operación de storage de Supabase.**

Flujo de archivos del Wizard (`src/components/Wizard.tsx`):
1. El usuario selecciona archivos desde un `<input type="file">` (sin `multiple`, sin `accept`).
2. El cliente convierte cada archivo a base64 con `FileReader.readAsDataURL()`.
3. El array `[{ name, data }]` se serializa en el body JSON de `POST /api/send-email`.
4. El servidor (`server.ts` / `send-email.js`) pasa los adjuntos a `nodemailer` con `path: dataURL`.
5. Los archivos llegan al correo del comité como adjuntos. **No se guardan en ningún storage.**

Flujo de logos del CMS (`src/admin/pages/ContenidoPage.tsx`):
1. El admin sube una imagen en el panel CMS.
2. Se valida tipo MIME y tamaño (máx 1.5 MB).
3. Se convierte a base64 data URL con `FileReader`.
4. Se guarda como JSON array stringificado en `content_blocks.value` donde `block_key = 'footer.logos'`.

### 4.4 Metadata en BD

La tabla `denuncias` **no almacena ninguna referencia a archivos adjuntos**. El campo `payload_json` contiene los datos del formulario del Wizard (sin los archivos binarios).

---

## 5. Código — Archivos que dependen de Supabase

> Solo se listan archivos con dependencia directa o indirecta sobre Supabase.

### Dependencia DIRECTA (instancian el cliente)

| Archivo | Tipo | Qué hace con Supabase |
|---------|------|----------------------|
| `src/server/supabase.ts` | TypeScript / Express | Crea el cliente `createClient()` con `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Exporta `getSupabase()` (lazy singleton) e `isSupabaseConfigured()`. |
| `netlify/functions/_data.js` | CommonJS / Netlify | Crea el cliente `createClient()` con las mismas variables. Implementa todas las operaciones CRUD de las 3 tablas. |

### Dependencia INDIRECTA (usan funciones de los módulos anteriores)

| Archivo | Tipo | Qué funciones usa |
|---------|------|------------------|
| `src/server/db.ts` | TypeScript / Express | Importa `getSupabase()` de `supabase.ts`. Implementa CRUD completo: `insertDenuncia`, `listDenuncias`, `getDenuncia`, `updateDenuncia`, `getFolioStatus`, `listContentBlocks`, `getContentMap`, `updateContentBlock`, `getAdminByUsername`, `ensureSeed`. |
| `netlify/functions/admin.js` | CommonJS / Netlify | Importa de `_data.js`: `listDenuncias`, `getDenuncia`, `updateDenuncia`, `getFolioStatus`, `listContentBlocks`, `getContentMap`, `updateContentBlock`, `getAdminByUsername`. |
| `netlify/functions/send-email.js` | CommonJS / Netlify | Importa de `_data.js`: `insertDenuncia`, `extractDenunciaFields`. |
| `src/server/routes.ts` | TypeScript / Express | Usa funciones de `db.ts` para todas las rutas API. |
| `server.ts` | TypeScript / Express | Usa `insertDenuncia` de `src/server/db.ts` para persistir denuncias en `POST /api/send-email`. |

### Sin dependencia de Supabase (CONFIRMADO)

Los siguientes archivos **no tienen ninguna referencia a Supabase**:

- `src/server/auth.ts` — solo JWT/bcrypt
- `src/server/mail.ts` — solo nodemailer
- `netlify/functions/_mail.js` — solo nodemailer
- `src/App.tsx`, `src/main.tsx`, `src/index.css` — frontend puro
- `src/admin/AdminLayout.tsx`, `src/admin/AuthContext.tsx`, `src/admin/RequireAuth.tsx` — frontend puro
- `src/admin/pages/LoginPage.tsx`, `ChangePasswordPage.tsx`, `ContenidoPage.tsx`, `FoliosPage.tsx` — frontend puro
- `src/components/Wizard.tsx`, `Tracking.tsx`, `TrackingSearch.tsx`, `AccesibilidadPanel.tsx` — frontend puro
- `src/components/shared/Button.tsx` — componente UI
- `src/types/admin.ts` — solo tipos TypeScript

---

## 6. API y Funciones Serverless

### 6.1 Rutas Express — desarrollo local (puerto 3000)

> Implementadas en `server.ts` + `src/server/routes.ts`

#### Rutas públicas (sin autenticación)

| Método | Ruta | Handler | Descripción |
|--------|------|---------|-------------|
| GET | `/api/content` | `getContentMap()` | Devuelve mapa `{ block_key: value }` del CMS. Usado por el Wizard para cargar textos del sitio. |
| GET | `/api/folios/:folio/status` | `getFolioStatus()` | Tracking público. Devuelve `{ folio, estatus, updated_at }`. No expone datos sensibles del denunciante. |
| POST | `/api/send-email` | `insertDenuncia()` + nodemailer | Recibe el formulario de denuncia. Genera folio (`crypto.randomBytes`), envía email al comité y confirmación al denunciante, persiste en BD. |

#### Rutas de autenticación (sin protección JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/admin/login` | Login. Recibe `{ username, password }`. Valida contra tabla `admins`. Setea cookie `admin_token` (HttpOnly, 12h). |
| POST | `/api/admin/logout` | Logout. Borra cookie `admin_token`. |
| GET | `/api/admin/me` | Verifica sesión activa. Devuelve `{ user: { username } }` si la cookie es válida. |

#### Rutas admin protegidas (requieren cookie JWT válida)

| Método | Ruta | Descripción |
|--------|------|-------------|
| PUT | `/api/admin/password` | Cambia contraseña. Recibe `{ currentPassword, newPassword }` (mínimo 8 chars). ⚠️ SOLO en Express, NO en Netlify. |
| GET | `/api/admin/folios` | Lista paginada de denuncias. Query params: `estatus`, `q` (búsqueda), `page`, `pageSize`. |
| GET | `/api/admin/folios/:folio` | Detalle completo de una denuncia. Incluye `payload` (payload_json parseado). |
| PATCH | `/api/admin/folios/:folio` | Actualiza `estatus` y/o `notas_admin`. Dispara email al denunciante si el estatus cambió y hay correo registrado. |
| GET | `/api/admin/content` | Lista todos los bloques de contenido del CMS. |
| PUT | `/api/admin/content/:block_key` | Actualiza el `value` de un bloque CMS. |

### 6.2 Netlify Functions — producción

#### `netlify/functions/admin.js` (7 338 B)

- **Ruta Netlify:** `/.netlify/functions/admin`
- **Expuesta vía redirects:** `/api/admin/*`, `/api/content`, `/api/folios/*`
- **Dependencias:** `_data.js`, `_mail.js`, `jsonwebtoken`, `bcryptjs`
- **Variables de entorno requeridas:** `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NODE_ENV`, `EMAIL_USER`, `EMAIL_PASS`
- **Maneja todas las rutas** equivalentes a `routes.ts`, **EXCEPTO** `PUT /api/admin/password` (⚠️ no implementada)

#### `netlify/functions/send-email.js` (5 574 B)

- **Ruta Netlify:** `/.netlify/functions/send-email`
- **Expuesta vía redirect:** `/api/send-email`
- **Método:** POST únicamente
- **Dependencias:** `_data.js`, `_mail.js`, `nodemailer`
- **Variables de entorno requeridas:** `EMAIL_USER`, `EMAIL_PASS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **⚠️ Genera folios con `Math.random()`** — no criptográficamente seguro (Express usa `crypto.randomBytes`)

#### `netlify/functions/_data.js` (5 775 B) — módulo compartido

- No es una función HTTP directa.
- Exporta: `getSupabase`, `ESTATUS_LABELS`, `VALID_ESTATUS`, `insertDenuncia`, `listDenuncias`, `getDenuncia`, `updateDenuncia`, `getFolioStatus`, `listContentBlocks`, `getContentMap`, `updateContentBlock`, `getAdminByUsername`, `extractDenunciaFields`.

#### `netlify/functions/_mail.js` (3 589 B) — módulo compartido

- No es una función HTTP directa.
- Exporta: `sendEstatusEmail(correo, folio, estatus)`.

### 6.3 Redirects en netlify.toml (CONFIRMADO)

```
/api/send-email       → /.netlify/functions/send-email
/api/admin/*          → /.netlify/functions/admin/api/admin/:splat
/api/content          → /.netlify/functions/admin/api/content
/api/folios/*         → /.netlify/functions/admin/api/folios/:splat
/*                    → /index.html  (SPA fallback)
```

---

## 7. Autenticación

### 7.1 Cómo funciona actualmente

**CONFIRMADO: Autenticación propia con bcryptjs + JWT en cookie HttpOnly. No usa Supabase Auth.**

Flujo completo:

1. `POST /api/admin/login` recibe `{ username, password }`.
2. El servidor busca el usuario en la tabla `admins` de PostgreSQL por `username`.
3. Compara la contraseña con `bcrypt.compareSync(password, password_hash)` (salt rounds: 10).
4. Si es válido, firma un JWT con payload `{ username }` y `JWT_SECRET` (TTL: 12 horas).
5. Setea la cookie `admin_token` (`HttpOnly: true`, `SameSite: lax`, `Secure: true` solo en producción, `Max-Age: 43200`).
6. El cliente React guarda el estado de usuario en `AuthContext.tsx`.

Middleware de protección (`requireAuth`):
- Lee la cookie `admin_token`.
- Verifica con `jwt.verify(token, JWT_SECRET)`.
- Si válido: adjunta `{ username }` a `req.admin` y continúa.
- Si inválido/expirado: devuelve `401`.

Guard de rutas React:
- `RequireAuth.tsx` consulta `GET /api/admin/me` al montar.
- Si no hay sesión válida, redirige a `/admin/login`.

Seed del admin por defecto:
- `ensureSeed()` en `src/server/db.ts` crea el usuario por defecto la primera vez.
- ⚠️ Las credenciales por defecto están hardcodeadas en `src/server/db.ts`. Moverlas a variables de entorno antes de producción.
- ⚠️ El README documenta credenciales incorrectas — está desactualizado.
- `ensureSeed()` solo existe en Express (`db.ts`). En Netlify (`_data.js`) no hay seed automático.

### 7.2 Dependencias con Supabase

La autenticación solo depende de Supabase de forma **indirecta**:

- La tabla `admins` vive en PostgreSQL (Supabase).
- Para verificar credenciales se consulta `admins` vía `@supabase/supabase-js`.
- El sistema **NO usa** Supabase Auth, JWT de Supabase, ni ninguna feature de auth del SDK.

Al migrar a Neon:
- Solo cambia la fuente de datos de la tabla `admins`.
- El sistema JWT, bcrypt y la lógica de sesión permanecen **exactamente iguales**.

### 7.3 Riesgos de migración

| Riesgo | Severidad | Descripción |
|--------|-----------|-------------|
| Credenciales hardcodeadas en `src/server/db.ts` | 🔴 ALTA | El usuario admin por defecto tiene usuario y contraseña embebidos en código. Mover a variables de entorno `ADMIN_DEFAULT_USER` y `ADMIN_DEFAULT_PASS`, o eliminar el seed automático y crear el usuario manualmente. |
| Fallback inseguro de `JWT_SECRET` | 🔴 ALTA | `src/server/auth.ts` y `netlify/functions/admin.js` tienen fallback `'dev-secret-arh-change-me'`. Si `JWT_SECRET` no se define en producción, los tokens son predecibles. Hacer la variable obligatoria (lanzar error si falta). |
| `PUT /api/admin/password` ausente en Netlify | 🟠 MEDIA | La ruta de cambio de contraseña no funciona en producción Netlify. El admin no puede cambiar su contraseña desde el panel en producción. Debe implementarse en `admin.js`. |
| `ensureSeed()` ausente en Netlify | 🟠 MEDIA | En Netlify no hay seed automático. Si la base de datos Neon está vacía, no habrá usuario admin. Hay que crear el primer admin manualmente o agregar seed en `_data.js`. |
| README desactualizado | 🟡 BAJA | Documentación incorrecta sobre credenciales por defecto. Actualizar después de la migración. |

---

## 8. Email

### 8.1 Implementación actual

**CONFIRMADO: Librería `nodemailer` v8, proveedor Gmail SMTP, autenticación con usuario + app password.**

Dos transporters independientes según entorno:
- **Express:** singleton creado al arrancar `server.ts`.
- **Netlify:** creado en cada invocación de función (sin estado entre llamadas).

Tres tipos de email enviados:

**1. Notificación al comité** (siempre)
- Disparado por: `POST /api/send-email`
- Destino: `to` del body (email del comité configurado en el Wizard)
- Asunto: `[{folio}] {subject_del_formulario}`
- Contenido: HTML del formulario + adjuntos de evidencias

**2. Confirmación al denunciante** (si proporcionó email)
- Disparado por: `POST /api/send-email`
- Destino: `denuncianteEmail` del body
- Asunto: `Confirmación de denuncia recibida - Folio {folio}`
- Contenido: HTML con el folio de seguimiento

**3. Actualización de estatus** (si el admin cambia el estatus y hay correo)
- Disparado por: `PATCH /api/admin/folios/:folio`
- Destino: `denunciante_correo` de la BD
- Asunto: `Actualización de tu denuncia - Folio {folio}`
- Contenido: HTML con el nuevo estatus
- Comportamiento: best-effort — si falla no interrumpe la operación. La respuesta incluye `notificado: boolean`.

El módulo `_mail.js` en Netlify Functions encapsula `sendEstatusEmail()` para el caso 3.

### 8.2 Variables requeridas

```
EMAIL_USER   # Gmail que envía los correos
EMAIL_PASS   # App Password de Gmail (no la contraseña normal)
```

> El sistema de email es **completamente independiente de Supabase**. No requiere cambios al migrar la base de datos.

---

## 9. Variables de Entorno Requeridas

> ⚠️ NUNCA incluir valores reales en este documento ni en el repositorio.

### Variables actuales (CONFIRMADO desde `.env.example`)

| Variable | Usada en | Descripción |
|----------|---------|-------------|
| `EMAIL_USER` | `server.ts`, `netlify/functions/send-email.js`, `netlify/functions/_mail.js` | Cuenta Gmail para enviar correos |
| `EMAIL_PASS` | `server.ts`, `netlify/functions/send-email.js`, `netlify/functions/_mail.js` | App Password de Gmail |
| `SUPABASE_URL` | `src/server/supabase.ts`, `netlify/functions/_data.js` | URL del proyecto Supabase (a reemplazar por Neon) |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/server/supabase.ts`, `netlify/functions/_data.js` | Service role key de Supabase (a reemplazar) |
| `JWT_SECRET` | `src/server/auth.ts`, `netlify/functions/admin.js` | Secreto para firmar/verificar JWT de sesiones admin |

### Variable opcional

| Variable | Usada en | Descripción |
|----------|---------|-------------|
| `NODE_ENV` | `server.ts`, `netlify/functions/admin.js` | `production` activa flag `Secure` en la cookie JWT y sirve estáticos |

### Variables nuevas necesarias para la migración a Neon + R2

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Connection string de Neon PostgreSQL (reemplaza `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) |
| `R2_ACCOUNT_ID` | ID de cuenta Cloudflare R2 (si se implementa storage de evidencias) |
| `R2_ACCESS_KEY_ID` | Access key de R2 (si se implementa storage) |
| `R2_SECRET_ACCESS_KEY` | Secret key de R2 (si se implementa storage) |
| `R2_BUCKET_NAME` | Nombre del bucket R2 (si se implementa storage) |

---

## 10. Riesgos de Migración

> Ordenados por severidad decreciente.

### 🔴 CRÍTICO

| # | Riesgo | Archivo(s) | Mitigación |
|---|--------|-----------|------------|
| R01 | Pérdida de datos en migración si se ejecuta en producción sin backup previo | Base de datos Supabase | Hacer dump completo de PostgreSQL antes de cualquier cambio |
| R02 | Credenciales admin hardcodeadas en código fuente | `src/server/db.ts` | Mover a variables de entorno o eliminar el seed automático; cambiar credenciales antes de producción |
| R03 | `JWT_SECRET` con fallback inseguro en producción | `src/server/auth.ts`, `netlify/functions/admin.js` | Hacer la variable obligatoria; lanzar error de inicio si no está definida |
| R04 | Archivos de evidencias irrecuperables | Arquitectura actual | Las evidencias solo existen en el correo del comité; si se pierde el correo, los archivos son irrecuperables. Implementar storage (R2) es recomendable pero requiere cambios de arquitectura. |

### 🟠 ALTA

| # | Riesgo | Archivo(s) | Mitigación |
|---|--------|-----------|------------|
| R05 | `PUT /api/admin/password` no existe en Netlify Functions (producción) | `netlify/functions/admin.js` | Implementar la ruta antes o durante la migración |
| R06 | Seed automático de admin ausente en Netlify | `netlify/functions/_data.js` | Documentar proceso manual de creación de admin en Neon, o agregar seed en `_data.js` |
| R07 | Folio generado con `Math.random()` en Netlify (no criptográfico) | `netlify/functions/send-email.js` | Reemplazar por `crypto.randomBytes()` al igual que en Express |
| R08 | `better-sqlite3` en `package.json` raíz — dependencia residual | `package.json` | Eliminar la dependencia si no se usa; puede causar problemas de build en entornos Linux |
| R09 | Logos del CMS como base64 en Postgres | `content_blocks.value` | Los datos de la columna `value` pueden ser grandes; migrarlos a R2 u otro storage es recomendable a largo plazo |

### 🟡 MEDIA

| # | Riesgo | Archivo(s) | Mitigación |
|---|--------|-----------|------------|
| R10 | `POST /api/send-email` sin autenticación ni rate limiting | `server.ts`, `netlify/functions/send-email.js` | Agregar rate limiting o token de envío antes de producción |
| R11 | Sin validación de tipo/tamaño en archivos adjuntos del Wizard | `src/components/Wizard.tsx`, `server.ts` | Agregar `accept` al input, validar MIME y tamaño en cliente y servidor |
| R12 | Nombre de archivo sin sanitizar pasado a nodemailer | `server.ts`, `netlify/functions/send-email.js` | Sanitizar `filename` antes de pasar a nodemailer |
| R13 | `updated_at` sin trigger automático | `supabase/schema.sql` | Al migrar a Neon, crear trigger `BEFORE UPDATE` para mantener consistencia automática |
| R14 | `payload_json` como `text` en lugar de `jsonb` | `supabase/schema.sql` | Al migrar, cambiar a `jsonb` para beneficiar de índices y consultas JSON nativas |
| R15 | Sin CHECK constraint en `denuncias.estatus` | `supabase/schema.sql` | Agregar constraint en el nuevo schema para garantizar integridad |
| R16 | README desactualizado (credenciales por defecto incorrectas) | `README.md` | Actualizar documentación después de la migración |

### 🟢 BAJO RIESGO (confirmados como bien implementados)

- RLS correctamente configurado en deny-all para anon.
- `SUPABASE_SERVICE_ROLE_KEY` nunca expuesta al cliente.
- Supabase Auth no usada (facilita migración — no hay sesiones de Supabase que invalidar).
- Sin Storage de Supabase (no hay buckets que migrar).
- Sin RPC ni Triggers (no hay lógica de BD que portar).
- Sin Foreign Keys (migración de datos directa, sin dependencias de orden).
- Frontend completamente desacoplado de Supabase.

---

## 11. Arquitectura Propuesta: Neon + R2

### Diagrama ASCII

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (React SPA)                            │
│           Sin cambios — sigue siendo el mismo frontend                  │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │ HTTP (fetch + credentials: include)
               ┌──────────┴──────────┐
               │                     │
    ┌──────────▼──────────┐  ┌───────▼───────────────────────┐
    │  DESARROLLO LOCAL    │  │         PRODUCCIÓN            │
    │  server.ts (Express) │  │      Netlify Functions        │
    │  src/server/         │  │      netlify/functions/       │
    │  (sin cambios        │  │      (sin cambios             │
    │   de superficie)     │  │       de superficie)          │
    └──────────┬───────────┘  └───────────────┬───────────────┘
               │                              │
               │    pg / postgres driver       │
               └──────────────┬───────────────┘
                              │
              ┌───────────────▼───────────────────┐
              │           NEON                     │
              │    PostgreSQL (serverless)          │
              │    3 tablas (mismo schema)          │
              │    + trigger updated_at             │
              │    + jsonb en payload_json          │
              │    + CHECK en estatus               │
              │    Connection pooling (Neon proxy)  │
              └───────────────────────────────────┘

              ┌────────────────────────────────────┐
              │       CLOUDFLARE R2 (nuevo)         │  ← OPCIONAL / FASE FUTURA
              │    Bucket: evidencias/              │
              │    Bucket: logos-cms/               │
              │    Acceso: presigned URLs (server)  │
              │    Reemplaza base64 en email y BD   │
              └────────────────────────────────────┘

              ┌────────────────────────────────────┐
              │       EMAIL (sin cambios)           │
              │    Gmail SMTP vía nodemailer        │
              │    EMAIL_USER + EMAIL_PASS          │
              └────────────────────────────────────┘
```

### Descripción de la arquitectura propuesta

**Neon PostgreSQL** reemplaza a Supabase como motor de base de datos:
- Mismo motor (PostgreSQL), mismo esquema de tablas.
- El cliente `@supabase/supabase-js` se reemplaza por un driver PostgreSQL directo (`pg` o `postgres`).
- Neon ofrece serverless connection pooling compatible con Netlify Functions (conexiones efímeras).
- Las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` se reemplazan por `DATABASE_URL`.

**Cloudflare R2** (opcional, recomendado para evidencias):
- Almacenamiento de objetos compatible con S3.
- Reemplaza el sistema actual de adjuntos por email y logos en base64.
- Las evidencias se subirían desde el servidor (no desde el cliente) antes de enviar el email.
- Las URLs firmadas permitirían al admin ver evidencias desde el panel.

**Sin cambios:**
- Sistema de autenticación (JWT + bcrypt).
- Sistema de email (nodemailer + Gmail).
- Frontend React completo.
- Estructura de rutas API.
- Netlify como plataforma de despliegue.

---

## 12. Plan de Migración por Fases

### FASE 0 — Preparación y backup

- [ ] Hacer dump completo de la base de datos Supabase (`pg_dump` o exportación desde el dashboard).
- [ ] Documentar todas las variables de entorno actuales (sin valores).
- [ ] Crear rama de Git `migration/neon` para el trabajo de migración.
- [ ] Congelar deploys a producción durante la migración crítica.
- [ ] Verificar credenciales hardcodeadas y decidir estrategia de manejo.

### FASE 1 — Provisionar Neon

- [ ] Crear proyecto en Neon (neon.tech).
- [ ] Obtener `DATABASE_URL` (connection string con pooling).
- [ ] Anotar la URL en el gestor de secretos (sin subirla al repositorio).

### FASE 2 — Migrar schema a Neon

- [ ] Crear nuevo archivo `neon/schema.sql` basado en `supabase/schema.sql`.
- [ ] Agregar trigger `BEFORE UPDATE` para `updated_at` en `denuncias` y `content_blocks`.
- [ ] Cambiar `payload_json text` a `payload_json jsonb` en `denuncias`.
- [ ] Agregar `CHECK (estatus IN ('recibida', 'en_proceso', 'resuelta', 'cerrada'))` en `denuncias` (REQUIERE VERIFICACIÓN de valores válidos en código).
- [ ] Crear los 2 índices: `idx_denuncias_estatus` e `idx_denuncias_created_at`.
- [ ] Ejecutar el schema en el proyecto Neon.
- [ ] Verificar que las 3 tablas se crearon correctamente.
- [ ] **NO habilitar RLS** en Neon (no aplica fuera de Supabase; la seguridad la maneja el servidor).

### FASE 3 — Migrar datos

- [ ] Exportar datos de Supabase como CSV o INSERT statements.
- [ ] Importar datos a Neon.
- [ ] Verificar conteo de filas en cada tabla.
- [ ] Verificar integridad de los datos semilla en `content_blocks`.

### FASE 4 — Reemplazar cliente Supabase en Express (src/server/)

- [ ] Instalar driver PostgreSQL: `npm install postgres` o `npm install pg @types/pg`.
- [ ] Reescribir `src/server/supabase.ts` → `src/server/db-client.ts` con el nuevo driver.
- [ ] Reescribir `src/server/db.ts` traduciendo todas las queries del SDK de Supabase a SQL directo.
- [ ] Mantener la misma interfaz de funciones exportadas (mismos nombres, mismos parámetros).
- [ ] Actualizar `src/server/routes.ts` y `server.ts` si hay imports directos.
- [ ] Eliminar `@supabase/supabase-js` de `package.json` raíz una vez migrado.
- [ ] Eliminar `better-sqlite3` de `package.json` raíz (dependencia residual).

### FASE 5 — Reemplazar cliente Supabase en Netlify Functions

- [ ] Instalar driver PostgreSQL en `netlify/functions/package.json`.
- [ ] Reescribir `netlify/functions/_data.js` usando el nuevo driver, manteniendo las mismas exportaciones.
- [ ] Actualizar `netlify/functions/package.json` — agregar `pg` o `postgres`, eliminar `@supabase/supabase-js`.
- [ ] Verificar compatibilidad del driver con el bundler esbuild de Netlify.

### FASE 6 — Actualizar variables de entorno

- [ ] Agregar `DATABASE_URL` a `.env.local`.
- [ ] Agregar `DATABASE_URL` a las variables de entorno de Netlify (dashboard).
- [ ] Mantener temporalmente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` hasta confirmar que no se usan.
- [ ] Actualizar `.env.example` con las nuevas variables (sin valores).
- [ ] Eliminar las variables de Supabase una vez migrado.

### FASE 7 — Pruebas en desarrollo local

- [ ] Arrancar el servidor Express con `npm run dev`.
- [ ] Probar login admin.
- [ ] Probar listado de folios.
- [ ] Probar envío de denuncia (POST /api/send-email).
- [ ] Probar tracking de folio público.
- [ ] Probar edición de contenido CMS.
- [ ] Probar cambio de contraseña (PUT /api/admin/password).
- [ ] Verificar que `updated_at` se actualiza correctamente vía trigger.

### FASE 8 — Corregir bugs conocidos (durante o después de migración)

- [ ] Implementar `PUT /api/admin/password` en `netlify/functions/admin.js`.
- [ ] Reemplazar `Math.random()` por `crypto.randomBytes()` en `netlify/functions/send-email.js`.
- [ ] Hacer obligatoria la variable `JWT_SECRET` (lanzar error si no está definida).
- [ ] Mover credenciales del admin por defecto de `src/server/db.ts` a variables de entorno.
- [ ] Agregar seed del admin en Netlify (`netlify/functions/_data.js`) o documentar proceso manual.

### FASE 9 — Deploy de prueba en Netlify

- [ ] Hacer deploy a un entorno de staging en Netlify.
- [ ] Verificar que todas las variables de entorno están configuradas en Netlify.
- [ ] Probar todas las rutas API desde el entorno de staging.
- [ ] Probar el flujo completo de denuncia end-to-end.
- [ ] Verificar que los emails se envían correctamente.

### FASE 10 — Cutover a producción

- [ ] Con la base de datos Supabase en modo lectura (o simplemente deteniendo nuevas escrituras durante el cutover):
  - [ ] Hacer dump final de datos de Supabase.
  - [ ] Importar datos incrementales a Neon.
  - [ ] Hacer deploy de producción en Netlify con las nuevas variables `DATABASE_URL`.
- [ ] Verificar que la aplicación de producción funciona con Neon.
- [ ] Monitorear logs de Netlify durante las primeras 24 horas.

### FASE 11 — Depreciación de Supabase

- [ ] Verificar que no hay tráfico hacia Supabase (revisar logs del proyecto Supabase).
- [ ] Eliminar variables de entorno de Supabase en Netlify.
- [ ] Pausar o eliminar el proyecto de Supabase (después del período de retención de datos).
- [ ] Actualizar `README.md` con la nueva arquitectura y credenciales de acceso correctas.

### FASE 12 — Implementar Cloudflare R2 (OPCIONAL — Storage de evidencias)

- [ ] Crear bucket R2 en Cloudflare.
- [ ] Agregar variables `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.
- [ ] Agregar columna `evidencias_keys` (jsonb) a la tabla `denuncias` en Neon.
- [ ] Modificar `src/server/db.ts` y `netlify/functions/_data.js` para subir archivos a R2 antes de enviar el email.
- [ ] Modificar `server.ts` y `netlify/functions/send-email.js` para el nuevo flujo.
- [ ] Agregar endpoint de descarga de evidencias con URLs firmadas (protegido con `requireAuth`).
- [ ] Actualizar `src/admin/pages/FoliosPage.tsx` para mostrar evidencias desde el panel admin.

### FASE 13 — Hardening de seguridad (RECOMENDADO post-migración)

- [ ] Agregar validación de tipo MIME y tamaño en `src/components/Wizard.tsx`.
- [ ] Agregar rate limiting a `POST /api/send-email`.
- [ ] Sanitizar nombres de archivo antes de pasarlos a nodemailer.
- [ ] Evaluar mover logos del CMS de base64 en BD a R2.
- [ ] Revisar y actualizar `README.md` completamente.

---

## 13. Plan de Rollback

### Condición de activación

Activar rollback si, después del cutover a producción (FASE 10):
- Las rutas API devuelven errores 500 de forma sistemática.
- Los emails no se envían.
- Los datos muestran inconsistencias.
- El panel admin no funciona.

### Procedimiento de rollback

1. **Inmediato (< 5 minutos):** En el dashboard de Netlify, revertir el deploy al último build exitoso anterior a la migración.
2. **Variables de entorno:** Restaurar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en las variables de entorno de Netlify.
3. **Verificación:** Comprobar que el sistema funciona con Supabase nuevamente.
4. **Análisis:** Identificar la causa raíz del fallo antes de intentar el cutover nuevamente.

### Prerequisito de rollback

- El proyecto de Supabase debe mantenerse activo (no pausado) durante todo el período de prueba post-migración.
- El dump de datos realizado en FASE 0 y FASE 10 permite restaurar el estado de la base de datos si fuera necesario.
- No eliminar el proyecto de Supabase hasta al menos 30 días después de confirmar que la migración es exitosa (FASE 11).

---

## 14. Archivos a Modificar

> Lista exacta de archivos del proyecto que requieren cambios durante la migración.

| Archivo | Razón del cambio | Fase |
|---------|-----------------|------|
| `src/server/supabase.ts` | Reemplazar `createClient` de Supabase por inicialización del cliente PostgreSQL (pg/postgres) | FASE 4 |
| `src/server/db.ts` | Traducir todas las queries del SDK de Supabase a SQL directo. Mover credenciales hardcodeadas del admin a env vars. | FASE 4, FASE 8 |
| `src/server/auth.ts` | Hacer `JWT_SECRET` obligatorio (eliminar fallback inseguro) | FASE 8 |
| `netlify/functions/_data.js` | Reemplazar cliente Supabase por driver PostgreSQL. Agregar seed del admin. | FASE 5, FASE 8 |
| `netlify/functions/admin.js` | Implementar `PUT /api/admin/password`. Hacer `JWT_SECRET` obligatorio (eliminar fallback inseguro). | FASE 5, FASE 8 |
| `netlify/functions/send-email.js` | Reemplazar `Math.random()` por `crypto.randomBytes()` para generación de folios. | FASE 8 |
| `netlify/functions/package.json` | Agregar driver PostgreSQL (`pg` o `postgres`). Eliminar `@supabase/supabase-js`. | FASE 5 |
| `package.json` (raíz) | Eliminar `@supabase/supabase-js` y `better-sqlite3` (residual). Agregar driver PostgreSQL. | FASE 4 |
| `.env.example` | Reemplazar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` por `DATABASE_URL`. Agregar variables de R2 si aplica. | FASE 6 |
| `README.md` | Actualizar arquitectura, credenciales por defecto (correctas), variables de entorno, proceso de setup | FASE 11 |
| `src/components/Wizard.tsx` | Agregar validación de tipo MIME y tamaño en el input de archivos (FASE 13, hardening) | FASE 13 |
| `server.ts` | Reducir `express.json({ limit: '50mb' })` a un límite razonable (FASE 13) | FASE 13 |

---

## 15. Archivos Nuevos a Crear

> Lista exacta de archivos que deben crearse como parte de la migración.

| Archivo | Propósito | Fase |
|---------|-----------|------|
| `neon/schema.sql` | Schema SQL adaptado para Neon: mismo esquema que `supabase/schema.sql` pero con trigger `updated_at`, `jsonb` en `payload_json`, CHECK constraint en `estatus`, sin directivas RLS específicas de Supabase | FASE 2 |
| `neon/seed.sql` | Script de datos semilla para Neon: `content_blocks` iniciales, datos de admin por defecto (REQUIERE VERIFICACIÓN del formato de hash) | FASE 2 |
| `neon/migrate.sql` | Script de migración incremental si se necesita alterar el schema con datos existentes (columna `payload_json text` → `jsonb`) | FASE 2–3 |
| `src/server/db-client.ts` | Módulo de cliente PostgreSQL para Express que reemplaza `src/server/supabase.ts` | FASE 4 |
| `.env.example` (actualizado) | Ya existe — se modifica, no se crea | FASE 6 |

### Archivos nuevos opcionales (FASE 12 — R2 Storage)

| Archivo | Propósito |
|---------|-----------|
| `src/server/storage.ts` | Módulo de cliente Cloudflare R2 para Express (operaciones upload/presigned URL) |
| `netlify/functions/_storage.js` | Equivalente CommonJS de `storage.ts` para Netlify Functions |

---

## 16. Qué NO debe tocarse

> Lista de archivos y sistemas que deben quedar intactos durante la migración.

### Frontend — NO modificar

- `src/App.tsx` — enrutamiento React sin dependencias de Supabase
- `src/main.tsx` — entry point React
- `src/index.css` — estilos globales
- `src/admin/AdminLayout.tsx` — layout admin
- `src/admin/AuthContext.tsx` — contexto de autenticación (usa cookies JWT propias, no Supabase)
- `src/admin/RequireAuth.tsx` — guard de rutas
- `src/admin/pages/LoginPage.tsx` — página de login
- `src/admin/pages/ChangePasswordPage.tsx` — página de cambio de contraseña
- `src/admin/pages/ContenidoPage.tsx` — CMS (excepto si se implementa R2 en FASE 12)
- `src/admin/pages/FoliosPage.tsx` — gestión de folios (excepto si se implementa R2 en FASE 12)
- `src/components/AccesibilidadPanel.tsx`
- `src/components/TrackingSearch.tsx`
- `src/components/Tracking.tsx`
- `src/components/shared/Button.tsx`
- `src/types/admin.ts`

### Backend — NO modificar (lógica de negocio)

- `src/server/mail.ts` — envío de emails con nodemailer (completamente independiente de Supabase)
- `src/server/routes.ts` — definición de rutas API (solo cambia la capa de datos que llama)
- `netlify/functions/_mail.js` — helper de email para Netlify

### Infraestructura — NO modificar

- `netlify.toml` — configuración de build y redirects (no depende de Supabase)
- `vite.config.ts` — configuración del bundler frontend
- `tsconfig.json` — configuración TypeScript
- `index.html` — entry point HTML
- `public/` — assets estáticos (`favicon.png`, `logo-arh.png`)

### Archivos informativos — NO modificar (hasta FASE 11)

- `ADMIN_API_CONTRACT.md` — documentación del API (actualizar en FASE 11 si cambia algo)
- `supabase/schema.sql` — mantener como referencia histórica; crear nuevo en `neon/`

---

## 17. Checklist de Migración

### FASE 0 — Preparación

- [ ] Dump completo de base de datos Supabase exportado y guardado de forma segura
- [ ] Inventario de variables de entorno documentado (solo nombres)
- [ ] Rama `migration/neon` creada en Git
- [ ] Deploys a producción congelados
- [ ] Credenciales hardcodeadas en `src/server/db.ts` identificadas y plan definido

### FASE 1 — Provisionar Neon

- [ ] Proyecto Neon creado en neon.tech
- [ ] `DATABASE_URL` obtenida (con connection pooling activado)
- [ ] `DATABASE_URL` guardada de forma segura (fuera del repositorio)

### FASE 2 — Schema en Neon

- [ ] Archivo `neon/schema.sql` creado
- [ ] Trigger `BEFORE UPDATE` para `updated_at` incluido
- [ ] `payload_json jsonb` (en lugar de `text`) incluido
- [ ] CHECK constraint en `denuncias.estatus` incluido (REQUIERE VERIFICACIÓN de valores válidos)
- [ ] Índices `idx_denuncias_estatus` e `idx_denuncias_created_at` incluidos
- [ ] Schema ejecutado en Neon
- [ ] Las 3 tablas verificadas en Neon
- [ ] Datos semilla de `content_blocks` verificados (8 registros)

### FASE 3 — Migración de datos

- [ ] Datos exportados de Supabase (CSV o INSERT)
- [ ] Datos importados a Neon
- [ ] Conteo de filas verificado en cada tabla (`admins`, `denuncias`, `content_blocks`)
- [ ] Integridad de `payload_json` verificada tras conversión a `jsonb`

### FASE 4 — Cliente PostgreSQL en Express

- [ ] Driver PostgreSQL instalado en `package.json` raíz
- [ ] `src/server/db-client.ts` creado (reemplaza `supabase.ts`)
- [ ] `src/server/db.ts` reescrito con SQL directo
- [ ] Misma interfaz de funciones exportadas verificada
- [ ] `@supabase/supabase-js` eliminado de `package.json` raíz
- [ ] `better-sqlite3` eliminado de `package.json` raíz
- [ ] `npm install` ejecutado sin errores

### FASE 5 — Cliente PostgreSQL en Netlify Functions

- [ ] Driver PostgreSQL instalado en `netlify/functions/package.json`
- [ ] `netlify/functions/_data.js` reescrito
- [ ] Mismas exportaciones verificadas (`insertDenuncia`, `listDenuncias`, etc.)
- [ ] `@supabase/supabase-js` eliminado de `netlify/functions/package.json`
- [ ] Compatibilidad con bundler esbuild verificada

### FASE 6 — Variables de entorno

- [ ] `DATABASE_URL` agregada a `.env.local`
- [ ] `DATABASE_URL` agregada a las variables de entorno de Netlify
- [ ] `.env.example` actualizado
- [ ] Variables de Supabase marcadas como "pendientes de eliminar" (no eliminar aún)

### FASE 7 — Pruebas locales

- [ ] `npm run dev` arranca sin errores
- [ ] `POST /api/admin/login` funciona
- [ ] `GET /api/admin/me` funciona
- [ ] `GET /api/admin/folios` devuelve datos
- [ ] `GET /api/admin/folios/:folio` devuelve detalle
- [ ] `PATCH /api/admin/folios/:folio` actualiza estatus
- [ ] Email de actualización de estatus enviado correctamente
- [ ] `GET /api/admin/content` devuelve bloques CMS
- [ ] `PUT /api/admin/content/:block_key` actualiza un bloque
- [ ] `GET /api/content` devuelve mapa CMS público
- [ ] `GET /api/folios/:folio/status` devuelve tracking
- [ ] `POST /api/send-email` crea denuncia, envía email y devuelve folio
- [ ] `updated_at` se actualiza automáticamente vía trigger
- [ ] `PUT /api/admin/password` funciona en Express

### FASE 8 — Corregir bugs conocidos

- [ ] `PUT /api/admin/password` implementada en `netlify/functions/admin.js`
- [ ] `Math.random()` reemplazado por `crypto.randomBytes()` en `netlify/functions/send-email.js`
- [ ] `JWT_SECRET` obligatorio (sin fallback inseguro) en `src/server/auth.ts`
- [ ] `JWT_SECRET` obligatorio (sin fallback inseguro) en `netlify/functions/admin.js`
- [ ] Credenciales del admin por defecto movidas fuera de `src/server/db.ts`

### FASE 9 — Deploy en staging

- [ ] Deploy en entorno de staging de Netlify exitoso
- [ ] Todas las variables de entorno configuradas en Netlify
- [ ] Flujo completo de denuncia probado en staging
- [ ] Panel admin probado en staging
- [ ] Emails recibidos correctamente en staging
- [ ] Logs de Netlify Functions sin errores

### FASE 10 — Cutover a producción

- [ ] Ventana de mantenimiento comunicada (si aplica)
- [ ] Dump final de datos de Supabase
- [ ] Datos incrementales importados a Neon
- [ ] Deploy de producción en Netlify con nuevas variables
- [ ] Aplicación de producción funciona con Neon
- [ ] Primeras 24 horas de monitoreo completadas

### FASE 11 — Depreciación de Supabase

- [ ] Sin tráfico hacia Supabase confirmado (logs revisados)
- [ ] Variables de entorno de Supabase eliminadas de Netlify
- [ ] Proyecto de Supabase pausado (NO eliminar hasta 30 días)
- [ ] `README.md` actualizado completamente
- [ ] `ADMIN_API_CONTRACT.md` revisado y actualizado si es necesario

### FASE 12 — R2 Storage (OPCIONAL)

- [ ] Bucket R2 creado en Cloudflare
- [ ] Variables R2 configuradas
- [ ] Columna `evidencias_keys jsonb` agregada a `denuncias`
- [ ] `src/server/storage.ts` y `netlify/functions/_storage.js` creados
- [ ] Flujo de subida de evidencias implementado
- [ ] Visualización de evidencias en panel admin implementada
- [ ] Logos del CMS migrados de base64 a R2

### FASE 13 — Hardening (RECOMENDADO)

- [ ] Validación de tipo MIME y tamaño en `src/components/Wizard.tsx`
- [ ] Rate limiting en `POST /api/send-email`
- [ ] Sanitización de nombres de archivo antes de nodemailer
- [ ] Límite del body JSON reducido en `server.ts` (de 50 MB a un valor razonable)
- [ ] Evaluación de logos del CMS en R2 completada
- [ ] Proyecto de Supabase eliminado definitivamente (solo si FASE 11 completada hace > 30 días)

---

*Documento generado a partir de auditorías automatizadas de los 5 sub-agentes. Última actualización: 2026-09-26.*
