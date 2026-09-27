# SUPABASE_DEPENDENCIES.md
## Inventario de Dependencias Supabase — Canal de Denuncias ARH

> **Fecha de auditoría:** 2026-09-27  
> **Estado general:** ✅ MIGRACIÓN COMPLETADA — Supabase eliminado del código activo  
> **Base de datos activa:** Neon PostgreSQL (via `pg` / node-postgres)

---

## RESUMEN EJECUTIVO

El proyecto fue migrado de Supabase a **Neon PostgreSQL**. No existe ningún paquete
de Supabase instalado (`@supabase/supabase-js` ausente de `package.json` y
`netlify/functions/package.json`). El código de producción no realiza ninguna
llamada a la API de Supabase. Los vestigios restantes son exclusivamente
archivos históricos, un stub de compatibilidad, variables de entorno comentadas
y documentación desactualizada — ninguno de ellos afecta el comportamiento en
producción.

---

## A) Base de Datos

| Archivo | Tipo | Estado | Riesgo |
|---|---|---|---|
| `supabase/schema.sql` | Esquema original (CREATE TABLE, RLS, triggers) | Histórico. No se ejecuta en producción. | ✅ Ninguno |
| `data/supabase_backup.json` | Backup de datos exportados desde Supabase | Datos migrados a Neon. Referencia histórica. | ✅ Ninguno |
| `scripts/migrate-data.ts` | Script de migración Supabase → Neon | Ya ejecutado. Tarea completada. | ✅ Ninguno |
| `scripts/run-migration.ts` | Runner del script de migración | Ya ejecutado. Tarea completada. | ✅ Ninguno |

**Patrones de API de Supabase buscados en código activo:**

- `createClient` → **NO ENCONTRADO**
- `.from()` → **NO ENCONTRADO** (aparece solo en SQL plano, no en JS/TS)
- `.select()` / `.insert()` / `.update()` / `.delete()` (Supabase ORM) → **NO ENCONTRADO**

**Código activo de base de datos** usa exclusivamente `pg` (node-postgres):
- `netlify/functions/_data.js`
- `src/server/db-neon.ts`
- `src/server/db-client.ts`
- `src/server/db.ts`

---

## B) Storage

| Patrón buscado | Resultado |
|---|---|
| `storage` (API Supabase) | **NO ENCONTRADO** en código activo |
| `bucket` | **NO ENCONTRADO** |
| `upload` | Encontrado solo en `upload-file.js` — usa **Cloudflare R2**, no Supabase |
| `download` | **NO ENCONTRADO** |
| `getPublicUrl` | **NO ENCONTRADO** |
| `createSignedUrl` | **NO ENCONTRADO** |

**Conclusión:** Supabase Storage nunca fue integrado o ya fue eliminado completamente.  
El almacenamiento de archivos usa **Cloudflare R2** (documentado en `R2_STORAGE.md`).

---

## C) Auth

| Patrón buscado | Resultado |
|---|---|
| `auth` (Supabase Auth API) | **NO ENCONTRADO** en código activo |
| `signIn` / `signOut` / `signUp` | **NO ENCONTRADO** |
| `getUser` / `getSession` | **NO ENCONTRADO** |
| `onAuthStateChange` | **NO ENCONTRADO** |
| `@supabase/auth-js` | **NO instalado** en ningún `package.json` |

**Conclusión:** La autenticación de administradores usa **JWT propio** (`JWT_SECRET`)
gestionado por el servidor Express. Supabase Auth no está en uso.

---

## D) Functions (Edge Functions / Serverless)

| Patrón buscado | Resultado |
|---|---|
| `supabase.functions.invoke()` | **NO ENCONTRADO** |
| Referencias a Edge Functions de Supabase | **NO ENCONTRADO** |
| Directorio `supabase/functions/` | **NO EXISTE** |

**Conclusión:** Las funciones serverless del proyecto son **Netlify Functions**
(`netlify/functions/`), independientes de Supabase.

---

## E) RPC

| Patrón buscado | Resultado |
|---|---|
| `.rpc()` (Supabase RPC calls) | **NO ENCONTRADO** en código activo |

**Conclusión:** No se usa RPC de Supabase. Las llamadas a procedimientos o
funciones de base de datos se hacen con SQL plano vía `pg`.

---

## F) RLS (Row Level Security)

| Archivo | Contenido | Estado |
|---|---|---|
| `supabase/schema.sql` | Define políticas RLS para las tablas `admins`, `denuncias`, `content_blocks` | Histórico. Solo aplica en un proyecto Supabase. No afecta Neon. |

**Conclusión:** Las políticas RLS definidas en `schema.sql` son específicas de
Supabase y **no tienen efecto** sobre la base de datos Neon activa. La
autorización en producción la maneja el servidor Express mediante JWT y lógica
de negocio propia.

---

## G) Frontend

| Patrón buscado | Resultado |
|---|---|
| `VITE_SUPABASE_URL` | **NO ENCONTRADO** |
| `VITE_SUPABASE_ANON_KEY` | **NO ENCONTRADO** |
| `createClient` importado en código de cliente | **NO ENCONTRADO** |
| `import { supabase }` en componentes React/Vue | **NO ENCONTRADO** |

**Conclusión:** El frontend no tiene ninguna dependencia directa de Supabase.
Todas las llamadas de datos se hacen al backend propio (API Express / Netlify
Functions).

---

