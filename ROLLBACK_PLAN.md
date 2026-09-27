# ROLLBACK PLAN — Migración R2 → Google Drive

> **Proyecto:** Canal de Denuncias ARH  
> **Fecha de elaboración:** 2026-09-27  
> **Alcance:** Migración de almacenamiento de archivos de Cloudflare R2 a Google Drive  
> **Responsable de ejecución:** Desarrollador principal + revisión de seguridad  

---

## 1. Estado actual — Baseline (punto de partida seguro)

Este es el estado **verificado y funcional** antes de comenzar cualquier fase de migración. En caso de fallo catastrófico en cualquier fase, este es el estado al que se puede volver.

| Componente | Estado | Notas |
|---|---|---|
| **Storage** | Cloudflare R2 ✅ funcional | Bucket activo, credenciales válidas |
| **Base de datos** | Neon PostgreSQL ✅ funcional | Ya migrado desde Supabase |
| **Backend** | Netlify Functions ✅ funcional | Deploy activo |
| **Frontend** | Vite + React 19 ✅ funcional | Build de producción activo |
| **Denuncias en producción** | 2 denuncias de prueba | Sin datos personales reales críticos |
| **Archivos en R2** | 0 archivos críticos reales | Safe to experiment |
| **Backup Supabase** | `data/supabase_backup.json` ✅ existe | Referencia histórica |

> **Regla de oro:** antes de cada fase, verificar que el baseline sigue funcional ejecutando el checklist de smoke test (§6).

---

## 2. Mapa de fases

```
Baseline ──► Fase 2 ──► Fase 3 ──► Fase 4 ──► Fase 5
(R2 actual)  (Drive    (Integrac.) (Migrac.   (Cleanup
             test)                 R2→Drive)   Supabase)
              ↑ bajo     ↑ medio    ↑ medio     ↑ PUNTO DE
              riesgo     riesgo     riesgo       NO RETORNO
```

Cada flecha es un punto de rollback independiente. Se puede revertir cualquier fase sin afectar las anteriores (excepto Fase 5, que es irreversible).

---

## 3. Fase 2 — Google Drive: prueba de conexión OAuth

### Objetivo
Verificar que el flujo OAuth funciona correctamente en un entorno de prueba aislado. No afecta el flujo de producción de R2.

### Archivos involucrados
```
netlify/functions/google-oauth-init.js      ← nuevo
netlify/functions/google-oauth-callback.js  ← nuevo
Drive: carpeta _test/                        ← nueva (solo en Drive)
Netlify env vars: GOOGLE_*                   ← nuevas
```

### Cómo hacer rollback de Fase 2

**Tiempo estimado: 10 minutos**  
**Riesgo: BAJO** — ninguna funcionalidad de producción se ve afectada.

```bash
# Paso 1: Eliminar funciones OAuth de prueba
rm netlify/functions/google-oauth-init.js
rm netlify/functions/google-oauth-callback.js

# Paso 2: Remover variables de entorno de Netlify
netlify env:unset GOOGLE_CLIENT_ID
netlify env:unset GOOGLE_CLIENT_SECRET
netlify env:unset GOOGLE_REFRESH_TOKEN
netlify env:unset GOOGLE_REDIRECT_URI
netlify env:unset GOOGLE_DRIVE_ROOT_FOLDER_ID

# Paso 3: Eliminar carpeta _test/ de Google Drive
# (manual desde drive.google.com o via script)

# Paso 4: Deploy
netlify deploy --prod
```

**Verificación post-rollback:**
- [ ] El endpoint de upload a R2 sigue funcionando
- [ ] Las funciones google-oauth*.js ya no existen en el deploy
- [ ] Las variables GOOGLE_* no aparecen en `netlify env:list`

---

## 4. Fase 3 — Integración Google Drive en flujo principal

### Objetivo
Activar Google Drive como storage provider opcional, controlado por la variable de entorno `STORAGE_PROVIDER`. R2 sigue siendo el default.

### Archivos involucrados
```
netlify/functions/upload-file.js   ← modificado (lógica de routing por STORAGE_PROVIDER)
netlify/functions/get-file.js      ← modificado (lógica de routing por STORAGE_PROVIDER)
netlify/functions/drive-service.js ← nuevo (wrapper de Drive API)
Netlify env vars: STORAGE_PROVIDER=drive  ← cambiado
Neon DB: columna drive_file_id en tabla files  ← nueva columna (IF NOT EXISTS)
```

### Cómo hacer rollback de Fase 3

**Tiempo estimado: 2 minutos (solo cambio de env var)**  
**Riesgo: MEDIO**

```bash
# Rollback inmediato — cambiar feature flag
netlify env:set STORAGE_PROVIDER r2
netlify deploy --prod
```

