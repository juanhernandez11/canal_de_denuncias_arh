-- ============================================================
-- Esquema Neon PostgreSQL — Canal de Denuncias ARH
-- Ejecutar: psql $DATABASE_URL_UNPOOLED -f database/schema.sql
-- Compatible con: PostgreSQL 15+
-- NO incluye RLS (seguridad por DATABASE_URL con password)
-- ============================================================

CREATE TABLE IF NOT EXISTS admins (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
