#!/usr/bin/env python3
"""
Generador de documentos Word (.docx) para el Canal de Denuncias ARH.

Un .docx es un contenedor ZIP con XML (Office Open XML). Este script construye
los .docx directamente, sin dependencias externas, a partir de una estructura
de bloques de contenido definida en Python. Los documentos resultantes son
totalmente editables en Microsoft Word, LibreOffice o Google Docs.

Uso:
    python3 _generar_docx.py
"""

import os
import zipfile
from xml.sax.saxutils import escape

AZUL = "1A237E"      # Azul corporativo ARH
NARANJA = "F57C00"   # Acento
GRIS = "64748B"

# ---------------------------------------------------------------------------
# Helpers para construir XML de WordprocessingML
# ---------------------------------------------------------------------------

def _run(text, *, bold=False, italic=False, color=None, size=None):
    """Genera un run (fragmento de texto con formato)."""
    rpr = "<w:rPr>"
    if bold:
        rpr += "<w:b/>"
    if italic:
        rpr += "<w:i/>"
    if color:
        rpr += f'<w:color w:val="{color}"/>'
    if size:
        rpr += f'<w:sz w:val="{size*2}"/>'  # half-points
    rpr += "</w:rPr>"
    if rpr == "<w:rPr></w:rPr>":
        rpr = ""
    return f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'


def p_title(text):
    """Título principal de portada."""
    return (
        '<w:p><w:pPr><w:jc w:val="center"/>'
        '<w:spacing w:before="240" w:after="120"/></w:pPr>'
        + _run(text, bold=True, color=AZUL, size=26)
        + "</w:p>"
    )


def p_subtitle(text):
    return (
        '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>'
        + _run(text, bold=True, color=NARANJA, size=15)
        + "</w:p>"
    )


def p_h1(text):
    return (
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/>'
        '<w:spacing w:before="360" w:after="120"/>'
        f'<w:pBdr><w:bottom w:val="single" w:sz="18" w:space="4" w:color="{NARANJA}"/></w:pBdr>'
        '</w:pPr>'
        + _run(text, bold=True, color=AZUL, size=18)
        + "</w:p>"
    )


def p_h2(text):
    return (
        '<w:p><w:pPr><w:pStyle w:val="Heading2"/>'
        '<w:spacing w:before="240" w:after="80"/></w:pPr>'
        + _run(text, bold=True, color=AZUL, size=14)
        + "</w:p>"
    )


def p_h3(text):
    return (
        '<w:p><w:pPr><w:spacing w:before="180" w:after="60"/></w:pPr>'
        + _run(text, bold=True, color="283593", size=12)
        + "</w:p>"
    )


def p_text(text):
    return (
        '<w:p><w:pPr><w:jc w:val="both"/><w:spacing w:after="120"/></w:pPr>'
        + _run(text)
        + "</w:p>"
    )


def p_bullet(text):
    return (
        '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
        '<w:spacing w:after="40"/></w:pPr>'
        + _run(text)
        + "</w:p>"
    )


def p_numbered(text):
    return (
        '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>'
        '<w:spacing w:after="40"/></w:pPr>'
        + _run(text)
        + "</w:p>"
    )


def p_box(text, kind="nota"):
    """Caja de aviso con fondo de color y borde."""
    colores = {
        "nota": ("FFF8E1", "FFC107"),
        "importante": ("FEF2F2", "EF4444"),
        "tip": ("F0FDF4", "22C55E"),
        "paso": ("EEF2FF", "C7D2FE"),
    }
    fill, border = colores.get(kind, colores["nota"])
    return (
        '<w:p><w:pPr>'
        f'<w:pBdr><w:left w:val="single" w:sz="24" w:space="6" w:color="{border}"/></w:pBdr>'
        f'<w:shd w:val="clear" w:fill="{fill}"/>'
        '<w:spacing w:before="120" w:after="120"/>'
        '<w:ind w:left="120" w:right="120"/></w:pPr>'
        + _run(text)
        + "</w:p>"
    )