**¿Se pierden datos?** No directamente, pero con matices:
- Los archivos subidos **mientras `STORAGE_PROVIDER=drive` estaba activo** están almacenados en Google Drive.
- Sus metadatos (`drive_file_id`) están en Neon.
- Al volver a `STORAGE_PROVIDER=r2`, el código de R2 intentará buscar el archivo en R2 por su `r2_key`, que no existe para esos archivos.
- **Resultado:** esos archivos quedan temporalmente inaccesibles (los metadatos existen pero el código de R2 no puede servirlos).
- **Mitigación:** en el período de prueba de Fase 3, no procesar denuncias reales con archivos críticos.

**Rollback completo de código (si es necesario revertir también los cambios de código):**

```bash
# Revertir archivos modificados a su versión pre-Fase 3
git checkout main -- netlify/functions/upload-file.js
git checkout main -- netlify/functions/get-file.js
# Eliminar el nuevo wrapper
rm netlify/functions/drive-service.js
# La columna drive_file_id en Neon puede dejarse (no rompe nada con IF NOT EXISTS)
netlify deploy --prod
```

**Verificación post-rollback:**
- [ ] `STORAGE_PROVIDER=r2` confirmado en `netlify env:list`
- [ ] Subir un archivo de prueba y verificar que llega a R2
- [ ] Descargar el archivo de prueba y verificar que se sirve desde R2

---

## 5. Fase 4 — Migración de archivos existentes R2 → Drive

### Objetivo
Copiar todos los archivos existentes en R2 a Google Drive y actualizar los metadatos en Neon (columna `drive_file_id`). Una vez validado, `STORAGE_PROVIDER=drive` se activa permanentemente.

### Pre-requisitos OBLIGATORIOS antes de ejecutar

```
[ ] Backup completo de la tabla files en Neon (ver §5.1)
[ ] Verificar que 0 denuncias nuevas se están recibiendo (maintenance window)
[ ] Script de migración probado en staging con datos de prueba
[ ] R2 sigue activo y funcional (no deshabilitar hasta validación completa)
[ ] GOOGLE_DRIVE_ROOT_FOLDER_ID documentado y registrado en este documento
```

**GOOGLE_DRIVE_ROOT_FOLDER_ID:** `________________________` ← completar antes de ejecutar

### 5.1 Backup de Neon antes de migrar

```bash
# Exportar tabla files completa antes de cualquier ALTER o UPDATE
pg_dump $DATABASE_URL \
  --table=files \
  --format=custom \
  --file=data/neon_files_backup_$(date +%Y%m%d_%H%M%S).dump

# Verificar que el backup es válido
pg_restore --list data/neon_files_backup_*.dump | head -20
```

### Cómo hacer rollback de Fase 4

**Tiempo estimado: 2 minutos (cambio de env var) + validación**  
**Riesgo: MEDIO**

```bash
# Rollback inmediato — volver a R2
netlify env:set STORAGE_PROVIDER r2
netlify deploy --prod
```

**Estado de los datos:**
- Los archivos en R2 **no se borran** durante la migración (solo se copian a Drive).
- Los metadatos nuevos (`drive_file_id`) se agregan en Neon, pero los campos de R2 siguen existiendo.
- Al volver a `STORAGE_PROVIDER=r2`, el código vuelve a servir desde R2 sin pérdida de datos.

> ⚠️ **REGLA CRÍTICA:** NO eliminar el bucket de R2 hasta que:
> 1. `STORAGE_PROVIDER=drive` esté activo en producción por al menos 7 días sin incidentes.
> 2. Todos los archivos hayan sido verificados uno a uno en Drive.
> 3. Se haya obtenido aprobación explícita del equipo.

**Rollback de datos si la migración corrompió metadatos:**

```bash
# Restaurar tabla files desde el backup
pg_restore \
  --dbname=$DATABASE_URL \
  --table=files \
  --clean \
  data/neon_files_backup_*.dump
```

**Verificación post-rollback:**
- [ ] `STORAGE_PROVIDER=r2` confirmado
- [ ] Descargar 3 archivos existentes y verificar integridad
- [ ] Subir un archivo nuevo y verificar que va a R2
- [ ] Verificar que los metadatos de Neon son consistentes con R2

---

## 6. Fase 5 — Cleanup de Supabase (PUNTO DE NO RETORNO)

> 🔴 **ESTA FASE ES IRREVERSIBLE**

### Objetivo
Eliminar archivos y referencias históricas de Supabase que ya no son necesarios.

### Archivos a eliminar

```
supabase/schema.sql          ← eliminar del repo
supabase/                    ← eliminar directorio completo
.env.example entries:        ← remover SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
README.md                    ← actualizar referencias a Supabase
```

### Pre-requisitos OBLIGATORIOS — no ejecutar sin verificar

```
[ ] Neon PostgreSQL tiene TODOS los datos que tenía Supabase
[ ] data/supabase_backup.json existe y está completo
[ ] Llevan al menos 30 días sin ninguna referencia a Supabase en logs de producción
[ ] Ninguna función activa importa @supabase/supabase-js
[ ] El equipo ha revisado y aprobado formalmente esta fase
```

