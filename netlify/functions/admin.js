// Función Netlify que expone la API del panel admin, el contenido público (CMS)
// y el tracking público. Enruta según el path de la petición.
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const {
  VALID_ESTATUS,
  listDenuncias,
  getDenuncia,
  updateDenuncia,
  getFolioStatus,
  listContentBlocks,
  getContentMap,
  updateContentBlock,
  getAdminByUsername,
} = require('./_data');
const { sendEstatusEmail } = require('./_mail');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-arh-change-me';
const COOKIE_NAME = 'admin_token';
const TOKEN_TTL = '12h';
const isProd = process.env.NODE_ENV === 'production';

// ---------- helpers ----------
function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  };
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > -1) {
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  });
  return out;
}

function cookieString(token) {
  const attrs = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${12 * 60 * 60}`,
  ];
  if (isProd) attrs.push('Secure');
  return attrs.join('; ');
}

function clearCookieString() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

function getAuth(event) {
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded && typeof decoded.username === 'string') {
      return { username: decoded.username };
    }
    return null;
  } catch {
    return null;
  }
}

// Normaliza el path quitando prefijos de Netlify Functions.
function normalizePath(event) {
  let p = event.path || '';
  p = p.replace('/.netlify/functions/admin', '');
  return p || '/';
}

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = normalizePath(event);
  const qs = event.queryStringParameters || {};

  try {
    // ---------------- Público: contenido CMS ----------------
    if (path === '/api/content' && method === 'GET') {
      return json(200, await getContentMap());
    }

    // ---------------- Público: tracking ----------------
    const trackMatch = path.match(/^\/api\/folios\/([^/]+)\/status$/);
    if (trackMatch && method === 'GET') {
      const status = await getFolioStatus(decodeURIComponent(trackMatch[1]));
      if (!status) return json(404, { error: 'Folio no encontrado' });
      return json(200, status);
    }

    // ---------------- Auth: login ----------------
    if (path === '/api/admin/login' && method === 'POST') {
      const { username, password } = JSON.parse(event.body || '{}');
      if (typeof username !== 'string' || typeof password !== 'string') {
        return json(400, { error: 'Credenciales inválidas' });
      }
      const admin = await getAdminByUsername(username);
      if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
        return json(401, { error: 'Usuario o contraseña incorrectos' });
      }
      const token = jwt.sign({ username: admin.username }, JWT_SECRET, {
        expiresIn: TOKEN_TTL,
      });
      return json(200, { ok: true, user: { username: admin.username } }, {
        'Set-Cookie': cookieString(token),
      });
    }

    // ---------------- Auth: logout ----------------
    if (path === '/api/admin/logout' && method === 'POST') {
      return json(200, { ok: true }, { 'Set-Cookie': clearCookieString() });
    }

    // ---------------- A partir de aquí: protegido ----------------
    const user = getAuth(event);

    if (path === '/api/admin/me' && method === 'GET') {
      if (!user) return json(401, { error: 'No autenticado' });
      return json(200, { user });
    }

    // Todas las demás rutas /api/admin/* requieren auth
    if (path.startsWith('/api/admin/')) {
      if (!user) return json(401, { error: 'No autenticado' });

      // Folios: lista
      if (path === '/api/admin/folios' && method === 'GET') {
        const result = await listDenuncias({
          estatus: qs.estatus || undefined,
          q: qs.q || undefined,
          page: qs.page ? Number(qs.page) : undefined,
          pageSize: qs.pageSize ? Number(qs.pageSize) : undefined,
        });
        return json(200, result);
      }

      // Folios: detalle / patch
      const folioMatch = path.match(/^\/api\/admin\/folios\/([^/]+)$/);
      if (folioMatch) {
        const folio = decodeURIComponent(folioMatch[1]);
        if (method === 'GET') {
          const d = await getDenuncia(folio);
          if (!d) return json(404, { error: 'Folio no encontrado' });
          let payload = null;
          if (d.payload_json) {
            try {
              payload = JSON.parse(d.payload_json);
            } catch {
              payload = null;
            }
          }
          return json(200, { ...d, payload });
        }
        if (method === 'PATCH') {
          const { estatus, notas_admin } = JSON.parse(event.body || '{}');
          if (estatus !== undefined && !VALID_ESTATUS.includes(estatus)) {
            return json(400, { error: 'Estatus inválido' });
          }
          if (notas_admin !== undefined && typeof notas_admin !== 'string') {
            return json(400, { error: 'notas_admin inválido' });
          }
          // Estado previo para detectar si el estatus realmente cambió
          const previo = await getDenuncia(folio);
          if (!previo) return json(404, { error: 'Folio no encontrado' });

          const updated = await updateDenuncia(folio, { estatus, notas_admin });
          if (!updated) return json(404, { error: 'Folio no encontrado' });

          // Notificar al denunciante si el estatus cambió y dejó correo
          let notificado = false;
          if (
            estatus !== undefined &&
            estatus !== previo.estatus &&
            updated.denunciante_correo
          ) {
            notificado = await sendEstatusEmail(
              updated.denunciante_correo,
              folio,
              estatus
            );
          }
          return json(200, { ...updated, notificado });
        }
      }

      // CMS: lista
      if (path === '/api/admin/content' && method === 'GET') {
        return json(200, await listContentBlocks());
      }

      // CMS: update por block_key
      const blockMatch = path.match(/^\/api\/admin\/content\/(.+)$/);
      if (blockMatch && method === 'PUT') {
        const { value } = JSON.parse(event.body || '{}');
        if (typeof value !== 'string') {
          return json(400, { error: 'value inválido' });
        }
        const updated = await updateContentBlock(
          decodeURIComponent(blockMatch[1]),
          value
        );
        if (!updated) return json(404, { error: 'Bloque no encontrado' });
        return json(200, updated);
      }
    }

    return json(404, { error: 'Ruta no encontrada' });
  } catch (err) {
    console.error('[admin fn]', err);
    return json(500, { error: 'Error del servidor' });
  }
};
