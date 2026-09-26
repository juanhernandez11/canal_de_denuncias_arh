# Plan de Migración — Supabase → Neon PostgreSQL

## Resumen

| Item | Detalle |
|---|---|
| Proyecto | Canal de Denuncias ARH Consultores |
| Migración | Supabase PostgreSQL → Neon PostgreSQL |
| Storage | No aplica (sin Supabase Storage activo) |
| Auth | No aplica (JWT propio, no Supabase Auth) |
| Email | Sin cambios (Nodemailer/Gmail) |
| Riesgo total | 🟡 Bajo-Medio |

---

## FASE 0 — Auditoría ✅
**Estado:** Completada  
**Output:** `MIGRATION_AUDIT.md`  

---

## FASE 1 — Crear cuenta Neon
**Tiempo estimado:** 10 min  
**Criterio de éxito:** Tienes `DATABASE_URL` y `DATABASE_URL_UNPOOLED`

Pasos:
1. Ve a [neon.tech](https://neon.tech) → Create account
2. Create project → nombre: `canal-denuncias-arh`
3. Region: us-east-2 (o la más cercana)
4. Copia las dos connection strings (pooled y direct)
5. Guárdalas en `.env.local`

---

## FASE 2 — Crear esquema en Neon
**Tiempo estimado:** 5 min  
**Criterio de éxito:** 3 tablas creadas, 8 content_blocks en seed

```bash
npm run migrate:db
```

O manualmente:
```bash
psql $DATABASE_URL_UNPOOLED -f database/schema.sql
psql $DATABASE_URL_UNPOOLED -f database/indexes.sql
psql $DATABASE_URL_UNPOOLED -f database/seed.sql
```

---

## FASE 3 — Migrar datos de Supabase a Neon
**Tiempo estimado:** 15-30 min  
**Criterio de éxito:** Mismo número de registros en ambas BDs

```bash
# 1. Exportar de Supabase
pg_dump "$SUPABASE_DB_URL" --no-owner --no-acl \
  --table=admins --table=denuncias --table=content_blocks \
  -f backup-supabase.sql

# 2. Importar a Neon (solo datos, sin DDL duplicado)
psql "$DATABASE_URL_UNPOOLED" -f backup-supabase.sql
```

---

## FASE 4 — No aplica (sin Supabase Storage)
**Estado:** Omitida — no existe Supabase Storage activo en el proyecto.

---

## FASE 5 — Código: nuevo cliente Neon ✅
**Estado:** Completada  
**Archivos:** `src/server/db-client.ts`, `src/server/db-neon.ts`, `src/server/db.ts`

---

## FASE 6 — No aplica (sin storage)

---

## FASE 7 — Actualizar API (Netlify Functions) ✅
**Estado:** Completada  
**Archivos:** `netlify/functions/_data.js`, `netlify/functions/send-email.js`

---

## FASE 8 — Pruebas locales
**Tiempo estimado:** 30 min  
**Criterio de éxito:** `npm run dev` funciona con `DATABASE_URL` de Neon

```bash
# Asegúrate de tener DATABASE_URL en .env.local
npm install          # instala pg
npm run migrate:db   # crea tablas en Neon
npm run dev          # prueba local
```

---

## FASE 9 — Deploy preview en Netlify
**Tiempo estimado:** 15 min  
**Criterio de éxito:** Preview URL funciona con Neon

1. Netlify → Site settings → Environment variables → Agrega `DATABASE_URL`
2. Push rama de migración → Netlify crea preview deploy automático
3. Verifica la URL de preview

---

## FASE 10 — Pruebas completas en preview
**Tiempo estimado:** 1-2h  
**Ver:** `MIGRATION_TEST_PLAN.md`

---

## FASE 11 — Cambiar producción
**Tiempo estimado:** 5 min  
**Criterio de éxito:** Producción en Netlify usa Neon

1. Netlify → Deploys → merge/publish rama de migración
2. Confirmar en logs que no hay errores

---

## FASE 12 — Supabase como backup temporal (48h)
No elimines Supabase. Monitorea logs de Netlify.

---

## FASE 13 — Eliminar Supabase
Ver criterios en `BACKUP_AND_ROLLBACK.md`.
