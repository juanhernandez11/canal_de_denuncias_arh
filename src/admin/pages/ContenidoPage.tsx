import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Home, Mail, PanelBottom, LayoutList, RefreshCw, Save, Code, Eye, Bold, Italic, List, Link as LinkIcon } from 'lucide-react';
import type { ContentBlock } from '../../types/admin';

interface SectionDef {
  key: string;
  label: string;
  icon: typeof Home;
}

// Secciones agrupadas por prefijo de block_key.
const SECTIONS: SectionDef[] = [
  { key: 'home', label: 'Página de inicio', icon: Home },
  { key: 'contacto', label: 'Contacto', icon: Mail },
  { key: 'footer', label: 'Pie de página', icon: PanelBottom },
];

function sectionForKey(blockKey: string): string {
  const prefix = blockKey.split('.')[0];
  return SECTIONS.some((s) => s.key === prefix) ? prefix : 'otros';
}

export default function ContenidoPage() {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Valores en edición por block_key.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/content', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar el contenido');
        return (await res.json()) as ContentBlock[];
      })
      .then((data) => {
        setBlocks(data);
        setDrafts(Object.fromEntries(data.map((b) => [b.block_key, b.value])));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error desconocido'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, ContentBlock[]> = {};
    for (const b of blocks) {
      const s = sectionForKey(b.block_key);
      (map[s] ||= []).push(b);
    }
    return map;
  }, [blocks]);

  const setDraft = (key: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const save = async (block: ContentBlock) => {
    const value = drafts[block.block_key] ?? '';
    setSaving((prev) => ({ ...prev, [block.block_key]: true }));
    try {
      const res = await fetch(`/api/admin/content/${encodeURIComponent(block.block_key)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error('No se pudo guardar');
      const updated = (await res.json()) as ContentBlock;
      setBlocks((prev) => prev.map((b) => (b.block_key === updated.block_key ? updated : b)));
      setDrafts((prev) => ({ ...prev, [updated.block_key]: updated.value }));
      toast.success(`«${block.label}» guardado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving((prev) => ({ ...prev, [block.block_key]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#1a237e] rounded-full animate-spin mr-3" />
        Cargando contenido…
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="font-semibold text-red-800 mb-2">Error al cargar el contenido</p>
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1a237e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#283593]"
          >
            <RefreshCw size={16} /> Recargar
          </button>
        </div>
      </div>
    );
  }

  const orderedSections = [
    ...SECTIONS,
    { key: 'otros', label: 'Otros bloques', icon: LayoutList },
  ].filter((s) => grouped[s.key]?.length);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a237e]">Contenido del sitio</h1>
          <p className="text-sm text-slate-500 mt-1">
            Edita los textos que se muestran en el canal de denuncias.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={16} /> Recargar
        </button>
      </div>

      <div className="space-y-8">
        {orderedSections.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.key}>
              <div className="flex items-center gap-2 mb-3 text-[#1a237e]">
                <Icon size={18} />
                <h2 className="font-bold">{section.label}</h2>
              </div>
              <div className="space-y-4">
                {grouped[section.key].map((block) => (
                  <BlockEditor
                    key={block.block_key}
                    block={block}
                    value={drafts[block.block_key] ?? ''}
                    dirty={(drafts[block.block_key] ?? '') !== block.value}
                    saving={!!saving[block.block_key]}
                    onChange={(v) => setDraft(block.block_key, v)}
                    onSave={() => save(block)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

interface BlockEditorProps {
  block: ContentBlock;
  value: string;
  dirty: boolean;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

function BlockEditor({ block, value, dirty, saving, onChange, onSave }: BlockEditorProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3 gap-4">
        <div>
          <p className="font-semibold text-slate-800">{block.label}</p>
          <code className="text-xs text-slate-400">{block.block_key}</code>
        </div>
        {dirty && (
          <span className="shrink-0 text-xs font-medium text-[#f57c00]">Cambios sin guardar</span>
        )}
      </div>

      {block.type === 'text' && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1a237e] focus:ring-2 focus:ring-[#1a237e]/20 outline-none"
        />
      )}

      {block.type === 'textarea' && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1a237e] focus:ring-2 focus:ring-[#1a237e]/20 outline-none resize-y"
        />
      )}

      {block.type === 'html' && (
        <HtmlEditor value={value} onChange={onChange} />
      )}

      <div className="flex justify-end mt-4">
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1a237e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#283593] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

interface HtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
}

// Editor HTML sencillo: modo visual (contentEditable + document.execCommand,
// deprecado pero sin dependencias, según el contrato) y modo código (textarea).
function HtmlEditor({ value, onChange }: HtmlEditorProps) {
  const [mode, setMode] = useState<'visual' | 'code'>('visual');
  const ref = useRef<HTMLDivElement>(null);

  // Sincroniza el HTML entrante hacia el div editable solo cuando cambia externamente.
  useEffect(() => {
    if (mode === 'visual' && ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, [value, mode]);

  const exec = (command: string, arg?: string) => {
    // document.execCommand está deprecado; se usa por ser la vía sin dependencias.
    document.execCommand(command, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  return (
    <div className="rounded-lg border border-slate-300 overflow-hidden">
      <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        {mode === 'visual' && (
          <>
            <ToolbarBtn onClick={() => exec('bold')} title="Negrita"><Bold size={15} /></ToolbarBtn>
            <ToolbarBtn onClick={() => exec('italic')} title="Cursiva"><Italic size={15} /></ToolbarBtn>
            <ToolbarBtn onClick={() => exec('insertUnorderedList')} title="Lista"><List size={15} /></ToolbarBtn>
            <ToolbarBtn
              onClick={() => {
                const url = window.prompt('URL del enlace:');
                if (url) exec('createLink', url);
              }}
              title="Enlace"
            >
              <LinkIcon size={15} />
            </ToolbarBtn>
            <div className="flex-1" />
          </>
        )}
        {mode === 'code' && <div className="flex-1" />}
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'visual' ? 'code' : 'visual'))}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
        >
          {mode === 'visual' ? (<><Code size={14} /> HTML</>) : (<><Eye size={14} /> Visual</>)}
        </button>
      </div>

      {mode === 'visual' ? (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
          className="min-h-[120px] px-3 py-2 text-sm focus:outline-none prose prose-sm max-w-none"
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 text-sm font-mono focus:outline-none resize-y"
        />
      )}
    </div>
  );
}

function ToolbarBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded p-1.5 text-slate-600 hover:bg-slate-200"
    >
      {children}
    </button>
  );
}
