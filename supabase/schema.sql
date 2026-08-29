-- ============================================================================
-- Esquema de base de datos para el Canal de Denuncias ARH (Supabase / Postgres)
-- ============================================================================
-- Cómo aplicarlo:
--   Dashboard de Supabase -> SQL Editor -> pega este archivo -> Run.
--
-- Notas de seguridad:
--   - El backend accede con la SERVICE_ROLE key, que ignora RLS.
--   - Habilitamos RLS y NO creamos políticas públicas: así, aunque alguien
--     obtenga la anon key, no podrá leer/escribir estas tablas desde el cliente.
--   - El usuario admin por defecto NO se crea aquí; lo crea el servidor al
--     arrancar (hash de bcryptjs). Ver src/server/db.ts -> ensureSeed().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabla: admins
-- ----------------------------------------------------------------------------
create table if not exists public.admins (
  id            bigint generated always as identity primary key,
  username      text unique not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Tabla: denuncias
-- ----------------------------------------------------------------------------
create table if not exists public.denuncias (
  id                  bigint generated always as identity primary key,
  folio               text unique not null,
  estatus             text not null default 'recibida',
  tipo                text,
  empresa             text,
  centro              text,
  modo                text,
  denunciante_nombre  text,
  denunciante_correo  text,
  descripcion         text,
  payload_json        text,
  notas_admin         text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_denuncias_estatus    on public.denuncias (estatus);
create index if not exists idx_denuncias_created_at on public.denuncias (created_at desc);

-- ----------------------------------------------------------------------------
-- Tabla: content_blocks
-- ----------------------------------------------------------------------------
create table if not exists public.content_blocks (
  id         bigint generated always as identity primary key,
  block_key  text unique not null,
  label      text not null,
  type       text not null default 'text',
  value      text not null default '',
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Seed de content_blocks (idempotente)
-- ----------------------------------------------------------------------------
insert into public.content_blocks (block_key, label, type, value) values
  ('home.titulo',           'Título principal',              'text',     'Canal Ético de Denuncias'),
  ('home.subtitulo',        'Subtítulo',                     'textarea', 'Reporta de forma segura y confidencial cualquier conducta irregular.'),
  ('home.descripcion',      'Descripción de inicio',         'html',     '<p>Tu denuncia será tratada con total confidencialidad...</p>'),
  ('home.aviso_privacidad', 'Texto de la casilla de privacidad', 'html',     'Acepto la <strong>Política de privacidad</strong> del Canal Ético y autorizo el tratamiento de mis datos conforme a la misma.'),
  ('home.terminos',         'Texto de la casilla de términos y condiciones', 'html', 'Al pulsar <strong>Enviar</strong>, acepto los <strong>términos y condiciones</strong> de uso del Canal Ético.'),
  ('footer.texto',          'Texto del pie de página',       'text',       'ARH Consultores © 2026 — Todos los derechos reservados'),
  ('footer.logos',          'Logos del pie de página',       'image_list', '[]'),
  ('contacto.email',        'Correo de contacto del comité', 'text',       'denunciasconsultoresarh@gmail.com')
on conflict (block_key) do nothing;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
-- Habilitamos RLS sin políticas públicas. El backend usa service_role (bypass).
alter table public.admins         enable row level security;
alter table public.denuncias      enable row level security;
alter table public.content_blocks enable row level security;
