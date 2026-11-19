/**
 * STRESS TEST — Canal de Denuncias ARH
 * ─────────────────────────────────────────────────────────────
 * Propósito : Encontrar el punto de quiebre del sistema
 *             incrementando la carga hasta que empiece a fallar.
 *
 * ⚠️  ADVERTENCIA: Este test genera tráfico intenso y puede:
 *   · Consumir cuota de Netlify Functions (125k/mes free)
 *   · Agotar el pool de conexiones de Neon (20 max en free)
 *   · Disparar rate-limit de Gmail (500 correos/día)
 *   · Incurrir en costos si el plan lo permite
 *
 * Ejecutar SOLO en staging o con --env BASE_URL apuntando a un entorno de prueba.
 * Ejecutar  : k6 run k6/stress.test.js --env BASE_URL=https://staging.netlify.app
 * ─────────────────────────────────────────────────────────────
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8888';

const emailDuration    = new Trend('email_send_duration',   true);
const trackingDuration = new Trend('tracking_duration',     true);
const errorRate        = new Rate('error_rate');

export const options = {
  stages: [
    // Rampa agresiva para encontrar el límite
    { duration: '1m',  target: 10  },
    { duration: '2m',  target: 25  },
    { duration: '2m',  target: 50  },
    { duration: '2m',  target: 75  },
    { duration: '2m',  target: 100 },
    { duration: '3m',  target: 100 }, // Mantener el pico
    { duration: '2m',  target: 0   }, // Bajada
  ],
  thresholds: {
    // En stress test los umbrales son más permisivos — el objetivo es observar, no pasar
    http_req_failed:   ['rate<0.15'],   // Alertar si > 15 % de errores
    http_req_duration: ['p(95)<15000'], // 15 s máximo en p95
    error_rate:        ['rate<0.20'],
  },
};

function randomString(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // Mezcla de operaciones — simula comportamiento real bajo estrés
  const roll = Math.random();

  if (roll < 0.5) {
    // 50%: consulta de contenido público (la más barata)
    group('Contenido público', () => {
      const res = http.get(`${BASE_URL}/api/content`);
      check(res, { 'content → 200': (r) => r.status === 200 });
      errorRate.add(res.status !== 200);
    });

  } else if (roll < 0.85) {
    // 35%: tracking de folio
    group('Tracking', () => {
      const folio = `ARH-${new Date().getFullYear()}-${randomString(5).toUpperCase()}`;
      const res = http.get(`${BASE_URL}/api/folios/${folio}/status`);
      check(res, { 'tracking → 200|404': (r) => r.status === 200 || r.status === 404 });
      trackingDuration.add(res.timings.duration);
      errorRate.add(res.status !== 200 && res.status !== 404);
    });

  } else {
    // 15%: envío de denuncia (la más cara: Gmail + Neon)
    group('Envío denuncia', () => {
      const payload = JSON.stringify({
        subject: `Stress test denuncia ${randomString(6)}`,
        text: 'Prueba de stress generada por k6.',
        html: '<p>Prueba de stress.</p>',
        attachments: [],
        to: 'denunciasconsultoresarh@gmail.com',
      });
      const res = http.post(
        `${BASE_URL}/.netlify/functions/send-email`,
        payload,
        { headers, timeout: '20s' }
      );
      const ok = check(res, {
        'send-email → 200': (r) => r.status === 200,
      });
      emailDuration.add(res.timings.duration);
      errorRate.add(!ok);
    });
  }

  // Pausa muy corta para maximizar la presión
  sleep(0.1 + Math.random() * 0.5);
}
