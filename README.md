# Canal de Denuncias ARH

Aplicación web para el envío y seguimiento de denuncias, con un panel de
administración (CMS tipo WordPress + gestión de folios) respaldado por Supabase.

## Requisitos

- Node.js
- Un proyecto de [Supabase](https://supabase.com) (plan gratuito es suficiente)

## Configuración

1. Instala dependencias:
   ```
   npm install
   ```

2. Crea las tablas en Supabase:
   - En el dashboard de Supabase, abre **SQL Editor**.
   - Pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y ejecuta **Run**.
   - Esto crea las tablas `admins`, `denuncias` y `content_blocks`, siembra el
     contenido editable por defecto y habilita RLS.

3. Configura las variables de entorno. Copia `.env.example` a `.env.local` y completa:
   ```
   EMAIL_USER=                 # Gmail para notificaciones
   EMAIL_PASS=                 # App password de Gmail
   SUPABASE_URL=               # Project Settings -> API -> Project URL
   SUPABASE_SERVICE_ROLE_KEY=  # Project Settings -> API -> service_role (SECRETA)
   JWT_SECRET=                 # Cadena larga y aleatoria para firmar sesiones admin
   ```
   > La `service_role key` es secreta y solo se usa en el backend. Nunca la
   > expongas en el cliente ni la subas al repositorio.

4. Ejecuta la app:
   ```
   npm run dev
   ```
   La app queda en `http://localhost:3000`.

## Panel de administración

- URL: `/admin/login`
- Usuario por defecto: `admin` · Contraseña: `admin123`

El servidor crea el usuario admin por defecto la primera vez que se conecta a
Supabase. **Cambia la contraseña antes de producción.**

Desde el panel puedes:
- **Folios**: listar, buscar, filtrar por estatus, ver el detalle de cada
  denuncia y cambiar su estatus / agregar notas internas.
- **Contenido**: editar los textos del sitio (título, subtítulo, aviso de
  privacidad, pie de página, etc.) tipo CMS.

## Scripts

- `npm run dev` — servidor de desarrollo (Express + Vite).
- `npm run build` — build de producción a `dist/`.
- `npm run lint` — verificación de tipos (`tsc --noEmit`).

## Despliegue

La capa de datos usa el cliente `@supabase/supabase-js` (API REST), por lo que
funciona tanto en el servidor Express local como en entornos serverless
(Netlify Functions). Recuerda definir las mismas variables de entorno en el
proveedor de despliegue.
