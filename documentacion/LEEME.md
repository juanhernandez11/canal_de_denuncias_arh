# Documentación — Canal Ético de Denuncias ARH

Esta carpeta contiene la documentación completa del sistema, lista para entregar al cliente.

## Entregables finales

Cada manual está disponible en **dos formatos**: PDF (para imprimir/entregar) y **Word (.docx)** (para editar).

| Documento | PDF | Word | Dirigido a |
|-----------|-----|------|-----------|
| Documento General de Entrega | `0-Documento-General-Entrega.pdf` | `0-Documento-General-Entrega.docx` | Cliente / Dirección |
| Manual del Usuario (Denunciante) | `1-Manual-Usuario-Denunciante.pdf` | `1-Manual-Usuario-Denunciante.docx` | Público / Denunciantes |
| Manual del Administrador | `2-Manual-Administrador.pdf` | `2-Manual-Administrador.docx` | Comité de Ética |
| Manual Técnico e Instalación | `3-Manual-Tecnico-Instalacion.pdf` | `3-Manual-Tecnico-Instalacion.docx` | Equipo de TI |

Los archivos `.docx` se abren y editan en **Microsoft Word, LibreOffice Writer o Google Docs**.

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

## Cómo regenerar los Word (.docx)

Los documentos Word se generan por script (sin dependencias externas):

```bash
cd documentacion
python3 _generar_docx.py
```

El contenido de cada manual está en `_contenido_docx.py` (fácil de editar) y los
helpers de formato en `_generar_docx.py`.

## Cómo convertir un PDF a Word manualmente (alternativa)

- **Microsoft Word 2016+:** Archivo → Abrir → selecciona el PDF → acepta la conversión → guarda como `.docx`.
- **En línea:** sube el PDF a smallpdf.com o ilovepdf.com (PDF a Word).

## Notas

- Los manuales PDF usan el logo en `../public/logo-arh.png`.
- Los colores siguen la identidad de ARH Consultores: azul `#1a237e` y acento naranja/ámbar `#f57c00` / `#ffc107`.
- Documentos confidenciales — versión 1.0 — 2026.
