-- ============================================================
-- MIGRATION SCRIPT — Supabase → Neon PostgreSQL
-- ADVERTENCIA: Ejecutar SOLO en Neon, NUNCA en Supabase
-- Comando: psql $DATABASE_URL_UNPOOLED -f database/migration.sql
-- Es completamente idempotente (se puede ejecutar múltiples veces)
-- ============================================================

-- PASO 1: Crear esquema
\i database/schema.sql

-- PASO 2: Crear índices
\i database/indexes.sql

-- PASO 3: Insertar datos iniciales
\i database/seed.sql

-- PASO 4: Verificación
SELECT 'admins' AS tabla, COUNT(*) AS registros FROM admins
UNION ALL
SELECT 'denuncias', COUNT(*) FROM denuncias
UNION ALL
SELECT 'content_blocks', COUNT(*) FROM content_blocks;
