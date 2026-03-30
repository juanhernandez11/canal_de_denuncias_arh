import { useState, useEffect, useRef } from 'react';

const DEFAULTS = {
  tamano: 16,
  interlineado: 1.5,
  contraste: 'normal' as 'normal' | 'oscuro' | 'claro',
  espaciado: false,
  cursorGrande: false,
  resaltarLinks: false,
  sinAnimaciones: false,
  guiaFoco: false,
  escalaGrises: false,
  modoLectura: false,
  resaltadoHover: false,
  mascaraLectura: false,
  fuenteDislexia: false,
  posicion: 'derecha' as 'derecha' | 'izquierda',
};

type Prefs = typeof DEFAULTS;

const PERFILES: { label: string; emoji: string; desc: string; prefs: Partial<Prefs> }[] = [
  {
    label: 'Visual',
    emoji: '👁',
    desc: 'Alto contraste y texto grande',
    prefs: { contraste: 'oscuro', tamano: 20, guiaFoco: true, resaltarLinks: true },
  },
  {
    label: 'Motor',
    emoji: '🖐',
    desc: 'Cursor grande y foco visible',
    prefs: { cursorGrande: true, guiaFoco: true, tamano: 18, sinAnimaciones: true },
  },
  {
    label: 'Cognitivo',
    emoji: '🧠',
    desc: 'Lectura fácil y sin distracciones',
    prefs: { modoLectura: true, fuenteDislexia: true, interlineado: 2, espaciado: true, sinAnimaciones: true },
  },
  {
    label: 'Dislexia',
    emoji: '📖',
    desc: 'Fuente y espaciado especial',
    prefs: { fuenteDislexia: true, espaciado: true, interlineado: 2.25, mascaraLectura: true },
  },
];

const load = (): Prefs => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('a11y') || '{}') }; }
  catch { return DEFAULTS; }
};

const CONTRASTES = { normal: '', oscuro: 'acc-contrast-dark', claro: 'acc-contrast-light' };

