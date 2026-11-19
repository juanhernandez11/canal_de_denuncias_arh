# Reporte de Auditoría de Seguridad
## Canal de Denuncias — ARH Consultores
**Fecha:** 2025  
**Alcance:** Revisión estática del código fuente (white-box)

---

## Resumen ejecutivo

| Severidad | Hallazgos |
|-----------|-----------|
| 🔴 Crítica    | 2 |
| 🟠 Alta       | 3 |
| 🟡 Media      | 4 |
| 🔵 Baja / Info | 3 |

---

## 🔴 CRÍTICA

### C-01 — Fallback de JWT_SECRET hardcodeado en código fuente
**Archivo:** `src/server/auth.ts` línea 6  
**Código afectado:**
```ts
const JWT_SECRET: string = process.env.JWT_SECRET || 'dev-secret-arh-change-me';
```
**Riesgo:** Si `JWT_SECRET` no está configurado en el entorno (Netlify env vars), el sistema usa el secreto `'dev-secret-arh-change-me'` que es público en el repositorio. Cualquier persona que vea este código puede forjar tokens JWT de administrador válidos y acceder al panel sin credenciales.

**Remediación:**
```ts
const JWT_SECRET: string = process.env.JWT_SECRET ?? (() => {
  throw new Error('[auth] JWT_SECRET no está definido. Configúralo en las variables de entorno.');
})();
```
Que falle en arranque es mejor que ejecutarse inseguro en producción.

---

### C-02 — Credencial de admin por defecto en código fuente
**Archivo:** `src/server/db-neon.ts` línea 83  
**Código afectado:**
```ts
const hash = bcrypt.hashSync('arhconsultores', 10);
await query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)...', ['adminrh', hash]);
```
**Riesgo:** Si la base de datos se inicializa y nadie cambia la contraseña, las credenciales `adminrh / arhconsultores` son accesibles para cualquiera que haya leído el código. Combinado con C-01, el panel completo es accesible sin esfuerzo.

**Remediación:**
- Obligar cambio de contraseña en el primer login (flag `must_change_password` en tabla `admins`).
- O leer las credenciales del seed desde variables de entorno: `ADMIN_DEFAULT_USER` / `ADMIN_DEFAULT_PASS`.
- Documentar prominentemente que estas credenciales **deben cambiarse antes del primer despliegue**.

---

## 🟠 ALTA

### A-01 — Sin rate limiting en endpoints críticos
**Archivos:** `netlify/functions/send-email.js`, `src/server/routes.ts`  
**Riesgo:** El endpoint `POST /.netlify/functions/send-email` no tiene ningún límite de frecuencia. Un atacante puede:
- Spamear correos desde el sistema hacia víctimas (abuso del canal de Gmail).
- Agotar las 125 000 invocaciones/mes del plan free de Netlify en horas.
- Saturar la cuota diaria de Gmail (500 correos/día) dejando el sistema inoperante.
- Llenar la base de datos Neon con miles de registros falsos.

El endpoint `POST /api/admin/login` tampoco tiene protección contra fuerza bruta.

**Remediación para Netlify:** Activar Netlify Rate Limiting (disponible en planes Pro) o implementar un contador por IP en Redis/Upstash:
```js
// Ejemplo simple con una variable en memoria (no persiste entre instancias)
// Para producción usar Upstash Redis con @upstash/ratelimit
const RATE_WINDOW_MS = 60_000; // 1 minuto
const MAX_PER_WINDOW = 5;
const ipCounts = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = ipCounts.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW_MS) {
    ipCounts.set(ip, { count: 1, start: now });
    return true;
  }
  if (entry.count >= MAX_PER_WINDOW) return false;
  entry.count++;
  ipCounts.set(ip, entry);
  return true;
}
```

---

### A-02 — Sin validación del campo `to` en send-email.js
**Archivo:** `netlify/functions/send-email.js`  
**Riesgo:** El campo `to` llega del frontend sin validación de formato de correo. Un atacante puede manipular la petición directamente (es una API pública) e inyectar destinatarios arbitrarios, usando el sistema como relay de spam hacia cualquier dirección.

**Remediación:** Ignorar el `to` que viene del frontend en producción y usar siempre el valor de la variable de entorno o del CMS leído del lado del servidor:
```js
// No confiar en el "to" que llega del cliente
// Leer el destinatario directamente desde la BD o env var
const toFromDB = await getContentValue('contacto.email'); // llamada interna
const normalizado = normalizeEmails(toFromDB) || process.env.EMAIL_FALLBACK;
```

---

### A-03 — Cookies de sesión sin flag `Secure` en desarrollo
**Archivo:** `src/server/routes.ts` línea 23  
**Código afectado:**
```ts
secure: isProd,  // false en desarrollo
```
**Riesgo:** En un entorno de staging/QA que accidentalmente no tenga `NODE_ENV=production`, las cookies se transmiten sin HTTPS y son interceptables. El flag debería ser `true` siempre que el host use HTTPS, independientemente del `NODE_ENV`.

**Remediación:**
```ts
secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
```

---

## 🟡 MEDIA

### M-01 — Ausencia de cabeceras de seguridad HTTP
**Archivos:** `netlify/functions/send-email.js`, `src/server/routes.ts`  
**Cabeceras faltantes:**
- `Content-Security-Policy` — permite XSS desde cualquier origen
- `X-Frame-Options` — permite clickjacking (embeber el canal en un iframe)
- `X-Content-Type-Options: nosniff` — permite MIME sniffing
- `Referrer-Policy` — puede filtrar datos en la cabecera Referer
- `Permissions-Policy` — no restringe acceso a cámara/micrófono/geolocalización

