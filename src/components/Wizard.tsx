import { useState, useRef, useEffect } from 'react';
import { LayoutGrid, User, Calendar, Eye, Paperclip, CheckSquare } from 'lucide-react';
import Button from './shared/Button';
import { Toaster, toast } from 'react-hot-toast';
import AccesibilidadPanel, { hablar, lectorActivo } from './AccesibilidadPanel';

const narrar = (texto: string) => { if (lectorActivo()) hablar(texto); };

const steps = [
  { icon: LayoutGrid, label: 'Inicio' },
  { icon: User, label: 'Denunciante' },
  { icon: Calendar, label: 'Detalles' },
  { icon: Eye, label: 'Involucrados' },
  { icon: Paperclip, label: 'Evidencias' },
  { icon: CheckSquare, label: 'Confirmación' },
];

const TIPOS_NOTIFICACION = [
  "Actos de corrupción/fraude", "Escenarios de conflicto de interés", "Incumplimiento al código de ética/políticas y normativa interna",
  "Independencia profesional/relación inapropiada con clientes", "Regalos, hopitalidad o beneficios indebidos",
  "Uso indebido de información/divulgación de información confidencial", "Discriminación o trato desigual",
  "Acoso laboral o sexual/hostigamiento", "Violaciones a derechos humanos",
  "Incumplimiento de leyes o regulaciones", "Actuación irregular de libre competencia/prácticas desleales", "Relación indebida con proveedores", "Violaciones a la ética digital", "Otros"];

const SEDES = ["Sede Tehuacán", "Puebla (Torre Elementa)"];

const RELACIONES_EMPRESA = [
  "Empleado/a", "Exempleado/a", "Personal en prácticas / becario/a",
  "Voluntario/a", "Proveedor", "Cliente", "Accionista", "Subcontratista", "Socio"
];

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

