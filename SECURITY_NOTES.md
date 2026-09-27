# SECURITY NOTES — Canal de Denuncias ARH

> **Clasificación:** Interno / Confidencial  
> **Última actualización:** 2026-09-27  
> **Responsable:** Senior Security Engineer  

---

## 1. Seguridad actual implementada

### 1.1 Autenticación y sesiones

| Control | Detalle |
|---|---|
| **JWT httpOnly cookie** | Cookie `admin_token`, expiración 12 h |
| **SameSite=Lax** | Mitiga CSRF en la mayoría de flujos |
| **Secure flag** | Activo en producción — transmisión solo por HTTPS |
| **Expiración corta** | 12 h reduce la ventana de abuso si el token es robado |

**Notas:** El flag `httpOnly` impide acceso desde JavaScript (XSS mitigation). Sin embargo, sigue siendo vulnerable si el servidor es comprometido o si hay un XSS que explote otro vector. Mantener CSP estricto en el frontend.

---

### 1.2 Manejo de archivos

| Control | Detalle |
|---|---|
| **Validación MIME type** | Allowlist explícita en `upload-file.js`; se rechazan tipos no listados |
| **Tamaño máximo** | 10 MB validado en código (ver advertencia §3.4) |
| **`sanitizeFilename`** | Elimina caracteres peligrosos antes de usar el nombre en cualquier operación |
| **Sin URLs públicas permanentes** | URLs firmadas expiran a los 5 minutos |
| **Auth requerida en `get-file.js`** | Ningún archivo es accesible sin sesión admin válida |

---

### 1.3 Base de datos

| Control | Detalle |
|---|---|
| **Parameterized queries** | Todas las operaciones SQL usan parámetros posicionales — no hay interpolación de strings |
| **Sin credenciales en frontend** | La `service_role key` / connection string de Neon solo existe en Netlify env vars |

---

### 1.4 Generación de folios

- `crypto.randomBytes` — generación criptográficamente segura (CSPRNG).
- Formato validado por regex: `/^ARH-\d{4}-[A-Z0-9]{5}$/`
- La validación de formato **debe estar presente tanto en el endpoint de creación como en `_data.js`** (ver §3.4).

---

## 2. Nuevos riesgos con Google Drive

La migración de Cloudflare R2 → Google Drive introduce una nueva superficie de ataque basada en OAuth 2.0 y en la API de Google Drive. Los controles de esta sección son **obligatorios antes de activar `STORAGE_PROVIDER=drive` en producción**.

---

### 2.1 Refresh Token (`GOOGLE_REFRESH_TOKEN`)

> ⚠️ **Riesgo CRÍTICO**

El refresh token es equivalente a una contraseña permanente para la cuenta de servicio.

