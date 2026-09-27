-- ============================================================
-- MIGRACIÓN: Agregar soporte Google Drive a archivos_denuncia
-- Archivo: database/migration_gdrive.sql
-- Base de datos: Neon PostgreSQL
-- Comando: psql $DATABASE_URL_UNPOOLED -f database/migration_gdrive.sql
--
-- CARACTERÍSTICAS:
-- - No destructiva: usa IF NOT EXISTS y NOT NULL DROP COLUMN seguro
-- - Idempotente: se puede ejecutar múltiples veces sin error
-- - Compatible con archivos R2 existentes (r2_key queda nullable)
-- - Los archivos R2 existentes conservan storage_provider = 'r2'
-- ============================================================

BEGIN;

-- PASO 1: Hacer r2_key nullable para archivos nuevos en Google Drive
-- Los archivos R2 existentes conservan su r2_key.
-- Los nuevos archivos en Drive tendrán r2_key = NULL.
ALTER TABLE archivos_denuncia
  ALTER COLUMN r2_key DROP NOT NULL;

-- PASO 2: Agregar columna para Google Drive File ID
-- UNIQUE asegura no hay duplicados de archivo en Drive
ALTER TABLE archivos_denuncia
  ADD COLUMN IF NOT EXISTS google_drive_file_id TEXT;

-- Agregar constraint UNIQUE solo si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'archivos_denuncia_gdrive_file_id_key'
  ) THEN
    ALTER TABLE archivos_denuncia
      ADD CONSTRAINT archivos_denuncia_gdrive_file_id_key
      UNIQUE (google_drive_file_id);
  END IF;
END$$;

-- PASO 3: Agregar columna para Google Drive Folder ID del folio
ALTER TABLE archivos_denuncia
  ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT;

-- PASO 4: Agregar columna storage_provider con valor default 'r2'
-- Los archivos existentes quedan como 'r2' automáticamente.
-- Los nuevos archivos en Drive tendrán 'google_drive'.
ALTER TABLE archivos_denuncia
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'r2';

-- Agregar CHECK constraint solo si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'archivos_denuncia_storage_provider_check'
  ) THEN
    ALTER TABLE archivos_denuncia
      ADD CONSTRAINT archivos_denuncia_storage_provider_check
      CHECK (storage_provider IN ('r2', 'google_drive'));
  END IF;
END$$;

-- PASO 5: Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_archivos_gdrive_file_id
  ON archivos_denuncia (google_drive_file_id);

CREATE INDEX IF NOT EXISTS idx_archivos_storage_provider
  ON archivos_denuncia (storage_provider);

COMMIT;

-- ============================================================
-- VERIFICACIÓN — ejecutar después de la migración
-- ============================================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'archivos_denuncia'
ORDER BY ordinal_position;

-- Conteo por proveedor de storage
SELECT
  storage_provider,
  COUNT(*) AS total
FROM archivos_denuncia
GROUP BY storage_provider;
