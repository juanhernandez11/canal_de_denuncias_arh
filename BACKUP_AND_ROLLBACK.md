# Backup y Rollback — Canal de Denuncias ARH

## Estado Actual

Durante la migración, **Supabase permanece activo** como sistema de referencia.
No se elimina Supabase hasta validar 48h en producción con Neon.

## Backup de Datos (Supabase → archivo local)

### Opción A: Dashboard de Supabase
1. Supabase Dashboard → Settings → Database → Backups
2. Descarga el backup más reciente (`.sql`)

### Opción B: pg_dump
```bash
# Exportar datos de Supabase (reemplaza <SUPABASE_DB_URL> con tu URL directa)
pg_dump "$SUPABASE_DB_URL" \
  --no-owner --no-acl \
  --table=admins \
  --table=denuncias \
  --table=content_blocks \
  -f backup-supabase-$(date +%Y%m%d).sql
```

### Opción C: Importar backup a Neon
```bash
psql "$DATABASE_URL_UNPOOLED" -f backup-supabase-YYYYMMDD.sql
```

## Procedimiento de Rollback (Neon → Supabase)

Tiempo estimado: **< 5 minutos**

### Paso 1: Revertir variables de entorno en Netlify
- Site settings → Environment variables
- Cambiar `DATABASE_URL` por `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- (Mantener `EMAIL_USER`, `EMAIL_PASS`, `JWT_SECRET` sin cambios)

### Paso 2: Hacer deploy del commit con cliente Supabase
- Netlify → Deploys → selecciona el deploy anterior → Publish deploy

### Paso 3: Verificar
- `GET /api/content` → debe retornar contenido
- `GET /api/folios/{folio}/status` → debe retornar estatus
- Login admin → debe funcionar

## Triggers de Rollback

Usa rollback inmediatamente si:
- ❌ Errores 500 en más del 5% de requests
- ❌ Login admin no funciona
- ❌ Folios no se crean o no se guardan
- ❌ Panel /admin/folios no carga
- ❌ Emails de confirmación no llegan

## Cuándo Eliminar Supabase

Elimina Supabase **solo después de**:
- [ ] 48h en producción sin errores en logs de Netlify
- [ ] Todos los checks del MIGRATION_TEST_PLAN pasando
- [ ] Backup manual descargado y verificado
- [ ] Cliente Supabase eliminado del código (PR mergeado)
- [ ] Variables SUPABASE_* eliminadas de Netlify
