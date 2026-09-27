# Google Drive — Guía de Configuración
## Canal de Denuncias ARH

> **Senior Cloud Engineer Note:** Esta guía cubre todo el ciclo de vida de la
> integración Google Drive: desde verificar la configuración OAuth existente en
> Google Cloud Console hasta la prueba de conexión en producción en Netlify.
> Lee cada sección en orden la primera vez. Las secciones 3 y 4 son las más
> críticas si el proyecto ya tiene Google Cloud configurado.

---

## Índice

1. [Prerrequisitos en Google Cloud Console](#1-prerrequisitos-en-google-cloud-console)
2. [Verificar configuración OAuth existente](#2-verificar-configuración-oauth-existente)
3. [Obtener el Refresh Token (paso a paso)](#3-obtener-el-refresh-token-paso-a-paso)
4. [Variables de entorno en Netlify](#4-variables-de-entorno-en-netlify)
5. [Crear carpeta raíz en Google Drive](#5-crear-carpeta-raíz-en-google-drive)
6. [Verificar permisos de la carpeta](#6-verificar-permisos-de-la-carpeta)
7. [Prueba de conexión](#7-prueba-de-conexión)
8. [Troubleshooting común](#8-troubleshooting-común)
9. [Revocar acceso](#9-revocar-acceso)

---

## 1. Prerrequisitos en Google Cloud Console

### Estado actual del proyecto

| Parámetro | Valor |
|---|---|
| Proyecto GCP | `canal-denuncias-arh` |
| API habilitada | `drive.googleapis.com` |
| Tipo de OAuth | Aplicación web |
| Tipo de usuario | Externos |
| Estado de publicación | **Prueba** (Testing) |
| Scope | `https://www.googleapis.com/auth/drive.file` |
| Redirect URI | `https://denunciasarhconsultores.netlify.app/.netlify/functions/google-oauth-callback` |

> **Importante — Estado "Prueba":** Mientras la aplicación esté en modo
> *Testing*, solo los usuarios de prueba explícitamente agregados en la pantalla
> de consentimiento OAuth pueden autenticarse. El refresh token expira a los
> **7 días**. Para producción permanente se requiere publicar la app o usar una
> cuenta de servicio (Service Account). Ver sección 8.

### Verificar que la Drive API está habilitada

1. Ir a [https://console.cloud.google.com/apis/library](https://console.cloud.google.com/apis/library)
2. Seleccionar el proyecto **canal-denuncias-arh** en el selector superior.
3. Buscar **"Google Drive API"**.
4. Confirmar que el estado sea **"API habilitada"** (botón gris que dice *Manage*,
   no *Enable*).
5. Si no está habilitada: hacer clic en **Enable**.

### Verificar la cuenta de facturación (no requerida para Drive)

La Google Drive API no requiere facturación activa para uso básico dentro de
las cuotas gratuitas. No es necesario agregar una tarjeta para este proyecto.

---

## 2. Verificar configuración OAuth existente

### 2.1 — Pantalla de consentimiento OAuth

1. Ir a **APIs & Services → OAuth consent screen**:
   [https://console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent)
2. Confirmar los siguientes valores:

   | Campo | Valor esperado |
   |---|---|
   | User Type | External |
   | Publishing status | Testing |
   | App name | (cualquier nombre descriptivo, ej. `Canal Denuncias ARH`) |
   | Scopes autorizados | `https://www.googleapis.com/auth/drive.file` |
   | Test users | Al menos 1 usuario agregado (la cuenta Google que hará el OAuth) |

3. Si el scope `drive.file` no aparece en la lista: hacer clic en **Edit App →
   Scopes → Add or Remove Scopes** y agregar:
   ```
   https://www.googleapis.com/auth/drive.file
   ```
4. Si el usuario de prueba no está: ir a **Test users → Add Users** y agregar
   el correo Gmail que usarás para autorizar el acceso.

### 2.2 — Credenciales OAuth 2.0

1. Ir a **APIs & Services → Credentials**:
   [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. En la sección **OAuth 2.0 Client IDs**, localizar la entrada de tipo
   **Web application**.
3. Hacer clic en el ícono de lápiz (editar) para revisar:

   | Campo | Valor esperado |
   |---|---|
   | Application type | Web application |
   | Authorized JavaScript origins | *(puede estar vacío para este caso)* |
   | Authorized redirect URIs | `https://denunciasarhconsultores.netlify.app/.netlify/functions/google-oauth-callback` |

4. Si el Redirect URI no está: hacer clic en **Add URI** y pegar exactamente:
   ```
   https://denunciasarhconsultores.netlify.app/.netlify/functions/google-oauth-callback
   ```
   Luego hacer clic en **Save**.

   > **Atención:** El Redirect URI debe coincidir **byte a byte** con el que
   > envía la función `google-oauth.js`. Cualquier diferencia (trailing slash,
   > http vs https) causará error `redirect_uri_mismatch`.

### 2.3 — Descargar credenciales (Client ID y Client Secret)

1. En la misma pantalla de edición de credenciales, copiar:
   - **Client ID** → se verá como `XXXXXXXXXXXX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`
   - **Client Secret** → se verá como `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxx`
2. Guardarlos de forma segura (gestor de contraseñas). Los necesitarás en la
   sección 4.

   > **Nunca** los incluyas en código fuente ni los subas al repositorio.

---

## 3. Obtener el Refresh Token (paso a paso)

El refresh token es el secreto de larga duración que permite a las Netlify
Functions subir archivos a Drive sin interacción humana. Se obtiene una sola vez
ejecutando el flow OAuth manualmente.

### 3.1 — Desplegar las Netlify Functions

Antes del flow OAuth, las dos funciones deben estar desplegadas y accesibles.

**Estructura de archivos requerida:**

```
netlify/
└── functions/
    ├── google-oauth.js
    ├── google-oauth-callback.js
    └── lib/
        └── googleDrive.js
```

**`netlify/functions/google-oauth.js`** — Inicia el flow:

```javascript
// Redirige al usuario a la pantalla de autorización de Google
exports.handler = async () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.file',
    access_type: 'offline',   // CRÍTICO: necesario para obtener refresh_token
    prompt: 'consent',        // CRÍTICO: fuerza mostrar el refresh_token aunque ya se autorizó antes
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  return {
    statusCode: 302,
    headers: { Location: authUrl },
    body: '',
  };
};
```

**`netlify/functions/google-oauth-callback.js`** — Recibe el callback y muestra
el refresh token:

```javascript
// Intercambia el código por tokens y muestra el refresh_token
exports.handler = async (event) => {
  const { code } = event.queryStringParameters || {};

  if (!code) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing authorization code' }),
    };
  }

  const params = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: data }),
    };
  }

  // Muestra los tokens — SOLO PARA SETUP. Remover o proteger tras obtener el refresh_token.
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'OAuth exitoso. Copia el refresh_token y guárdalo en Netlify.',
      access_token: data.access_token,
      refresh_token: data.refresh_token,   // <-- Este es el que necesitas
      expires_in: data.expires_in,
    }),
  };
};
```

**`netlify/functions/lib/googleDrive.js`** — Cliente reutilizable de Drive:

```javascript
// Librería interna para operaciones en Google Drive
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

/**
 * Obtiene un access_token usando el refresh_token almacenado.
 * @returns {Promise<string>} access_token válido
 */
async function getAccessToken() {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Token refresh failed: ${JSON.stringify(err)}`);
  }

  const { access_token } = await res.json();
  return access_token;
}

/**
 * Crea una carpeta en Drive si no existe ya con ese nombre dentro del padre.
 * @param {string} name - Nombre de la carpeta
 * @param {string} parentId - ID de la carpeta padre
 * @returns {Promise<string>} ID de la carpeta creada o encontrada
 */
async function getOrCreateFolder(name, parentId) {
  const token = await getAccessToken();

  // Buscar si ya existe
  const query = encodeURIComponent(
    `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  );

  const searchRes = await fetch(
    `${GOOGLE_DRIVE_API}/files?q=${query}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Crear si no existe
  const createRes = await fetch(`${GOOGLE_DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });

  const folder = await createRes.json();
  return folder.id;
}

/**
 * Sube un archivo a la carpeta de un folio específico.
 * Crea la estructura año/folio automáticamente.
 *
 * @param {Buffer|Uint8Array} fileBuffer - Contenido del archivo
 * @param {string} fileName - Nombre del archivo (ej. "evidencia-01.pdf")
 * @param {string} mimeType - MIME type del archivo (ej. "application/pdf")
 * @param {string} folioId - ID del folio (ej. "ARH-2026-RQA3Z")
 * @returns {Promise<{fileId: string, webViewLink: string}>}
 */
async function uploadFileToDrive(fileBuffer, fileName, mimeType, folioId) {
  const token = await getAccessToken();
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

  // Extraer año del folio (ej. "ARH-2026-RQA3Z" -> "2026")
  const year = folioId.split('-')[1] || new Date().getFullYear().toString();

  // Crear estructura: Root → Año → Folio
  const yearFolderId = await getOrCreateFolder(year, rootFolderId);
  const folioFolderId = await getOrCreateFolder(folioId, yearFolderId);

  // Subir archivo con multipart upload
  const boundary = '-------314159265358979323846';
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folioFolderId],
  });

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    '', // El contenido binario se concatena después
  ].join('\r\n');

  const bodyEnd = `\r\n--${boundary}--`;

  const metaPart = Buffer.from(body, 'utf-8');
  const endPart = Buffer.from(bodyEnd, 'utf-8');
  const fullBody = Buffer.concat([metaPart, fileBuffer, endPart]);

  const uploadRes = await fetch(
    `${GOOGLE_DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
        'Content-Length': fullBody.length,
      },
      body: fullBody,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json();
    throw new Error(`Upload failed: ${JSON.stringify(err)}`);
  }

  return await uploadRes.json();
}

module.exports = { getAccessToken, getOrCreateFolder, uploadFileToDrive };
```

### 3.2 — Configurar variables mínimas para el flow OAuth

Antes de ejecutar el flow, configura en Netlify al menos estas 3 variables
(ver sección 4 para el procedimiento completo):

| Variable | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID de las credenciales OAuth |
| `GOOGLE_CLIENT_SECRET` | Client Secret de las credenciales OAuth |
| `GOOGLE_REDIRECT_URI` | `https://denunciasarhconsultores.netlify.app/.netlify/functions/google-oauth-callback` |

Haz un deploy para que las funciones queden disponibles.

### 3.3 — Ejecutar el flow OAuth

1. Abre el navegador con la cuenta Google que es **usuario de prueba** en GCP.
2. Navega a:
   ```
   https://denunciasarhconsultores.netlify.app/.netlify/functions/google-oauth
   ```
   O si configuraste el redirect en `netlify.toml`:
   ```
   https://denunciasarhconsultores.netlify.app/api/google-oauth
   ```
3. Google mostrará una pantalla de consentimiento con el mensaje:
   > *"Esta aplicación no está verificada"* — Esto es esperado en modo Testing.
4. Hacer clic en **"Advanced" → "Go to canal-denuncias-arh (unsafe)"**.
5. Revisar los permisos solicitados (`drive.file`) y hacer clic en **Allow**.
6. Serás redirigido al callback. La respuesta JSON mostrará:
   ```json
   {
     "message": "OAuth exitoso. Copia el refresh_token y guárdalo en Netlify.",
     "access_token": "ya29.xxxxxxx",
     "refresh_token": "1//xxxxxxxxxxxxxxxxxxxxxxxx",
     "expires_in": 3599
   }
   ```
7. **Copiar el valor de `refresh_token`** — empieza con `1//`. Este es el
   secreto de larga duración.

   > **Si `refresh_token` aparece como `null`:** significa que ya autorizaste
   > esta app previamente y Google no emite un segundo refresh token. Para
   > forzarlo: ir a [https://myaccount.google.com/permissions](https://myaccount.google.com/permissions),
   > revocar el acceso de la app y repetir el flow desde el paso 2.
   > El parámetro `prompt: 'consent'` en la función también fuerza esto.

8. Guardar el `refresh_token` en el gestor de contraseñas antes de cerrar el
   navegador.

### 3.4 — Asegurar el endpoint de callback

Una vez obtenido el `refresh_token`, **modificar o eliminar** la función
`google-oauth-callback.js` para que no exponga los tokens en producción:

```javascript
// Versión segura para producción — no expone tokens
exports.handler = async (event) => {
  const { code } = event.queryStringParameters || {};

  if (!code) {
    return { statusCode: 400, body: 'Missing code' };
  }

  // ... (mismo intercambio de tokens) ...
  // En lugar de retornar los tokens, redirigir al panel de admin
  return {
    statusCode: 302,
    headers: { Location: '/admin/login?oauth=success' },
    body: '',
  };
};
```

---

## 4. Variables de entorno en Netlify

### 4.1 — Acceder a la configuración de entorno

1. Ir a [https://app.netlify.com](https://app.netlify.com) y abrir el sitio
   `denunciasarhconsultores`.
2. Navegar a: **Site configuration → Environment variables**.
3. O usar la URL directa:
   ```
   https://app.netlify.com/sites/denunciasarhconsultores/configuration/env
   ```

### 4.2 — Variables a configurar

Agregar cada una con el botón **Add a variable → Add a single variable**:

| Variable | Valor | Descripción |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `XXXXXXXXXXXX-xxxxxx.apps.googleusercontent.com` | ID público de la credencial OAuth |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxxxxxxxx` | Secreto de la credencial OAuth |
| `GOOGLE_REDIRECT_URI` | `https://denunciasarhconsultores.netlify.app/.netlify/functions/google-oauth-callback` | URI exacto del callback |
| `GOOGLE_REFRESH_TOKEN` | `1//xxxxxxxxxxxxxxxx` | Token obtenido en sección 3 |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | `1BxxxxxxxxxxxxxxxFolderId` | ID de la carpeta raíz en Drive (sección 5) |

> **Scope de las variables:** Para mayor seguridad, marcar las variables
> sensibles (`GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`) con el scope
> **"Functions"** únicamente, ya que no se necesitan en el frontend.

### 4.3 — Trigger deploy tras agregar variables

Las variables de entorno solo se inyectan en nuevos deploys. Después de
agregar todas las variables:

1. Ir a **Deploys**.
2. Hacer clic en **Trigger deploy → Deploy site**.
3. Esperar que el deploy complete (estado verde).

---

## 5. Crear carpeta raíz en Google Drive

La estructura de Drive se crea de forma híbrida: la carpeta raíz se crea
manualmente una vez, y las subcarpetas de año/folio las crea la aplicación
automáticamente.

### 5.1 — Crear la carpeta raíz manualmente

1. Abrir [https://drive.google.com](https://drive.google.com) con la cuenta
   Google autorizada (la misma que hizo el OAuth en sección 3).
2. En **Mi unidad**, hacer clic en **+ Nuevo → Carpeta**.
3. Nombre: `Canal-Denuncias-ARH` (respetar mayúsculas y guiones).
4. Hacer clic en **Crear**.

### 5.2 — Obtener el ID de la carpeta raíz

El ID de la carpeta está en la URL cuando la abres:

```
https://drive.google.com/drive/folders/1BxxxxxxxxxxxxxxxFolderId
                                       ^^^^^^^^^^^^^^^^^^^^^^^
                                       Este es el GOOGLE_DRIVE_ROOT_FOLDER_ID
```

1. Abrir la carpeta `Canal-Denuncias-ARH` en Drive.
2. Copiar el segmento de la URL después de `/folders/`.
   - Ejemplo: si la URL es
     `https://drive.google.com/drive/folders/1BcDeFgHiJkLmNoPqRsTuVwXyZ`,
     el ID es `1BcDeFgHiJkLmNoPqRsTuVwXyZ`.
3. Guardar este ID — se usará como `GOOGLE_DRIVE_ROOT_FOLDER_ID` (sección 4).

### 5.3 — Estructura resultante esperada

La aplicación creará automáticamente la siguiente estructura al procesar
denuncias con evidencias adjuntas:

```
Mi unidad/
└── Canal-Denuncias-ARH/          ← Creada manualmente (paso 5.1)
    └── 2026/                     ← Creada automáticamente al primer upload del año
        ├── ARH-2026-RQA3Z/       ← Creada automáticamente al subir evidencias del folio
        │   ├── evidencia-01.pdf
        │   └── evidencia-02.jpg
        └── ARH-2026-1A0NM/
            └── documento.docx
```

---

## 6. Verificar permisos de la carpeta

### 6.1 — Confirmar que la carpeta es privada

La carpeta `Canal-Denuncias-ARH` debe ser **estrictamente privada**:

1. En Drive, hacer clic derecho sobre la carpeta `Canal-Denuncias-ARH`.
2. Seleccionar **Compartir → Compartir**.
3. En el diálogo de compartir, verificar:
   - **No** debe aparecer "Cualquier persona con el enlace".
   - Solo debe aparecer el propietario (tu cuenta) con rol **Propietario**.
4. Si aparece un acceso general no deseado, hacer clic en el selector y
   cambiarlo a **"Restringido"**.
5. Hacer clic en **Listo**.

### 6.2 — Confirmar que el scope `drive.file` es suficiente

El scope `https://www.googleapis.com/auth/drive.file` otorga acceso **solo a
los archivos creados por la aplicación**. Esto significa:

- ✅ La app puede crear y leer archivos/carpetas que ella misma creó.
- ✅ La app puede subir archivos a la carpeta raíz que fue compartida con ella.
- ❌ La app NO puede ver otros archivos del Drive del usuario.

> **Acción requerida:** Para que `drive.file` permita subir a la carpeta raíz,
> la carpeta `Canal-Denuncias-ARH` **debe crearse a través de la API**
> (no manualmente), O la cuenta que hace el OAuth debe ser la misma propietaria
> de la carpeta.
>
> La forma más simple y segura es que la cuenta que hizo el OAuth en sección 3
> sea la misma propietaria de la carpeta creada en sección 5. En ese caso,
> `drive.file` tiene acceso completo a esa carpeta y su contenido.

### 6.3 — Verificar acceso programático

Usar el endpoint de Drive para listar la carpeta raíz y confirmar acceso:

```bash
# Obtener un access_token temporal usando el refresh_token
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=TU_CLIENT_ID" \
  -d "client_secret=TU_CLIENT_SECRET" \
  -d "refresh_token=TU_REFRESH_TOKEN" \
  -d "grant_type=refresh_token"

# Con el access_token obtenido, listar la carpeta raíz
curl "https://www.googleapis.com/drive/v3/files?q='TU_FOLDER_ID'+in+parents&fields=files(id,name,mimeType)" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

Respuesta esperada (carpeta vacía inicialmente):
```json
{
  "files": []
}
```

---

## 7. Prueba de conexión

### 7.1 — Prueba end-to-end desde Netlify

Con todas las variables configuradas y un deploy reciente, crear una función
de test temporal:

**`netlify/functions/test-drive.js`** (eliminar tras verificar):

```javascript
const { getAccessToken, getOrCreateFolder } = require('./lib/googleDrive');

exports.handler = async () => {
  try {
    // 1. Verificar que el token refresh funciona
    const token = await getAccessToken();
    console.log('✅ Access token obtenido correctamente');

    // 2. Verificar acceso a la carpeta raíz
    const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${rootId}?fields=id,name`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Carpeta raíz inaccesible: ${JSON.stringify(err)}`);
    }

    const folder = await res.json();
    console.log(`✅ Carpeta raíz accesible: ${folder.name} (${folder.id})`);

    // 3. Probar creación de subcarpeta de año
    const yearFolderId = await getOrCreateFolder('2026-TEST', rootId);
    console.log(`✅ Subcarpeta de prueba creada/encontrada: ${yearFolderId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'OK',
        rootFolder: folder.name,
        testFolderId: yearFolderId,
      }),
    };
  } catch (err) {
    console.error('❌ Error en prueba de Drive:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
```

**Ejecutar la prueba:**

```
https://denunciasarhconsultores.netlify.app/.netlify/functions/test-drive
```

**Resultado esperado:**
```json
{
  "status": "OK",
  "rootFolder": "Canal-Denuncias-ARH",
  "testFolderId": "1xxxxxxxxxxxxxxxxxxx"
}
```

> **Después de la prueba:** Eliminar la función `test-drive.js` y eliminar la
> carpeta `2026-TEST` de Drive manualmente.

### 7.2 — Verificar en el log de Netlify

1. Ir a **Deploys → Functions** en el dashboard de Netlify.
2. O ir a **Logs → Function logs**.
3. Confirmar que no aparecen errores de autenticación tras las primeras
   invocaciones reales.

### 7.3 — Verificar la estructura en Drive

Tras el primer upload real de una denuncia con evidencias, abrir Drive y
confirmar que se creó la estructura:

```
Canal-Denuncias-ARH/
└── 2026/
    └── ARH-2026-XXXXX/
        └── nombre-archivo.ext
```

---

## 8. Troubleshooting común

### ❌ `redirect_uri_mismatch`

**Síntoma:** Error de Google durante el flow OAuth.

**Causa:** El Redirect URI enviado en la request no coincide exactamente con el
registrado en Google Cloud Console.

**Solución:**
1. Ir a GCP → APIs & Services → Credentials → editar la credencial OAuth.
2. Verificar que el Redirect URI sea exactamente:
   ```
   https://denunciasarhconsultores.netlify.app/.netlify/functions/google-oauth-callback
   ```
3. Verificar que `GOOGLE_REDIRECT_URI` en Netlify tenga el mismo valor.
4. No hay trailing slash (`/`) al final.

---

### ❌ `refresh_token` es `null`

**Síntoma:** El callback retorna `refresh_token: null`.

**Causa:** La cuenta ya autorizó la app previamente y Google no reemite el
refresh token por defecto.

**Solución:**
1. Ir a [https://myaccount.google.com/permissions](https://myaccount.google.com/permissions).
2. Buscar la app `canal-denuncias-arh` y hacer clic en **Quitar acceso**.
3. Repetir el flow OAuth desde la sección 3.3.
4. El parámetro `prompt: 'consent'` en `google-oauth.js` también fuerza la
   re-emisión del refresh token.

---

### ❌ `invalid_grant` al usar el refresh token

**Síntoma:** Error al intentar obtener un access token nuevo.

**Causas posibles:**

| Causa | Solución |
|---|---|
| App en modo *Testing* y han pasado 7 días | Repetir el flow OAuth (sección 3.3) para obtener un nuevo refresh token |
| El refresh token fue revocado manualmente | Repetir el flow OAuth |
| El refresh token fue usado en otro lugar simultáneo | Netlify usa una sola instancia, no debería ocurrir |
| El `GOOGLE_CLIENT_SECRET` en Netlify es incorrecto | Verificar y corregir la variable de entorno |

> **Para eliminar la expiración de 7 días:** Publicar la aplicación OAuth
> (cambiar estado de *Testing* a *In production* en la pantalla de
> consentimiento). Requiere verificación de Google si usa scopes sensibles.
> El scope `drive.file` es considerado **no sensible** y generalmente no
> requiere verificación extensa.

---

### ❌ `insufficientPermissions` al subir archivo

**Síntoma:** Error 403 al llamar a la Drive API.

**Causa:** El scope autorizado no incluye los permisos necesarios, o se está
intentando acceder a una carpeta que no fue creada por la app.

**Solución:**
1. Verificar que el scope en `google-oauth.js` sea `https://www.googleapis.com/auth/drive.file`.
2. Verificar que la carpeta raíz fue creada por la misma cuenta que hizo el OAuth.
3. Si la carpeta fue creada por otra cuenta, transferir la propiedad o usar
   el scope `https://www.googleapis.com/auth/drive` (más permisivo, requiere
   re-autorización).

---

### ❌ Carpeta no encontrada (`File not found: <GOOGLE_DRIVE_ROOT_FOLDER_ID>`)

**Síntoma:** Error 404 al intentar listar o crear subcarpetas.

**Causa:** El `GOOGLE_DRIVE_ROOT_FOLDER_ID` es incorrecto o la carpeta fue
eliminada.

**Solución:**
1. Abrir la carpeta en Drive y copiar el ID correcto de la URL.
2. Actualizar `GOOGLE_DRIVE_ROOT_FOLDER_ID` en Netlify.
3. Hacer un nuevo deploy.

---

### ❌ La función de Netlify no encuentra las variables de entorno

**Síntoma:** `process.env.GOOGLE_CLIENT_ID` es `undefined`.

**Causa:** Las variables se agregaron pero no se hizo un nuevo deploy.

**Solución:** Ir a Deploys → **Trigger deploy** → Deploy site.

---

### ❌ `This app is blocked` durante el flow OAuth

**Síntoma:** Google muestra "Esta app está bloqueada" durante el consentimiento.

**Causa:** La cuenta que intenta autorizar no está en la lista de usuarios de
prueba de GCP.

**Solución:**
1. Ir a GCP → APIs & Services → OAuth consent screen → **Test users**.
2. Hacer clic en **Add Users**.
3. Agregar el correo Google que usarás para el OAuth.
4. Guardar y repetir el flow.

---

## 9. Revocar acceso

### 9.1 — Desde la cuenta de Google (usuario final)

Para revocar el acceso que el usuario autorizó:

1. Ir a [https://myaccount.google.com/permissions](https://myaccount.google.com/permissions).
2. Buscar **canal-denuncias-arh** (o el nombre de la app en la pantalla de
   consentimiento).
3. Hacer clic en **Quitar acceso**.
4. Confirmar.

Esto invalida inmediatamente el `refresh_token` almacenado en Netlify. La
próxima vez que la app intente refrescar el access token, recibirá `invalid_grant`.

### 9.2 — Desde Google Cloud Console (administrador)

Para revocar todos los tokens emitidos para un cliente OAuth específico:

1. Ir a GCP → **APIs & Services → Credentials**.
2. Localizar la credencial OAuth 2.0.
3. Opción A — Rotar el Client Secret:
   - Editar la credencial → **Reset Secret**.
   - Actualizar `GOOGLE_CLIENT_SECRET` en Netlify.
   - Todos los refresh tokens anteriores quedan inválidos.
4. Opción B — Eliminar la credencial:
   - Hacer clic en el ícono de papelera junto a la credencial.
   - Crear una nueva credencial y repetir el setup desde sección 2.

### 9.3 — Limpiar variables de entorno en Netlify

Si la integración con Drive se deshabilita permanentemente:

1. Ir a Netlify → Site configuration → Environment variables.
2. Eliminar:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `GOOGLE_REFRESH_TOKEN`
   - `GOOGLE_DRIVE_ROOT_FOLDER_ID`
3. Eliminar o deshabilitar las funciones en `netlify/functions/`.
4. Hacer un nuevo deploy.

---

## Resumen de la configuración completa

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONFIGURACIÓN REQUERIDA                       │
├─────────────────────────────────────────────────────────────────┤
│ Google Cloud Console                                             │
│  ✓ Proyecto: canal-denuncias-arh                                 │
│  ✓ Drive API habilitada                                          │
│  ✓ OAuth consent screen: scope drive.file, usuario de prueba     │
│  ✓ Credentials: Redirect URI del callback de Netlify             │
├─────────────────────────────────────────────────────────────────┤
│ Google Drive                                                     │
│  ✓ Carpeta "Canal-Denuncias-ARH" creada (por la cuenta OAuth)    │
│  ✓ Carpeta privada (Restringido, sin "Anyone with the link")     │
│  ✓ ID de carpeta copiado                                         │
├─────────────────────────────────────────────────────────────────┤
│ OAuth Flow                                                       │
│  ✓ Functions desplegadas en netlify/functions/                   │
│  ✓ Flow ejecutado: refresh_token obtenido y guardado             │
├─────────────────────────────────────────────────────────────────┤
│ Netlify — Variables de entorno                                   │
│  ✓ GOOGLE_CLIENT_ID                                              │
│  ✓ GOOGLE_CLIENT_SECRET                                          │
│  ✓ GOOGLE_REDIRECT_URI                                           │
│  ✓ GOOGLE_REFRESH_TOKEN                                          │
│  ✓ GOOGLE_DRIVE_ROOT_FOLDER_ID                                   │
│  ✓ Deploy realizado tras agregar variables                        │
├─────────────────────────────────────────────────────────────────┤
│ Verificación                                                     │
│  ✓ test-drive.js retornó status: OK                              │
│  ✓ Carpeta de test eliminada de Drive                            │
│  ✓ Función test-drive.js eliminada del repo                      │
└─────────────────────────────────────────────────────────────────┘
```

---

*Documento generado para Canal de Denuncias ARH — Última actualización: 2026-09-27*
