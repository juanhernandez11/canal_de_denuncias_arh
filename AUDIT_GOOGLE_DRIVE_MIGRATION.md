# AUDIT: Migración de Storage — Cloudflare R2 → Google Drive
## Proyecto: Canal de Denuncias ARH
**Fecha de auditoría:** 2026-09-27  
**Auditor:** Senior Full-Stack Engineer  
**Estado del proyecto:** En producción (Netlify). Migración de storage en planificación.

---

## Tabla de contenidos

1. [Stack tecnológico](#1-stack-tecnológico)
2. [Arquitectura actual](#2-arquitectura-actual)
3. [Netlify Functions — inventario completo](#3-netlify-functions--inventario-completo)
4. [Configuración netlify.toml](#4-configuración-netlifytoml)
5. [Base de datos Neon PostgreSQL — esquema](#5-base-de-datos-neon-postgresql--esquema)
6. [Estado de Supabase](#6-estado-de-supabase)
7. [Variables de entorno actuales](#7-variables-de-entorno-actuales)
8. [Módulo de storage actual — Cloudflare R2](#8-módulo-de-storage-actual--cloudflare-r2)
9. [Google Cloud — configuración existente](#9-google-cloud--configuración-existente)
10. [Plan de migración: R2 → Google Drive](#10-plan-de-migración-r2--google-drive)
11. [Archivos a modificar](#11-archivos-a-modificar)
12. [Archivos que NO se modifican](#12-archivos-que-no-se-modifican)
13. [Cambios de esquema en base de datos](#13-cambios-de-esquema-en-base-de-datos)
14. [Nuevas variables de entorno requeridas](#14-nuevas-variables-de-entorno-requeridas)
15. [MIME types y restricciones de archivo](#15-mime-types-y-restricciones-de-archivo)
16. [Formato de folio](#16-formato-de-folio)
17. [Riesgos identificados](#17-riesgos-identificados)
18. [Dependencias a agregar](#18-dependencias-a-agregar)

---

## 1. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend framework | Vite 6 + React 19 + TypeScript |
| CSS | Tailwind CSS v4 |
| Router | react-router-dom v7 |
| Backend (desarrollo) | Express (`server.ts`) |
| Backend (producción) | Netlify Functions (`netlify/functions/`) |
| Base de datos | Neon PostgreSQL (`pg` / node-postgres) |
| Storage **actual** | Cloudflare R2 (AWS SDK S3 compatible) — **A MIGRAR** |
| Storage **objetivo** | Google Drive API v3 (googleapis) |
| Autenticación admin | JWT httpOnly cookie (`admin_token`, 12h) |
| Mail | Nodemailer + Gmail SMTP |

---

## 2. Arquitectura actual

```
┌─────────────────────────────────────────────────┐
│                 React SPA (Vite)                │
│         src/ — Tailwind v4, RR-DOM v7           │
└────────────────────┬────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────┐
│              Netlify Edge / CDN                 │
│  netlify.toml redirects /api/* → Functions      │
└──┬──────────┬──────────┬──────────┬─────────────┘
   │          │          │          │
   ▼          ▼          ▼          ▼
admin.js  send-email  upload-file  get-file
   │          │          │          │
   └──────────┴────┬─────┴──────────┘
                   ▼
           _data.js (Neon Pool)
                   │
                   ▼
        ┌──────────────────┐     ┌────────────────────┐
        │  Neon PostgreSQL │     │  Cloudflare R2     │
        │  (pg / Pool)     │     │  (S3-compatible)   │
        └──────────────────┘     └────────────────────┘
                                         ↑
                                   A REEMPLAZAR CON
                                   Google Drive API
```

**Flujo de denuncia:**
1. Usuario llena formulario en la SPA → `POST /api/send-email`
2. `send-email.js` genera folio (`ARH-YYYY-XXXXX`), persiste en Neon, envía email
3. Usuario adjunta archivos → `POST /api/upload-file` (base64)
4. `upload-file.js` valida MIME/tamaño, sube a R2, guarda metadata en `archivos_denuncia`
5. Admin accede a `/admin/login` → recibe JWT cookie
6. Admin solicita archivo → `GET /api/get-file` → `get-file.js` genera signed URL R2 (5 min)

---

## 3. Netlify Functions — inventario completo

### 3.1 `admin.js`
- **Propósito:** Panel de administración + CMS + tracking público
- **Rutas manejadas:**
  - `/api/admin/*` — gestión admin (login, folios, cambio de contraseña)
  - `/api/content` — bloques de contenido CMS
  - `/api/folios/*/status` — estado público de un folio
  - `/api/files` — listado de archivos de una denuncia
- **Auth requerida:** Sí (JWT cookie `admin_token`) para rutas admin
- **Modificar en migración:** No

### 3.2 `_data.js`
- **Propósito:** Capa de acceso a datos — Neon PostgreSQL (Pool pg)
- **Funciones exportadas:**
  - `insertDenuncia`
  - `listDenuncias`
  - `getDenuncia`
  - `updateDenuncia`
  - `getFolioStatus`
  - `listContentBlocks`
  - `getContentMap`
  - `updateContentBlock`
  - `getAdminByUsername`
  - `updateAdminPassword`
  - `extractDenunciaFields`
  - `insertArchivoMeta`
  - `getArchivosByFolio`
  - `getArchivo`
- **Modificar en migración:** Solo adiciones (columnas nuevas en `archivos_denuncia`). No se elimina ni rompe nada existente.

### 3.3 `upload-file.js`
- **Propósito:** Recibe archivo en base64, sube a Cloudflare R2, guarda metadata en Neon
- **Auth requerida:** No (accesible por el denunciante)
- **Dependencias actuales:** `@aws-sdk/client-s3`, `_data.js`
- **Modificar en migración:** **Sí** — reemplazar lógica R2 por Google Drive API
- **Notas:**
  - Valida folio con regex `/^ARH-\d{4}-[A-Z0-9]{5}$/`
  - Tamaño máximo: 10 MB
  - Ver sección 15 para MIME types permitidos

### 3.4 `get-file.js`
- **Propósito:** Genera signed URL de Cloudflare R2 (validez: 5 minutos) para descarga de archivos
- **Auth requerida:** Sí (JWT cookie `admin_token`)
- **Dependencias actuales:** `@aws-sdk/client-s3` (GetObjectCommand + getSignedUrl)
- **Modificar en migración:** **Sí** — signed URL de R2 → proxy o webViewLink/webContentLink de Google Drive
- **Notas:**
  - La URL resultante es temporal y de uso único para el admin
  - Con Google Drive: debe ser proxy (la Function sirve el stream) o webContentLink con permisos de lectura del service account

### 3.5 `send-email.js`
- **Propósito:** Genera folio único, envía email de confirmación, persiste denuncia en Neon
- **Folio generado:** `ARH-YYYY-XXXXX` con `crypto.randomBytes` (XXXXX = 5 chars A-Z0-9)
- **Dependencias:** `nodemailer`, `_data.js`, `crypto` (nativo Node)
- **Modificar en migración:** No

### 3.6 `_mail.js`
- **Propósito:** Helper de email
- **Funciones exportadas:** `sendEstatusEmail()` — notifica al denunciante cuando cambia el estatus
- **Modificar en migración:** No

---

## 4. Configuración netlify.toml

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"
```

### Redirects actuales

| Source | Destination | Status |
|--------|-------------|--------|
| `/api/send-email` | `/.netlify/functions/send-email` | 200 |
| `/api/admin/*` | `/.netlify/functions/admin/api/admin/:splat` | 200 |
| `/api/content` | `/.netlify/functions/admin/api/content` | 200 |
| `/api/folios/*` | `/.netlify/functions/admin/api/folios/:splat` | 200 |
| `/api/upload-file` | `/.netlify/functions/upload-file` | 200 |
| `/api/get-file` | `/.netlify/functions/get-file` | 200 |
| `/api/files` | `/.netlify/functions/admin/api/files` | 200 |
| `/*` | `/index.html` | 200 (SPA fallback) |

### Redirects a agregar en migración

| Source | Destination | Propósito |
|--------|-------------|-----------|
| `/api/google-oauth-callback` | `/.netlify/functions/google-oauth-callback` | Recibir authorization code de Google OAuth |

---

## 5. Base de datos Neon PostgreSQL — esquema

### 5.1 Tabla `admins`

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | NOT FOUND | PK |
| `username` | NOT FOUND | UNIQUE |
| `password_hash` | NOT FOUND | — |
| `created_at` | NOT FOUND | — |

### 5.2 Tabla `denuncias`

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | NOT FOUND | PK |
| `folio` | NOT FOUND | UNIQUE |
| `estatus` | NOT FOUND | CHECK IN ('recibida', 'en_revision', 'en_investigacion', 'resuelta', 'desestimada') |
| `tipo` | NOT FOUND | — |
| `empresa` | NOT FOUND | — |
| `centro` | NOT FOUND | — |
| `modo` | NOT FOUND | — |
| `denunciante_nombre` | NOT FOUND | — |
| `denunciante_correo` | NOT FOUND | — |
| `descripcion` | NOT FOUND | — |
| `payload_json` | NOT FOUND | — |
| `notas_admin` | NOT FOUND | — |
| `created_at` | NOT FOUND | — |
| `updated_at` | NOT FOUND | — |

### 5.3 Tabla `content_blocks`

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | NOT FOUND | PK |
| `block_key` | NOT FOUND | UNIQUE |
| `label` | NOT FOUND | — |
| `type` | NOT FOUND | CHECK IN ('text', 'textarea', 'html', 'image_list') |
| `value` | NOT FOUND | — |
| `updated_at` | NOT FOUND | — |

### 5.4 Tabla `archivos_denuncia` (estado actual)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | NOT FOUND | PK |
| `denuncia_folio` | NOT FOUND | FK → `denuncias(folio)` ON DELETE CASCADE |
| `nombre_original` | NOT FOUND | — |
| `nombre_storage` | NOT FOUND | — |
| `mime_type` | NOT FOUND | — |
| `size_bytes` | NOT FOUND | — |
| `r2_key` | NOT FOUND | UNIQUE (actualmente NOT NULL) |
| `created_at` | NOT FOUND | — |

**Índice:** `idx_archivos_denuncia_folio ON archivos_denuncia(denuncia_folio)`

### 5.5 Tabla `archivos_denuncia` (estado objetivo post-migración)

Columnas a agregar (ver sección 13):

| Columna nueva | Tipo sugerido | Nullable | Descripción |
|---------------|---------------|----------|-------------|
| `google_drive_file_id` | TEXT | YES | ID del archivo en Google Drive |
| `google_drive_folder_id` | TEXT | YES | ID de la carpeta en Google Drive |
| `storage_provider` | TEXT | YES | `'r2'` o `'google_drive'` |

---

## 6. Estado de Supabase

> **Supabase ha sido completamente desconectado del proyecto.** No hay dependencia real en producción.

| Ítem | Estado |
|------|--------|
| `src/server/supabase.ts` | STUB vacío. `isSupabaseConfigured()` retorna `false`. `getSupabase()` lanza error. |
| `@supabase/supabase-js` en `package.json` | **NO está instalado** |
| `data/supabase_backup.json` | Backup histórico — 2 denuncias de prueba, 8 content_blocks, 1 admin. Solo referencia. |
| `supabase/schema.sql` | Esquema original de Supabase. Histórico. No se usa en producción. |
| `scripts/migrate-data.ts` | Script de migración ya ejecutado |
| `scripts/run-migration.ts` | Script de migración ya ejecutado |
| Variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Obsoletas (comentadas en `.env.example`) |

---

## 7. Variables de entorno actuales

Archivo de referencia: `.env.example`

```
EMAIL_USER=                 # Gmail para notificaciones (Nodemailer)
EMAIL_PASS=                 # App password de Gmail
DATABASE_URL=               # Neon PostgreSQL connection string (pooled)
DATABASE_URL_UNPOOLED=      # Neon PostgreSQL connection string (unpooled)
JWT_SECRET=                 # Cadena larga y aleatoria — firmar cookies admin_token
R2_ACCOUNT_ID=              # Cloudflare account ID
R2_ACCESS_KEY_ID=           # Cloudflare R2 access key
R2_SECRET_ACCESS_KEY=       # Cloudflare R2 secret key
R2_BUCKET_NAME=             # Nombre del bucket R2

# Obsoletas (comentadas):
# SUPABASE_URL=
# SUPABASE_SERVICE_ROLE_KEY=
```

---

## 8. Módulo de storage actual — Cloudflare R2

### Dependencias
- `@aws-sdk/client-s3` — S3-compatible SDK usado para interactuar con R2
- `@aws-sdk/s3-request-presigner` — para generar signed URLs

### Flujo actual de subida (`upload-file.js`)
1. Recibe body con `{ folio, fileName, mimeType, fileBase64 }`
2. Valida folio: `/^ARH-\d{4}-[A-Z0-9]{5}$/`
3. Valida MIME type contra lista permitida
4. Valida tamaño ≤ 10 MB
5. Decodifica base64 → Buffer
6. Sube a R2 con `PutObjectCommand`
7. Llama `insertArchivoMeta()` en `_data.js` → persiste en `archivos_denuncia`

### Flujo actual de descarga (`get-file.js`)
1. Verifica JWT cookie `admin_token`
2. Recibe query param con ID de archivo
3. Recupera metadata con `getArchivo()` → obtiene `r2_key`
4. Genera presigned URL con `GetObjectCommand` + `getSignedUrl` (ExpiresIn: 300s)
5. Retorna la URL al cliente admin

---

## 9. Google Cloud — configuración existente

| Parámetro | Valor |
|-----------|-------|
| Proyecto GCP | `canal-denuncias-arh` |
| API habilitada | Google Drive API v3 |
| Tipo de credencial | OAuth 2.0 — Aplicación web |
| Scope | `https://www.googleapis.com/auth/drive.file` |
| Estado de la app | Prueba (Testing) |
| Redirect URI planeado | `https://denunciasarhconsultores.netlify.app/.netlify/functions/google-oauth-callback` |

> **Nota:** El scope `drive.file` solo permite acceso a archivos creados o abiertos por la aplicación. No tiene acceso al Drive completo del usuario. Esto es correcto para este caso de uso.

> **Nota sobre estado "Prueba":** Mientras la app esté en estado Testing, los tokens de refresh expiran en 7 días. Se debe publicar la app (o usar una cuenta de servicio) para obtener refresh tokens de larga duración en producción.

---

## 10. Plan de migración: R2 → Google Drive

### Resumen de fases

| Fase | Descripción | Archivos afectados |
|------|-------------|--------------------|
| **Fase 1** | Configurar credenciales OAuth + obtener refresh token | `.env.example`, nueva `google-oauth-callback.js` |
| **Fase 2** | Migrar esquema DB — agregar columnas no destructivas | `database/schema.sql`, `_data.js` |
| **Fase 3** | Implementar `upload-file.js` con Google Drive | `upload-file.js`, `netlify/functions/package.json` |
| **Fase 4** | Implementar `get-file.js` como proxy de Drive | `get-file.js` |
| **Fase 5** | Migración de archivos existentes en R2 | Script ad-hoc (no listado aún) |
| **Fase 6** | Descomisionar R2 (cuando Fase 5 esté completa) | `upload-file.js`, `get-file.js`, `.env.example` |

### Descripción del flujo objetivo (Fases 3 y 4)

**Subida (`upload-file.js` post-migración):**
1. Recibe body con `{ folio, fileName, mimeType, fileBase64 }`
2. Valida folio, MIME type, tamaño (sin cambios)
3. Autentica con Google usando `google.auth.OAuth2` + refresh token desde env var
4. Crea (o reutiliza) carpeta en Drive con nombre del folio
5. Sube el archivo al folder con `drive.files.create`
6. Guarda metadata con `insertArchivoMeta()` incluyendo `google_drive_file_id`, `google_drive_folder_id`, `storage_provider = 'google_drive'`

**Descarga (`get-file.js` post-migración):**
1. Verifica JWT cookie `admin_token` (sin cambios)
2. Recupera metadata con `getArchivo()` → obtiene `google_drive_file_id`
3. Autentica con Google OAuth (refresh token)
4. Obtiene el stream del archivo con `drive.files.get({ alt: 'media' })`
5. Hace pipe del stream como respuesta HTTP (proxy), con `Content-Type` y `Content-Disposition` correctos

### Estrategia de compatibilidad con archivos R2 existentes (Fase 5)

- La columna `r2_key` se mantiene en el esquema (solo se vuelve nullable)
- La columna `storage_provider` indica si el archivo está en `'r2'` o `'google_drive'`
- `get-file.js` post-migración debe verificar `storage_provider` y enrutar al cliente correcto (R2 o Drive) hasta que todos los archivos estén migrados

---

## 11. Archivos a modificar

### `netlify/functions/upload-file.js`
- Eliminar: lógica `@aws-sdk/client-s3` (S3Client, PutObjectCommand)
- Agregar: autenticación OAuth2 con `googleapis`
- Agregar: crear folder en Drive por folio (o reutilizar si existe)
- Agregar: `drive.files.create` con stream del buffer
- Actualizar: llamada a `insertArchivoMeta()` con campos nuevos (`google_drive_file_id`, `google_drive_folder_id`, `storage_provider`)
- Mantener: validación de folio regex, validación MIME, validación tamaño

### `netlify/functions/get-file.js`
- Eliminar: lógica R2 presigned URL
- Agregar: autenticación OAuth2 con `googleapis`
- Agregar: proxy stream de `drive.files.get({ alt: 'media' })`
- Agregar: manejo de `storage_provider` para compatibilidad con archivos R2 legacy
- Mantener: verificación JWT cookie

### `netlify/functions/_data.js`
- **Solo addiciones** (no se rompe nada existente)
- Actualizar: `insertArchivoMeta()` para incluir `google_drive_file_id`, `google_drive_folder_id`, `storage_provider`
- Actualizar: `getArchivo()` para retornar las columnas nuevas
- Posiblemente: `getArchivosByFolio()` para retornar columnas nuevas

### `database/schema.sql`
- Agregar columnas a `archivos_denuncia` (ver sección 13)
- Volver `r2_key` nullable (migración no destructiva)

### `netlify/functions/package.json`
- Agregar: `"googleapis": "^<versión>"` (ver sección 18)

### `.env.example`
- Agregar variables de Google OAuth (ver sección 14)
- Comentar o eliminar variables R2 en Fase 6

### `netlify.toml`
- Agregar redirect: `/api/google-oauth-callback` → `/.netlify/functions/google-oauth-callback`

### `netlify/functions/google-oauth-callback.js` (archivo nuevo)
- Maneja el authorization code de Google
- Intercambia code por tokens (access_token + refresh_token)
- El refresh_token debe almacenarse manualmente en Netlify env vars (no en BD)

---

## 12. Archivos que NO se modifican

| Archivo / Directorio | Razón |
|----------------------|-------|
| `src/` (React frontend) | No hay llamadas directas a R2 desde el cliente |
| `src/server/routes.ts` | Rutas Express (dev only) sin lógica de storage |
| `src/server/auth.ts` | JWT helpers — sin cambios |
| `src/server/mail.ts` | Nodemailer helper — sin cambios |
| `src/server/db.ts` | DB client (dev) — sin cambios |
| `src/server/db-neon.ts` | DB client Neon — sin cambios |
| `src/server/db-client.ts` | DB abstraction — sin cambios |
| `netlify/functions/admin.js` | Sin lógica de storage directa |
| `netlify/functions/send-email.js` | No interactúa con storage |
| `netlify/functions/_mail.js` | Helper de email — sin cambios |
| `vite.config.ts` | Config de build — sin cambios |
| `tsconfig.json` | Config TypeScript — sin cambios |
| `public/` | Assets estáticos — sin cambios |
| `index.html` | Entry HTML — sin cambios |

---

## 13. Cambios de esquema en base de datos

### Migraciones SQL a aplicar en Neon (no destructivas)

```sql
-- 1. Volver r2_key nullable (compatibilidad con archivos Google Drive sin r2_key)
ALTER TABLE archivos_denuncia
  ALTER COLUMN r2_key DROP NOT NULL;

-- 2. Agregar columnas de Google Drive
ALTER TABLE archivos_denuncia
  ADD COLUMN IF NOT EXISTS google_drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'r2';

-- 3. Marcar registros existentes como storage r2
UPDATE archivos_denuncia
  SET storage_provider = 'r2'
  WHERE storage_provider IS NULL;

-- 4. (Opcional) Agregar constraint de validación
ALTER TABLE archivos_denuncia
  ADD CONSTRAINT chk_storage_provider
  CHECK (storage_provider IN ('r2', 'google_drive'));
```

> **IMPORTANTE:** Ejecutar primero en ambiente de staging/preview antes de producción. La restricción `r2_key UNIQUE` se mantiene (solo se elimina NOT NULL), por lo que los registros Drive pueden tener `r2_key = NULL` sin conflicto.

---

## 14. Nuevas variables de entorno requeridas

Variables a agregar en `.env.example` y en Netlify dashboard (Site settings → Environment variables):

```
GOOGLE_CLIENT_ID=           # OAuth 2.0 Client ID (Google Cloud Console)
GOOGLE_CLIENT_SECRET=       # OAuth 2.0 Client Secret (Google Cloud Console)
GOOGLE_REFRESH_TOKEN=       # Refresh token obtenido en Fase 1 (OAuth flow)
GOOGLE_DRIVE_ROOT_FOLDER_ID= # ID de la carpeta raíz en Drive para denuncias (opcional)
```

> **Seguridad:** El `GOOGLE_REFRESH_TOKEN` es equivalente a una contraseña permanente de acceso al Drive. Tratarlo como secreto. Nunca committear al repositorio. Configurar exclusivamente en Netlify env vars.

> **Nota sobre expiración:** Con app en estado "Prueba", el refresh token expira a los 7 días. Publicar la app en Google Cloud Console para tokens de larga duración antes de ir a producción real.

---

## 15. MIME types y restricciones de archivo

### MIME types permitidos en `upload-file.js`

| MIME Type | Descripción |
|-----------|-------------|
| `application/pdf` | PDF |
| `image/jpeg` | JPEG |
| `image/jpg` | JPEG (alias) |
| `image/png` | PNG |
| `image/gif` | GIF |
| `image/webp` | WebP |
| `application/msword` | Word (.doc) |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Word (.docx) |
| `application/vnd.ms-excel` | Excel (.xls) |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Excel (.xlsx) |
| `text/plain` | Texto plano (.txt) |

**Tamaño máximo:** 10 MB

> **Riesgo:** Netlify Functions tiene un límite de body de ~6 MB para requests. Un archivo de 10 MB codificado en base64 produce ~13.3 MB. Ver sección 17, riesgo #6.

---

## 16. Formato de folio

**Patrón:** `ARH-YYYY-XXXXX`

| Componente | Descripción |
|------------|-------------|
| `ARH` | Prefijo fijo |
| `YYYY` | Año de la denuncia (4 dígitos) |
| `XXXXX` | 5 caracteres alfanuméricos uppercase (A-Z, 0-9), generados con `crypto.randomBytes` |

**Regex de validación:** `/^ARH-\d{4}-[A-Z0-9]{5}$/`

> Esta validación está presente en `upload-file.js` y debe mantenerse intacta en la versión migrada.

**Generado en:** `send-email.js` usando `crypto.randomBytes` de Node.js (nativo, sin dependencias externas).

---

## 17. Riesgos identificados

| # | Riesgo | Impacto | Mitigación |
|---|--------|---------|------------|
| 1 | **R2 sigue activo** — archivos existentes no migrados hasta Fase 5 | Medio | `get-file.js` debe manejar ambos providers vía campo `storage_provider` hasta completar Fase 5 |
| 2 | **`r2_key UNIQUE NOT NULL`** — esquema actual no admite filas sin `r2_key` | Alto | Migración no destructiva: `ALTER COLUMN r2_key DROP NOT NULL` antes de desplegar upload-file nuevo |
| 3 | **OAuth callback URI** no configurada en Google Cloud Console | Alto | Agregar `https://denunciasarhconsultores.netlify.app/.netlify/functions/google-oauth-callback` a URIs autorizados antes de ejecutar el flow |
| 4 | **Refresh token en BD** — riesgo de exposición | Alto | Guardar exclusivamente en Netlify env vars (`GOOGLE_REFRESH_TOKEN`). Nunca en base de datos ni en código. |
| 5 | **`get-file.js` devuelve signed URL directa** — con Drive debe ser proxy o URL de Drive | Medio | Implementar proxy en la Function: `drive.files.get({ alt: 'media' })` + pipe del stream. Evaluar si webContentLink es aceptable para el caso de uso. |
| 6 | **Límite de 6 MB en Netlify Functions body** vs **10 MB máximo de archivo** | Alto | Un archivo de 10 MB en base64 genera ~13.3 MB. Considerar: (a) reducir límite a 4 MB para base64, (b) migrar a upload directo a Drive con multipart, (c) usar Netlify Large Media o Background Functions |
| 7 | **Validación de folio** `/^ARH-\d{4}-[A-Z0-9]{5}$/` | Bajo | Mantener la regex intacta en la versión migrada de `upload-file.js`. No modificar el formato de folio. |
| 8 | **App Google en estado "Prueba"** | Medio | Refresh tokens expiran en 7 días. Publicar app antes de producción. Mientras tanto, renovar token manualmente cada 7 días. |

---

## 18. Dependencias a agregar

### `netlify/functions/package.json` (o `package.json` raíz si las functions comparten)

```json
{
  "dependencies": {
    "googleapis": "^144.0.0"
  }
}
```

> Verificar la versión más reciente estable de `googleapis` antes de instalar. Usar versión exacta o rango de patch en producción.

### Dependencias a eliminar (en Fase 6, cuando R2 esté descomisionado)

```
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner
```

> No eliminar hasta que la Fase 5 (migración de archivos R2 existentes) esté completa y verificada.

---

## Apéndice A — Backup de datos históricos (Supabase)

Archivo: `data/supabase_backup.json`

| Entidad | Cantidad |
|---------|----------|
| Denuncias de prueba | 2 |
| Content blocks | 8 |
| Admins | 1 |

> Este backup es solo referencia histórica. No afecta la migración de storage.

---

## Apéndice B — URL de producción

| Servicio | URL |
|----------|-----|
| App en producción | `https://denunciasarhconsultores.netlify.app` |
| Google OAuth callback | `https://denunciasarhconsultores.netlify.app/.netlify/functions/google-oauth-callback` |
| Admin panel | `https://denunciasarhconsultores.netlify.app/admin/login` |

---

*Documento generado el 2026-09-27 como parte de la auditoría previa a la migración de storage de Cloudflare R2 a Google Drive API v3.*
