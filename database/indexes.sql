-- ============================================================
-- Índices — Canal de Denuncias ARH (Neon)
-- ============================================================

-- Filtrado por estatus en panel admin
CREATE INDEX IF NOT EXISTS idx_denuncias_estatus
  ON denuncias (estatus);

-- Ordenamiento por fecha descendente
CREATE INDEX IF NOT EXISTS idx_denuncias_created_at
  ON denuncias (created_at DESC);

-- Búsqueda por folio (complementa el UNIQUE)
CREATE INDEX IF NOT EXISTS idx_denuncias_folio
  ON denuncias (folio);

-- Búsqueda por block_key en CMS (complementa el UNIQUE)
CREATE INDEX IF NOT EXISTS idx_content_blocks_block_key
  ON content_blocks (block_key);