export default function AccesibilidadPanel() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(load);
  const [maskY, setMaskY] = useState(0);
  const maskRef = useRef<((e: MouseEvent) => void) | null>(null);

  useEffect(() => {
    localStorage.setItem('a11y', JSON.stringify(prefs));
    const cl = document.documentElement.classList;

    document.documentElement.style.fontSize = `${prefs.tamano}px`;
    document.documentElement.style.setProperty('--acc-line-height', `${prefs.interlineado}`);

    Object.values(CONTRASTES).forEach(c => c && cl.remove(c));
    if (CONTRASTES[prefs.contraste]) cl.add(CONTRASTES[prefs.contraste]);

    cl.toggle('acc-espaciado', prefs.espaciado);
    cl.toggle('acc-cursor', prefs.cursorGrande);
    cl.toggle('acc-links', prefs.resaltarLinks);
    cl.toggle('acc-sin-anim', prefs.sinAnimaciones);
    cl.toggle('acc-foco', prefs.guiaFoco);
    cl.toggle('acc-grises', prefs.escalaGrises);
    cl.toggle('acc-lectura', prefs.modoLectura);
    cl.toggle('acc-hover', prefs.resaltadoHover);
    cl.toggle('acc-dislexia', prefs.fuenteDislexia);
  }, [prefs]);

  // Máscara de lectura
  useEffect(() => {
    if (maskRef.current) window.removeEventListener('mousemove', maskRef.current);
    if (prefs.mascaraLectura) {
      const handler = (e: MouseEvent) => setMaskY(e.clientY);
      maskRef.current = handler;
      window.addEventListener('mousemove', handler);
    }
    return () => { if (maskRef.current) window.removeEventListener('mousemove', maskRef.current); };
  }, [prefs.mascaraLectura]);

  const set = <K extends keyof Prefs>(key: K, val: Prefs[K]) => setPrefs(p => ({ ...p, [key]: val }));

  const applyProfile = (perfil: Partial<Prefs>) => {
    const next = { ...DEFAULTS, ...perfil, posicion: prefs.posicion };
    setPrefs(next);
    document.documentElement.style.fontSize = `${next.tamano}px`;
    document.documentElement.style.setProperty('--acc-line-height', `${next.interlineado}`);
  };

  const reset = () => {
    setPrefs(DEFAULTS);
    document.documentElement.style.fontSize = `${DEFAULTS.tamano}px`;
    document.documentElement.style.setProperty('--acc-line-height', `${DEFAULTS.interlineado}`);
  };

  const posClass = prefs.posicion === 'izquierda' ? 'left-6' : 'right-6';
  const panelPos = prefs.posicion === 'izquierda' ? 'left-6' : 'right-6';

  const Toggle = ({ k, label }: { k: keyof Prefs; label: string }) => (
    <div className="flex justify-between items-center">
      <span>{label}</span>
      <button
        role="switch"
        aria-checked={prefs[k] as boolean}
        onClick={() => set(k, !prefs[k] as any)}
        className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${prefs[k] ? 'bg-green-500' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${prefs[k] ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );

  return (
    <>
      {/* Máscara de lectura */}
      {prefs.mascaraLectura && (
        <div
          className="fixed inset-0 z-40 pointer-events-none"
          style={{
            background: `linear-gradient(
              to bottom,
              rgba(0,0,0,0.75) 0px,
              rgba(0,0,0,0.75) ${maskY - 28}px,
              transparent ${maskY - 28}px,
              transparent ${maskY + 28}px,
              rgba(0,0,0,0.75) ${maskY + 28}px,
              rgba(0,0,0,0.75) 100%
            )`
          }}
        />
      )}

      {/* Botón flotante */}
      <button
        onClick={() => setOpen(!open)}
        title="Opciones de accesibilidad"
        aria-label="Abrir panel de accesibilidad"
        className={`fixed bottom-6 ${posClass} z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-2xl bg-slate-900 text-yellow-400 hover:bg-slate-700 transition-colors`}
      >
        👁️
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Panel de accesibilidad"
          className={`fixed bottom-24 ${panelPos} z-50 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden`}
        >
          <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center">
            <span className="font-semibold text-sm">♿ Accesibilidad</span>
            <button onClick={() => setOpen(false)} aria-label="Cerrar panel" className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
          </div>

          <div className="p-4 space-y-5 text-sm text-slate-700 max-h-[75vh] overflow-y-auto">

            {/* Perfiles rápidos */}
            <div>
              <p className="font-semibold mb-2">Perfiles rápidos</p>
              <div className="grid grid-cols-2 gap-2">
                {PERFILES.map(p => (
                  <button
                    key={p.label}
                    onClick={() => applyProfile(p.prefs)}
                    title={p.desc}
                    className="flex flex-col items-center gap-1 py-2 px-1 rounded border border-slate-200 hover:bg-slate-50 hover:border-slate-400 transition-colors text-center"
                  >
                    <span className="text-xl">{p.emoji}</span>
                    <span className="font-medium text-xs">{p.label}</span>
                    <span className="text-xs text-slate-400 leading-tight">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Tamaño de texto */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="font-semibold">Tamaño de texto</p>
                <span className="text-xs text-slate-500">{prefs.tamano}px</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => set('tamano', Math.max(12, prefs.tamano - 2))} className="w-8 h-8 rounded border border-slate-300 font-bold hover:bg-slate-100 flex items-center justify-center">−</button>
                <input type="range" min={12} max={28} step={2} value={prefs.tamano} onChange={e => set('tamano', Number(e.target.value))} className="flex-1 accent-slate-900" />
                <button onClick={() => set('tamano', Math.min(28, prefs.tamano + 2))} className="w-8 h-8 rounded border border-slate-300 font-bold hover:bg-slate-100 flex items-center justify-center">+</button>
              </div>
            </div>

            {/* Interlineado */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="font-semibold">Interlineado</p>
                <span className="text-xs text-slate-500">{prefs.interlineado}x</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => set('interlineado', Math.max(1, Math.round((prefs.interlineado - 0.25) * 100) / 100))} className="w-8 h-8 rounded border border-slate-300 font-bold hover:bg-slate-100 flex items-center justify-center">−</button>
                <input type="range" min={1} max={3} step={0.25} value={prefs.interlineado} onChange={e => set('interlineado', Number(e.target.value))} className="flex-1 accent-slate-900" />
                <button onClick={() => set('interlineado', Math.min(3, Math.round((prefs.interlineado + 0.25) * 100) / 100))} className="w-8 h-8 rounded border border-slate-300 font-bold hover:bg-slate-100 flex items-center justify-center">+</button>
              </div>
            </div>

            {/* Contraste */}
            <div>
              <p className="font-semibold mb-2">Contraste</p>
              <div className="flex gap-2">
                {([{ label: 'Normal', v: 'normal' }, { label: '🌙 Oscuro', v: 'oscuro' }, { label: '☀️ Claro', v: 'claro' }] as const).map(({ label, v }) => (
                  <button key={v} onClick={() => set('contraste', v)}
                    className={`flex-1 py-1.5 rounded border text-xs font-medium transition-colors ${prefs.contraste === v ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 hover:bg-slate-100'}`}
                  >{label}</button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <Toggle k="espaciado" label="↔ Espaciado amplio" />
              <Toggle k="cursorGrande" label="🖱 Cursor grande" />
              <Toggle k="resaltarLinks" label="🔗 Resaltar botones" />
              <Toggle k="guiaFoco" label="🎯 Guía de foco (teclado)" />
              <Toggle k="resaltadoHover" label="✨ Resaltado al pasar mouse" />
              <Toggle k="mascaraLectura" label="🎭 Máscara de lectura" />
              <Toggle k="fuenteDislexia" label="📖 Fuente para dislexia" />
              <Toggle k="escalaGrises" label="⬛ Escala de grises" />
              <Toggle k="modoLectura" label="📄 Modo lectura" />
              <Toggle k="sinAnimaciones" label="⏸ Sin animaciones" />
            </div>

            {/* Posición */}
            <div>
              <p className="font-semibold mb-2">Posición del botón</p>
              <div className="flex gap-2">
                {([{ label: '← Izquierda', v: 'izquierda' }, { label: 'Derecha →', v: 'derecha' }] as const).map(({ label, v }) => (
                  <button key={v} onClick={() => set('posicion', v)}
                    className={`flex-1 py-1.5 rounded border text-xs font-medium transition-colors ${prefs.posicion === v ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 hover:bg-slate-100'}`}
                  >{label}</button>
                ))}
              </div>
            </div>

            <button onClick={reset} className="w-full py-2 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-medium transition-colors">
              ↺ Restablecer todo
            </button>
          </div>
        </div>
      )}
    </>
  );
}