**Remediación para Netlify:** Agregar en `netlify.toml`:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.netlify.app https://*.neon.tech"
```

---

### M-02 — `payload_json` almacena datos PII sin cifrar
**Archivo:** `src/server/db-neon.ts`  
**Riesgo:** La columna `payload_json` guarda el formulario completo de la denuncia, incluyendo nombre, correo y teléfono del denunciante. Si hay un acceso no autorizado a la base de datos (leak de `DATABASE_URL`), todos los datos de identidad de los denunciantes quedan expuestos.

**Remediación:** Cifrar el `payload_json` antes de insertarlo usando AES-256-GCM con una clave manejada desde variables de entorno. Los campos de búsqueda estructurados (`denunciante_nombre`, `denunciante_correo`) pueden mantenerse en claro para funcionalidad admin, pero el payload completo debería estar cifrado en reposo.

---

### M-03 — Sin validación de tamaño ni tipo en archivos adjuntos
**Archivo:** `netlify/functions/send-email.js`  
**Riesgo:** Los adjuntos se reciben como base64 sin validación de tipo MIME ni tamaño máximo. Esto puede:
- Causar timeouts de Netlify (límite 6 MB en body de Lambda)
- Facilitar el envío de archivos ejecutables disfrazados

**Remediación:**
```js
const MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = ['image/jpeg','image/png','image/gif','application/pdf','text/plain'];

for (const a of attachments || []) {
  const mimeMatch = a.data.match(/^data:([^;]+);base64,/);
  if (!mimeMatch || !ALLOWED_MIME.includes(mimeMatch[1])) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Tipo de archivo no permitido' }) };
  }
  const sizeBytes = (a.data.length * 3) / 4;
  if (sizeBytes > MAX_ATTACHMENT_SIZE) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Archivo demasiado grande' }) };
  }
}
```

---

### M-04 — Parámetros de búsqueda en listDenuncias sin límite estricto de pageSize
**Archivo:** `src/server/db-neon.ts` línea 162  
**Código afectado:**
```ts
const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
```
**Riesgo:** Un admin puede solicitar hasta 100 registros con `pageSize=100`. Si hay miles de denuncias con `payload_json` grandes, una sola petición puede devolver varios MB de datos y estresar la conexión a Neon.

**Remediación:** Reducir el máximo a 50 y paginar en el frontend, o implementar un cursor-based pagination.

---

## 🔵 BAJA / INFORMATIVA

### I-01 — Folio predecible en entropía baja teórica
**Archivo:** `netlify/functions/send-email.js`  
**Nota:** El folio usa `crypto.randomBytes(5)` → ~1 billón de combinaciones posibles (36^5). Es seguro para el volumen esperado, pero si el sistema tuviera decenas de miles de denuncias mensuales, la probabilidad de colisión aumenta. El código actual usa `ON CONFLICT DO NOTHING` en Neon sin reintentar, por lo que una colisión silenciosa no generaría un error visible.  
**Recomendación:** Cambiar a `randomBytes(6)` o agregar un reintento en caso de conflicto de `folio`.

---

### I-02 — Logs en consola exponen información sensible
**Archivos:** `src/server/routes.ts`, `netlify/functions/send-email.js`  
**Riesgo bajo:** Los logs con `console.error('[login]', err)` pueden incluir stack traces con rutas internas, versiones de dependencias o fragmentos de queries. En Netlify Functions estos logs son accesibles para cualquier miembro del equipo con acceso al panel.  
**Recomendación:** Usar un logger estructurado que filtre datos sensibles y distinga entre entornos (p.ej. `pino` con nivel `info` en producción).

---

### I-03 — `sameSite: 'lax'` en lugar de `'strict'`
**Archivo:** `src/server/routes.ts`  
**Nota:** `sameSite: 'lax'` protege contra CSRF en la mayoría de los casos pero permite el envío de cookies en navegación de nivel superior (clicks en enlaces externos). Para un panel administrativo, `'strict'` es más conservador aunque puede causar que el admin tenga que re-autenticarse al llegar desde un enlace externo.  
**Recomendación:** Evaluar cambiar a `'strict'` dado que el panel no necesita ser accedido desde redirecciones externas.

---

## Plan de remediación priorizado

| Prioridad | ID | Acción | Esfuerzo |
|---|---|---|---|
| 1 | C-01 | Eliminar fallback de JWT_SECRET | 5 min |
| 2 | C-02 | Leer credenciales del seed desde env vars o forzar cambio en 1er login | 1 h |
| 3 | A-01 | Implementar rate limiting en send-email y login | 2–4 h |
| 4 | A-02 | Ignorar `to` del cliente, leer desde BD server-side | 1 h |
| 5 | M-01 | Agregar cabeceras de seguridad en `netlify.toml` | 30 min |
| 6 | M-03 | Validar tipo y tamaño de adjuntos | 1 h |
| 7 | A-03 | Corregir flag `secure` en cookies | 15 min |
| 8 | M-02 | Cifrar `payload_json` en reposo | 4–8 h |

---

*Auditoría realizada mediante revisión estática del código fuente (white-box). No incluye pruebas de penetración dinámicas ni análisis de dependencias de terceros (npm audit).*
