-- ============================================================
-- Seed inicial — Canal de Denuncias ARH (Neon)
-- Idempotente: ON CONFLICT DO NOTHING
-- El admin por defecto se crea desde código al arrancar (ensureSeed)
-- ============================================================

INSERT INTO content_blocks (block_key, label, type, value) VALUES
  ('home.titulo',           'Título principal',                          'text',       'Canal Ético de Denuncias'),
  ('home.subtitulo',        'Subtítulo',                                 'textarea',   'Reporta de forma segura y confidencial cualquier conducta irregular.'),
  ('home.descripcion',      'Descripción de inicio',                     'html',       '<p>Tu denuncia será tratada con total confidencialidad...</p>'),
  ('home.aviso_privacidad', 'Texto de la casilla de privacidad',         'html',       'Acepto la <strong>Política de privacidad</strong> del Canal Ético y autorizo el tratamiento de mis datos conforme a la misma.'),
  ('home.terminos',         'Texto de la casilla de términos',           'html',       'Al pulsar <strong>Enviar</strong>, acepto los <strong>términos y condiciones</strong> de uso del Canal Ético.'),
  ('footer.texto',          'Texto del pie de página',                   'text',       'ARH Consultores © 2026 — Todos los derechos reservados'),
  ('footer.logos',          'Logos del pie de página',                   'image_list', '[]'),
  ('contacto.email',        'Correo de contacto del comité',             'text',       'denunciasconsultoresarh@gmail.com')
ON CONFLICT (block_key) DO NOTHING;
