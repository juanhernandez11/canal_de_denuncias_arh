import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { Denuncia, EstatusFolio } from '../../types/admin';
import { ESTATUS_LABELS } from '../../types/admin';

interface FoliosResponse {
  items: Denuncia[];
  total: number;
  page: number;
  pageSize: number;
}

interface DenunciaDetalle extends Denuncia {
  payload?: Record<string, unknown> | null;
}

const PAGE_SIZE = 10;

const ESTATUS_BADGE: Record<EstatusFolio, string> = {
  recibida: 'bg-blue-100 text-blue-800',
  en_revision: 'bg-amber-100 text-amber-800',
  en_investigacion: 'bg-purple-100 text-purple-800',
  resuelta: 'bg-green-100 text-green-800',
  desestimada: 'bg-slate-200 text-slate-700',
};

function EstatusBadge({ estatus }: { estatus: EstatusFolio }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTATUS_BADGE[estatus] ?? 'bg-slate-100 text-slate-700'}`}
    >
      {ESTATUS_LABELS[estatus] ?? estatus}
    </span>
  );
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FoliosPage() {
  const [items, setItems] = useState<Denuncia[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [estatus, setEstatus] = useState<'' | EstatusFolio>('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (estatus) params.set('estatus', estatus);
      if (q) params.set('q', q);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      const res = await fetch(`/api/admin/folios?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('No se pudieron cargar los folios');
      const data = (await res.json()) as FoliosResponse;
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [estatus, q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQ(qInput.trim());
  };

  const handleEstatusFilter = (value: string) => {
    setPage(1);
    setEstatus(value as '' | EstatusFolio);
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[#1a237e]">Folios de denuncias</h1>

      <form
        onSubmit={handleSearch}
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <input
          type="search"
          placeholder="Buscar por folio, tipo, empresa o descripción…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          className="w-full flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-[#1a237e] focus:outline-none focus:ring-2 focus:ring-[#1a237e]/20"
        />
        <select
          value={estatus}
          onChange={(e) => handleEstatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-[#1a237e] focus:outline-none focus:ring-2 focus:ring-[#1a237e]/20"
        >
          <option value="">Todos los estatus</option>
          {Object.entries(ESTATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-[#1a237e] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#151d63]"
        >
          Buscar
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Folio</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Empresa</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Estatus</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Recibida</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No hay folios que coincidan.
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr
                  key={it.folio}
                  onClick={() => setSelected(it.folio)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-mono font-medium text-[#1a237e]">
                    {it.folio}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{it.tipo ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{it.empresa ?? '—'}</td>
                  <td className="px-4 py-3">
                    <EstatusBadge estatus={it.estatus} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(it.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <span>
          {total} folio{total === 1 ? '' : 's'} · Página {page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-slate-100"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-slate-100"
          >
            Siguiente
          </button>
        </div>
      </div>

      {selected && (
        <DetalleModal
          folio={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            void load();
          }}
        />
      )}
    </div>
  );
}

function DetalleModal({
  folio,
  onClose,
  onSaved,
}: {
  folio: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detalle, setDetalle] = useState<DenunciaDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [estatus, setEstatus] = useState<EstatusFolio>('recibida');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/folios/${encodeURIComponent(folio)}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('No se pudo cargar el detalle');
        const data = (await res.json()) as DenunciaDetalle;
        if (!active) return;
        setDetalle(data);
        setEstatus(data.estatus);
        setNotas(data.notas_admin ?? '');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al cargar detalle');
        onClose();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [folio, onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/folios/${encodeURIComponent(folio)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estatus, notas_admin: notas }),
      });
      if (!res.ok) throw new Error('No se pudo guardar');
      const updated = (await res.json()) as DenunciaDetalle;
      setDetalle((prev) => (prev ? { ...prev, ...updated } : updated));
      toast.success('Cambios guardados');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-[#1a237e] px-6 py-4">
          <h2 className="font-mono text-lg font-bold text-white">
            {folio}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {loading || !detalle ? (
          <div className="px-6 py-12 text-center text-slate-400">Cargando…</div>
        ) : (
          <div className="space-y-5 p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Tipo" value={detalle.tipo} />
              <Field label="Empresa" value={detalle.empresa} />
              <Field label="Centro" value={detalle.centro} />
              <Field label="Modo" value={detalle.modo} />
              <Field label="Denunciante" value={detalle.denunciante_nombre} />
              <Field label="Correo" value={detalle.denunciante_correo} />
              <Field label="Recibida" value={formatDate(detalle.created_at)} />
              <Field label="Actualizada" value={formatDate(detalle.updated_at)} />
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Descripción
              </p>
              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                {detalle.descripcion || '—'}
              </p>
            </div>

            {detalle.payload && (
              <details className="rounded-lg border border-slate-200">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-600">
                  Ver datos completos (payload)
                </summary>
                <pre className="max-h-64 overflow-auto rounded-b-lg bg-slate-900 p-3 text-xs text-green-200">
                  {JSON.stringify(detalle.payload, null, 2)}
                </pre>
              </details>
            )}

            <div className="border-t border-slate-200 pt-4">
              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Estatus
                </label>
                <select
                  value={estatus}
                  onChange={(e) => setEstatus(e.target.value as EstatusFolio)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1a237e] focus:outline-none focus:ring-2 focus:ring-[#1a237e]/20"
                >
                  {Object.entries(ESTATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Notas administrativas
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1a237e] focus:outline-none focus:ring-2 focus:ring-[#1a237e]/20"
                  placeholder="Notas internas sobre el seguimiento…"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-[#f57c00] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#e06f00] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-sm text-slate-800">{value || '—'}</p>
    </div>
  );
}
