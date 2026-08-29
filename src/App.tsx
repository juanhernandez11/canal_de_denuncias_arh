import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Wizard from './components/Wizard';
import Tracking from './components/Tracking';
import { AuthProvider } from './admin/AuthContext';
import RequireAuth from './admin/RequireAuth';
import AdminLayout from './admin/AdminLayout';
import LoginPage from './admin/pages/LoginPage';
import FoliosPage from './admin/pages/FoliosPage';
import ContenidoPage from './admin/pages/ContenidoPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<Wizard />} />
          <Route path="/tracking/:folio" element={<Tracking />} />

          <Route path="/admin/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/admin/folios" replace />} />
            <Route path="folios" element={<FoliosPage />} />
            <Route path="contenido" element={<ContenidoPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
