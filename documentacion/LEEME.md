# Documentación — Canal Ético de Denuncias ARH

Esta carpeta contiene la documentación completa del sistema, lista para entregar al cliente.

## Archivos PDF (entregables finales)

| Archivo | Dirigido a | Contenido |
|---------|-----------|-----------|
| `0-Documento-General-Entrega.pdf` | Cliente / Dirección | Descripción general del sistema, componentes, índice de manuales y cómo empezar. |
| `1-Manual-Usuario-Denunciante.pdf` | Público / Denunciantes | Cómo presentar una denuncia y consultar su estatus, paso a paso. |
| `2-Manual-Administrador.pdf` | Comité de Ética | Gestión de folios, cambio de estatus, notas, CMS y seguridad. |
| `3-Manual-Tecnico-Instalacion.pdf` | Equipo de TI | Arquitectura, instalación, configuración, base de datos y despliegue. |

## Archivos fuente (HTML)

Cada PDF tiene su archivo `.html` fuente correspondiente. Si necesitas **editar** algún manual:

1. Edita el archivo `.html`.
2. Vuelve a generar el PDF (ver abajo).

El archivo `_estilos-pdf.css` contiene los estilos compartidos (colores corporativos, tablas, cajas de aviso, etc.).

## Cómo regenerar los PDF

### Opción A — Desde el navegador (recomendada, sin instalar nada)
1. Abre el archivo `.html` en Chrome, Edge o Firefox.
2. Presiona `Ctrl+P` (o `Cmd+P` en Mac).
3. En "Destino" elige **"Guardar como PDF"**.
4. Guarda.

### Opción B — Con Chrome desde línea de comandos
```bash
chrome --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="1-Manual-Usuario-Denunciante.pdf" \
  "1-Manual-Usuario-Denunciante.html"
```

## Notas

- Los manuales usan el logo en `../public/logo-arh.png`.
- Los colores siguen la identidad de ARH Consultores: azul `#1a237e` y acento naranja/ámbar `#f57c00` / `#ffc107`.
- Documentos confidenciales — versión 1.0 — 2026.
