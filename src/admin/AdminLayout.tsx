import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Sesión cerrada');
    navigate('/', { replace: true });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-white/15 text-white'
        : 'text-white/70 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-[#1a237e] transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
          <img
            src="/logo-arh.png"
            alt="ARH"
            className="h-10 w-auto rounded bg-white/95 p-1"
          />
          <span className="text-sm font-semibold text-white">
            Panel Admin
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <NavLink
            to="/admin/folios"
            className={navLinkClass}
            onClick={() => setSidebarOpen(false)}
          >
            <span aria-hidden="true">📋</span> Folios
          </NavLink>
          <NavLink
            to="/admin/contenido"
            className={navLinkClass}
            onClick={() => setSidebarOpen(false)}
          >
            <span aria-hidden="true">📝</span> Contenido
          </NavLink>
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          {user && (
            <p className="mb-2 px-4 text-xs text-white/60">
              Conectado como <span className="font-semibold text-white">{user.username}</span>
            </p>
          )}
          <NavLink
            to="/"
            className="mb-1 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <span aria-hidden="true">🌐</span> Ver sitio público
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-[#f57c00] hover:text-white"
          >
            <span aria-hidden="true">⏻</span> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-[#1a237e] hover:bg-slate-100"
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <img src="/logo-arh.png" alt="ARH" className="h-8 w-auto" />
        </header>

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
