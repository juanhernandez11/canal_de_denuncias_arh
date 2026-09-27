# Canal de Denuncias ARH

Aplicación web para el envío y seguimiento de denuncias, con panel de
administración respaldado por **Neon PostgreSQL** y **Google Drive**.

## Stack

- **Frontend**: Vite + React 19 + TypeScript + Tailwind CSS
- **Backend**: Netlify Functions (Node.js)
- **Base de datos**: Neon PostgreSQL
- **Almacenamiento**: Google Drive (archivos privados)
- **Auth admin**: JWT httpOnly cookie
- **Correo**: Nodemailer + Gmail SMTP

## Requisitos

- Node.js 18+
- Cuenta en [Neon](https://neon.tech)
- Proyecto en [Google Cloud](https://console.cloud.google.com) con Drive API habilitada
- Cuenta de Gmail para notificaciones

## Configuración

### 1. Instalar dependencias

```
npm install
cd netlify/functions && npm install && cd ../..
```

### 2. Crear tablas en Neon

```
psql $DATABASE_URL_UNPOOLED -f database/schema.sql
psql $DATABASE_URL_UNPOOLED -f database/indexes.sql
psql $DATABASE_URL_UNPOOLED -f database/migration_gdrive.sql
```

### 3. Variables de entorno

Copia `.env.example` a `.env.local` y completa:

```
EMAIL_USER=                    # Gmail para notificaciones
EMAIL_PASS=                    # App Password de Gmail
DATABASE_URL=                  # Neon connection string (pooled)
DATABASE_URL_UNPOOLED=         # Neon connection string (directo)
JWT_SECRET=                    # Cadena aleatoria mínimo 32 chars
GOOGLE_CLIENT_ID=              # OAuth 2.0 Client ID
GOOGLE_CLIENT_SECRET=          # OAuth 2.0 Client Secret
GOOGLE_REDIRECT_URI=           # https://tu-sitio.netlify.app/.netlify/functions/google-oauth-callback
GOOGLE_REFRESH_TOKEN=          # Obtener con el flujo OAuth (ver abajo)
GOOGLE_DRIVE_ROOT_FOLDER_ID=   # ID de carpeta Canal-Denuncias-ARH en Drive
```

### 4. Configurar Google Drive

Consulta `GOOGLE_DRIVE_SETUP.md` para instrucciones detalladas.

El flujo básico para obtener el refresh token:
1. Configura las variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` en Netlify.
2. Inicia sesión en el panel admin.
3. Visita `/api/google-oauth`.
4. Autoriza la app con tu cuenta Google.
5. Copia el `GOOGLE_REFRESH_TOKEN` que aparece y guárdalo en Netlify.

### 5. Ejecutar en desarrollo

```
npm run dev
```

La app queda en `http://localhost:3000`.

## Panel de administración

- URL: `/admin/login`
- Usuario por defecto: `adminrh` · Contraseña: `arhconsultores`

**Cambia la contraseña antes de usar en producción.**

Desde el panel puedes:
- **Folios**: listar, buscar, filtrar por estatus, ver detalle, cambiar estatus y agregar notas.
- **Contenido**: editar textos del sitio (CMS).
- **Evidencias**: descargar archivos adjuntos de cada denuncia.

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción a `dist/`
- `npm run lint` — verificación de tipos TypeScript

## Documentación

| Archivo | Descripción |
|---------|-------------|
| `AUDIT_GOOGLE_DRIVE_MIGRATION.md` | Auditoría completa del proyecto |
| `GOOGLE_DRIVE_SETUP.md` | Configuración paso a paso de Google Drive |
| `DATABASE_MIGRATION_PLAN.md` | Plan de migración de la base de datos |
| `ENVIRONMENT_VARIABLES.md` | Documentación de todas las variables |
| `SECURITY_NOTES.md` | Notas de seguridad y vulnerabilidades |
| `ROLLBACK_PLAN.md` | Plan de rollback por fase |
