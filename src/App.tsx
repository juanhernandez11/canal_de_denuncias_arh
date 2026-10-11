import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Wizard from './components/Wizard';
import Tracking from './components/Tracking';
import TrackingSearch from './components/TrackingSearch';
import { AuthProvider } from './admin/AuthContext';
import RequireAuth from './admin/RequireAuth';
import AdminLayout from './admin/AdminLayout';
import LoginPage from './admin/pages/LoginPage';
import FoliosPage from './admin/pages/FoliosPage';
import ContenidoPage from './admin/pages/ContenidoPage';
import ChangePasswordPage from './admin/pages/ChangePasswordPage';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        {/* Rutas públicas — sin AuthProvider */}
        <Route path="/" element={<Wizard />} />
        <Route path="/tracking" element={<TrackingSearch />} />
        <Route path="/tracking/:folio" element={<Tracking />} />

        {/* Rutas admin — AuthProvider solo aquí */}
        <Route
          path="/admin/*"
          element={
            <AuthProvider>
              <Routes>
                <Route path="login" element={<LoginPage />} />
                <Route
                  path="/*"
                  element={
                    <RequireAuth>
                      <AdminLayout />
                    </RequireAuth>
                  }
                >
                  <Route index element={<Navigate to="/admin/folios" replace />} />
                  <Route path="folios" element={<FoliosPage />} />
                  <Route path="contenido" element={<ContenidoPage />} />
                  <Route path="password" element={<ChangePasswordPage />} />
                </Route>
              </Routes>
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
