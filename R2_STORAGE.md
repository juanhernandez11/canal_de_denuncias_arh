# Cloudflare R2 Storage — Canal de Denuncias ARH

## Configuración inicial

### 1. Crear bucket en Cloudflare R2
1. Ve a [dash.cloudflare.com](https://dash.cloudflare.com) → R2 Object Storage
2. Create bucket → nombre: `canal-denuncias-arh`
3. **IMPORTANTE**: Mantener bucket como PRIVADO (sin Public Access)

### 2. Crear API Token de R2
1. Cloudflare Dashboard → R2 → Manage R2 API Tokens
2. Create API token:
   - Permissions: **Object Read & Write**
   - Bucket: `canal-denuncias-arh` (específico)
3. Guarda: **Access Key ID** y **Secret Access Key**

### 3. Obtener Account ID
- Cloudflare Dashboard → lado derecho → Account ID

### 4. Variables de entorno requeridas

```env
R2_ACCOUNT_ID=          # Tu Cloudflare Account ID
R2_ACCESS_KEY_ID=       # Access Key ID del API Token
R2_SECRET_ACCESS_KEY=   # Secret Access Key del API Token
R2_BUCKET_NAME=canal-denuncias-arh
```

### 5. Configurar en Netlify
- Site settings → Environment variables
- Agrega las 4 variables anteriores

### 6. Ejecutar migración de tabla en Neon
```bash
npm run migrate:db
```

## Estructura de archivos en R2

```
canal-denuncias-arh/
  denuncias/
    ARH-2026-XXXXX/
      {uuid}-evidencia.pdf
      {uuid}-foto.jpg
```

## Seguridad

- ✅ Bucket privado — sin acceso público directo
- ✅ Archivos accesibles solo via Signed URLs (expiran en 5 minutos)
- ✅ Solo admins autenticados pueden descargar
- ✅ Keys generadas por el backend — path traversal imposible
- ✅ Validación de MIME type en el servidor
- ✅ Máximo 10MB por archivo

## Tipos de archivo permitidos

| Tipo | MIME |
|------|------|
| PDF | application/pdf |
| Imagen | image/jpeg, image/png, image/gif, image/webp |
| Word | application/msword, .docx |
| Excel | application/vnd.ms-excel, .xlsx |
| Texto | text/plain |

## Flujo de upload

```
Usuario selecciona archivo
        ↓
Frontend valida tipo y tamaño
        ↓
Enviar denuncia → obtener folio
        ↓
POST /api/upload-file (base64 + folio)
        ↓
Backend valida MIME + tamaño
        ↓
Genera key: denuncias/{folio}/{uuid}-{nombre}
        ↓
Sube a R2
        ↓
Guarda metadata en Neon (archivos_denuncia)
```

## Flujo de descarga (admin)

```
Admin abre folio
        ↓
GET /api/files?folio=ARH-XXXX → lista de archivos
        ↓
Admin click "Descargar"
        ↓
GET /api/get-file?id={id} (con cookie JWT)
        ↓
Backend verifica auth + obtiene r2_key de Neon
        ↓
Genera Signed URL (expira en 5 min)
        ↓
Frontend abre URL en nueva pestaña
```
