#!/usr/bin/env python3
"""
Contenido de los documentos Word del Canal de Denuncias ARH.
Se importa desde _generar_docx.py, que provee los helpers de construcción.
"""

from _generar_docx import (
    p_title, p_subtitle, p_h1, p_h2, p_h3, p_text, p_bullet, p_numbered,
    p_box, table, page_break, footer_note,
)

# ===========================================================================
# 0. DOCUMENTO GENERAL DE ENTREGA
# ===========================================================================

doc0 = "".join([
    p_title("Canal Ético de Denuncias"),
    p_subtitle("Documento de Entrega y Descripción General"),
    p_text("ARH Consultores — Sistema web de denuncias con panel administrativo. Documento confidencial © 2026."),
    page_break(),

    p_h1("Descripción general del sistema"),
    p_text("El Canal Ético de Denuncias es una aplicación web integral que permite a cualquier persona reportar de forma segura y confidencial conductas irregulares dentro de la organización, así como dar seguimiento al estado de su reporte mediante un folio único. El sistema incluye un panel de administración para que el Comité de Ética gestione las denuncias y administre el contenido del sitio."),

    p_h2("Componentes principales"),
    table([
        ["Módulo", "Función", "Usuario"],
        ["Formulario de denuncia (Wizard)", "Registro guiado en 6 pasos, anónimo o identificado.", "Denunciante"],
        ["Consulta de folio (Tracking)", "Consulta del estatus de una denuncia por folio.", "Denunciante"],
        ["Panel de Folios", "Gestión, búsqueda, filtrado y actualización.", "Administrador"],
        ["Gestión de Contenido (CMS)", "Edición de textos del sitio sin código.", "Administrador"],
        ["Notificaciones por correo", "Envío automático al comité y al denunciante.", "Sistema"],
    ], widths=[2600, 4200, 2000]),

    p_h2("Características destacadas"),
    p_bullet("Disponible 24/7 desde computadora, tablet o teléfono (diseño responsivo)."),
    p_bullet("Modalidad anónima o identificada."),
    p_bullet("Generación automática de folio de seguimiento y comprobante PDF."),
    p_bullet("Panel de administración tipo CMS (similar a WordPress)."),
    p_bullet("Cinco estados: Recibida, En revisión, En investigación, Resuelta, Desestimada."),
    p_bullet("Funciones de accesibilidad: lector de voz, alto contraste y atajos de teclado."),
    p_bullet("Notificaciones automáticas por correo electrónico."),
    p_bullet("Almacenamiento seguro en la nube (Supabase) con cifrado de contraseñas."),

    p_h1("Documentación entregada"),
    table([
        ["#", "Documento", "Dirigido a"],
        ["1", "Manual del Usuario (Denunciante)", "Público general"],
        ["2", "Manual del Administrador", "Comité de Ética"],
        ["3", "Manual Técnico e Instalación", "Equipo de TI"],
    ], widths=[600, 5200, 3000]),

    p_h1("Cómo empezar"),
    p_box("1. Denunciantes: lean el Manual del Usuario para presentar y dar seguimiento a una denuncia.", "paso"),
    p_box("2. Comité de Ética: lean el Manual del Administrador. Lo primero es acceder a /admin/login y cambiar la contraseña por defecto.", "paso"),
    p_box("3. Equipo técnico: consulten el Manual Técnico para instalación, Supabase y despliegue.", "paso"),
    p_box("Nota de seguridad: El sistema se entrega con usuario admin por defecto (admin / admin123). Es obligatorio cambiar esta contraseña antes de producción.", "importante"),

    p_h1("Datos de contacto"),
    table([
        ["Concepto", "Detalle"],
        ["Correo del comité de ética", "denunciasconsultoresarh@gmail.com"],
        ["Acceso al panel admin", "[dominio-del-sitio]/admin/login"],
        ["Consulta de folios (público)", "[dominio-del-sitio]/tracking"],
    ], widths=[3600, 5200]),

    footer_note("ARH Consultores — Canal Ético de Denuncias · Documento de Entrega · Versión 1.0 · 2026 · Confidencial"),
])


