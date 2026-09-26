# Plan de Pruebas de Migración — Canal de Denuncias ARH

## Base de Datos
- [ ] Conexión a Neon exitosa (`npm run migrate:db` sin errores)
- [ ] Tabla `admins` creada
- [ ] Tabla `denuncias` creada con constraint de estatus
- [ ] Tabla `content_blocks` creada
- [ ] Índices creados
- [ ] 8 content_blocks en seed
- [ ] Admin `adminrh` creado al primer request

## Denuncia (usuario)
- [ ] Crear denuncia anónima → folio generado `ARH-YYYY-XXXXX`
- [ ] Crear denuncia con correo → email de confirmación recibido
- [ ] Folio guardado en Neon (verificar en Dashboard de Neon)
- [ ] Folio generado con `crypto.randomBytes` (no `Math.random`)
- [ ] Email de notificación interna enviado al comité
- [ ] Adjuntos enviados por email (base64)

## Seguimiento (usuario)
- [ ] `GET /api/folios/{folio}/status` con folio existente → 200 con estatus
- [ ] `GET /api/folios/{folio}/status` con folio inventado → 404

## Admin
- [ ] `POST /api/admin/login` credenciales correctas → cookie JWT
- [ ] `POST /api/admin/login` credenciales incorrectas → 401
- [ ] `GET /api/admin/me` sin cookie → 401
- [ ] `GET /api/admin/folios` → lista paginada
- [ ] `GET /api/admin/folios?estatus=recibida` → filtrado por estatus
- [ ] `GET /api/admin/folios?q=ARH` → búsqueda funcional
- [ ] `GET /api/admin/folios/{folio}` → detalle de denuncia
- [ ] `PATCH /api/admin/folios/{folio}` con nuevo estatus → actualizado
- [ ] `PATCH /api/admin/folios/{folio}` → email al denunciante si tiene correo
- [ ] `GET /api/admin/content` → lista de content blocks
- [ ] `PUT /api/admin/content/{key}` → actualiza bloque
- [ ] `POST /api/admin/logout` → cookie limpiada

## CMS Público
- [ ] `GET /api/content` → mapa de content blocks (sin auth)

## Seguridad
- [ ] `DATABASE_URL` no aparece en el bundle JS del frontend
- [ ] `/api/admin/*` sin JWT → 401 (no 500)
- [ ] JWT_SECRET vacío → el servidor debe rechazar arrancar o loggear advertencia
- [ ] Admin por defecto cambiado de contraseña antes de producción
- [ ] No hay credenciales hardcodeadas en el código (`grep -r 'arhconsultores' src/`)

## Email
- [ ] `EMAIL_USER` configurado en Netlify
- [ ] `EMAIL_PASS` es App Password (no contraseña normal de Gmail)
- [ ] Email de confirmación llega al denunciante
- [ ] Email de cambio de estatus llega al denunciante

## Rollback
- [ ] Variables de Supabase todavía en Netlify (no borradas)
- [ ] Deploy anterior disponible en Netlify → Publishes deploy funciona
- [ ] Rollback ejecutable en < 5 minutos
