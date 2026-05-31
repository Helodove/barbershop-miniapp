import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { AppLayout } from './components/layout/AppLayout'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 60 * 1000,
    },
  },
})

// Lazy-loaded pages (will be created in Tasks 4 & 5)
const HomeScreen = lazy(() => import('./screens/HomeScreen'))
const BookingScreen = lazy(() => import('./screens/BookingScreen'))
const ProfileScreen = lazy(() => import('./screens/ProfileScreen'))
const AppointmentDetailScreen = lazy(() => import('./screens/AppointmentDetailScreen'))

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-bg">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route
                path="/"
                element={<Suspense fallback={<LoadingScreen />}><HomeScreen /></Suspense>}
              />
              <Route
                path="/booking"
                element={<Suspense fallback={<LoadingScreen />}><BookingScreen /></Suspense>}
              />
              <Route
                path="/profile"
                element={<Suspense fallback={<LoadingScreen />}><ProfileScreen /></Suspense>}
              />
              <Route
                path="/appointments/:id"
                element={<Suspense fallback={<LoadingScreen />}><AppointmentDetailScreen /></Suspense>}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