# ===========================================================================
# 1. MANUAL DEL USUARIO (DENUNCIANTE)
# ===========================================================================

doc1 = "".join([
    p_title("Manual del Usuario"),
    p_subtitle("Canal Ético de Denuncias"),
    p_text("Cómo presentar y dar seguimiento a una denuncia. Guía dirigida a denunciantes y público general. ARH Consultores © 2026 — Confidencial."),
    page_break(),

    p_h1("1. ¿Qué es el Canal Ético de Denuncias?"),
    p_text("El Canal Ético de Denuncias de ARH Consultores es una plataforma web segura y confidencial que permite a empleados, proveedores, clientes y cualquier persona reportar conductas irregulares, faltas al código de ética o incumplimientos a las políticas internas."),
    p_text("El canal está disponible las 24 horas del día, los 7 días de la semana, desde cualquier dispositivo con conexión a internet (computadora, tablet o teléfono móvil)."),
    p_box("Tu reporte es importante. Cada denuncia es tratada con seriedad y confidencialidad por el Comité de Ética.", "tip"),

    p_h1("2. ¿Qué puedo denunciar?"),
    p_text("El sistema contempla los siguientes tipos de denuncia:"),
    table([
        ["Categoría"],
        ["Actos de corrupción / fraude"],
        ["Escenarios de conflicto de interés"],
        ["Incumplimiento al código de ética / políticas y normativa interna"],
        ["Independencia profesional / relación inapropiada con clientes"],
        ["Regalos, hospitalidad o beneficios indebidos"],
        ["Uso indebido de información / divulgación de información confidencial"],
        ["Discriminación o trato desigual"],
        ["Acoso laboral o sexual / hostigamiento"],
        ["Violaciones a derechos humanos"],
        ["Incumplimiento de leyes o regulaciones"],
        ["Actuación irregular de libre competencia / prácticas desleales"],
        ["Relación indebida con proveedores"],
        ["Violaciones a la ética digital"],
        ["Otros"],
    ], widths=[8800]),

    p_h1("3. Cómo presentar una denuncia (paso a paso)"),
    p_text("El formulario está organizado en 6 pasos guiados. Puedes avanzar y retroceder en cualquier momento; tu información se guarda temporalmente en el navegador mientras completas el proceso."),
    p_box("Paso 1 — Inicio: Selecciona el Centro / Sede (Sede Tehuacán o Puebla — Torre Elementa) y el Tipo de notificación. La empresa viene preconfigurada como 'ARH Consultores'.", "paso"),
    p_box("Paso 2 — Denunciante: Elige si deseas identificarte o presentar la denuncia de forma anónima. Si te identificas, se te pedirá nombre, correo, teléfono (opcional) y tu relación con la empresa.", "paso"),
    p_box("Paso 3 — Detalles: Indica la fecha del incidente y una descripción detallada de los hechos. Entre más información proporciones, mejor podrá el comité investigar.", "paso"),
    p_box("Paso 4 — Involucrados: Agrega, si lo deseas, los datos de las personas involucradas. Este paso es opcional.", "paso"),
    p_box("Paso 5 — Evidencias: Puedes adjuntar archivos de evidencia (documentos, imágenes) y comentarios. Este paso es opcional.", "paso"),
    p_box("Paso 6 — Confirmación: Revisa el resumen, acepta el aviso de privacidad y los términos, y envía. El sistema generará tu folio de seguimiento.", "paso"),
    p_box("Consejo de accesibilidad: El sistema cuenta con panel de accesibilidad (lector de voz, alto contraste) y atajos: Alt+A abre accesibilidad, Alt+N avanza y Alt+P regresa.", "nota"),

    p_h1("4. Denuncia anónima vs. identificada"),
    table([
        ["Modalidad", "Características"],
        ["Anónima", "No se solicitan tus datos. Debes guardar tu folio, es la única forma de dar seguimiento. No recibirás correo."],
        ["Identificada", "Proporcionas tus datos de contacto. Recibirás correo de confirmación con tu folio. El comité puede contactarte."],
    ], widths=[2200, 6600]),
    p_box("Importante: En ambos casos tu información es tratada con estricta confidencialidad. La modalidad anónima no afecta la seriedad con la que se atiende tu caso.", "importante"),

    p_h1("5. Tu folio de seguimiento"),
    p_text("Al enviar tu denuncia, el sistema genera automáticamente un folio único con el formato ARH-2026-XXXXX. Este folio es tu llave para consultar el estado de tu caso."),
    p_box("Guarda tu folio en un lugar seguro. Especialmente si presentaste una denuncia anónima, el folio es la única manera de dar seguimiento. Sin él no será posible recuperar el estatus.", "importante"),

    p_h1("6. Cómo consultar el estatus de tu denuncia"),
    p_box("1. Ingresa a la página principal y haz clic en 'Consultar folio' (parte superior).", "paso"),
    p_box("2. Escribe tu número de folio (ej. ARH-2026-00123) y presiona 'Consultar estatus'.", "paso"),
    p_box("3. El sistema mostrará el estatus actual y la fecha de última actualización.", "paso"),
    p_h3("Significado de cada estatus"),
    table([
        ["Estatus", "¿Qué significa?"],
        ["Recibida", "Tu denuncia fue recibida y registrada correctamente."],
        ["En revisión", "El comité está revisando la información proporcionada."],
        ["En investigación", "El caso está siendo investigado a fondo."],
        ["Resuelta", "El caso concluyó y se tomaron las acciones correspondientes."],
        ["Desestimada", "El caso fue cerrado sin acción (falta de elementos u otra razón)."],
    ], widths=[2600, 6200]),
    p_box("Por confidencialidad, la consulta pública solo muestra el estatus y la fecha. No expone datos sensibles.", "nota"),

    p_h1("7. Comprobante en PDF"),
    p_text("Tras enviar tu denuncia, puedes descargar un comprobante en PDF con el botón 'Descargar comprobante PDF'. Incluye tu folio, datos generales y descripción de los hechos. Consérvalo como respaldo."),

    p_h1("8. Preguntas frecuentes"),
    p_h3("¿Es realmente confidencial?"),
    p_text("Sí. La información solo es accesible para el Comité de Ética. En denuncias anónimas no se registran datos de identificación."),
    p_h3("No recibí el correo de confirmación, ¿qué hago?"),
    p_text("Revisa tu carpeta de spam o correo no deseado. El correo proviene del sistema automatizado del canal ético."),
    p_h3("¿Puedo denunciar desde mi celular?"),
    p_text("Sí, la plataforma es totalmente responsiva y funciona en computadora, tablet y teléfono."),
    p_h3("Perdí mi folio, ¿puedo recuperarlo?"),
    p_text("Si te identificaste, el folio está en tu correo. Si fue anónima y no lo guardaste, no es posible recuperarlo por seguridad."),

    p_h1("9. Confidencialidad y privacidad"),
    p_text("ARH Consultores garantiza el tratamiento confidencial de toda la información proporcionada, conforme a su aviso de privacidad. Los datos se utilizan exclusivamente para la atención de la denuncia. Las denuncias de buena fe están protegidas contra represalias."),

    footer_note("ARH Consultores — Canal Ético de Denuncias · Manual del Usuario · Versión 1.0 · 2026 · Contacto: denunciasconsultoresarh@gmail.com"),
])


