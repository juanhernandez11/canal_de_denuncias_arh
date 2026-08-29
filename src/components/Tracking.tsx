import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ESTATUS_LABELS, type EstatusFolio } from '../types/admin';

interface FolioStatus {
  folio: string;
  estatus: EstatusFolio;
  updated_at: string;
}

// Colores por estatus, acordes a la paleta del proyecto.
const ESTATUS_STYLES: Record<EstatusFolio, string> = {
  recibida: 'bg-blue-100 text-blue-800 border-blue-200',
  en_revision: 'bg-amber-100 text-amber-800 border-amber-200',
  en_investigacion: 'bg-orange-100 text-orange-800 border-orange-200',
  resuelta: 'bg-green-100 text-green-800 border-green-200',
  desestimada: 'bg-slate-100 text-slate-700 border-slate-200',
};

// Orden de la línea de tiempo del proceso.
const TIMELINE: EstatusFolio[] = ['recibida', 'en_revision', 'en_investigacion', 'resuelta'];

export default function Tracking() {
  const { folio } = useParams();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [data, setData] = useState<FolioStatus | null>(null);

  useEffect(() => {
    if (!folio) return;
    let activo = true;
    setLoading(true);
    setNotFound(false);
    setError(false);

    fetch(`/api/folios/${encodeURIComponent(folio)}/status`)
      .then(async (res) => {
        if (!activo) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setError(true);
          return;
        }
        const json = (await res.json()) as FolioStatus;
        setData(json);
      })
      .catch(() => {
        if (activo) setError(true);
      })
      .finally(() => {
        if (activo) setLoading(false);
      });

    return () => { activo = false; };
  }, [folio]);

  const fechaLegible = data
    ? new Date(data.updated_at).toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '';

  const estatusActual = data?.estatus;
  const indiceActual = estatusActual ? TIMELINE.indexOf(estatusActual) : -1;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a237e] to-[#283593] px-8 py-6 flex items-center gap-5">
          <img src="/logo-arh.png" alt="ARH Consultores" className="h-12 object-contain shrink-0" />
          <div className="border-l border-white/30 pl-5">
            <h1 className="text-white font-bold text-lg tracking-tight">Seguimiento de Denuncia</h1>
            <p className="text-indigo-200 text-sm mt-0.5">Consulta el estatus de tu folio</p>
          </div>
        </div>

        <div className="px-8 py-8">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Folio de seguimiento</p>
            <p className="text-2xl font-extrabold text-[#1a237e] tracking-wider break-all">{folio}</p>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1a237e] rounded-full animate-spin mb-4" />
              <p className="text-sm">Consultando el estatus del folio…</p>
            </div>
          )}

          {!loading && notFound && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
              <p className="text-3xl mb-2">🔍</p>
              <h2 className="text-lg font-bold text-amber-800 mb-1">Folio no encontrado</h2>
              <p className="text-sm text-amber-700">
                No encontramos ninguna denuncia con este folio. Verifica que lo hayas escrito
                correctamente.
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-3xl mb-2">⚠️</p>
              <h2 className="text-lg font-bold text-red-800 mb-1">Ocurrió un error</h2>
              <p className="text-sm text-red-700">
                No pudimos consultar el estatus en este momento. Inténtalo de nuevo más tarde.
              </p>
            </div>
          )}

          {!loading && !notFound && !error && data && estatusActual && (
            <>
              <div className="mb-8">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Estatus actual</p>
                <span
                  className={`inline-block px-4 py-2 rounded-full border text-sm font-semibold ${ESTATUS_STYLES[estatusActual]}`}
                >
                  {ESTATUS_LABELS[estatusActual]}
                </span>
                <p className="text-xs text-slate-400 mt-3">Última actualización: {fechaLegible}</p>
              </div>

              {/* Línea de tiempo del proceso (no aplica a folios desestimados) */}
              {estatusActual !== 'desestimada' && (
                <div className="border-t border-slate-100 pt-6">
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-4">Progreso</p>
                  <ol className="space-y-4">
                    {TIMELINE.map((estatus, i) => {
                      const completado = indiceActual >= 0 && i <= indiceActual;
                      const activoPaso = i === indiceActual;
                      return (
                        <li key={estatus} className="flex items-center gap-3">
                          <span
                            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
                              completado
                                ? 'bg-[#1a237e] text-white'
                                : 'bg-slate-200 text-slate-400'
                            }`}
                          >
                            {completado ? '✓' : i + 1}
                          </span>
                          <span
                            className={`text-sm ${
                              activoPaso
                                ? 'font-bold text-[#1a237e]'
                                : completado
                                ? 'text-slate-700'
                                : 'text-slate-400'
                            }`}
                          >
                            {ESTATUS_LABELS[estatus]}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 text-center space-y-2">
            <Link
              to="/tracking"
              className="block text-sm font-semibold text-[#1a237e] hover:text-[#283593] transition-colors"
            >
              🔎 Consultar otro folio
            </Link>
            <Link
              to="/"
              className="inline-block text-sm text-slate-500 hover:text-[#1a237e] transition-colors"
            >
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
