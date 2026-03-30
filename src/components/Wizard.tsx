import { useState, useRef } from 'react';
import { LayoutGrid, User, Calendar, Eye, Paperclip, CheckSquare } from 'lucide-react';
import Button from './shared/Button';
import { Toaster, toast } from 'react-hot-toast';

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
  "Uso indebido de información/divulgación de información confidencial", "Descriminación o trato desigual",
  "Acoso laboral o sexual/hostigamiento", "Violaciones a derechos humanos",
  "Incumplimiento de leyes o regulaciones", "Actuación irregular de libre competencia/prácticas desleales", "Relación indebida con proveedores", "Otros"];

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
  <h2>Nueva notificación: ${formData.tipo}</h2>
  <h3>Datos generales</h3>
  <ul>
    <li><strong>Empresa:</strong> ${formData.empresa}</li>
    <li><strong>Centro:</strong> ${formData.centro}</li>
    <li><strong>Tipo:</strong> ${formData.tipo}</li>
    <li><strong>Fecha de incidencia:</strong> ${formData.notificacion.fecha}</li>
  </ul>
  <h3>Descripción</h3>
  <p>${formData.notificacion.descripcion}</p>
  ${formData.modo === 'identificado' ? `
    <h3>Datos del denunciante</h3>
    <ul>
      <li><strong>Relación:</strong> ${formData.denunciante.relacion}</li>
      <li><strong>Nombre:</strong> ${formData.denunciante.nombre} ${formData.denunciante.apellidos}</li>
      <li><strong>Correo:</strong> ${formData.denunciante.correo}</li>
      ${formData.denunciante.telefono ? `<li><strong>Teléfono:</strong> ${formData.denunciante.telefono}</li>` : ''}
    </ul>
  ` : '<p><em>Denuncia anónima</em></p>'}
  ${formData.involucrados.length > 0 ? `
    <h3>Personas involucradas</h3>
    ${formData.involucrados.map((inv: any) => `
      <ul>
        <li><strong>Nombre:</strong> ${inv.nombre} ${inv.apellidos}</li>
        ${inv.correo ? `<li><strong>Correo:</strong> ${inv.correo}</li>` : ''}
        ${inv.telefono ? `<li><strong>Teléfono:</strong> ${inv.telefono}</li>` : ''}
        ${inv.comentarios ? `<li><strong>Comentarios:</strong> ${inv.comentarios}</li>` : ''}
      </ul><hr/>
    `).join('')}
  ` : ''}
  ${formData.archivos.comentarios ? `<h3>Comentarios sobre archivos</h3><p>${formData.archivos.comentarios}</p>` : ''}
  ${formData.final.comentarios ? `<h3>Comentarios adicionales</h3><p>${formData.final.comentarios}</p>` : ''}
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
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>(initialForm);
  const [nuevoInvolucrado, setNuevoInvolucrado] = useState({ nombre: '', apellidos: '', correo: '', telefono: '', comentarios: '' });
  const [archivosSubidos, setArchivosSubidos] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-screen bg-[url('https://picsum.photos/seed/office/1920/1080?blur=10')] bg-cover bg-center flex items-center justify-center p-4">
      <Toaster position="top-right" />
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-2xl overflow-hidden">
        <div className="p-6 border-b flex items-center gap-4 bg-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-12 h-12 shrink-0">
            <circle cx="32" cy="32" r="32" fill="#16a34a" />
            <path d="M20 44 L20 24 Q20 20 24 20 L40 20 Q44 20 44 24 L44 36 Q44 40 40 40 L28 40 Z" fill="white" />
            <rect x="26" y="26" width="12" height="2" rx="1" fill="#16a34a" />
            <rect x="26" y="30" width="12" height="2" rx="1" fill="#16a34a" />
            <rect x="26" y="34" width="8" height="2" rx="1" fill="#16a34a" />
            <circle cx="21" cy="45" r="4" fill="#15803d" />
            <path d="M18 45 Q20 48 21 49 L24 43" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
          <div>
            <p className="font-semibold text-slate-800 text-base">Canal Ético de Denuncias</p>
            <p className="text-xs text-slate-500">ARH Consultores — Inicio / Enviar comunicación</p>
          </div>
        </div>

        <div className="p-8 flex justify-between items-center bg-slate-50">
          {steps.map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${i + 1 === step ? 'border-green-500 bg-green-500 text-white' : 'border-slate-300 text-slate-400'}`}>
                <s.icon size={24} />
              </div>
            </div>
          ))}
        </div>

        <div className="p-12">
          {step === 1 && (
            <>
              <h2 className="text-2xl font-semibold text-center text-slate-700 mb-10">¿QUÉ HECHO ES EL QUE QUIERE NOTIFICAR?</h2>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Empresa *</label>
                  <input type="text" value={formData.empresa} disabled className="w-full mt-1 p-2 border border-slate-300 rounded bg-slate-100 text-slate-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Centro *</label>
                  <select value={formData.centro} onChange={(e) => setFormData({...formData, centro: e.target.value})} className="w-full mt-1 p-2 border border-slate-300 rounded focus:ring-1 focus:ring-slate-500 outline-none">
                    <option value="">Seleccionar...</option>
                    {SEDES.map(sede => <option key={sede} value={sede}>{sede}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-8">
                <label className="block text-sm font-medium text-slate-700">Tipo de notificación *</label>
                <select value={formData.tipo} onChange={(e) => setFormData({...formData, tipo: e.target.value})} className="w-full mt-1 p-2 border border-slate-300 rounded focus:ring-1 focus:ring-slate-500 outline-none">
                  <option value="">Seleccionar...</option>
                  {TIPOS_NOTIFICACION.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-2xl font-semibold text-center text-slate-700 mb-10">DATOS DE IDENTIFICACIÓN</h2>
              <div className="flex justify-center gap-6 mb-8">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="modo" checked={formData.modo === 'identificado'} onChange={() => setFormData({...formData, modo: 'identificado'})} />
                  Identificado
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="modo" checked={formData.modo === 'anonimo'} onChange={() => setFormData({...formData, modo: 'anonimo'})} />
                  Anónimo
                </label>
              </div>
              {formData.modo === 'identificado' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Relación con la empresa *</label>
                    <select value={formData.denunciante.relacion} onChange={(e) => setFormData({...formData, denunciante: {...formData.denunciante, relacion: e.target.value}})} className="w-full mt-1 p-2 border border-slate-300 rounded focus:ring-1 focus:ring-slate-500 outline-none">
                      <option value="">Seleccionar...</option>
                      {RELACIONES_EMPRESA.map(rel => <option key={rel} value={rel}>{rel}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Nombre *</label>
                      <input type="text" value={formData.denunciante.nombre} onChange={(e) => setFormData({...formData, denunciante: {...formData.denunciante, nombre: e.target.value}})} className="w-full mt-1 p-2 border border-slate-300 rounded focus:ring-1 focus:ring-slate-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Apellidos *</label>
                      <input type="text" value={formData.denunciante.apellidos} onChange={(e) => setFormData({...formData, denunciante: {...formData.denunciante, apellidos: e.target.value}})} className="w-full mt-1 p-2 border border-slate-300 rounded focus:ring-1 focus:ring-slate-500 outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Correo *</label>
                      <input type="email" value={formData.denunciante.correo} onChange={(e) => setFormData({...formData, denunciante: {...formData.denunciante, correo: e.target.value}})} className="w-full mt-1 p-2 border border-slate-300 rounded focus:ring-1 focus:ring-slate-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Teléfono</label>
                      <input type="tel" value={formData.denunciante.telefono} onChange={(e) => setFormData({...formData, denunciante: {...formData.denunciante, telefono: e.target.value}})} className="w-full mt-1 p-2 border border-slate-300 rounded focus:ring-1 focus:ring-slate-500 outline-none" />
                    </div>
                  </div>
                </div>
              )}
              {formData.modo === 'anonimo' && (
                <p className="text-center text-slate-500 italic">Ha seleccionado realizar la denuncia de forma anónima. No se solicitarán datos personales.</p>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-2xl font-semibold text-center text-slate-700 mb-10">DATOS DE LA NOTIFICACIÓN</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Fecha de la incidencia *</label>
                  <input type="date" value={formData.notificacion.fecha} onChange={(e) => setFormData({...formData, notificacion: {...formData.notificacion, fecha: e.target.value}})} className="w-full mt-1 p-2 border border-slate-300 rounded focus:ring-1 focus:ring-slate-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Descripción *</label>
                  <textarea value={formData.notificacion.descripcion} onChange={(e) => setFormData({...formData, notificacion: {...formData.notificacion, descripcion: e.target.value}})} rows={6} maxLength={4000} className="w-full mt-1 p-2 border border-slate-300 rounded focus:ring-1 focus:ring-slate-500 outline-none" placeholder="Por favor, describe en este recuadro todos los detalles sobre el asunto que te preocupa o sugerencia. Trata de ser tan específico como puedas en cuanto a los nombres o departamentos, personas, documentos, políticas, lugares, fechas, horas, etc." />
                  <p className="text-right text-sm text-slate-500">{formData.notificacion.descripcion.length} caracteres de 4000</p>
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-2xl font-semibold text-center text-slate-700 mb-10">PERSONAS INVOLUCRADAS</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Nombre" value={nuevoInvolucrado.nombre} onChange={(e) => setNuevoInvolucrado({...nuevoInvolucrado, nombre: e.target.value})} className="p-2 border border-slate-300 rounded" />
                  <input type="text" placeholder="Apellidos" value={nuevoInvolucrado.apellidos} onChange={(e) => setNuevoInvolucrado({...nuevoInvolucrado, apellidos: e.target.value})} className="p-2 border border-slate-300 rounded" />
                  <input type="email" placeholder="Correo" value={nuevoInvolucrado.correo} onChange={(e) => setNuevoInvolucrado({...nuevoInvolucrado, correo: e.target.value})} className="p-2 border border-slate-300 rounded" />
                  <input type="tel" placeholder="Teléfono" value={nuevoInvolucrado.telefono} onChange={(e) => setNuevoInvolucrado({...nuevoInvolucrado, telefono: e.target.value})} className="p-2 border border-slate-300 rounded" />
                </div>
                <textarea placeholder="Comentarios" value={nuevoInvolucrado.comentarios} onChange={(e) => setNuevoInvolucrado({...nuevoInvolucrado, comentarios: e.target.value})} rows={4} maxLength={4000} className="w-full p-2 border border-slate-300 rounded" />
                <p className="text-right text-sm text-slate-500">{nuevoInvolucrado.comentarios.length} caracteres de 4000</p>
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
                }} className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">AÑADIR PERSONAS INVOLUCRADAS</button>
              </div>
              <p className="text-center text-sm text-slate-500 mt-4">Se puede agregar de manera opcional datos de personas como testigos o personas involucradas.</p>
              {formData.involucrados.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-semibold text-slate-700 mb-4">Personas agregadas:</h3>
                  {formData.involucrados.map((inv: any, i: number) => (
                    <div key={i} className="bg-slate-50 p-4 rounded border mb-2 flex justify-between items-center">
                      <span>{inv.nombre} {inv.apellidos}</span>
                      <button onClick={() => setFormData({...formData, involucrados: formData.involucrados.filter((_: any, index: number) => index !== i)})} className="flex items-center gap-1 text-sm text-red-500 border border-red-300 px-3 py-1 rounded hover:bg-red-50 transition-colors">🗑 Eliminar</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="text-2xl font-semibold text-center text-slate-700 mb-10">ARCHIVOS</h2>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center">
                <div className="flex flex-col items-center">
                  <Paperclip size={48} className="text-slate-400 mb-4" />
                  <input type="file" ref={fileInputRef} onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0)
                      setArchivosSubidos([...archivosSubidos, e.target.files[0]]);
                  }} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">SUBIR ARCHIVO</button>
                </div>
              </div>
              {archivosSubidos.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="font-medium text-slate-700">Archivos subidos:</h4>
                  {archivosSubidos.map((file, i) => (
                    <div key={i} className="bg-slate-50 p-3 rounded border flex justify-between items-center">
                      <span className="text-sm text-slate-600">{file.name}</span>
                      <button onClick={() => setArchivosSubidos(archivosSubidos.filter((_, index) => index !== i))} className="flex items-center gap-1 text-sm text-red-500 border border-red-300 px-3 py-1 rounded hover:bg-red-50 transition-colors">🗑 Eliminar</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-8">
                <label className="block text-sm font-medium text-slate-700">Comentarios</label>
                <textarea value={formData.archivos.comentarios} onChange={(e) => setFormData({...formData, archivos: {...formData.archivos, comentarios: e.target.value}})} rows={4} maxLength={4000} className="w-full mt-1 p-2 border border-slate-300 rounded focus:ring-1 focus:ring-slate-500 outline-none" placeholder="Comentarios" />
                <p className="text-right text-sm text-slate-500">{formData.archivos.comentarios.length} caracteres de 4000</p>
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <h2 className="text-2xl font-semibold text-center text-slate-700 mb-10">FINALIZAR NOTIFICACIÓN</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Comentarios adicionales</label>
                  <textarea value={formData.final.comentarios} onChange={(e) => setFormData({...formData, final: {...formData.final, comentarios: e.target.value}})} rows={6} maxLength={4000} className="w-full mt-1 p-2 border border-slate-300 rounded focus:ring-1 focus:ring-slate-500 outline-none" placeholder="Comentarios" />
                  <p className="text-right text-sm text-slate-500">{formData.final.comentarios.length} caracteres de 4000</p>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.final.aceptoPrivacidad} onChange={(e) => setFormData({...formData, final: {...formData.final, aceptoPrivacidad: e.target.checked}})} />
                    Al hacer clic en la casilla acepto la Política de privacidad del Canal Ético.
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.final.aceptoTerminos} onChange={(e) => setFormData({...formData, final: {...formData.final, aceptoTerminos: e.target.checked}})} />
                    Al pulsar sobre el botón Enviar usted acepta los términos y condiciones de uso del Canal Ético.
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-8 border-t flex justify-between">
          {step > 1 ? (
            <Button variant="secondary" onClick={() => setStep(Math.max(1, step - 1))}>← ANTERIOR</Button>
          ) : (
            <div></div>
          )}
          <Button onClick={async () => {
            if (step === 1 && (!formData.centro || !formData.tipo)) {
              toast.error("Por favor, completa los campos requeridos.");
              return;
            }
            if (step === 2 && formData.modo === 'identificado') {
              if (!formData.denunciante.relacion || !formData.denunciante.nombre || !formData.denunciante.apellidos || !formData.denunciante.correo) {
                toast.error("Por favor, completa todos los datos de identificación.");
                return;
              }
            }
            if (step === 3 && (!formData.notificacion.fecha || !formData.notificacion.descripcion)) {
              toast.error("Por favor, completa los campos requeridos.");
              return;
            }
            if (step === 6 && (!formData.final.aceptoPrivacidad || !formData.final.aceptoTerminos)) {
              toast.error("Por favor, acepta la política de privacidad y los términos y condiciones.");
              return;
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
                    subject: `Nueva notificación recibida: ${formData.tipo}`,
                    text: `Se ha recibido una nueva notificación.\n\nEmpresa: ${formData.empresa}\nCentro: ${formData.centro}\nTipo: ${formData.tipo}\nDescripción: ${formData.notificacion.descripcion}`,
                    html: buildEmailHtml(formData),
                    attachments
                  })
                });
                if (!response.ok) throw new Error("Error al enviar el correo.");
                toast.dismiss();
                toast.success("Formulario enviado con éxito.");
                setFormData(initialForm);
                setArchivosSubidos([]);
                setStep(1);
              } catch (error) {
                toast.dismiss();
                toast.error(error instanceof Error ? error.message : "Hubo un error al enviar el formulario.");
              }
              return;
            }
            setStep(Math.min(6, step + 1));
          }} className="bg-slate-900 text-white px-8 py-2 rounded-none hover:bg-slate-800">{step === 6 ? 'ENVIAR' : 'SIGUIENTE →'}</Button>
        </div>
      </div>
    </div>
  );
}