# ===========================================================================
# 2. MANUAL DEL ADMINISTRADOR
# ===========================================================================

doc2 = "".join([
    p_title("Manual del Administrador"),
    p_subtitle("Canal Ético de Denuncias"),
    p_text("Gestión de folios y contenido del sitio. Guía dirigida al Comité de Ética y administradores. ARH Consultores © 2026 — Confidencial."),
    page_break(),

    p_h1("1. Acceso al panel de administración"),
    p_text("El panel es de uso exclusivo para miembros autorizados del Comité de Ética. Se accede desde la dirección: https://[dominio-del-sitio]/admin/login"),
    p_text("También puedes acceder desde el ícono 'Admin' (escudo) en la esquina superior derecha de la página principal."),
    p_box("Acceso restringido: Solo el personal autorizado debe conocer estas credenciales. No compartas tu usuario ni contraseña.", "importante"),

    p_h1("2. Primer inicio de sesión y cambio de contraseña"),
    p_text("El sistema se entrega con un usuario administrador por defecto:"),
    table([
        ["Campo", "Valor por defecto"],
        ["Usuario", "admin"],
        ["Contraseña", "admin123"],
    ], widths=[3000, 5800]),
    p_box("CRÍTICO — Cambia la contraseña de inmediato. Lo primero al recibir el sistema es iniciar sesión y cambiar la contraseña. Nunca dejes la contraseña por defecto en producción.", "importante"),
    p_box("1. Ingresa a /admin/login.", "paso"),
    p_box("2. Escribe tu usuario y contraseña, y presiona 'Iniciar sesión'.", "paso"),
    p_box("3. Serás dirigido automáticamente al panel de Folios.", "paso"),

    p_h1("3. Panel de Folios: gestión de denuncias"),
    p_text("La sección Folios muestra todas las denuncias recibidas en una tabla:"),
    table([
        ["Columna", "Descripción"],
        ["Folio", "Identificador único (ej. ARH-2026-00123)."],
        ["Tipo", "Categoría de la denuncia."],
        ["Empresa", "Empresa asociada."],
        ["Estatus", "Estado actual (con color distintivo)."],
        ["Recibida", "Fecha y hora de recepción."],
    ], widths=[2400, 6400]),
    p_h3("Buscar y filtrar"),
    p_bullet("Búsqueda: escribe en la barra superior para buscar por folio, tipo, empresa o descripción."),
    p_bullet("Filtro por estatus: usa el menú desplegable para ver denuncias en un estado específico."),
    p_bullet("Paginación: los folios se muestran de 10 en 10; usa 'Anterior' y 'Siguiente'."),

    p_h1("4. Ver el detalle de una denuncia"),
    p_text("Haz clic en cualquier fila para abrir la ventana de detalle, que muestra:"),
    p_bullet("Tipo, empresa, centro y modalidad (anónima / identificada)."),
    p_bullet("Datos del denunciante (si se identificó)."),
    p_bullet("Fechas de recepción y última actualización."),
    p_bullet("Descripción completa de los hechos."),
    p_bullet("Datos completos (payload): sección expandible con toda la información enviada."),

    p_h1("5. Cambiar el estatus y agregar notas"),
    p_box("1. Selecciona el nuevo Estatus en el menú desplegable.", "paso"),
    p_box("2. Escribe Notas administrativas (internas). Estas notas NO son visibles para el denunciante.", "paso"),
    p_box("3. Presiona 'Guardar cambios'. El nuevo estatus será visible para el denunciante al consultar su folio.", "paso"),
    p_h3("Flujo recomendado de estatus"),
    table([
        ["Estatus", "Cuándo usarlo"],
        ["Recibida", "Estado inicial automático al recibir la denuncia."],
        ["En revisión", "Cuando el comité comienza a analizar el caso."],
        ["En investigación", "Cuando se abre una investigación formal."],
        ["Resuelta", "Cuando el caso concluye con acciones tomadas."],
        ["Desestimada", "Cuando se cierra sin acción por falta de elementos."],
    ], widths=[2600, 6200]),
    p_box("Buena práctica: Documenta en las notas cada cambio de estatus con fecha y motivo. Crea una bitácora útil para auditorías.", "tip"),

    p_h1("6. Gestión de Contenido (CMS)"),
    p_text("La sección Contenido funciona como un mini-CMS (similar a WordPress) que permite editar los textos del sitio público sin tocar código. Bloques editables:"),
    table([
        ["Bloque", "Descripción"],
        ["Título principal", "Encabezado del canal en la página de inicio."],
        ["Subtítulo", "Texto secundario del encabezado."],
        ["Descripción de inicio", "Texto introductorio (admite HTML)."],
        ["Aviso de privacidad", "Texto legal del aviso de privacidad."],
        ["Texto del pie de página", "Leyenda del footer."],
        ["Correo de contacto del comité", "Correo mostrado como contacto."],
    ], widths=[3200, 5600]),
    p_box("1. Ingresa a la sección Contenido desde el menú lateral.", "paso"),
    p_box("2. Edita el texto del bloque que deseas modificar.", "paso"),
    p_box("3. Guarda el bloque. El cambio se refleja de inmediato en el sitio público.", "paso"),

    p_h1("7. Cambiar mi contraseña"),
    p_box("1. En el menú lateral, entra a la sección de cambio de contraseña (/admin/password).", "paso"),
    p_box("2. Ingresa tu contraseña actual y la nueva (dos veces para confirmar).", "paso"),
    p_box("3. Guarda. Usa una contraseña robusta: mínimo 8 caracteres con mayúsculas, minúsculas, números y símbolos.", "paso"),
    p_box("Recomendación: Cambia la contraseña cada 3-6 meses y nunca la reutilices en otros servicios.", "tip"),

    p_h1("8. Cerrar sesión y buenas prácticas de seguridad"),
    p_bullet("Usa 'Cerrar sesión' al terminar, especialmente en equipos compartidos."),
    p_bullet("No compartas tus credenciales con nadie."),
    p_bullet("Accede solo desde equipos y redes de confianza."),
    p_bullet("La sesión se cierra automáticamente tras un periodo de inactividad."),
    p_bullet("Trata toda la información de las denuncias como estrictamente confidencial."),

    p_h1("9. Solución de problemas frecuentes"),
    p_h3("No puedo iniciar sesión"),
    p_text("Verifica usuario y contraseña. Si olvidaste la contraseña, contacta al responsable técnico para restablecerla en la base de datos (Supabase)."),
    p_h3("No aparecen folios nuevos"),
    p_text("Refresca la página. Verifica que el sistema de correo/base de datos esté operativo (ver Manual Técnico)."),
    p_h3("Los cambios de contenido no se ven en el sitio"),
    p_text("Refresca la página pública (Ctrl+F5)."),

    footer_note("ARH Consultores — Canal Ético de Denuncias · Manual del Administrador · Versión 1.0 · 2026 · Confidencial"),
])


