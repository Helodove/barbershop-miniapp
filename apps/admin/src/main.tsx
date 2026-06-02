import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AdminLayout } from './components/layout/AdminLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { AppointmentsPage } from './pages/AppointmentsPage'
import { SchedulePage } from './pages/SchedulePage'
import { ClientsPage } from './pages/ClientsPage'
import { BarbersPage } from './pages/BarbersPage'
import { ServicesPage } from './pages/ServicesPage'
import { BonusPage } from './pages/BonusPage'
import { BarberServicesPage } from './pages/BarberServicesPage'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/appointments" replace />} />
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route
                path="clients"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <ClientsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="barbers"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <BarbersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="services"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <ServicesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="bonus"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <BonusPage />
                  </ProtectedRoute>
                }
              />
              <Route path="my-services" element={<BarberServicesPage />} />
              <Route path="*" element={<Navigate to="/appointments" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
