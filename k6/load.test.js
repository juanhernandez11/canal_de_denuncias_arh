/**
 * LOAD TEST — Canal de Denuncias ARH
 * ─────────────────────────────────────────────────────────────
 * Propósito : Simular carga normal sostenida de usuarios reales.
 *             Rampa suave → pico → rampa de bajada.
 * Ejecutar  : k6 run k6/load.test.js
 *             k6 run --env BASE_URL=https://tu-dominio.netlify.app k6/load.test.js
 *
 * Arquitectura objetivo:
 *   · Netlify Functions  → límite free: 125k invocaciones/mes, 10 s timeout
 *   · Neon PostgreSQL    → límite free: 0.5 GB almacenamiento, pool de 20 conex.
 *   · Gmail SMTP         → límite: ~500 correos/día en cuenta normal
 * ─────────────────────────────────────────────────────────────
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8888';

// Métricas personalizadas
const emailDuration    = new Trend('email_send_duration',    true);
const trackingDuration = new Trend('tracking_duration',      true);
const contentDuration  = new Trend('content_load_duration',  true);
const errorRate        = new Rate('error_rate');
const denunciasEnviadas = new Counter('denuncias_enviadas');

export const options = {
  stages: [
    { duration: '2m',  target: 5  },  // Rampa: 0 → 5 VUs
    { duration: '5m',  target: 10 },  // Carga sostenida: 10 VUs (realista para este canal)
    { duration: '2m',  target: 20 },  // Pico moderado
    { duration: '3m',  target: 20 },  // Pico sostenido
    { duration: '2m',  target: 0  },  // Bajada
  ],
  thresholds: {
    // SLOs de producción
    http_req_failed:        ['rate<0.02'],   // < 2 % errores HTTP
    http_req_duration:      ['p(95)<5000', 'p(99)<10000'],
    email_send_duration:    ['p(95)<8000'],  // Gmail puede tardar
    tracking_duration:      ['p(95)<2000'],  // Consulta de folio debe ser rápida
    content_load_duration:  ['p(95)<1000'],  // CMS público debe ser muy rápido
    error_rate:             ['rate<0.05'],
  },
};

function randomString(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const TIPOS = [
  'Actos de corrupción/fraude',
  'Acoso laboral o sexual/hostigamiento',
  'Incumplimiento al código de ética',
  'Discriminación o trato desigual',
  'Otros',
];

function buildDenuncia(anonimo = true) {
  const base = {
    subject: `Denuncia k6 - ${TIPOS[Math.floor(Math.random() * TIPOS.length)]}`,
    text: `Descripción de prueba generada por k6. ID: ${randomString(12)}`,
    html: `<p>Descripción de prueba generada por k6.</p>`,
    attachments: [],
    to: 'denunciasconsultoresarh@gmail.com',
  };
  if (!anonimo) {
    base.denuncianteEmail = `test-${randomString(6)}@example.com`;
  }
  return JSON.stringify(base);
}

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // ── Grupo 1: Carga de página pública ─────────────────────
  group('Contenido público', () => {
    const res = http.get(`${BASE_URL}/api/content`);
    const ok = check(res, {
      'GET /api/content → 200': (r) => r.status === 200,
      'GET /api/content → body no vacío': (r) => r.body && r.body.length > 10,
    });
    contentDuration.add(res.timings.duration);
    errorRate.add(!ok);
    sleep(0.3);
  });

  // ── Grupo 2: Consulta de folio (tracking) ─────────────────
  group('Tracking de folio', () => {
    // 70% consulta folio inexistente, 30% formato válido pero no existente
    const folio = Math.random() > 0.3
      ? `ARH-${new Date().getFullYear()}-${randomString(5).toUpperCase()}`
      : `INVALIDO-${randomString(8)}`;

    const res = http.get(`${BASE_URL}/api/folios/${folio}/status`);
    check(res, {
      'tracking → 200 o 404': (r) => r.status === 200 || r.status === 404,
    });
    trackingDuration.add(res.timings.duration);
    sleep(0.5);
  });

  // ── Grupo 3: Envío de denuncia ────────────────────────────
  // Solo el 20% de los VUs envía una denuncia en cada iteración
  // (simula que no todos los visitantes llegan al paso final)
  if (Math.random() < 0.2) {
    group('Envío de denuncia', () => {
      const anonimo = Math.random() > 0.4; // 60% anónimas
      const res = http.post(
        `${BASE_URL}/.netlify/functions/send-email`,
        buildDenuncia(anonimo),
        { headers, timeout: '15s' }
      );
      const ok = check(res, {
        'POST send-email → 200': (r) => r.status === 200,
        'POST send-email → folio en respuesta': (r) => {
          try { return !!JSON.parse(r.body).folio; } catch { return false; }
        },
      });
      emailDuration.add(res.timings.duration);
      errorRate.add(!ok);
      if (ok) denunciasEnviadas.add(1);
    });
  }

  sleep(Math.random() * 2 + 1); // pausa aleatoria 1–3 s entre iteraciones
}