def table(rows, header=True, widths=None):
    """
    Genera una tabla. `rows` es lista de listas de strings.
    `widths` opcional: lista de anchos en dxa (twentieths of a point).
    """
    ncols = len(rows[0])
    if not widths:
        total = 9360  # ancho útil aprox en A4 con márgenes
        widths = [total // ncols] * ncols

    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)

    def cell(text, is_header, w):
        shd = f'<w:shd w:val="clear" w:fill="{AZUL}"/>' if is_header else ""
        run = _run(text, bold=is_header, color="FFFFFF" if is_header else None)
        return (
            "<w:tc><w:tcPr>"
            f'<w:tcW w:w="{w}" w:type="dxa"/>'
            f"{shd}"
            '<w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/>'
            '<w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar>'
            "</w:tcPr>"
            '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>' + run + "</w:p></w:tc>"
        )

    body = ""
    for i, row in enumerate(rows):
        is_h = header and i == 0
        cells = "".join(cell(str(c), is_h, widths[j]) for j, c in enumerate(row))
        body += f"<w:tr>{cells}</w:tr>"

    return (
        "<w:tbl><w:tblPr>"
        '<w:tblStyle w:val="TableGrid"/>'
        '<w:tblW w:w="0" w:type="auto"/>'
        '<w:tblBorders>'
        '<w:top w:val="single" w:sz="4" w:color="E2E8F0"/>'
        '<w:bottom w:val="single" w:sz="4" w:color="E2E8F0"/>'
        '<w:left w:val="single" w:sz="4" w:color="E2E8F0"/>'
        '<w:right w:val="single" w:sz="4" w:color="E2E8F0"/>'
        '<w:insideH w:val="single" w:sz="4" w:color="E2E8F0"/>'
        '<w:insideV w:val="single" w:sz="4" w:color="E2E8F0"/>'
        "</w:tblBorders></w:tblPr>"
        f"<w:tblGrid>{grid}</w:tblGrid>"
        f"{body}</w:tbl>"
        + '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>'
    )


def page_break():
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def footer_note(text):
    return (
        '<w:p><w:pPr><w:jc w:val="center"/>'
        '<w:spacing w:before="360"/>'
        '<w:pBdr><w:top w:val="single" w:sz="4" w:space="6" w:color="E2E8F0"/></w:pBdr>'
        '</w:pPr>'
        + _run(text, italic=True, color=GRIS, size=9)
        + "</w:p>"
    )


# ---------------------------------------------------------------------------
# Archivos de estructura del .docx
# ---------------------------------------------------------------------------

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>"""

RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>"""

DOC_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>"""

STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Segoe UI"/>
<w:sz w:val="22"/><w:szCs w:val="22"/>
<w:color w:val="1E293B"/>
</w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style>
</w:styles>"""

NUMBERING = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="420" w:hanging="240"/></w:pPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="420" w:hanging="240"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>"""


def core_props(title):
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>{escape(title)}</dc:title>
<dc:creator>ARH Consultores</dc:creator>
<dc:subject>Canal Etico de Denuncias</dc:subject>
</cp:coreProperties>"""


DOC_OPEN = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>"""

# Section properties: A4 con márgenes
SECT_PR = """<w:sectPr>
<w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1134" w:right="1021" w:bottom="1134" w:left="1021" w:header="708" w:footer="708" w:gutter="0"/>
</w:sectPr>"""

DOC_CLOSE = f"{SECT_PR}</w:body></w:document>"


def build_docx(path, title, body_xml):
    document = DOC_OPEN + body_xml + DOC_CLOSE
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES)
        z.writestr("_rels/.rels", RELS)
        z.writestr("word/_rels/document.xml.rels", DOC_RELS)
        z.writestr("word/document.xml", document)
        z.writestr("word/styles.xml", STYLES)
        z.writestr("word/numbering.xml", NUMBERING)
        z.writestr("docProps/core.xml", core_props(title))
    print(f"  generado: {os.path.basename(path)}")


# ---------------------------------------------------------------------------
# Contenido de los documentos (importado desde _contenido_docx.py)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import _contenido_docx as C
    outdir = os.path.dirname(os.path.abspath(__file__))
    print("Generando documentos Word (.docx)...")
    for fname, title, body in C.DOCUMENTOS:
        build_docx(os.path.join(outdir, fname), title, body)
    print("Listo.")