# ===========================================================================
# 3. MANUAL TÉCNICO E INSTALACIÓN
# ===========================================================================

doc3 = "".join([
    p_title("Manual Técnico"),
    p_subtitle("Instalación, Configuración y Despliegue"),
    p_text("Canal Ético de Denuncias. Guía dirigida al equipo técnico / responsable de TI. ARH Consultores © 2026 — Confidencial."),
    page_break(),

    p_h1("1. Arquitectura general del sistema"),
    p_text("El sistema es una aplicación web de página única (SPA) construida con React, respaldada por una base de datos en la nube (Supabase / PostgreSQL) y un backend que funciona como servidor Express (desarrollo) o funciones serverless (producción con Netlify)."),
    p_text("Flujo: los usuarios (denunciante y administrador) interactúan con el frontend React; este llama a las rutas /api/* del backend; el backend persiste en Supabase y envía correos vía Gmail SMTP."),

    p_h1("2. Tecnologías utilizadas (stack)"),
    table([
        ["Capa", "Tecnología"],
        ["Frontend", "React 19, Vite 6, Tailwind CSS 4, React Router 7"],
        ["Lenguaje", "TypeScript 5.8"],
        ["Backend (dev)", "Express 4, ejecutado con tsx"],
        ["Backend (prod)", "Netlify Functions (serverless)"],
        ["Base de datos", "Supabase (PostgreSQL) vía @supabase/supabase-js"],
        ["Autenticación admin", "JWT (jsonwebtoken) en cookie httpOnly"],
        ["Contraseñas", "Hash con bcryptjs"],
        ["Correo", "Nodemailer (Gmail SMTP)"],
    ], widths=[2600, 6200]),

    p_h1("3. Requisitos previos"),
    p_bullet("Node.js (versión 18 o superior)."),
    p_bullet("Una cuenta de Supabase (el plan gratuito es suficiente)."),
    p_bullet("Una cuenta de Gmail con contraseña de aplicación para envío de correos."),
    p_bullet("Una cuenta de Netlify para despliegue en producción (opcional)."),
    p_bullet("Git instalado (para clonar el repositorio)."),

    p_h1("4. Instalación local (desarrollo)"),
    p_box("1. Clonar: git clone https://github.com/juanhernandez11/canal_de_denuncias_arh.git", "paso"),
    p_box("2. Instalar dependencias: npm install", "paso"),
    p_box("3. Configurar variables: cp .env.example .env.local y editar con tus credenciales.", "paso"),
    p_box("4. Ejecutar: npm run dev — la app queda en http://localhost:3000", "paso"),
    p_h3("Scripts disponibles"),
    table([
        ["Comando", "Descripción"],
        ["npm run dev", "Servidor de desarrollo (Express + Vite)."],
        ["npm run build", "Genera el build de producción en dist/."],
        ["npm run preview", "Previsualiza el build de producción."],
        ["npm run lint", "Verificación de tipos (tsc --noEmit)."],
        ["npm run clean", "Elimina la carpeta dist/."],
    ], widths=[2600, 6200]),

    p_h1("5. Configuración de Supabase (base de datos)"),
    p_box("1. Crea un proyecto nuevo en supabase.com.", "paso"),
    p_box("2. En el dashboard, abre SQL Editor.", "paso"),
    p_box("3. Copia y pega el contenido de supabase/schema.sql y presiona Run. Crea las tablas admins, denuncias y content_blocks, siembra contenido por defecto y habilita RLS.", "paso"),
    p_box("El usuario admin por defecto (admin / admin123) no se crea en el SQL; lo crea el servidor la primera vez que se conecta a Supabase.", "nota"),

    p_h1("6. Variables de entorno"),
    p_text("Copia .env.example a .env.local y completa los siguientes valores:"),
    table([
        ["Variable", "Descripción"],
        ["EMAIL_USER", "Cuenta de Gmail para enviar notificaciones."],
        ["EMAIL_PASS", "Contraseña de aplicación de Gmail (no la normal)."],
        ["SUPABASE_URL", "Project Settings -> API -> Project URL."],
        ["SUPABASE_SERVICE_ROLE_KEY", "Project Settings -> API -> service_role (SECRETA)."],
        ["JWT_SECRET", "Cadena larga y aleatoria para firmar sesiones admin."],
    ], widths=[3400, 5400]),
    p_box("La service_role key es secreta. Solo se usa en el backend. Nunca la expongas en el cliente ni la subas al repositorio. El archivo .env.local está excluido en .gitignore.", "importante"),

    p_h1("7. Configuración del correo (Gmail)"),
    p_box("1. Activa la verificación en dos pasos en la cuenta de Gmail.", "paso"),
    p_box("2. Genera una contraseña de aplicación desde la configuración de seguridad de Google.", "paso"),
    p_box("3. Usa esa contraseña de aplicación en EMAIL_PASS (no tu contraseña normal).", "paso"),
    p_text("Cuando se envía una denuncia, el sistema notifica al comité y, si el denunciante se identificó, le envía un correo de confirmación con su folio."),

    p_h1("8. Despliegue en producción (Netlify)"),
    p_text("El proyecto incluye netlify.toml preconfigurado. La capa de datos usa la API REST de Supabase, por lo que funciona en entornos serverless."),
    p_box("1. Conecta el repositorio de GitHub a Netlify.", "paso"),
    p_box("2. Netlify detecta: build 'npm run build', publicación 'dist', funciones en 'netlify/functions'.", "paso"),
    p_box("3. En Netlify -> Environment variables, define las mismas variables de la sección 6.", "paso"),
    p_box("4. Despliega. Netlify redirige /api/send-email, /api/admin/*, /api/content y /api/folios/* a las funciones serverless.", "paso"),

    p_h1("9. Estructura de la base de datos"),
    p_h3("Tabla: admins"),
    table([
        ["Campo", "Descripción"],
        ["id", "Identificador único."],
        ["username", "Nombre de usuario (único)."],
        ["password_hash", "Contraseña cifrada con bcrypt."],
        ["created_at", "Fecha de creación."],
    ], widths=[2600, 6200]),
    p_h3("Tabla: denuncias"),
    table([
        ["Campo", "Descripción"],
        ["folio", "Identificador único (ARH-2026-XXXXX)."],
        ["estatus", "recibida / en_revision / en_investigacion / resuelta / desestimada."],
        ["tipo, empresa, centro, modo", "Datos generales de la denuncia."],
        ["denunciante_nombre, denunciante_correo", "Datos del denunciante (si se identificó)."],
        ["descripcion", "Descripción de los hechos."],
        ["payload_json", "JSON completo con todos los datos del formulario."],
        ["notas_admin", "Notas internas del comité."],
        ["created_at, updated_at", "Fechas de creación y actualización."],
    ], widths=[3400, 5400]),
    p_h3("Tabla: content_blocks"),
    p_text("Almacena los textos editables del sitio (CMS): título, subtítulo, aviso de privacidad, pie de página, correo de contacto, etc."),

    p_h1("10. Mantenimiento y respaldos"),
    p_bullet("Respaldos: Supabase realiza respaldos automáticos. Exporta periódicamente la tabla denuncias desde el SQL Editor."),
    p_bullet("Actualización de dependencias: usa npm outdated y verifica con npm run lint y npm run build."),
    p_bullet("Monitoreo: revisa los logs de Netlify Functions y de Supabase ante incidencias."),

    p_h1("11. Seguridad"),
    table([
        ["Aspecto", "Implementación"],
        ["Autenticación admin", "JWT firmado con JWT_SECRET, en cookie httpOnly."],
        ["Contraseñas", "Cifradas con bcrypt (nunca en texto plano)."],
        ["Base de datos", "RLS habilitado; el backend usa service_role."],
        ["Rutas admin", "Protegidas con middleware requireAuth."],
        ["Tracking público", "Solo expone estatus y fecha; nunca datos sensibles."],
        ["Secretos", "En variables de entorno, fuera del repositorio."],
    ], widths=[2800, 6000]),
    p_box("Acciones obligatorias antes de producción: cambiar la contraseña del usuario admin por defecto; definir un JWT_SECRET largo y aleatorio; verificar que .env.local no esté versionado.", "importante"),

    footer_note("ARH Consultores — Canal Ético de Denuncias · Manual Técnico e Instalación · Versión 1.0 · 2026 · Confidencial"),
])


# ===========================================================================
# Registro de documentos a generar
# ===========================================================================

DOCUMENTOS = [
    ("0-Documento-General-Entrega.docx", "Documento de Entrega - Canal de Denuncias ARH", doc0),
    ("1-Manual-Usuario-Denunciante.docx", "Manual del Usuario - Canal de Denuncias ARH", doc1),
    ("2-Manual-Administrador.docx", "Manual del Administrador - Canal de Denuncias ARH", doc2),
    ("3-Manual-Tecnico-Instalacion.docx", "Manual Tecnico - Canal de Denuncias ARH", doc3),
]
