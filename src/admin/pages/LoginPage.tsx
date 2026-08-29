import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      toast.success('Bienvenido');
      navigate('/admin/folios', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1a237e] to-[#0d1440] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center">
          <img src="/logo-arh.png" alt="ARH" className="h-16 w-auto" />
          <h1 className="mt-4 text-xl font-bold text-[#1a237e]">
            Panel de Administración
          </h1>
          <p className="mt-1 text-sm text-slate-500">Canal de Denuncias ARH</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Usuario
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#1a237e] focus:outline-none focus:ring-2 focus:ring-[#1a237e]/30"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#1a237e] focus:outline-none focus:ring-2 focus:ring-[#1a237e]/30"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#1a237e] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#151d63] focus:outline-none focus:ring-2 focus:ring-[#1a237e]/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
