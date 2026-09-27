# DATABASE MIGRATION PLAN — Canal de Denuncias ARH

**Proyecto:** Canal de Denuncias ARH  
**Motor de BD:** Neon PostgreSQL  
**Fecha del plan:** 2026-09-27  
**Autor:** Senior Full-Stack Engineer / DBA  
**Objetivo:** Extender `archivos_denuncia` para soportar Google Drive como backend de almacenamiento adicional, sin perder compatibilidad con los registros R2 existentes.

---

## Tabla de contenidos

1. [Estado actual de la base de datos](#1-estado-actual-de-la-base-de-datos)
2. [Análisis de tablas, relaciones, índices y constraints](#2-análisis-de-tablas-relaciones-índices-y-constraints)
3. [Cambios requeridos para Google Drive](#3-cambios-requeridos-para-google-drive)
4. [Script de migración no destructivo](#4-script-de-migración-no-destructivo)
5. [Cómo verificar la migración](#5-cómo-verificar-la-migración)
6. [Rollback plan](#6-rollback-plan)
7. [Consideraciones de seguridad](#7-consideraciones-de-seguridad)

---

## 1. Estado actual de la base de datos

### Motor y entorno

| Parámetro       | Valor                      |
|-----------------|----------------------------|
| Motor           | PostgreSQL (Neon)          |
| Archivo fuente  | `database/schema.sql`      |
| Entorno         | Producción                 |

### Datos en producción (al momento del plan)

| Tabla               | Registros |
|---------------------|-----------|
| `admins`            | 1 (`adminrh`) |
| `denuncias`         | 2 (de prueba) |
| `content_blocks`    | 8 |
| `archivos_denuncia` | 0 archivos confirmados (tabla vacía; los archivos subidos usaron R2 pero no se registraron en BD) |

> **Nota importante:** La tabla `archivos_denuncia` está vacía en producción. Esto significa que la migración que afecta sus columnas no tiene riesgo de corrupción de datos existentes, aunque se aplica igualmente de forma no destructiva para seguir buenas prácticas.

---

## 2. Análisis de tablas, relaciones, índices y constraints

### 2.1 Tabla `admins`

```sql
CREATE TABLE IF NOT EXISTS admins (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| Columna         | Tipo        | Nullable | Notas                              |
|-----------------|-------------|----------|------------------------------------|
| `id`            | BIGINT      | NO       | PK, identity generada automáticamente |
| `username`      | TEXT        | NO       | UNIQUE — identificador de login    |
| `password_hash` | TEXT        | NO       | Hash bcrypt de la contraseña       |
| `created_at`    | TIMESTAMPTZ | NO       | Timestamp con zona horaria         |

**Índices implícitos:**
- PK en `id`
- UNIQUE en `username`

**Relaciones:** Ninguna (tabla independiente).

**Estado:** Sin cambios requeridos en esta migración.

---

### 2.2 Tabla `denuncias`

```sql
CREATE TABLE IF NOT EXISTS denuncias (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  folio               TEXT UNIQUE NOT NULL,
  estatus             TEXT NOT NULL DEFAULT 'recibida'
                        CONSTRAINT denuncias_estatus_check
                        CHECK (estatus IN ('recibida','en_revision','en_investigacion','resuelta','desestimada')),
  tipo                TEXT,
  empresa             TEXT,
  centro              TEXT,
  modo                TEXT,
  denunciante_nombre  TEXT,
  denunciante_correo  TEXT,
  descripcion         TEXT,
  payload_json        TEXT,
  notas_admin         TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| Columna              | Tipo        | Nullable | Notas                                   |
|----------------------|-------------|----------|-----------------------------------------|
| `id`                 | BIGINT      | NO       | PK, identity                            |
| `folio`              | TEXT        | NO       | UNIQUE — clave de negocio, referenciada por `archivos_denuncia` |
| `estatus`            | TEXT        | NO       | CHECK: valores controlados              |
| `tipo`               | TEXT        | SÍ       | Categoría de la denuncia                |
| `empresa`            | TEXT        | SÍ       | Empresa involucrada                     |
| `centro`             | TEXT        | SÍ       | Centro de trabajo                       |
| `modo`               | TEXT        | SÍ       | Modalidad (anónima / identificada)      |
| `denunciante_nombre` | TEXT        | SÍ       | Nullable para denuncias anónimas        |
| `denunciante_correo` | TEXT        | SÍ       | Nullable para denuncias anónimas        |
| `descripcion`        | TEXT        | SÍ       | Cuerpo libre de la denuncia             |
| `payload_json`       | TEXT        | SÍ       | Snapshot completo del formulario en JSON|
| `notas_admin`        | TEXT        | NO       | DEFAULT '' — nunca NULL                 |
| `created_at`         | TIMESTAMPTZ | NO       | Inmutable tras inserción                |
| `updated_at`         | TIMESTAMPTZ | NO       | Debe actualizarse en cada UPDATE        |

**Constraints:**
- `denuncias_estatus_check`: limita `estatus` a los 5 valores del flujo de trabajo.

**Índices implícitos:**
- PK en `id`
- UNIQUE en `folio`

**Relaciones:** `folio` es referenciado como FK desde `archivos_denuncia.denuncia_folio`.

**Estado:** Sin cambios requeridos en esta migración.

---

### 2.3 Tabla `content_blocks`

```sql
CREATE TABLE IF NOT EXISTS content_blocks (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  block_key  TEXT UNIQUE NOT NULL,
  label      TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'text'
               CONSTRAINT content_blocks_type_check
               CHECK (type IN ('text','textarea','html','image_list')),
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| Columna     | Tipo        | Nullable | Notas                          |
|-------------|-------------|----------|--------------------------------|
| `id`        | BIGINT      | NO       | PK, identity                   |
| `block_key` | TEXT        | NO       | UNIQUE — identificador CMS     |
| `label`     | TEXT        | NO       | Etiqueta legible para el admin |
| `type`      | TEXT        | NO       | CHECK: 4 tipos de bloque       |
| `value`     | TEXT        | NO       | DEFAULT '' — contenido del bloque |
| `updated_at`| TIMESTAMPTZ | NO       | Timestamp de última edición    |

**Constraints:**
- `content_blocks_type_check`: restringe `type` a los 4 tipos soportados por el CMS.

**Índices implícitos:**
- PK en `id`
- UNIQUE en `block_key`

**Relaciones:** Ninguna.

**Estado:** Sin cambios requeridos en esta migración.

---

### 2.4 Tabla `archivos_denuncia` ← **TABLA A MIGRAR**

```sql
CREATE TABLE IF NOT EXISTS archivos_denuncia (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  denuncia_folio   TEXT NOT NULL REFERENCES denuncias(folio) ON DELETE CASCADE,
  nombre_original  TEXT NOT NULL,
  nombre_storage   TEXT NOT NULL,
  mime_type        TEXT NOT NULL,
  size_bytes       INTEGER NOT NULL,
  r2_key           TEXT NOT NULL UNIQUE,   -- <-- se volverá nullable
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archivos_denuncia_folio
  ON archivos_denuncia (denuncia_folio);
```

| Columna           | Tipo        | Nullable | Notas                                 |
|-------------------|-------------|----------|---------------------------------------|
| `id`              | BIGINT      | NO       | PK, identity                          |
| `denuncia_folio`  | TEXT        | NO       | FK → `denuncias.folio` ON DELETE CASCADE |
| `nombre_original` | TEXT        | NO       | Nombre original del archivo subido    |
| `nombre_storage`  | TEXT        | NO       | Nombre en el sistema de almacenamiento|
| `mime_type`       | TEXT        | NO       | Tipo MIME del archivo                 |
| `size_bytes`      | INTEGER     | NO       | Tamaño en bytes                       |
| `r2_key`          | TEXT        | **NO**   | Clave única en Cloudflare R2 — **cambia a nullable** |
| `created_at`      | TIMESTAMPTZ | NO       | Inmutable                             |

**Índices explícitos:**
- `idx_archivos_denuncia_folio` en `denuncia_folio` — para lookups de archivos por denuncia.

**Índices implícitos:**
- PK en `id`
- UNIQUE en `r2_key`

**Relaciones:**
- `denuncia_folio` → `denuncias.folio` (FK con CASCADE DELETE: al borrar una denuncia se eliminan sus archivos)

**Problema identificado:** El diseño original asume un único backend de almacenamiento (R2). Para soportar Google Drive, la columna `r2_key` no puede seguir siendo `NOT NULL`, y se necesitan columnas adicionales para almacenar el identificador de Drive.

---

### 2.5 Diagrama de relaciones (ER simplificado)

```
admins              content_blocks
  id (PK)              id (PK)
  username             block_key (UNIQUE)
  password_hash        label
  created_at           type
                       value
                       updated_at

denuncias
  id (PK)
  folio (UNIQUE)  ◄────────────────────┐
  estatus                              │ FK ON DELETE CASCADE
  ...                                  │
  created_at                           │
  updated_at                           │
                                       │
archivos_denuncia                      │
  id (PK)                              │
  denuncia_folio ──────────────────────┘
  nombre_original
  nombre_storage
  mime_type
  size_bytes
  r2_key (UNIQUE, nullable tras migración)
  [google_drive_file_id]   ← NUEVO
  [google_drive_folder_id] ← NUEVO
  [storage_provider]       ← NUEVO
  created_at
```

---

## 3. Cambios requeridos para Google Drive

### 3.1 Motivación

El sistema actualmente soporta un único backend de almacenamiento de archivos: **Cloudflare R2**, referenciado a través de la columna `r2_key`. Para agregar **Google Drive** como alternativa (o reemplazo), se requiere:

1. **Columna `storage_provider`** — discriminador que indica qué backend almacena cada archivo (`'r2'` o `'google_drive'`).
2. **Columna `google_drive_file_id`** — ID único del archivo en Google Drive (equivalente a `r2_key` pero para Drive).
3. **Columna `google_drive_folder_id`** — ID de la carpeta en Drive donde se almacena el archivo (para organización por folio/denuncia).
4. **`r2_key` nullable** — los archivos nuevos subidos a Drive no tendrán `r2_key`; hacerla nullable preserva los registros R2 existentes sin romper inserciones de archivos Drive.

### 3.2 Decisión de diseño: no destructivo

Dado que `archivos_denuncia` está vacía en producción, técnicamente sería posible recrear la tabla. Sin embargo, se elige una migración **ALTER TABLE** por las siguientes razones:

- Es la práctica estándar en entornos de producción (evita pérdida accidental de datos).
- Es reversible con otro `ALTER TABLE`.
- No requiere bloqueo prolongado de tabla (los `ADD COLUMN` y `ALTER COLUMN DROP NOT NULL` en PostgreSQL son operaciones rápidas).
- Mantiene la FK y los índices existentes intactos.

### 3.3 Resumen de cambios

| Cambio | Tipo | Impacto |
|--------|------|---------|
| `ADD COLUMN google_drive_file_id TEXT UNIQUE` | Adición | Nullable, sin efecto en registros existentes |
| `ADD COLUMN google_drive_folder_id TEXT` | Adición | Nullable, sin efecto en registros existentes |
| `ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'r2'` | Adición | DEFAULT 'r2' cubre todos los registros existentes |
| `ALTER COLUMN r2_key DROP NOT NULL` | Modificación | Relaja constraint; no afecta datos existentes |
| `CREATE INDEX idx_archivos_drive_file_id` | Índice nuevo | Solo lectura, sin impacto en datos |
| `CREATE INDEX idx_archivos_storage_provider` | Índice nuevo | Solo lectura, sin impacto en datos |

---

## 4. Script de migración no destructivo

> **Instrucciones de ejecución:**
> 1. Abrir **Neon Dashboard → SQL Editor** (o conectarse vía `psql`/cliente PostgreSQL).
> 2. Ejecutar el script completo en una sola transacción.
> 3. Verificar con las queries de la sección 5.

```sql
-- ============================================================
-- MIGRACIÓN: Soporte Google Drive en archivos_denuncia
-- Proyecto:  Canal de Denuncias ARH
-- Fecha:     2026-09-27
-- Motor:     Neon PostgreSQL
-- Tipo:      NO DESTRUCTIVA — solo ADD COLUMN y DROP NOT NULL
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Agregar columna: identificador del archivo en Google Drive
--    UNIQUE y nullable: cada archivo Drive tendrá un ID único;
--    los archivos R2 existentes lo dejarán como NULL.
-- ------------------------------------------------------------
ALTER TABLE archivos_denuncia
  ADD COLUMN IF NOT EXISTS google_drive_file_id TEXT;

-- La restricción UNIQUE se agrega por separado para poder usar
-- IF NOT EXISTS en la columna y manejar idempotencia.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'archivos_denuncia_google_drive_file_id_key'
      AND conrelid = 'archivos_denuncia'::regclass
  ) THEN
    ALTER TABLE archivos_denuncia
      ADD CONSTRAINT archivos_denuncia_google_drive_file_id_key
      UNIQUE (google_drive_file_id);
  END IF;
END$$;

-- ------------------------------------------------------------
-- 2. Agregar columna: ID de la carpeta en Google Drive
--    Nullable: se usará para agrupar archivos de una misma
--    denuncia dentro de una subcarpeta en Drive.
-- ------------------------------------------------------------
ALTER TABLE archivos_denuncia
  ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT;

-- ------------------------------------------------------------
-- 3. Agregar columna: discriminador de backend de almacenamiento
--    NOT NULL con DEFAULT 'r2' para cubrir registros existentes.
--    CHECK constraint limita a los backends soportados.
-- ------------------------------------------------------------
ALTER TABLE archivos_denuncia
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'r2';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'archivos_denuncia_storage_check'
      AND conrelid = 'archivos_denuncia'::regclass
  ) THEN
    ALTER TABLE archivos_denuncia
      ADD CONSTRAINT archivos_denuncia_storage_check
      CHECK (storage_provider IN ('r2', 'google_drive'));
  END IF;
END$$;

-- ------------------------------------------------------------
-- 4. Hacer r2_key nullable
--    Los archivos subidos a Google Drive no tienen r2_key.
--    Los registros R2 existentes conservan su valor; la
--    restricción UNIQUE en r2_key se mantiene (NULLs no
--    compiten entre sí en PostgreSQL).
-- ------------------------------------------------------------
ALTER TABLE archivos_denuncia
  ALTER COLUMN r2_key DROP NOT NULL;

-- ------------------------------------------------------------
-- 5. Índice: búsqueda por google_drive_file_id
--    Útil para verificar duplicados y recuperar metadata.
--    El índice parcial excluye NULLs automáticamente.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_archivos_drive_file_id
  ON archivos_denuncia (google_drive_file_id)
  WHERE google_drive_file_id IS NOT NULL;

-- ------------------------------------------------------------
-- 6. Índice: búsqueda por storage_provider
--    Permite filtrar rápidamente todos los archivos de un
--    mismo backend (útil para auditoría y migraciones futuras).
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_archivos_storage_provider
  ON archivos_denuncia (storage_provider);

COMMIT;

-- ============================================================
-- FIN DE LA MIGRACIÓN
-- Ejecutar las queries de verificación de la sección 5
-- antes de desplegar la nueva versión de la aplicación.
-- ============================================================
```

> **Nota sobre idempotencia:** El script puede ejecutarse múltiples veces sin error gracias a `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` y los bloques `DO $$ ... $$` que verifican la existencia de constraints antes de crearlos.

---

## 5. Cómo verificar la migración

Ejecutar estas queries inmediatamente después de aplicar el script:

### 5.1 Verificar estructura final de la tabla

```sql
-- Debe mostrar todas las columnas incluyendo las 3 nuevas
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'archivos_denuncia'
ORDER BY ordinal_position;
```

**Resultado esperado (columnas relevantes):**

| column_name              | data_type         | is_nullable | column_default |
|--------------------------|-------------------|-------------|----------------|
| id                       | bigint            | NO          | (identity)     |
| denuncia_folio           | text              | NO          |                |
| nombre_original          | text              | NO          |                |
| nombre_storage           | text              | NO          |                |
| mime_type                | text              | NO          |                |
| size_bytes               | integer           | NO          |                |
| r2_key                   | text              | **YES**     |                |
| created_at               | timestamptz       | NO          | now()          |
| google_drive_file_id     | text              | YES         |                |
| google_drive_folder_id   | text              | YES         |                |
| storage_provider         | text              | NO          | 'r2'           |

### 5.2 Verificar constraints

```sql
-- Debe mostrar el CHECK constraint de storage_provider y el UNIQUE de google_drive_file_id
SELECT
  conname        AS constraint_name,
  contype        AS type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'archivos_denuncia'::regclass
ORDER BY contype, conname;
```

**Resultados esperados:**

| constraint_name                                | type | definition                                          |
|------------------------------------------------|------|-----------------------------------------------------|
| archivos_denuncia_pkey                         | p    | PRIMARY KEY (id)                                    |
| archivos_denuncia_google_drive_file_id_key     | u    | UNIQUE (google_drive_file_id)                       |
| archivos_denuncia_r2_key_key                   | u    | UNIQUE (r2_key)                                     |
| archivos_denuncia_storage_check                | c    | CHECK (storage_provider IN ('r2', 'google_drive'))  |
| archivos_denuncia_denuncia_folio_fkey          | f    | FOREIGN KEY (denuncia_folio) REFERENCES denuncias(folio) ON DELETE CASCADE |

### 5.3 Verificar índices

```sql
-- Debe mostrar los 2 índices nuevos más los existentes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'archivos_denuncia'
ORDER BY indexname;
```

**Índices esperados:**

| indexname                          | descripción                              |
|------------------------------------|------------------------------------------|
| archivos_denuncia_pkey             | PK en `id`                               |
| archivos_denuncia_r2_key_key       | UNIQUE en `r2_key`                       |
| archivos_denuncia_google_drive_file_id_key | UNIQUE en `google_drive_file_id` |
| idx_archivos_denuncia_folio        | BTree en `denuncia_folio`                |
| idx_archivos_drive_file_id         | BTree parcial en `google_drive_file_id` WHERE NOT NULL |
| idx_archivos_storage_provider      | BTree en `storage_provider`              |

### 5.4 Verificar integridad de datos existentes

```sql
-- Todos los registros existentes deben tener storage_provider = 'r2'
-- y google_drive_file_id = NULL (tabla vacía en producción, resultado = 0 filas)
SELECT
  COUNT(*)                                          AS total_archivos,
  COUNT(*) FILTER (WHERE storage_provider = 'r2')  AS archivos_r2,
  COUNT(*) FILTER (WHERE storage_provider = 'google_drive') AS archivos_drive,
  COUNT(*) FILTER (WHERE r2_key IS NULL AND storage_provider = 'r2') AS r2_sin_key  -- debe ser 0
FROM archivos_denuncia;
```

### 5.5 Prueba funcional: insertar un archivo Drive de prueba

```sql
-- Insertar registro de prueba con Google Drive (r2_key NULL)
INSERT INTO archivos_denuncia
  (denuncia_folio, nombre_original, nombre_storage, mime_type,
   size_bytes, r2_key, google_drive_file_id, google_drive_folder_id, storage_provider)
SELECT
  folio,
  'test_drive.pdf',
  'test_drive.pdf',
  'application/pdf',
  1024,
  NULL,                        -- r2_key NULL para archivos Drive
  '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms', -- ID ficticio de ejemplo
  '1FBohfGXjJCKMTJIg-WBNmfV2p3G8fHgW',             -- folder ID ficticio de ejemplo
  'google_drive'
FROM denuncias
LIMIT 1;

-- Verificar inserción
SELECT id, denuncia_folio, nombre_original, storage_provider,
       r2_key, google_drive_file_id, google_drive_folder_id
FROM archivos_denuncia
WHERE storage_provider = 'google_drive';

-- Limpiar registro de prueba
DELETE FROM archivos_denuncia WHERE storage_provider = 'google_drive';
```

### 5.6 Verificar que el CHECK constraint rechaza valores inválidos

```sql
-- Debe fallar con ERROR: new row violates check constraint
INSERT INTO archivos_denuncia
  (denuncia_folio, nombre_original, nombre_storage, mime_type,
   size_bytes, storage_provider)
SELECT folio, 'x', 'x', 'text/plain', 1, 'dropbox'
FROM denuncias LIMIT 1;
-- Resultado esperado: ERROR
```

---

## 6. Rollback plan

La migración es reversible en su totalidad. En caso de necesitar deshacer los cambios:

> **Cuándo usar rollback:** Si la aplicación presenta errores inesperados tras la migración, o si las verificaciones de la sección 5 revelan inconsistencias.

### 6.1 Script de rollback completo

```sql
-- ============================================================
-- ROLLBACK: Revertir soporte Google Drive en archivos_denuncia
-- PRECAUCIÓN: Ejecutar SOLO si no hay registros con
--             storage_provider = 'google_drive' en la tabla.
--             Si los hay, se perderán esas referencias.
-- ============================================================

BEGIN;

-- 1. Eliminar índices nuevos
DROP INDEX IF EXISTS idx_archivos_drive_file_id;
DROP INDEX IF EXISTS idx_archivos_storage_provider;

-- 2. Eliminar constraint CHECK de storage_provider
ALTER TABLE archivos_denuncia
  DROP CONSTRAINT IF EXISTS archivos_denuncia_storage_check;

-- 3. Eliminar constraint UNIQUE de google_drive_file_id
ALTER TABLE archivos_denuncia
  DROP CONSTRAINT IF EXISTS archivos_denuncia_google_drive_file_id_key;

-- 4. Eliminar columnas nuevas
ALTER TABLE archivos_denuncia
  DROP COLUMN IF EXISTS storage_provider,
  DROP COLUMN IF EXISTS google_drive_folder_id,
  DROP COLUMN IF EXISTS google_drive_file_id;

-- 5. Restaurar r2_key a NOT NULL
--    PRECAUCIÓN: fallará si hay filas con r2_key IS NULL.
--    Verificar antes:
--      SELECT COUNT(*) FROM archivos_denuncia WHERE r2_key IS NULL;
ALTER TABLE archivos_denuncia
  ALTER COLUMN r2_key SET NOT NULL;

COMMIT;
```

### 6.2 Precondición para el rollback del paso 5

Antes de ejecutar el rollback, verificar que no existan filas con `r2_key` en NULL:

```sql
SELECT COUNT(*) FROM archivos_denuncia WHERE r2_key IS NULL;
-- Debe retornar 0 para poder restaurar el NOT NULL
```

Si hay registros con `r2_key IS NULL` (archivos Drive ya creados), el rollback requiere primero eliminarlos o asignarles un valor:

```sql
-- Opción A: eliminar los archivos Drive (si son de prueba y aceptable)
DELETE FROM archivos_denuncia WHERE r2_key IS NULL;

-- Opción B: asignar un placeholder (solo si se acepta la inconsistencia)
-- UPDATE archivos_denuncia SET r2_key = 'ROLLBACK_' || id WHERE r2_key IS NULL;
```

### 6.3 Matriz de riesgo del rollback

| Paso | Riesgo | Reversible |
|------|--------|-----------|
| DROP INDEX | Bajo — solo afecta rendimiento | Sí (recrear con CREATE INDEX) |
| DROP CONSTRAINT CHECK | Bajo — relaja validación | Sí (re-agregar con ADD CONSTRAINT) |
| DROP COLUMN | **Alto** — elimina datos Drive si los hay | No recuperable sin backup |
| SET NOT NULL en r2_key | Medio — falla si hay NULLs | Sí, con DROP NOT NULL |

> **Conclusión:** El rollback es seguro mientras `archivos_denuncia` no contenga registros con `storage_provider = 'google_drive'` (situación actual en producción).

---

## 7. Consideraciones de seguridad

### 7.1 Acceso a la BD (Neon)

- Las credenciales de conexión a Neon deben mantenerse **exclusivamente en variables de entorno del servidor** (nunca en el frontend ni en el repositorio).
- Variables afectadas: `DATABASE_URL` o equivalente configurado en el proyecto.
- Verificar que `.env.local` y `.env` estén en `.gitignore`.

### 7.2 Credenciales de Google Drive

- Las credenciales del Service Account de Google (archivo JSON con la clave privada) son equivalentes en sensibilidad a las claves de base de datos.
- Deben almacenarse como variable de entorno (contenido del JSON en base64 o ruta a archivo fuera del repositorio).
- **Nunca subir** `credentials.json`, `service-account.json` ni similar al repositorio.
- Agregar al `.gitignore`:
  ```
  *service-account*.json
  *credentials*.json
  google-drive-key.json
  ```

### 7.3 Exposición de IDs de Google Drive

- `google_drive_file_id` y `google_drive_folder_id` son identificadores que permiten acceder directamente a archivos si las carpetas Drive son públicas.
- Las carpetas de Drive usadas por la aplicación deben tener acceso **restringido** (solo el Service Account y administradores explícitos).
- El backend nunca debe exponer estos IDs directamente al frontend público; usarlos únicamente para generar URLs firmadas o para descarga proxy.

### 7.4 Datos sensibles en `denuncias`

- La tabla `denuncias` contiene datos personales (`denunciante_nombre`, `denunciante_correo`) y potencialmente sensibles (`descripcion`).
- `payload_json` almacena el formulario completo en texto plano: revisar que no incluya datos que requieran cifrado en reposo.
- En Neon, habilitar **cifrado en reposo** (disponible por defecto en el plan Pro; verificar el plan actual).
- Los archivos adjuntos en Google Drive pueden contener información sensible: asegurarse de que la carpeta del Service Account no sea indexable por Google ni accesible por link público.

### 7.5 Integridad referencial y DELETE CASCADE

- La FK `archivos_denuncia.denuncia_folio → denuncias.folio ON DELETE CASCADE` elimina automáticamente todos los archivos BD cuando se borra una denuncia.
- **Esto no elimina los archivos físicos** en R2 ni en Google Drive — esa lógica debe implementarse en el código de aplicación (handler de DELETE denuncia).
- Riesgo: si se borra una denuncia directamente en BD (sin pasar por la app), los archivos físicos quedan huérfanos en el almacenamiento.
- Recomendación: implementar una tarea de limpieza periódica que detecte archivos en Drive/R2 sin registro en BD.

### 7.6 Validación en aplicación

Aunque el CHECK constraint de `storage_provider` garantiza integridad en BD, la lógica de negocio debe validar adicionalmente:

- Si `storage_provider = 'r2'`, entonces `r2_key` debe ser NOT NULL (validar en la capa de servicio).
- Si `storage_provider = 'google_drive'`, entonces `google_drive_file_id` debe ser NOT NULL (validar en la capa de servicio).

Estas reglas de consistencia cruzada no pueden expresarse directamente con un simple CHECK constraint sin una función, por lo que recaen en la aplicación.

> **Opcional (PostgreSQL avanzado):** Se puede implementar con un CHECK constraint compuesto:
> ```sql
> ALTER TABLE archivos_denuncia
>   ADD CONSTRAINT archivos_denuncia_storage_consistency_check
>   CHECK (
>     (storage_provider = 'r2' AND r2_key IS NOT NULL) OR
>     (storage_provider = 'google_drive' AND google_drive_file_id IS NOT NULL)
>   );
> ```
> Este constraint garantiza consistencia a nivel de BD y se recomienda agregar tras la migración inicial.

### 7.7 Auditoría

- La tabla `archivos_denuncia` no tiene columna `updated_at`. Considerar agregar en una migración futura si se requiere auditoría de cambios en metadata de archivos.
- Neon ofrece logs de queries en el dashboard; habilitar para entornos de producción con datos sensibles.

---

## Resumen ejecutivo

| | |
|---|---|
| **Tablas modificadas** | 1 (`archivos_denuncia`) |
| **Tipo de cambio** | No destructivo (ADD COLUMN + DROP NOT NULL) |
| **Tiempo estimado de ejecución** | < 1 segundo (tabla vacía) |
| **Riesgo** | Muy bajo (0 registros afectados en producción) |
| **Reversibilidad** | Total (script de rollback incluido) |
| **Downtime requerido** | Ninguno |
| **Columnas añadidas** | `google_drive_file_id`, `google_drive_folder_id`, `storage_provider` |
| **Índices añadidos** | `idx_archivos_drive_file_id`, `idx_archivos_storage_provider` |
| **Columnas modificadas** | `r2_key`: `NOT NULL` → nullable |