- **Si se compromete:** el atacante tiene acceso total a Google Drive hasta que se revoque manualmente.
- **Acción inmediata ante compromiso:** ir a [Google Cloud Console → OAuth 2.0 → Revocar token](https://console.cloud.google.com/apis/credentials) y rotar las credenciales.
- **Almacenamiento:** SOLO en Netlify Environment Variables (panel web o CLI con `netlify env:set`). Nunca en `.env` del repositorio, nunca en logs, nunca en respuestas API.

```
# CORRECTO
GOOGLE_REFRESH_TOKEN=1//0gXx...  ← solo en Netlify env vars

# INCORRECTO
console.log('token:', refreshToken)          ← nunca
res.json({ debug: process.env.GOOGLE_REFRESH_TOKEN }) ← nunca
```

---

### 2.2 Scope OAuth

| Scope | Estado | Motivo |
|---|---|---|
| `https://www.googleapis.com/auth/drive.file` | ✅ **Usar este** | Acceso solo a archivos creados por la app |
| `https://www.googleapis.com/auth/drive` | ❌ **Prohibido** | Acceso a todo Drive del usuario |
| `https://www.googleapis.com/auth/drive.readonly` | ❌ No aplica | Solo lectura, no permite subir |

El scope `drive.file` garantiza que si el token se filtra, el daño se limita a los archivos creados por la aplicación.

---

### 2.3 OAuth Callback URI

- La URI de callback debe estar registrada **exactamente** en la whitelist de Google Cloud Console (sin trailing slash, sin variaciones de protocolo).
- Cualquier URI no registrada resultará en error `redirect_uri_mismatch`.
- **No registrar URIs comodín** (`*.netlify.app`) — solo URIs exactas de staging y producción.

```
# Registrar en Google Cloud Console:
https://canal-de-denuncias.netlify.app/.netlify/functions/google-oauth-callback
https://staging--canal-de-denuncias.netlify.app/.netlify/functions/google-oauth-callback
```

---

### 2.4 Proxy de archivos — nunca exponer URL directa de Drive

> ⚠️ **Riesgo ALTO**

Las URLs de descarga de Google Drive incluyen el access token en los headers o en parámetros de query. Devolver la URL directa al browser implica:

1. El access token queda en el historial del browser.
2. El access token queda en los logs del servidor.
3. El enlace puede ser compartido accidentalmente.

**Patrón correcto:**

```
Browser → GET /api/get-file?id=X (con cookie admin_token)
         ↓
Netlify Function → valida JWT → llama a Drive API server-side → hace pipe del stream
         ↓
Browser recibe el archivo directamente
```

**Patrón INCORRECTO:**

```
Browser → GET /api/get-file?id=X
Netlify Function → devuelve { driveUrl: "https://drive.google.com/..." } ← NUNCA
```

---

### 2.5 Rate Limiting de Google Drive API

| Límite | Valor |
|---|---|
| Requests por usuario / 100s | 1,000 |
| Requests por proyecto / 100s | 1,000 |
| Tamaño máximo de upload simple | 5 MB |
| Tamaño máximo de upload multipart | 5 MB |
| Upload resumable | Hasta 5 TB |

**Implicaciones para la app:**
- Implementar retry con exponential backoff en errores 429 y 403 `rateLimitExceeded`.
- Para archivos > 5 MB usar la API de upload resumable (no el upload simple).
- Monitorear cuotas en [Google Cloud Console → APIs & Services → Quotas](https://console.cloud.google.com/apis/dashboard).

---

### 2.6 Límite de body en Netlify Functions — PROBLEMA REAL

> ⚠️ **Riesgo ALTO — requiere rediseño antes de producción**

| Escenario | Tamaño |
|---|---|
| Archivo original de 10 MB | 10,000,000 bytes |
| Mismo archivo en base64 | ~13,333,333 bytes (~13 MB) |
| Límite máximo de body en Netlify Functions | **6 MB** |

**Resultado:** un archivo de 4.5 MB enviado como base64 ya supera el límite de Netlify.

**Soluciones posibles (en orden de preferencia):**

1. **Upload directo a Drive desde el browser** usando signed upload URLs generadas server-side (requiere OAuth adicional del usuario — no aplica aquí).
2. **Reducir el límite en la UI a 4 MB** (4 MB × 1.33 = ~5.3 MB en base64, dentro del límite de 6 MB con margen).
3. **Chunked upload**: dividir el archivo en chunks en el cliente y ensamblar en la Function (complejo, pero permite archivos grandes).
4. **Usar Netlify Background Functions** para uploads asincrónicos (tiempo de ejecución hasta 15 min).

**Acción inmediata:** cambiar el límite en la UI de 10 MB a **4 MB** hasta que se implemente una solución de chunked upload.

---

## 3. Vulnerabilidades a revisar

### 3.1 IDOR — Insecure Direct Object Reference

**Endpoint afectado:** `GET /api/get-file?id=X`

**Situación actual:** el endpoint verifica que el solicitante tenga un JWT admin válido, pero no verifica que el archivo `X` pertenezca a un folio al que ese admin tiene acceso. En un sistema multiusuario o si se implementan roles futuros, esto permite acceso cruzado entre folios.

**Fix recomendado:**

```javascript
// En get-file.js
const file = await db.query(
  'SELECT f.* FROM files f JOIN denuncias d ON f.denuncia_id = d.id WHERE f.id = $1',
  [fileId]
);
if (!file.rows.length) return res.status(404).json({ error: 'Not found' });
// Si se implementan roles por folio, verificar también d.assigned_to = adminId
```

**Prioridad:** Media (actualmente todos los admins son equivalentes, pero debe corregirse antes de implementar roles).

---

### 3.2 Path Traversal

**Situación actual:** `sanitizeFilename` mitiga ataques de path traversal en el nombre del archivo. Con Google Drive esto es menos crítico porque Drive API usa IDs internos, no paths del sistema de archivos.

**Riesgo residual:** si el nombre sanitizado se usa en algún log o en metadata de Drive, un nombre como `../../../etc/passwd` podría llegar a logs aunque no cause daño directo.

**Acción:** mantener `sanitizeFilename` activo y aplicarlo también al campo `title` o `description` enviado a Drive metadata.

---

### 3.3 MIME Spoofing

**Situación actual:** la validación usa el `Content-Type` declarado por el cliente. Un atacante puede enviar un archivo `.exe` con `Content-Type: image/jpeg`.

**Fix recomendado — validación por magic bytes:**

```javascript
import { fileTypeFromBuffer } from 'file-type'; // npm install file-type

const buffer = Buffer.from(base64Data, 'base64');
const detected = await fileTypeFromBuffer(buffer);

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'image/gif'];

if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
  return res.status(400).json({ error: 'Tipo de archivo no permitido' });
}
```

**Prioridad:** Alta — especialmente con archivos que luego se proxean al browser.

---

### 3.4 Folio Injection

**Situación actual:** el folio se valida con regex `/^ARH-\d{4}-[A-Z0-9]{5}$/` en el endpoint principal, pero debe validarse **también en `_data.js`** antes de cualquier operación de base de datos, como segunda línea de defensa.

```javascript
// En _data.js — validar antes de usar en cualquier query
const FOLIO_REGEX = /^ARH-\d{4}-[A-Z0-9]{5}$/;
if (!FOLIO_REGEX.test(folio)) throw new Error('Folio inválido');
```

**Prioridad:** Media (las parameterized queries ya previenen SQL injection, pero la validación doble es defensa en profundidad).

---

### 3.5 Log Leakage

**Situación actual:** `console.log` está activo en las Netlify Functions. En producción, los logs de Netlify son visibles para todos los miembros del equipo con acceso al panel.

**Datos que NUNCA deben loguearse:**
- Nombre, email o teléfono del denunciante
- Contenido de la denuncia
- Refresh token o access token
- Contraseñas o hashes
- Folios combinados con datos personales

**Patrón recomendado:**

```javascript
// MAL
console.log('Nueva denuncia:', { nombre, email, descripcion });

// BIEN
console.log(`Nueva denuncia creada. Folio: ${folio}. Archivos adjuntos: ${files.length}`);
```

**Acción:** auditar todos los `console.log` en `netlify/functions/` antes del siguiente deploy a producción.

---

### 3.6 CSRF

**Situación actual:** no hay token CSRF explícito. La mitigación actual es `SameSite=Lax` en la cookie de sesión.

**Análisis:**
- `SameSite=Lax` bloquea el envío de cookies en requests cross-site iniciados por `<img>`, `<script>`, `<form POST>`, y `fetch` desde otros orígenes.
- No protege contra requests de navegación top-level (GET con side effects — no hay ninguno en la app actualmente).
- Para una app con panel admin, `SameSite=Lax` es **suficiente** en la mayoría de navegadores modernos.

**Si se quiere agregar CSRF token explícito:**

```javascript
// Generar en el endpoint de login y devolver como header
res.setHeader('X-CSRF-Token', csrfToken); // no httpOnly, para que JS pueda leerlo
// Verificar en cada mutación
if (req.headers['x-csrf-token'] !== sessionCsrfToken) return res.status(403)...
```

**Prioridad:** Baja (el riesgo actual es aceptable con `SameSite=Lax`).

---

## 4. Recomendaciones de seguridad para Google Drive

### 4.1 Gestión del Refresh Token

```
✅ Guardar GOOGLE_REFRESH_TOKEN SOLO en Netlify env vars
✅ Nunca incluirlo en respuestas API (ni en campo debug)
✅ Nunca loguearlo (ni parcialmente)
✅ Rotar el token cada 90 días o tras cualquier sospecha de compromiso
✅ Documentar el procedimiento de revocación en el runbook del equipo
```

### 4.2 Renovación automática de Access Token

El access token de Google expira cada 1 hora. Implementar renovación automática:

```javascript
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

// googleapis renueva automáticamente el access token antes de que expire
// No es necesario manejar manualmente el refresh si se usa oauth2Client
const drive = google.drive({ version: 'v3', auth: oauth2Client });
```

### 4.3 Validar folderId antes de subir

```javascript
// Nunca confiar en un folderId enviado por el cliente
// El folderId debe derivarse del folio validado server-side

async function getFolderIdForFolio(folio) {
  const FOLIO_REGEX = /^ARH-\d{4}-[A-Z0-9]{5}$/;
  if (!FOLIO_REGEX.test(folio)) throw new Error('Folio inválido');
  
  // Buscar o crear la carpeta en Drive para este folio específico
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  // ... lógica de búsqueda/creación
  return folderId;
}
```

### 4.4 Nunca usar fileId ingresado por el usuario

```javascript
// MAL — el usuario controla qué archivo se sirve
const fileId = req.query.fileId;
const stream = await drive.files.get({ fileId, alt: 'media' });

// BIEN — el fileId viene de la base de datos, no del usuario
const fileId = req.query.id; // este es el ID interno de Neon
const fileRecord = await db.query('SELECT drive_file_id FROM files WHERE id = $1', [fileId]);
const driveFileId = fileRecord.rows[0]?.drive_file_id; // el fileId real de Drive
const stream = await drive.files.get({ fileId: driveFileId, alt: 'media' });
```

### 4.5 Rate Limiting en upload endpoint

Implementar rate limiting por IP para evitar abuso del endpoint de subida:

```javascript
// Opción simple con un Map en memoria (se resetea en cada función cold start)
const uploadAttempts = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const window = 60_000; // 1 minuto
  const maxAttempts = 5;
  
  const attempts = (uploadAttempts.get(ip) || []).filter(t => now - t < window);
  if (attempts.length >= maxAttempts) return false;
  
  attempts.push(now);
  uploadAttempts.set(ip, attempts);
  return true;
}
```

> Para producción real, usar una solución persistente como Redis o las capacidades de rate limiting de Netlify Edge Functions.

---

## 5. Variables de entorno — inventario y clasificación

| Variable | Clasificación | Almacenamiento | Rotación |
|---|---|---|---|
| `DATABASE_URL` | 🔴 Secreta | Netlify env vars | Al rotar credenciales de Neon |
| `JWT_SECRET` | 🔴 Secreta | Netlify env vars | Cada 6 meses o ante compromiso |
| `GOOGLE_CLIENT_ID` | 🟡 Semi-pública | Netlify env vars | Al rotar credenciales OAuth |
| `GOOGLE_CLIENT_SECRET` | 🔴 Secreta | Netlify env vars | Al rotar credenciales OAuth |
| `GOOGLE_REFRESH_TOKEN` | 🔴 Crítica | Netlify env vars | Cada 90 días o ante compromiso |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | 🟡 Interna | Netlify env vars | Nunca (a menos que se migre) |
| `EMAIL_USER` | 🟡 Semi-pública | Netlify env vars | Anual |
| `EMAIL_PASS` | 🔴 Secreta | Netlify env vars | Anual o ante compromiso |
| `STORAGE_PROVIDER` | 🟢 Config | Netlify env vars | N/A (feature flag) |

---

## 6. Checklist de seguridad pre-producción (Google Drive)

```
[ ] GOOGLE_REFRESH_TOKEN configurado SOLO en Netlify env vars
[ ] Scope OAuth verificado como drive.file (no drive completo)
[ ] OAuth callback URI registrada exactamente en Google Cloud Console
[ ] Validación de MIME por magic bytes implementada (file-type)
[ ] Límite de upload reducido a 4 MB en la UI (hasta implementar chunked upload)
[ ] Proxy de archivos verificado — cero URLs directas de Drive al browser
[ ] console.log auditados — sin datos sensibles del denunciante
[ ] IDOR fix aplicado en get-file.js
[ ] Rate limiting en upload endpoint
[ ] Folio regex validado también en _data.js
[ ] Retry con exponential backoff para errores 429 de Drive API
[ ] GOOGLE_DRIVE_ROOT_FOLDER_ID documentado y respaldado
```

---

*Documento generado por el equipo de seguridad. Revisar y actualizar tras cada fase de migración.*
