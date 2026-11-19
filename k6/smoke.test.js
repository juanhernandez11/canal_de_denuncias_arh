/**
 * SMOKE TEST — Canal de Denuncias ARH
 * ─────────────────────────────────────────────────────────────
 * Propósito : Verificar que el sistema responde correctamente
 *             con carga mínima (1 usuario, 1 minuto).
 * Instalar  : https://k6.io/docs/get-started/installation/
 * Ejecutar  : k6 run k6/smoke.test.js
 *             k6 run --env BASE_URL=https://tu-dominio.netlify.app k6/smoke.test.js
 * ─────────────────────────────────────────────────────────────
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ── Configuración ────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8888';

// Métricas personalizadas
const emailDuration  = new Trend('email_send_duration',  true);
const trackingDuration = new Trend('tracking_duration',  true);
const errorRate      = new Rate('error_rate');

export const options = {
  vus: 1,          // 1 usuario virtual
  duration: '1m',  // durante 1 minuto
  thresholds: {
    http_req_failed:   ['rate<0.01'],   // < 1 % de errores HTTP
    http_req_duration: ['p(95)<3000'],  // 95 % de peticiones < 3 s
    error_rate:        ['rate<0.05'],   // tasa de errores lógicos < 5 %
  },
};

// ── Helpers ──────────────────────────────────────────────────
function randomString(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function buildDenuncia() {
  return JSON.stringify({
    subject:  'Denuncia de prueba - smoke test',
    text:     'Texto plano de la denuncia de prueba.',
    html:     '<p>HTML de la denuncia de prueba.</p>',
    attachments: [],
    // Sin denuncianteEmail → no dispara el correo de confirmación
    to: 'denunciasconsultoresarh@gmail.com',
  });
}

// ── Escenario principal ───────────────────────────────────────
export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // 1. Página pública de contenido (CMS)
  {
    const res = http.get(`${BASE_URL}/api/content`);
    const ok = check(res, {
      'GET /api/content → 200': (r) => r.status === 200,
      'GET /api/content → JSON válido': (r) => {
        try { JSON.parse(r.body); return true; } catch { return false; }
      },
    });
    errorRate.add(!ok);
  }

  sleep(0.5);

  // 2. Tracking de folio inexistente → debe devolver 404
  {
    const folio = `ARH-SMOKE-${randomString(5).toUpperCase()}`;
    const res = http.get(`${BASE_URL}/api/folios/${folio}/status`);
    const ok = check(res, {
      'GET /api/folios/:folio/status → 404 para folio inexistente': (r) => r.status === 404,
    });
    trackingDuration.add(res.timings.duration);
    errorRate.add(!ok);
  }

  sleep(0.5);

  // 3. Envío de denuncia
  // En local el servidor Express expone /api/send-email.
  // En Netlify (staging/prod) el mismo path queda mapeado vía netlify.toml.
  {
    const res = http.post(
      `${BASE_URL}/api/send-email`,
      buildDenuncia(),
      { headers }
    );
    const ok = check(res, {
      'POST send-email → 200': (r) => r.status === 200,
      'POST send-email → tiene folio': (r) => {
        try { return !!JSON.parse(r.body).folio; } catch { return false; }
      },
    });
    emailDuration.add(res.timings.duration);
    errorRate.add(!ok);
  }

  sleep(1);
}