const buildEmailHtml = (formData: any) => `
<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Denuncia - Canal Ético</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Header verde ancho completo -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#16a34a;">
    <tr>
      <td style="padding:28px 40px;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">🛡️ Canal Ético de Denuncias</h1>
        <p style="margin:6px 0 0;color:#bbf7d0;font-size:14px;">ARH Consultores — Nueva comunicación recibida</p>
      </td>
    </tr>
  </table>

  <!-- Barra de tipo de denuncia -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fefce8;border-bottom:3px solid #f59e0b;">
    <tr>
      <td style="padding:16px 40px;">
        <p style="margin:0;font-size:11px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Tipo de denuncia</p>
        <p style="margin:4px 0 0;font-size:18px;color:#78350f;font-weight:700;">${formData.tipo}</p>
      </td>
    </tr>
  </table>

  <!-- Contenido principal -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <!-- Datos Generales -->
    <tr>
      <td style="padding:28px 40px 0;">
        <h2 style="margin:0 0 16px;font-size:17px;color:#0f172a;font-weight:700;border-bottom:2px solid #e2e8f0;padding-bottom:10px;">📋 Datos Generales</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
          <tr>
            <td style="padding:10px 16px;color:#64748b;width:200px;vertical-align:top;background-color:#f8fafc;border-bottom:1px solid #e2e8f0;">Empresa</td>
            <td style="padding:10px 16px;color:#1e293b;font-weight:600;background-color:#f8fafc;border-bottom:1px solid #e2e8f0;">${formData.empresa}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#64748b;vertical-align:top;border-bottom:1px solid #e2e8f0;">Centro / Sede</td>
            <td style="padding:10px 16px;color:#1e293b;font-weight:600;border-bottom:1px solid #e2e8f0;">${formData.centro}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#64748b;vertical-align:top;background-color:#f8fafc;border-bottom:1px solid #e2e8f0;">Fecha de incidencia</td>
            <td style="padding:10px 16px;color:#1e293b;font-weight:600;background-color:#f8fafc;border-bottom:1px solid #e2e8f0;">${formData.notificacion.fecha}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#64748b;vertical-align:top;">Modalidad</td>
            <td style="padding:10px 16px;"><span style="display:inline-block;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:700;${formData.modo === 'anonimo' ? 'background-color:#fee2e2;color:#991b1b;' : 'background-color:#dbeafe;color:#1e40af;'}">${formData.modo === 'anonimo' ? '🔒 Anónima' : '👤 Identificada'}</span></td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Descripción -->
    <tr>
      <td style="padding:28px 40px 0;">
        <h2 style="margin:0 0 16px;font-size:17px;color:#0f172a;font-weight:700;border-bottom:2px solid #e2e8f0;padding-bottom:10px;">📝 Descripción de los Hechos</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px;">
        <p style="margin:0;font-size:14px;color:#334155;line-height:1.7;background-color:#f8fafc;padding:20px;border-left:4px solid #16a34a;border-radius:0 6px 6px 0;">${formData.notificacion.descripcion}</p>
      </td>
    </tr>

    <!-- Datos del denunciante -->
    ${formData.modo === 'identificado' ? `
    <tr>
      <td style="padding:28px 40px 0;">
        <h2 style="margin:0 0 16px;font-size:17px;color:#0f172a;font-weight:700;border-bottom:2px solid #e2e8f0;padding-bottom:10px;">👤 Datos del Denunciante</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;background-color:#f0fdf4;border:1px solid #86efac;border-radius:6px;">
          <tr>
            <td style="padding:12px 16px;color:#64748b;width:200px;vertical-align:top;border-bottom:1px solid #bbf7d0;">Relación con empresa</td>
            <td style="padding:12px 16px;color:#1e293b;font-weight:600;border-bottom:1px solid #bbf7d0;">${formData.denunciante.relacion}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#64748b;vertical-align:top;border-bottom:1px solid #bbf7d0;">Nombre completo</td>
            <td style="padding:12px 16px;color:#1e293b;font-weight:600;border-bottom:1px solid #bbf7d0;">${formData.denunciante.nombre} ${formData.denunciante.apellidos}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#64748b;vertical-align:top;${formData.denunciante.telefono ? 'border-bottom:1px solid #bbf7d0;' : ''}">Correo electrónico</td>
            <td style="padding:12px 16px;color:#1e293b;font-weight:600;${formData.denunciante.telefono ? 'border-bottom:1px solid #bbf7d0;' : ''}">${formData.denunciante.correo}</td>
          </tr>
          ${formData.denunciante.telefono ? `
          <tr>
            <td style="padding:12px 16px;color:#64748b;vertical-align:top;">Teléfono</td>
            <td style="padding:12px 16px;color:#1e293b;font-weight:600;">${formData.denunciante.telefono}</td>
          </tr>` : ''}
        </table>
      </td>
    </tr>
    ` : `
    <tr>
      <td style="padding:28px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:6px;">
          <tr>
            <td style="padding:20px;text-align:center;">
              <p style="margin:0;font-size:15px;color:#991b1b;font-weight:700;">🔒 Denuncia realizada de forma anónima</p>
              <p style="margin:6px 0 0;font-size:13px;color:#b91c1c;">No se proporcionaron datos de identificación del denunciante</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    `}

    <!-- Personas involucradas -->
    ${formData.involucrados.length > 0 ? `
    <tr>
      <td style="padding:28px 40px 0;">
        <h2 style="margin:0 0 16px;font-size:17px;color:#0f172a;font-weight:700;border-bottom:2px solid #e2e8f0;padding-bottom:10px;">👥 Personas Involucradas (${formData.involucrados.length})</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px;">
        ${formData.involucrados.map((inv: any, idx: number) => `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;margin-bottom:12px;border:1px solid #e2e8f0;border-radius:6px;">
          <tr>
            <td style="padding:12px 16px;background-color:#1e293b;color:#ffffff;font-weight:600;border-radius:6px 6px 0 0;">Persona ${idx + 1}: ${inv.nombre} ${inv.apellidos}</td>
          </tr>
          ${inv.correo ? `<tr><td style="padding:10px 16px;color:#475569;border-bottom:1px solid #f1f5f9;">📧 ${inv.correo}</td></tr>` : ''}
          ${inv.telefono ? `<tr><td style="padding:10px 16px;color:#475569;border-bottom:1px solid #f1f5f9;">📞 ${inv.telefono}</td></tr>` : ''}
          ${inv.comentarios ? `<tr><td style="padding:10px 16px 14px;color:#475569;font-style:italic;">💬 ${inv.comentarios}</td></tr>` : ''}
        </table>
        `).join('')}
      </td>
    </tr>
    ` : ''}

    <!-- Comentarios sobre archivos -->
    ${formData.archivos.comentarios ? `
    <tr>
      <td style="padding:28px 40px 0;">
        <h2 style="margin:0 0 16px;font-size:17px;color:#0f172a;font-weight:700;border-bottom:2px solid #e2e8f0;padding-bottom:10px;">📎 Comentarios sobre Archivos Adjuntos</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px;">
        <p style="margin:0;font-size:14px;color:#334155;line-height:1.7;background-color:#f8fafc;padding:20px;border-left:4px solid #6366f1;border-radius:0 6px 6px 0;">${formData.archivos.comentarios}</p>
      </td>
    </tr>
    ` : ''}

    <!-- Comentarios adicionales -->
    ${formData.final.comentarios ? `
    <tr>
      <td style="padding:28px 40px 0;">
        <h2 style="margin:0 0 16px;font-size:17px;color:#0f172a;font-weight:700;border-bottom:2px solid #e2e8f0;padding-bottom:10px;">💬 Comentarios Adicionales</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px;">
        <p style="margin:0;font-size:14px;color:#334155;line-height:1.7;background-color:#f8fafc;padding:20px;border-left:4px solid #8b5cf6;border-radius:0 6px 6px 0;">${formData.final.comentarios}</p>
      </td>
    </tr>
    ` : ''}
  </table>

  <!-- Footer ancho completo -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1e293b;margin-top:32px;">
    <tr>
      <td style="padding:24px 40px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">Este correo fue generado automáticamente por el Canal Ético de Denuncias de ARH Consultores.</p>
        <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">Fecha de envío: ${new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        <p style="margin:12px 0 0;font-size:11px;color:#64748b;">⚠️ Información confidencial — Solo para uso interno del comité de ética</p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const initialForm = {
  empresa: 'ARH Consultores',
  centro: '',
  tipo: '',
  modo: 'identificado',
  denunciante: { relacion: '', nombre: '', apellidos: '', correo: '', telefono: '' },
  notificacion: { fecha: '', descripcion: '' },
  involucrados: [],
  archivos: { comentarios: '' },
  final: { comentarios: '', aceptoPrivacidad: false, aceptoTerminos: false }
};

export default function Wizard() {
  const [step, setStep] = useState(() => {
    const saved = parseInt(sessionStorage.getItem('wizard-step') || '1');
    return saved >= 1 && saved <= 6 ? saved : 1;
  });
  const [formData, setFormData] = useState<any>(() => {
    try { return { ...initialForm, ...JSON.parse(sessionStorage.getItem('wizard-form') || '{}') }; }
    catch { return initialForm; }
  });
  const [nuevoInvolucrado, setNuevoInvolucrado] = useState({ nombre: '', apellidos: '', correo: '', telefono: '', comentarios: '' });
  const [archivosSubidos, setArchivosSubidos] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistir paso y formulario en sessionStorage
  useEffect(() => { sessionStorage.setItem('wizard-step', String(step)); }, [step]);
  useEffect(() => { sessionStorage.setItem('wizard-form', JSON.stringify(formData)); }, [formData]);

  // Detectar modo alto contraste del sistema operativo
  useEffect(() => {
    const mq = window.matchMedia('(forced-colors: active)');
    if (mq.matches) document.documentElement.classList.add('acc-contrast-dark');
    const handler = (e: MediaQueryListEvent) =>
      document.documentElement.classList.toggle('acc-contrast-dark', e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Atajos de teclado globales
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>('[aria-label="Abrir panel de accesibilidad"]')?.click();
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>('[data-action="siguiente"]')?.click();
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>('[data-action="anterior"]')?.click();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-green-900 flex items-center justify-center p-4 sm:p-8">
      <Toaster position="top-right" />
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.3)] overflow-hidden">
        {/* Header mejorado con gradiente */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-8 py-6 flex items-center gap-5">
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-9 h-9">
              <path d="M20 44 L20 24 Q20 20 24 20 L40 20 Q44 20 44 24 L44 36 Q44 40 40 40 L28 40 Z" fill="white" />
              <rect x="26" y="26" width="12" height="2" rx="1" fill="#16a34a" />
              <rect x="26" y="30" width="12" height="2" rx="1" fill="#16a34a" />
              <rect x="26" y="34" width="8" height="2" rx="1" fill="#16a34a" />
              <circle cx="21" cy="45" r="4" fill="white" opacity="0.8" />
              <path d="M18 45 Q20 48 21 49 L24 43" stroke="#16a34a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg tracking-tight">Canal Ético de Denuncias</h1>
            <p className="text-green-100 text-sm mt-0.5">ARH Consultores — Enviar comunicación</p>
          </div>
        </div>

        {/* Barra de pasos mejorada con conectores y labels */}
        <div className="px-8 py-6 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between relative">
            {/* Línea conectora de fondo */}
            <div className="absolute top-5 left-[40px] right-[40px] h-0.5 bg-slate-200 z-0"></div>
            <div className="absolute top-5 left-[40px] h-0.5 bg-green-500 z-0 transition-all duration-500" style={{ width: `${((step - 1) / (steps.length - 1)) * (100 - (80 / (steps.length)))}%` }}></div>
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 relative z-10">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  i + 1 < step ? 'bg-green-500 text-white shadow-md shadow-green-200' :
                  i + 1 === step ? 'bg-green-600 text-white shadow-lg shadow-green-300 scale-110' :
                  'bg-white text-slate-400 border-2 border-slate-200'
                }`}>
                  {i + 1 < step ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <s.icon size={18} />
                  )}
                </div>
                <span className={`text-[11px] font-medium transition-colors ${
                  i + 1 <= step ? 'text-green-700' : 'text-slate-400'
                }`}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 sm:p-12">
          {step === 1 && (
            <>
              <h2 className="text-xl sm:text-2xl font-bold text-center text-slate-800 mb-2">¿Cuál es el hecho que desea denunciar?</h2>
              <p className="text-center text-slate-500 text-sm mb-10">Complete los datos básicos de la comunicación</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Empresa <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.empresa} disabled className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Centro <span className="text-red-500">*</span></label>
                  <select value={formData.centro} onChange={(e) => { setFormData({...formData, centro: e.target.value}); narrar(`Centro seleccionado: ${e.target.value}`); }} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow">
                    <option value="">Seleccionar...</option>
                    {SEDES.map(sede => <option key={sede} value={sede}>{sede}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-6">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tipo de notificación <span className="text-red-500">*</span></label>
                <select value={formData.tipo} onChange={(e) => { setFormData({...formData, tipo: e.target.value}); narrar(`Tipo seleccionado: ${e.target.value}`); }} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow">
                  <option value="">Seleccionar...</option>
                  {TIPOS_NOTIFICACION.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl sm:text-2xl font-bold text-center text-slate-800 mb-2">Datos de identificación</h2>
              <p className="text-center text-slate-500 text-sm mb-10">Elija si desea identificarse o realizar la denuncia de forma anónima</p>
              <div className="flex justify-center gap-4 mb-8">
                <label className={`flex items-center gap-3 cursor-pointer px-5 py-3 rounded-lg border-2 transition-all ${formData.modo === 'identificado' ? 'border-green-500 bg-green-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="modo" checked={formData.modo === 'identificado'} onChange={() => { setFormData({...formData, modo: 'identificado'}); narrar('Modo identificado seleccionado'); }} className="accent-green-600" />
                  <span className={`text-sm font-medium ${formData.modo === 'identificado' ? 'text-green-700' : 'text-slate-600'}`}>👤 Identificado</span>
                </label>
                <label className={`flex items-center gap-3 cursor-pointer px-5 py-3 rounded-lg border-2 transition-all ${formData.modo === 'anonimo' ? 'border-green-500 bg-green-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="modo" checked={formData.modo === 'anonimo'} onChange={() => { setFormData({...formData, modo: 'anonimo'}); narrar('Modo anónimo seleccionado. No se solicitarán datos personales.'); }} className="accent-green-600" />
                  <span className={`text-sm font-medium ${formData.modo === 'anonimo' ? 'text-green-700' : 'text-slate-600'}`}>🔒 Anónimo</span>
                </label>
              </div>
              {formData.modo === 'identificado' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Relación con la empresa <span className="text-red-500">*</span></label>
                    <select value={formData.denunciante.relacion} onChange={(e) => { setFormData({...formData, denunciante: {...formData.denunciante, relacion: e.target.value}}); narrar(`Relación seleccionada: ${e.target.value}`); }} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow">
                      <option value="">Seleccionar...</option>
                      {RELACIONES_EMPRESA.map(rel => <option key={rel} value={rel}>{rel}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre <span className="text-red-500">*</span></label>
                      <input type="text" value={formData.denunciante.nombre} onChange={(e) => setFormData({...formData, denunciante: {...formData.denunciante, nombre: e.target.value}})} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow" placeholder="Ingrese su nombre" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Apellidos <span className="text-red-500">*</span></label>
                      <input type="text" value={formData.denunciante.apellidos} onChange={(e) => setFormData({...formData, denunciante: {...formData.denunciante, apellidos: e.target.value}})} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow" placeholder="Ingrese sus apellidos" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Correo <span className="text-red-500">*</span></label>
                      <input type="email" value={formData.denunciante.correo} onChange={(e) => setFormData({...formData, denunciante: {...formData.denunciante, correo: e.target.value}})} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow" placeholder="correo@ejemplo.com" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Teléfono <span className="text-slate-400 text-xs font-normal">(opcional)</span></label>
                      <input type="tel" value={formData.denunciante.telefono} onChange={(e) => setFormData({...formData, denunciante: {...formData.denunciante, telefono: e.target.value}})} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow" placeholder="(000) 000-0000" />
                    </div>
                  </div>
                </div>
              )}
              {formData.modo === 'anonimo' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                  <p className="text-amber-800 font-medium text-sm">🔒 Ha seleccionado realizar la denuncia de forma anónima.</p>
                  <p className="text-amber-600 text-sm mt-1">No se solicitarán datos personales.</p>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-xl sm:text-2xl font-bold text-center text-slate-800 mb-2">Datos de la denuncia</h2>
              <p className="text-center text-slate-500 text-sm mb-10">Proporcione detalles sobre los hechos</p>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Fecha de la incidencia <span className="text-red-500">*</span></label>
                  <input type="date" value={formData.notificacion.fecha} onChange={(e) => setFormData({...formData, notificacion: {...formData.notificacion, fecha: e.target.value}})} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descripción <span className="text-red-500">*</span></label>
                  <textarea value={formData.notificacion.descripcion} onChange={(e) => setFormData({...formData, notificacion: {...formData.notificacion, descripcion: e.target.value}})} rows={7} maxLength={4000} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow resize-none" placeholder="Por favor, describe en este recuadro todos los detalles sobre el asunto que te preocupa o sugerencia. Trata de ser tan específico como puedas en cuanto a los nombres o departamentos, personas, documentos, políticas, lugares, fechas, horas, etc." />
                  <div className="flex justify-between mt-1.5">
                    <p className="text-xs text-slate-400">Sea lo más detallado posible</p>
                    <p className="text-xs text-slate-400">{formData.notificacion.descripcion.length}/4000</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-xl sm:text-2xl font-bold text-center text-slate-800 mb-2">Personas involucradas</h2>
              <p className="text-center text-slate-500 text-sm mb-10">Agregue datos de testigos o personas involucradas (opcional)</p>
              <div className="space-y-4 bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input type="text" placeholder="Nombre" value={nuevoInvolucrado.nombre} onChange={(e) => setNuevoInvolucrado({...nuevoInvolucrado, nombre: e.target.value})} className="p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow" />
                  <input type="text" placeholder="Apellidos" value={nuevoInvolucrado.apellidos} onChange={(e) => setNuevoInvolucrado({...nuevoInvolucrado, apellidos: e.target.value})} className="p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow" />
                  <input type="email" placeholder="Correo electrónico" value={nuevoInvolucrado.correo} onChange={(e) => setNuevoInvolucrado({...nuevoInvolucrado, correo: e.target.value})} className="p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow" />
                  <input type="tel" placeholder="Teléfono" value={nuevoInvolucrado.telefono} onChange={(e) => setNuevoInvolucrado({...nuevoInvolucrado, telefono: e.target.value})} className="p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow" />
                </div>
                <textarea placeholder="Comentarios sobre esta persona..." value={nuevoInvolucrado.comentarios} onChange={(e) => setNuevoInvolucrado({...nuevoInvolucrado, comentarios: e.target.value})} rows={3} maxLength={4000} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow resize-none" />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-slate-400">{nuevoInvolucrado.comentarios.length}/4000</p>
                  <button onClick={() => {
                    if (!nuevoInvolucrado.nombre || !nuevoInvolucrado.apellidos) {
                      toast.error("Si deseas agregar una persona, nombre y apellidos son requeridos.");
                      return;
                    }
                    if (!nuevoInvolucrado.correo) {
                      toast("Sin correo no podremos contactar a esta persona directamente.", { icon: '⚠️' });
                    }
                    setFormData({...formData, involucrados: [...formData.involucrados, nuevoInvolucrado]});
                    setNuevoInvolucrado({ nombre: '', apellidos: '', correo: '', telefono: '', comentarios: '' });
                  }} className="bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm">+ Añadir persona</button>
                </div>
              </div>
              {formData.involucrados.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-semibold text-slate-700 mb-3 text-sm">Personas agregadas ({formData.involucrados.length}):</h3>
                  <div className="space-y-2">
                    {formData.involucrados.map((inv: any, i: number) => (
                      <div key={i} className="bg-white p-4 rounded-lg border border-slate-200 flex justify-between items-center shadow-sm">
                        <div>
                          <span className="font-medium text-slate-700 text-sm">{inv.nombre} {inv.apellidos}</span>
                          {inv.correo && <span className="text-xs text-slate-400 ml-3">{inv.correo}</span>}
                        </div>
                        <button onClick={() => setFormData({...formData, involucrados: formData.involucrados.filter((_: any, index: number) => index !== i)})} className="flex items-center gap-1 text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors font-medium">✕ Eliminar</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="text-xl sm:text-2xl font-bold text-center text-slate-800 mb-2">Archivos adjuntos</h2>
              <p className="text-center text-slate-500 text-sm mb-10">Adjunte documentos o evidencias relevantes (opcional)</p>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center bg-slate-50 hover:border-green-400 hover:bg-green-50/30 transition-colors">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <Paperclip size={28} className="text-green-600" />
                  </div>
                  <p className="text-slate-500 text-sm mb-4">Arrastre sus archivos aquí o haga clic para seleccionar</p>
                  <input type="file" ref={fileInputRef} onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0)
                      setArchivosSubidos([...archivosSubidos, e.target.files[0]]);
                  }} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm">Seleccionar archivo</button>
                </div>
              </div>
              {archivosSubidos.length > 0 && (
                <div className="mt-5 space-y-2">
                  <h4 className="font-semibold text-slate-700 text-sm">Archivos subidos ({archivosSubidos.length}):</h4>
                  {archivosSubidos.map((file, i) => (
                    <div key={i} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                          <Paperclip size={14} className="text-blue-600" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-slate-700">{file.name}</span>
                          <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <button onClick={() => setArchivosSubidos(archivosSubidos.filter((_, index) => index !== i))} className="flex items-center gap-1 text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors font-medium">✕ Eliminar</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-6">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Comentarios sobre los archivos</label>
                <textarea value={formData.archivos.comentarios} onChange={(e) => setFormData({...formData, archivos: {...formData.archivos, comentarios: e.target.value}})} rows={3} maxLength={4000} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow resize-none" placeholder="Describa el contenido de los archivos adjuntos..." />
                <p className="text-right text-xs text-slate-400 mt-1">{formData.archivos.comentarios.length}/4000</p>
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <h2 className="text-xl sm:text-2xl font-bold text-center text-slate-800 mb-2">Finalizar denuncia</h2>
              <p className="text-center text-slate-500 text-sm mb-10">Revise y confirme el envío de su comunicación</p>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Comentarios adicionales <span className="text-slate-400 text-xs font-normal">(opcional)</span></label>
                  <textarea value={formData.final.comentarios} onChange={(e) => setFormData({...formData, final: {...formData.final, comentarios: e.target.value}})} rows={5} maxLength={4000} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm transition-shadow resize-none" placeholder="Agregue cualquier información adicional relevante..." />
                  <p className="text-right text-xs text-slate-400 mt-1">{formData.final.comentarios.length}/4000</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 space-y-4">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Términos y condiciones</p>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" checked={formData.final.aceptoPrivacidad} onChange={(e) => setFormData({...formData, final: {...formData.final, aceptoPrivacidad: e.target.checked}})} className="mt-0.5 w-4 h-4 accent-green-600 rounded" />
                    <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">Acepto la <strong>Política de privacidad</strong> del Canal Ético.</span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" checked={formData.final.aceptoTerminos} onChange={(e) => setFormData({...formData, final: {...formData.final, aceptoTerminos: e.target.checked}})} className="mt-0.5 w-4 h-4 accent-green-600 rounded" />
                    <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">Al pulsar <strong>Enviar</strong>, acepto los <strong>términos y condiciones</strong> de uso del Canal Ético.</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-8 py-5 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          {step > 1 ? (
            <Button variant="secondary" data-action="anterior" onClick={() => setStep(Math.max(1, step - 1))}>← Anterior</Button>
          ) : (
            <div></div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline">Paso {step} de {steps.length}</span>
            <Button data-action="siguiente" onClick={async () => {
            if (step === 1 && (!formData.centro || !formData.tipo)) {
              const msg = 'Por favor, completa los campos requeridos: centro y tipo de notificación.';
              toast.error(msg); narrar(msg); return;
            }
            if (step === 2 && formData.modo === 'identificado') {
              if (!formData.denunciante.relacion || !formData.denunciante.nombre || !formData.denunciante.apellidos || !formData.denunciante.correo) {
                const msg = 'Por favor, completa todos los datos de identificación: relación, nombre, apellidos y correo.';
                toast.error(msg); narrar(msg); return;
              }
            }
            if (step === 3 && (!formData.notificacion.fecha || !formData.notificacion.descripcion)) {
              const msg = 'Por favor, completa la fecha de incidencia y la descripción.';
              toast.error(msg); narrar(msg); return;
            }
            if (step === 6 && (!formData.final.aceptoPrivacidad || !formData.final.aceptoTerminos)) {
              const msg = 'Por favor, acepta la política de privacidad y los términos y condiciones.';
              toast.error(msg); narrar(msg); return;
            }
            if (step === 6) {
              try {
                toast.loading("Enviando formulario...");
                const attachments = await Promise.all(
                  archivosSubidos.map(async (file) => ({ name: file.name, data: await fileToBase64(file) }))
                );
                const response = await fetch('/api/send-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: 'denunciasconsultoresarh@gmail.com',
                    subject: `Nueva denuncia recibida: ${formData.tipo}`,
                    text: `Se ha recibido una nueva denuncia.\n\nEmpresa: ${formData.empresa}\nCentro: ${formData.centro}\nTipo: ${formData.tipo}\nDescripción: ${formData.notificacion.descripcion}`,
                    html: buildEmailHtml(formData),
                    attachments
                  })
                });
                if (!response.ok) throw new Error('Error al enviar el correo.');
                toast.dismiss();
                const okMsg = 'Formulario enviado con éxito. Gracias por su denuncia.';
                toast.success(okMsg); narrar(okMsg);
                setFormData(initialForm);
                setArchivosSubidos([]);
                setStep(1);
              } catch (error) {
                toast.dismiss();
                const errMsg = error instanceof Error ? error.message : 'Hubo un error al enviar el formulario.';
                toast.error(errMsg); narrar(errMsg);
              }
              return;
            }
            setStep(Math.min(6, step + 1));
          }} className="bg-green-600 text-white px-8 py-2.5 rounded-lg font-semibold text-sm hover:bg-green-700 transition-colors shadow-sm">{step === 6 ? '✓ Enviar denuncia' : 'Siguiente →'}</Button>
          </div>
        </div>
      </div>

      <AccesibilidadPanel step={step} />
    </div>
  );
}
