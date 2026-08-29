import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ChangePasswordPage() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      toast.error('Las contraseñas nuevas no coinciden');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/password', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido');
      toast.success('Contraseña actualizada');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-xl font-bold text-slate-800">Cambiar contraseña</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
        {(['currentPassword', 'newPassword', 'confirm'] as const).map((field) => (
          <div key={field}>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {field === 'currentPassword' ? 'Contraseña actual' : field === 'newPassword' ? 'Nueva contraseña' : 'Confirmar nueva contraseña'}
            </label>
            <input
              type="password"
              value={form[field]}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              required
              minLength={field !== 'currentPassword' ? 8 : undefined}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1a237e] focus:outline-none focus:ring-1 focus:ring-[#1a237e]"
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#1a237e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#283593] disabled:opacity-60"
        >
          {loading ? 'Guardando…' : 'Actualizar contraseña'}
        </button>
      </form>
    </div>
  );
}
