import type { Express, Request, Response } from 'express';
import {
  getContentMap,
  listContentBlocks,
  updateContentBlock,
  listDenuncias,
  getDenuncia,
  updateDenuncia,
  getFolioStatus,
  verifyAdmin,
} from './db.ts';
import {
  signToken,
  requireAuth,
  COOKIE_NAME,
  type AuthedRequest,
} from './auth.ts';
import { ESTATUS_LABELS, type EstatusFolio } from '../types/admin.ts';
import { sendEstatusEmail } from './mail.ts';

const isProd = process.env.NODE_ENV === 'production';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
    maxAge: 12 * 60 * 60 * 1000, // 12h
  };
}

const VALID_ESTATUS = Object.keys(ESTATUS_LABELS) as EstatusFolio[];

export function registerAdminRoutes(app: Express): void {
  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  app.post('/api/admin/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body ?? {};
      if (typeof username !== 'string' || typeof password !== 'string') {
        res.status(400).json({ error: 'Credenciales inválidas' });
        return;
      }
      const admin = await verifyAdmin(username, password);
      if (!admin) {
        res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        return;
      }
      const token = signToken({ username: admin.username });
      res.cookie(COOKIE_NAME, token, cookieOptions());
      res.json({ ok: true, user: { username: admin.username } });
    } catch (err) {
      console.error('[login]', err);
      res.status(500).json({ error: 'Error del servidor' });
    }
  });

  app.post('/api/admin/logout', (_req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/admin/me', requireAuth, (req: AuthedRequest, res: Response) => {
    res.json({ user: { username: req.admin?.username } });
  });

  // -------------------------------------------------------------------------
  // Folios (protegido)
  // -------------------------------------------------------------------------
  app.get(
    '/api/admin/folios',
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { estatus, q, page, pageSize } = req.query;
        const result = await listDenuncias({
          estatus: typeof estatus === 'string' && estatus ? estatus : undefined,
          q: typeof q === 'string' && q ? q : undefined,
          page: page ? Number(page) : undefined,
          pageSize: pageSize ? Number(pageSize) : undefined,
        });
        res.json(result);
      } catch (err) {
        console.error('[folios:list]', err);
        res.status(500).json({ error: 'Error al listar folios' });
      }
    }
  );

  app.get(
    '/api/admin/folios/:folio',
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const denuncia = await getDenuncia(req.params.folio);
        if (!denuncia) {
          res.status(404).json({ error: 'Folio no encontrado' });
          return;
        }
        let payload: unknown = null;
        if (denuncia.payload_json) {
          try {
            payload = JSON.parse(denuncia.payload_json);
          } catch {
            payload = null;
          }
        }
        res.json({ ...denuncia, payload });
      } catch (err) {
        console.error('[folios:detail]', err);
        res.status(500).json({ error: 'Error al obtener el folio' });
      }
    }
  );

  app.patch(
    '/api/admin/folios/:folio',
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { estatus, notas_admin } = req.body ?? {};

        if (estatus !== undefined) {
          if (
            typeof estatus !== 'string' ||
            !VALID_ESTATUS.includes(estatus as EstatusFolio)
          ) {
            res.status(400).json({ error: 'Estatus inválido' });
            return;
          }
        }
        if (notas_admin !== undefined && typeof notas_admin !== 'string') {
          res.status(400).json({ error: 'notas_admin inválido' });
          return;
        }

        const previo = await getDenuncia(req.params.folio);
        if (!previo) {
          res.status(404).json({ error: 'Folio no encontrado' });
          return;
        }

        const updated = await updateDenuncia(req.params.folio, {
          estatus: estatus as EstatusFolio | undefined,
          notas_admin,
        });
        if (!updated) {
          res.status(404).json({ error: 'Folio no encontrado' });
          return;
        }

        // Notificar al denunciante si el estatus cambió y dejó correo
        let notificado = false;
        if (
          estatus !== undefined &&
          estatus !== previo.estatus &&
          updated.denunciante_correo
        ) {
          notificado = await sendEstatusEmail(
            updated.denunciante_correo,
            updated.folio,
            estatus as EstatusFolio
          );
        }
        res.json({ ...updated, notificado });
      } catch (err) {
        console.error('[folios:patch]', err);
        res.status(500).json({ error: 'Error al actualizar el folio' });
      }
    }
  );

  // -------------------------------------------------------------------------
  // CMS (protegido para escritura)
  // -------------------------------------------------------------------------
  app.get(
    '/api/admin/content',
    requireAuth,
    async (_req: Request, res: Response) => {
      try {
        res.json(await listContentBlocks());
      } catch (err) {
        console.error('[content:list]', err);
        res.status(500).json({ error: 'Error al listar contenido' });
      }
    }
  );

  app.put(
    '/api/admin/content/:block_key',
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { value } = req.body ?? {};
        if (typeof value !== 'string') {
          res.status(400).json({ error: 'value inválido' });
          return;
        }
        const updated = await updateContentBlock(req.params.block_key, value);
        if (!updated) {
          res.status(404).json({ error: 'Bloque no encontrado' });
          return;
        }
        res.json(updated);
      } catch (err) {
        console.error('[content:put]', err);
        res.status(500).json({ error: 'Error al actualizar contenido' });
      }
    }
  );

  // -------------------------------------------------------------------------
  // Contenido público (sin auth)
  // -------------------------------------------------------------------------
  app.get('/api/content', async (_req: Request, res: Response) => {
    try {
      res.json(await getContentMap());
    } catch (err) {
      console.error('[content:public]', err);
      res.status(500).json({ error: 'Error al obtener contenido' });
    }
  });

  // -------------------------------------------------------------------------
  // Tracking público (sin auth)
  // -------------------------------------------------------------------------
  app.get('/api/folios/:folio/status', async (req: Request, res: Response) => {
    try {
      const status = await getFolioStatus(req.params.folio);
      if (!status) {
        res.status(404).json({ error: 'Folio no encontrado' });
        return;
      }
      res.json(status);
    } catch (err) {
      console.error('[folios:status]', err);
      res.status(500).json({ error: 'Error al obtener el estatus' });
    }
  });
}