**Verificación de que no hay dependencias activas de Supabase:**

```bash
# Buscar cualquier referencia a Supabase en el código activo
grep -r "supabase" netlify/functions/ --include="*.js"
grep -r "@supabase" package.json
grep -r "SUPABASE_" netlify/functions/ --include="*.js"
# Si alguno de estos retorna resultados, NO ejecutar Fase 5
```

### Backup final antes del cleanup

```bash
# Verificar que data/supabase_backup.json existe y es legible
cat data/supabase_backup.json | python -m json.tool > /dev/null && echo "JSON válido"

# Crear copia adicional con timestamp
cp data/supabase_backup.json data/supabase_backup_final_$(date +%Y%m%d).json
```

### Cómo hacer rollback de Fase 5

> ⚠️ El rollback de Fase 5 es complicado. Una vez eliminados los archivos de schema de Supabase y desconectado el proyecto de Supabase, restaurar requiere:
> 1. Recrear el proyecto en Supabase (nueva URL, nuevas credenciales).
> 2. Re-ejecutar el schema desde el backup.
> 3. Importar datos desde `data/supabase_backup.json`.
> 4. Actualizar variables de entorno en Netlify.

**Por esto, ejecutar Fase 5 solo cuando:**
- Neon lleva meses funcionando en producción sin incidentes.
- Existe un backup reciente y verificado de Neon.
- No hay ninguna razón operativa para mantener Supabase.

---

## 7. Checklist pre-migración (ejecutar antes de Fase 3)

```
[ ] Backup de Neon antes de cualquier ALTER TABLE (columna drive_file_id)
[ ] Verificar que las migraciones usan IF NOT EXISTS (0 downtime)
[ ] Documentar GOOGLE_DRIVE_ROOT_FOLDER_ID en este documento (§5)
[ ] Probar el flujo OAuth completo en staging antes de activar en prod
[ ] Verificar que R2 sigue funcional (smoke test) antes de cambiar STORAGE_PROVIDER
[ ] Reducir límite de upload a 4 MB en la UI (límite real de Netlify Functions)
[ ] Revisar todos los console.log en functions — sin datos sensibles
[ ] Implementar validación MIME por magic bytes (librería file-type)
[ ] IDOR fix aplicado en get-file.js
[ ] Rate limiting en upload endpoint implementado
```

---

## 8. Smoke test — verificación de sistema funcional

Ejecutar este checklist después de cualquier rollback o deploy para confirmar que el sistema está operativo.

```
[ ] GET  / → 200 OK (frontend carga)
[ ] POST /api/nueva-denuncia → 201 (con datos de prueba)
[ ] GET  /api/denuncia/:folio → 200 (folio de prueba creado arriba)
[ ] POST /api/admin/login → 200 con cookie admin_token
[ ] GET  /api/admin/folios → 200 (autenticado)
[ ] POST /api/upload-file → 200 (archivo de prueba < 1 MB)
[ ] GET  /api/get-file?id=X → 200 (archivo subido en paso anterior)
[ ] Verificar en storage (R2 o Drive según STORAGE_PROVIDER) que el archivo existe
[ ] Verificar en Neon que los metadatos del archivo existen
[ ] POST /api/admin/logout → 200
```

---

## 9. Contactos y recursos en caso de emergencia

| Recurso | URL |
|---|---|
| Netlify Dashboard | https://app.netlify.com |
| Google Cloud Console (revocar token) | https://console.cloud.google.com/apis/credentials |
| Neon Dashboard | https://console.neon.tech |
| Cloudflare R2 Dashboard | https://dash.cloudflare.com → R2 |
| Logs de Netlify Functions | Netlify Dashboard → Functions → Logs |

### Procedimiento de emergencia — compromiso de credenciales

**Si `GOOGLE_REFRESH_TOKEN` se compromete:**
1. Ir a [Google Cloud Console → OAuth 2.0](https://console.cloud.google.com/apis/credentials) → Revocar token — **INMEDIATAMENTE**
2. Regenerar credenciales OAuth (nuevo client secret)
3. Re-ejecutar el flujo OAuth para obtener nuevo refresh token
4. Actualizar `GOOGLE_REFRESH_TOKEN` y `GOOGLE_CLIENT_SECRET` en Netlify env vars
5. Redeploy
6. Auditar logs para determinar el alcance del acceso no autorizado

**Si `JWT_SECRET` se compromete:**
1. Cambiar `JWT_SECRET` en Netlify env vars (invalida TODAS las sesiones activas)
2. Redeploy
3. Todos los admins deberán volver a iniciar sesión

**Si `DATABASE_URL` se compromete:**
1. Rotar credenciales en el panel de Neon
2. Actualizar `DATABASE_URL` en Netlify env vars
3. Redeploy

---

*Plan elaborado por el equipo de seguridad. Actualizar tras completar cada fase.*
