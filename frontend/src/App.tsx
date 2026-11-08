import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientFormPage } from './pages/ClientFormPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { ConsultationsPage } from './pages/ConsultationsPage';
import { NewConsultationPage } from './pages/NewConsultationPage';
import { ConsultationDetailPage } from './pages/ConsultationDetailPage';
import { PartnersPage } from './pages/PartnersPage';
import { SettingsPage } from './pages/SettingsPage';

function PrivateRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" aria-label="Carregando" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role || '')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/new" element={<ClientFormPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/clients/:id/edit" element={<ClientFormPage />} />
        <Route path="/consultations" element={<ConsultationsPage />} />
        <Route path="/consultations/new" element={<NewConsultationPage />} />
        <Route path="/consultations/:id" element={<ConsultationDetailPage />} />
        <Route path="/partners" element={<PrivateRoute allowedRoles={['ADMIN']}><PartnersPage /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute allowedRoles={['ADMIN']}><SettingsPage /></PrivateRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}