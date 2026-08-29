import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function TrackingSearch() {
  const [folio, setFolio] = useState('');
  const navigate = useNavigate();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = folio.trim();
    if (value) {
      navigate(`/tracking/${encodeURIComponent(value)}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a237e] to-[#283593] px-8 py-6 flex items-center gap-5">
          <img src="/logo-arh.png" alt="ARH Consultores" className="h-12 object-contain shrink-0" />
          <div className="border-l border-white/30 pl-5">
            <h1 className="text-white font-bold text-lg tracking-tight">Seguimiento de Denuncia</h1>
            <p className="text-indigo-200 text-sm mt-0.5">Consulta el estatus de tu folio</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="px-8 py-8">
          <label htmlFor="folio" className="block text-sm font-semibold text-slate-700 mb-2">
            Ingresa tu número de folio
          </label>
          <input
            id="folio"
            type="text"
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            placeholder="ARH-2026-XXXXX"
            autoFocus
            className="w-full border border-slate-300 rounded-lg px-4 py-3 text-slate-800 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#1a237e] focus:border-[#1a237e] transition"
          />
          <button
            type="submit"
            disabled={!folio.trim()}
            className="mt-4 w-full bg-[#1a237e] text-white font-semibold py-3 rounded-lg hover:bg-[#283593] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Consultar estatus
          </button>

          <p className="mt-4 text-xs text-slate-500 text-center">
            El folio te fue proporcionado al momento de enviar tu denuncia y en el correo de
            confirmación.
          </p>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <Link
              to="/"
              className="inline-block text-sm font-semibold text-[#1a237e] hover:text-[#283593] transition-colors"
            >
              Volver al inicio
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
