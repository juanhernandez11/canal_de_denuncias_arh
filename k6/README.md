# Tests de carga — Grafana k6

## Instalación

```bash
# Windows (winget)
winget install k6 --source winget

# macOS
brew install k6

# Docker
docker pull grafana/k6
```

## Uso

Todos los scripts aceptan la variable `BASE_URL` para apuntar a cualquier entorno:

```bash
# Contra producción
k6 run --env BASE_URL=https://denunciasarhconsultores.netlify.app k6/smoke.test.js

# Contra local (netlify dev)
k6 run k6/smoke.test.js
```

## Scripts disponibles

| Script | VUs máx | Duración | Propósito |
|--------|---------|----------|-----------|
| `smoke.test.js`  | 1   | 1 min  | Verificar que todo responde correctamente con carga mínima |
| `load.test.js`   | 20  | 14 min | Carga normal sostenida, simula uso real |
| `stress.test.js` | 100 | 14 min | Encontrar el punto de quiebre ⚠️ Solo en staging |

## Orden recomendado

1. Primero corre `smoke.test.js` — si falla algo aquí, no tiene sentido seguir.
2. Luego `load.test.js` — valida que el sistema aguanta uso normal.
3. Por último `stress.test.js` — **solo en staging**, nunca contra producción sin avisar al equipo.

## Límites conocidos de la arquitectura

| Componente | Límite relevante (plan free) | Punto de quiebre esperado |
|---|---|---|
| Netlify Functions | 125 000 invocaciones/mes, timeout 10 s | ~4 invocaciones/segundo sostenidas |
| Neon PostgreSQL | Pool de 20 conexiones simultáneas | ~20 VUs haciendo queries en paralelo |
| Gmail SMTP | ~500 correos/día | ~20 denuncias/hora con correo del denunciante |
| Netlify CDN (assets) | Sin límite práctico en free | No es el cuello de botella |

## Ver resultados con Grafana Cloud k6

Si quieres dashboards visuales en tiempo real:

```bash
k6 run --out cloud k6/load.test.js
```

Requiere cuenta en [grafana.com/products/cloud/k6](https://grafana.com/products/cloud/k6) (tiene tier gratuito).
