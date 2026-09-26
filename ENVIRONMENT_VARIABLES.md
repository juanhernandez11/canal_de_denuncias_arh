# Variables de Entorno — Canal de Denuncias ARH

## Variables Activas

| Variable | Descripción | Dónde obtenerla | Requerida | Entorno |
|---|---|---|---|---|
| `DATABASE_URL` | Connection string Neon (pooled). Formato: `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` | Neon Dashboard → Project → Connection Details → Pooled | ✅ Sí | Dev + Prod |
| `DATABASE_URL_UNPOOLED` | Connection string Neon directo (sin pool). Para scripts de migración. | Neon Dashboard → Connection Details → Direct | ⚠️ Scripts | Dev |
| `EMAIL_USER` | Gmail para envío de notificaciones | Tu cuenta de Gmail | ✅ Sí | Dev + Prod |
| `EMAIL_PASS` | App Password de Gmail | [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) — Seguridad → App passwords | ✅ Sí | Dev + Prod |
| `JWT_SECRET` | Secreto para firmar tokens JWT del panel admin | Genera con: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` | ✅ Sí | Dev + Prod |

## Variables Obsoletas (eliminar después de validar)

| Variable | Estado |
|---|---|
| `SUPABASE_URL` | 🗑️ Eliminar después de 48h validando Neon en producción |
| `SUPABASE_SERVICE_ROLE_KEY` | 🗑️ Eliminar después de 48h validando Neon en producción |

## Ejemplo .env.local

```env
# Email
EMAIL_USER=tu-correo@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx

# Neon PostgreSQL
DATABASE_URL=postgresql://user:pass@ep-xxx-yyy.us-east-2.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:pass@ep-xxx-yyy.us-east-2.aws.neon.tech/neondb?sslmode=require

# JWT
JWT_SECRET=una-cadena-muy-larga-y-aleatoria-de-al-menos-32-caracteres
```

## Configuración en Netlify

1. Ve a **Site settings → Environment variables**
2. Agrega `DATABASE_URL` (usa el valor **pooled** de Neon)
3. Agrega `EMAIL_USER`, `EMAIL_PASS`, `JWT_SECRET`
4. Haz deploy o trigger manual

> ⚠️ **Seguridad**: `DATABASE_URL` contiene usuario y contraseña. Nunca la expongas en el frontend ni en logs públicos.