## H) Backend

| Archivo | Estado | Descripción |
|---|---|---|
| `src/server/supabase.ts` | ⚠️ STUB vacío | Exporta dos funciones inertes. `isSupabaseConfigured()` retorna `false`; `getSupabase()` lanza un error de migración. No hay lógica real. |

Contenido del stub:

```typescript
/**
 * supabase.ts — ELIMINADO
 * MIGRADO: Supabase → Neon PostgreSQL
 */
export function isSupabaseConfigured(): boolean {
  return false;
}
export function getSupabase(): never {
  throw new Error('[supabase] Migrado a Neon. Usa src/server/db-client.ts.');
}
```

**Conclusión:** Este archivo es el único vestigio activo de Supabase en el
backend. Es inofensivo pero innecesario. Seguro de eliminar.

---

## I) Variables de Entorno

| Variable | Ubicación | Estado |
|---|---|---|
| `SUPABASE_URL` | `.env.example` (comentada) | Obsoleta. Sin efecto. |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.example` (comentada) | Obsoleta. Sin efecto. |
| `SUPABASE_ANON_KEY` | **NO ENCONTRADA** en ningún archivo | — |
| `VITE_SUPABASE_URL` | **NO ENCONTRADA** | — |
| `VITE_SUPABASE_ANON_KEY` | **NO ENCONTRADA** | — |
| `NEXT_PUBLIC_SUPABASE_URL` | **NO ENCONTRADA** | — |

**Conclusión:** Las variables de Supabase están comentadas en `.env.example` y
sirven únicamente como recordatorio histórico. No existe ningún código que las
lea o consuma.

---

## Documentación Desactualizada

| Archivo | Problema |
|---|---|
| `README.md` | Menciona Supabase como base de datos activa, describe la configuración de `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, e indica pasos de ejecución del schema. Todo esto es incorrecto. No afecta el código. |

---

## ACCIONES RECOMENDADAS

Las siguientes acciones limpiarán los vestigios restantes de Supabase del
proyecto. Todas son **seguras y reversibles** mediante control de versiones (git).

### Prioridad ALTA — Limpieza de código

**1. Eliminar `src/server/supabase.ts`**

El stub no cumple ninguna función. Ningún módulo de producción lo importa.

```bash
git rm src/server/supabase.ts
```

Verificar antes de eliminar que ningún archivo lo importa:
```bash
grep -r "supabase" src/ --include="*.ts" --include="*.tsx" --include="*.js"
```

---

### Prioridad ALTA — Actualizar documentación

**2. Reescribir `README.md`**

Reemplazar todas las referencias a Supabase por la configuración real de Neon:

- Cambiar "Crea las tablas en Supabase" → instrucciones para Neon.
- Cambiar `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` → `DATABASE_URL` (Neon).
- Eliminar referencias al SQL Editor de Supabase y RLS.
- Actualizar la descripción de despliegue para mencionar Neon en lugar de Supabase.

---

### Prioridad MEDIA — Limpiar variables de entorno

**3. Actualizar `.env.example`**

Eliminar (o borrar definitivamente) las líneas comentadas de Supabase para
evitar confusión:

```diff
- # SUPABASE_URL=               # OBSOLETO — migrado a Neon
- # SUPABASE_SERVICE_ROLE_KEY=  # OBSOLETO — migrado a Neon
```

Asegurarse de que `DATABASE_URL` (Neon connection string) esté documentada y sea
el campo principal de base de datos.

---

### Prioridad BAJA — Archivar o eliminar artefactos históricos

**4. Archivar `supabase/` directorio**

El directorio contiene solo `schema.sql` histórico. Opciones:

- **Archivar:** Mover a `_archive/supabase/` para preservar el historial.
- **Eliminar:** `git rm -r supabase/` si no se necesita referencia histórica.

**5. Archivar scripts de migración**

```bash
mkdir -p _archive/migration-scripts
git mv scripts/migrate-data.ts _archive/migration-scripts/
git mv scripts/run-migration.ts _archive/migration-scripts/
```

**6. Archivar `data/supabase_backup.json`**

```bash
git mv data/supabase_backup.json _archive/supabase_backup.json
```

---

### Resumen de acciones por prioridad

| # | Acción | Prioridad | Impacto en producción |
|---|---|---|---|
| 1 | Eliminar `src/server/supabase.ts` | 🔴 Alta | Ninguno (stub inerte) |
| 2 | Reescribir `README.md` | 🔴 Alta | Ninguno (solo docs) |
| 3 | Limpiar `.env.example` | 🟡 Media | Ninguno |
| 4 | Archivar/eliminar `supabase/` | 🟢 Baja | Ninguno |
| 5 | Archivar `scripts/migrate-*.ts` | 🟢 Baja | Ninguno |
| 6 | Archivar `data/supabase_backup.json` | 🟢 Baja | Ninguno |

---

## CONCLUSIÓN

> **Supabase está efectivamente eliminado del proyecto.** No hay paquetes
> instalados, no hay llamadas a la API de Supabase en código activo, y las
> variables de entorno están comentadas. El stack de datos en producción es
> exclusivamente **Neon PostgreSQL + pg (node-postgres)**.
>
> Las 6 acciones recomendadas son de limpieza cosmética y documental — ninguna
> es urgente para el funcionamiento del sistema, pero su ejecución dejará el
> repositorio limpio y alineado con la arquitectura real.
