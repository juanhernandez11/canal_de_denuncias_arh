# Variables de Entorno — Canal de Denuncias ARH

Documentación completa de todas las variables de entorno requeridas por la aplicación.
Última actualización: 2026-09-27.

---

## ⚠️ Reglas de Seguridad Críticas

Antes de cualquier configuración, lee y comprende estas reglas:

| Regla | Descripción |
|-------|-------------|
| **NUNCA en Git** | Ningún secreto debe subirse al repositorio. `.env.local` está en `.gitignore`. |
| **NUNCA en frontend** | Las variables secretas solo viven en el servidor / Netlify Functions. |
| **NUNCA prefijos `VITE_` o `NEXT_PUBLIC_`** | Esos prefijos exponen variables al bundle del navegador. |
| **NUNCA en logs** | No imprimas valores de secretos en `console.log` ni en registros de errores. |
| **NUNCA en respuestas API** | Los endpoints nunca deben devolver valores de variables de entorno. |
| **`GOOGLE_REFRESH_TOKEN` es el secreto más crítico** | Si se compromete, revocarlo inmediatamente en Google Cloud Console → Credentials. |
| **`JWT_SECRET` mínimo 32 chars** | Generar con `openssl rand -base64 48` o equivalente. |

---

## Tabla Resumen

| Variable | Categoría | Sensibilidad | Requerida | Entorno |
|----------|-----------|:------------:|:---------:|---------|
| `EMAIL_USER` | Email | 🟡 Media | ✅ | Dev + Prod |
| `EMAIL_PASS` | Email | 🔴 Alta | ✅ | Dev + Prod |
| `DATABASE_URL` | Base de datos | 🔴 Alta | ✅ | Dev + Prod |
| `DATABASE_URL_UNPOOLED` | Base de datos | 🔴 Alta | ✅ | Dev + Scripts |
| `JWT_SECRET` | Autenticación | 🔴 Alta | ✅ | Dev + Prod |
| `R2_ACCOUNT_ID` | Cloudflare R2 | 🟡 Media | ⚠️ Hasta migración | Dev + Prod |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 | 🔴 Alta | ⚠️ Hasta migración | Dev + Prod |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 | 🔴 Alta | ⚠️ Hasta migración | Dev + Prod |
| `R2_BUCKET_NAME` | Cloudflare R2 | 🟢 Baja | ⚠️ Hasta migración | Dev + Prod |
| `GOOGLE_CLIENT_ID` | Google Drive | 🟡 Media | ✅ (si Drive activo) | Dev + Prod |
| `GOOGLE_CLIENT_SECRET` | Google Drive | 🔴 Alta | ✅ (si Drive activo) | Dev + Prod |
| `GOOGLE_REDIRECT_URI` | Google Drive | 🟢 Baja | ✅ (si Drive activo) | Dev + Prod |
| `GOOGLE_REFRESH_TOKEN` | Google Drive | 🔴🔴 Crítica | ✅ (si Drive activo) | Prod |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Google Drive | 🟢 Baja | ✅ (si Drive activo) | Dev + Prod |
| `STORAGE_PROVIDER` | Configuración | 🟢 Baja | ✅ | Dev + Prod |

> ⚠️ = Variables de Cloudflare R2 se mantienen activas hasta completar la migración a Google Drive.

---

## Dónde Configurar

### Desarrollo local
Crea el archivo `.env.local` en la raíz del proyecto (ya está en `.gitignore`):
```bash
cp .env.example .env.local
# Luego edita .env.local con tus valores reales
```

### Producción (Netlify)
**Netlify Dashboard → Site Configuration → Environment Variables**

Las variables definidas aquí se inyectan automáticamente en Netlify Functions en tiempo de ejecución. No se necesita ninguna configuración adicional en el código.

> Las Functions de Netlify corren en Node.js server-side, por lo que las variables **nunca** se exponen al navegador.

---

## Descripción Detallada

---

### 📧 Email — Notificaciones

#### `EMAIL_USER`
- **Descripción**: Dirección de Gmail usada como remitente para notificaciones automáticas al denunciante y al administrador.
- **Ejemplo**: `notificaciones@tudominio.com` o `tucuenta@gmail.com`
- **Sensibilidad**: 🟡 Media — es visible como remitente, pero no es una credencial de acceso por sí sola.
- **Usado en**: `netlify/functions/send-email.js`, `netlify/functions/_mail.js`, `src/server/mail.ts`
- **Cómo obtener**: Usa la cuenta de Gmail corporativa o crea una dedicada para la app.

#### `EMAIL_PASS`
- **Descripción**: App Password de Gmail (contraseña de aplicación de 16 caracteres). **No es la contraseña de la cuenta de Google.** Se genera por separado para apps que no soportan OAuth.
- **Ejemplo**: `abcd efgh ijkl mnop` (sin espacios al configurar: `abcdefghijklmnop`)
- **Sensibilidad**: 🔴 Alta — permite enviar correos desde la cuenta. Rotar si se compromete.
- **Usado en**: `netlify/functions/send-email.js`, `netlify/functions/_mail.js`, `src/server/mail.ts`
- **Cómo obtener**:
  1. Inicia sesión en [myaccount.google.com](https://myaccount.google.com)
  2. Seguridad → Verificación en 2 pasos (debe estar activa)
  3. Seguridad → Contraseñas de aplicaciones
  4. Selecciona "Correo" y "Otro (nombre personalizado)" → escribe `Canal Denuncias`
  5. Copia la contraseña de 16 caracteres generada

---

### 🗄️ Base de Datos — PostgreSQL (Neon / Supabase)

#### `DATABASE_URL`
- **Descripción**: Cadena de conexión PostgreSQL en modo **pooled** (PgBouncer). Usada para la mayoría de operaciones en tiempo de ejecución. Optimizada para entornos serverless donde las conexiones son efímeras.
- **Formato**: `postgresql://user:password@host/dbname?sslmode=require`
- **Ejemplo**: `postgresql://neondb_owner:abc123@ep-cool-cloud-123456.us-east-2.aws.neon.tech/neondb?sslmode=require`
- **Sensibilidad**: 🔴 Alta — acceso completo a la base de datos.
- **Usado en**: `netlify/functions/_data.js` (Pool), `src/server/db-client.ts`
- **Cómo obtener**:
  - **Neon**: Dashboard → tu proyecto → Connection Details → selecciona "Pooled connection"
  - **Supabase**: Settings → Database → Connection string → modo "Transaction" (pooler)

#### `DATABASE_URL_UNPOOLED`
- **Descripción**: Cadena de conexión PostgreSQL **directa** (sin pooler). Necesaria para migraciones de esquema y scripts que requieren conexiones persistentes o transacciones largas.
- **Formato**: `postgresql://user:password@host/dbname?sslmode=require`
- **Sensibilidad**: 🔴 Alta — acceso completo a la base de datos.
- **Usado en**: `scripts/migrate-data.ts`, `scripts/run-migration.ts`
- **Cómo obtener**:
  - **Neon**: Dashboard → Connection Details → desactiva el toggle "Pooled connection"
  - **Supabase**: Settings → Database → Connection string → modo "Session" o "Direct"

> **Nota**: No uses `DATABASE_URL_UNPOOLED` en Netlify Functions en producción. El límite de conexiones simultáneas de la base de datos se agotaría bajo carga.

---

### 🔐 Autenticación — Panel de Administración

#### `JWT_SECRET`
- **Descripción**: Clave secreta usada para firmar y verificar los JSON Web Tokens de las sesiones del panel de administración. Si se compromete, todos los tokens existentes deben invalidarse cambiando este valor.
- **Ejemplo**: `s3cr3t_muy_largo_y_aleatorio_de_al_menos_32_caracteres_XYZABC`
- **Sensibilidad**: 🔴 Alta — permite forjar tokens de sesión de admin si se expone.
- **Requisito**: **Mínimo 32 caracteres aleatorios**. Se recomienda 48+.
- **Usado en**: `netlify/functions/admin.js`, `netlify/functions/get-file.js`, `src/server/auth.ts`
- **Cómo generar**:
  ```bash
  # Linux / macOS / WSL
  openssl rand -base64 48

  # Node.js
  node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

  # PowerShell
  [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
  ```

---

### ☁️ Cloudflare R2 — Almacenamiento de Archivos (activo hasta migración)

> Estas variables se mantienen activas durante la migración gradual a Google Drive. Una vez completada la migración y verificada en producción, pueden eliminarse del entorno.

#### `R2_ACCOUNT_ID`
- **Descripción**: ID único de la cuenta de Cloudflare. Identifica el tenant en la API de R2.
- **Ejemplo**: `a1b2c3d4e5f6789012345678901234ab`
- **Sensibilidad**: 🟡 Media — no es una credencial de acceso por sí sola, pero es necesario para construir URLs y llamadas API.
- **Usado en**: `netlify/functions/upload-file.js`, `netlify/functions/get-file.js`
- **Cómo obtener**: [dash.cloudflare.com](https://dash.cloudflare.com) → Home → el Account ID aparece en el panel derecho bajo "API".

#### `R2_ACCESS_KEY_ID`
- **Descripción**: ID de la clave de acceso del API Token de R2. Equivalente al Access Key ID de AWS S3.
- **Sensibilidad**: 🔴 Alta — forma par con `R2_SECRET_ACCESS_KEY` para autenticar operaciones en el bucket.
- **Usado en**: `netlify/functions/upload-file.js`, `netlify/functions/get-file.js`
- **Cómo obtener**:
  1. Cloudflare Dashboard → R2 → Manage R2 API tokens
  2. Create API token → permisos: `Object Read & Write` para el bucket específico
  3. Copia el **Access Key ID**

#### `R2_SECRET_ACCESS_KEY`
- **Descripción**: Clave secreta del API Token de R2. Solo se muestra una vez al crear el token. Equivalente al Secret Access Key de AWS S3.
- **Sensibilidad**: 🔴 Alta — rotar inmediatamente si se compromete (Cloudflare Dashboard → R2 → Manage tokens → Delete y recrear).
- **Usado en**: `netlify/functions/upload-file.js`, `netlify/functions/get-file.js`
- **Cómo obtener**: Se muestra al crear el API token (paso anterior). Si se pierde, hay que crear un token nuevo.

#### `R2_BUCKET_NAME`
- **Descripción**: Nombre del bucket de R2 donde se almacenan los archivos adjuntos de las denuncias.
- **Ejemplo**: `canal-denuncias-arh`
- **Sensibilidad**: 🟢 Baja — es el nombre lógico del bucket, no una credencial.
- **Usado en**: `netlify/functions/upload-file.js`, `netlify/functions/get-file.js`
- **Cómo obtener**: Cloudflare Dashboard → R2 → el nombre del bucket que creaste.

---

### 📁 Google Drive — Almacenamiento (nuevo proveedor)

> Estas variables son necesarias cuando `STORAGE_PROVIDER=google_drive`.

#### `GOOGLE_CLIENT_ID`
- **Descripción**: Client ID de la aplicación OAuth 2.0 registrada en Google Cloud Console. Identifica públicamente la aplicación ante Google.
- **Ejemplo**: `123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com`
- **Sensibilidad**: 🟡 Media — es semi-público (aparece en flujos OAuth), pero sin el Client Secret no puede usarse para autenticar.
- **Usado en**: `netlify/functions/google-oauth-callback.js`, `netlify/functions/googleDrive.js`
- **Cómo obtener**:
  1. [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
  2. Create Credentials → OAuth 2.0 Client ID
  3. Application type: **Web application**
  4. Authorized redirect URIs: `https://denunciasarhconsultores.netlify.app/.netlify/functions/google-oauth-callback`
  5. Copia el **Client ID**

#### `GOOGLE_CLIENT_SECRET`
- **Descripción**: Secreto de la aplicación OAuth 2.0. Junto con el Client ID, permite obtener y renovar tokens de acceso a Google Drive. **Nunca exponer al navegador.**
- **Sensibilidad**: 🔴 Alta — cualquiera con este secreto + Client ID puede suplantar la aplicación.
- **Usado en**: `netlify/functions/google-oauth-callback.js`, `netlify/functions/googleDrive.js`
- **Cómo obtener**: En la misma pantalla del paso anterior, copia el **Client Secret**. Si se pierde, regenerar desde Credentials → tu OAuth client → Edit.

#### `GOOGLE_REDIRECT_URI`
- **Descripción**: URI de redirección registrada en Google Cloud Console. Google redirige aquí tras el flujo de autorización OAuth. Debe coincidir exactamente con la URI registrada.
- **Valor fijo (producción)**: `https://denunciasarhconsultores.netlify.app/.netlify/functions/google-oauth-callback`
- **Valor para desarrollo**: `http://localhost:8888/.netlify/functions/google-oauth-callback` (agregar también en Google Console)
- **Sensibilidad**: 🟢 Baja — es una URL pública.
- **Usado en**: `netlify/functions/google-oauth-callback.js`
- **Cómo obtener**: Es la URL que tú defines. Asegúrate de registrarla en Google Cloud Console → Credentials → tu OAuth Client → Authorized redirect URIs.

#### `GOOGLE_REFRESH_TOKEN`
- **Descripción**: Token de actualización OAuth 2.0 de larga duración. Permite a la aplicación obtener nuevos access tokens sin intervención del usuario. **Es el secreto más crítico de toda la aplicación.**
- **Sensibilidad**: 🔴🔴 Crítica — con este token se puede leer, escribir y eliminar cualquier archivo en el Google Drive autorizado. Si se compromete, revocar **inmediatamente** en [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
- **Usado en**: `netlify/functions/google-oauth-callback.js`, `netlify/functions/googleDrive.js`
- **Cómo obtener** (flujo único de configuración):
  1. Asegúrate de que `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_REDIRECT_URI` estén configuradas.
  2. Despliega la función `google-oauth-callback` en Netlify.
  3. Visita la URL de autorización (generada por tu script de setup o la función de callback).
  4. Autoriza el acceso con la cuenta de Google que tiene acceso a Drive.
  5. La función de callback capturará el `refresh_token` en la respuesta.
  6. **Guárdalo inmediatamente** en Netlify Dashboard → Environment Variables.
  7. El `refresh_token` solo se emite en el primer flujo de autorización. Si se necesita uno nuevo, revocar el acceso en [myaccount.google.com/permissions](https://myaccount.google.com/permissions) y repetir el flujo.

> **Rotación**: Si sospechas que el refresh token fue expuesto: ve a [myaccount.google.com/permissions](https://myaccount.google.com/permissions) → "Canal Denuncias ARH" → Revocar acceso. Luego repite el flujo OAuth para obtener uno nuevo.

#### `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- **Descripción**: ID de la carpeta raíz en Google Drive donde se almacenan los archivos de las denuncias (carpeta `Canal-Denuncias-ARH`). Los archivos de cada denuncia se organizan en subcarpetas bajo este directorio.
- **Ejemplo**: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`
- **Sensibilidad**: 🟢 Baja — es un identificador público de carpeta, no una credencial.
- **Usado en**: `netlify/functions/googleDrive.js`
- **Cómo obtener**:
  1. En Google Drive, abre (o crea) la carpeta `Canal-Denuncias-ARH`.
  2. En la URL del navegador, el ID es la cadena larga después de `/folders/`:
     `https://drive.google.com/drive/folders/`**`<ESTE_ES_EL_ID>`**
  3. Copia ese ID.

---

### ⚙️ Configuración — Proveedor de Almacenamiento

#### `STORAGE_PROVIDER`
- **Descripción**: Controla qué proveedor de almacenamiento de archivos usa la aplicación. Permite hacer el switch gradual de Cloudflare R2 a Google Drive sin modificar el código.
- **Valores válidos**: `r2` | `google_drive`
- **Valor actual recomendado**: `r2` (durante migración) → `google_drive` (tras validar en producción)
- **Sensibilidad**: 🟢 Baja — es un valor de configuración sin impacto en seguridad.
- **Usado en**: `netlify/functions/upload-file.js` (modificado), `netlify/functions/get-file.js` (modificado)
- **Comportamiento**:
  - `r2`: Todos los uploads y downloads usan Cloudflare R2. Las variables `R2_*` deben estar configuradas.
  - `google_drive`: Todos los uploads y downloads usan Google Drive. Las variables `GOOGLE_*` deben estar configuradas.

---

## Variables Obsoletas

Las siguientes variables existían en versiones anteriores y han sido reemplazadas. **No configurar en entornos nuevos.**

| Variable | Reemplazada por | Motivo |
|----------|-----------------|--------|
| `SUPABASE_URL` | `DATABASE_URL` + `DATABASE_URL_UNPOOLED` | Migración de Supabase JS client a conexión directa PostgreSQL |
| `SUPABASE_SERVICE_ROLE_KEY` | `DATABASE_URL` + `DATABASE_URL_UNPOOLED` | Mismo motivo anterior |

---

## Plantilla `.env.local`

Copia este bloque en tu archivo `.env.local` y completa los valores:

```dotenv
# ============================================================
# Canal de Denuncias ARH — Variables de Entorno (Desarrollo)
# ============================================================
# ADVERTENCIA: Este archivo NUNCA debe subirse a Git.
# Verificar que .gitignore incluya .env.local
# ============================================================

# --- Email ---
EMAIL_USER=
EMAIL_PASS=

# --- Base de Datos (PostgreSQL) ---
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# --- Autenticación ---
JWT_SECRET=

# --- Cloudflare R2 (activo hasta completar migración) ---
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# --- Google Drive (activar cuando STORAGE_PROVIDER=google_drive) ---
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8888/.netlify/functions/google-oauth-callback
GOOGLE_REFRESH_TOKEN=
GOOGLE_DRIVE_ROOT_FOLDER_ID=

# --- Configuración de Almacenamiento ---
# Valores: 'r2' | 'google_drive'
STORAGE_PROVIDER=r2

# --- Obsoletas (no configurar) ---
# SUPABASE_URL=
# SUPABASE_SERVICE_ROLE_KEY=
```

---

## Checklist de Configuración

### Primer despliegue en Netlify

- [ ] `EMAIL_USER` configurada en Netlify Environment Variables
- [ ] `EMAIL_PASS` configurada (App Password, no contraseña de cuenta)
- [ ] `DATABASE_URL` configurada (URL pooled)
- [ ] `DATABASE_URL_UNPOOLED` configurada (URL directa)
- [ ] `JWT_SECRET` generada con mínimo 32 chars aleatorios
- [ ] `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` configuradas
- [ ] `STORAGE_PROVIDER=r2` hasta completar migración
- [ ] `.env.local` en `.gitignore` ✓ (ya incluido)
- [ ] Ninguna variable con prefijo `VITE_` contiene secretos

### Activación de Google Drive

- [ ] Proyecto creado en Google Cloud Console con la API de Google Drive habilitada
- [ ] OAuth 2.0 Client ID creado (tipo: Web application)
- [ ] URI de redirección registrada en Google Console
- [ ] `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` configuradas en Netlify
- [ ] `GOOGLE_REDIRECT_URI` configurada
- [ ] Flujo OAuth ejecutado y `GOOGLE_REFRESH_TOKEN` obtenido y guardado en Netlify
- [ ] `GOOGLE_DRIVE_ROOT_FOLDER_ID` configurada
- [ ] `STORAGE_PROVIDER` cambiada a `google_drive` tras validar
- [ ] Variables `R2_*` eliminadas del entorno una vez migración completa

---

*Documento generado el 2026-09-27. Mantener actualizado ante cualquier cambio en la arquitectura de la aplicación.*
