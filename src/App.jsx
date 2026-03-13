import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import AdminLayout from './components/AdminLayout'
import ClientLayout from './components/ClientLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Waitlist from './pages/Waitlist'
import Affiliates from './pages/Affiliates'
import Customers from './pages/Customers'
import ConvertSignup from './pages/ConvertSignup'
import Platforms from './pages/Platforms'
import PlatformDetail from './pages/PlatformDetail'
import Chat from './pages/Chat'
import PortalDashboard from './pages/portal/PortalDashboard'
import PortalProject from './pages/portal/PortalProject'
import PortalMessages from './pages/portal/PortalMessages'
import PortalDocuments from './pages/portal/PortalDocuments'
import PortalInvoices from './pages/portal/PortalInvoices'
import PortalWizard from './pages/portal/PortalWizard'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return null
  if (!isAdmin) return <Navigate to="/portal" replace />
  return children
}

function ClientRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return null
  if (isAdmin) return <Navigate to="/" replace />
  return children
}

function RootRedirect() {
  const { isAdmin, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/portal" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Root redirect based on role */}
          <Route path="/" element={
            <ProtectedRoute>
              <RootRedirect />
            </ProtectedRoute>
          } />

          {/* Admin routes */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="waitlist" element={<Waitlist />} />
            <Route path="affiliates" element={<Affiliates />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/convert/:signupId" element={<ConvertSignup />} />
            <Route path="platforms" element={<Platforms />} />
            <Route path="platforms/:id" element={<PlatformDetail />} />
            <Route path="chat" element={<Chat />} />
          </Route>

          {/* Client portal routes */}
          <Route path="/portal" element={
            <ProtectedRoute>
              <ClientRoute>
                <ClientLayout />
              </ClientRoute>
            </ProtectedRoute>
          }>
            <Route index element={<PortalDashboard />} />
            <Route path="project" element={<PortalProject />} />
            <Route path="messages" element={<PortalMessages />} />
            <Route path="documents" element={<PortalDocuments />} />
            <Route path="invoices" element={<PortalInvoices />} />
            <Route path="new-project" element={<PortalWizard />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import AdminLayout from './components/AdminLayout'
import ClientLayout from './components/ClientLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Waitlist from './pages/Waitlist'
import Affiliates from './pages/Affiliates'
import Customers from './pages/Customers'
import ConvertSignup from './pages/ConvertSignup'
import Platforms from './pages/Platforms'
import PlatformDetail from './pages/PlatformDetail'
import Chat from './pages/Chat'
import PortalDashboard from './pages/portal/PortalDashboard'
import PortalProject from './pages/portal/PortalProject'
import PortalMessages from './pages/portal/PortalMessages'
import PortalDocuments from './pages/portal/PortalDocuments'
import PortalInvoices from './pages/portal/PortalInvoices'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return null
  if (!isAdmin) return <Navigate to="/portal" replace />
  return children
}

function ClientRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return null
  if (isAdmin) return <Navigate to="/" replace />
  return children
}

function RootRedirect() {
  const { isAdmin, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/portal" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Root redirect based on role */}
          <Route path="/" element={
            <ProtectedRoute>
              <RootRedirect />
            </ProtectedRoute>
          } />

          {/* Admin routes */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="waitlist" element={<Waitlist />} />
            <Route path="affiliates" element={<Affiliates />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/convert/:signupId" element={<ConvertSignup />} />
            <Route path="platforms" element={<Platforms />} />
            <Route path="platforms/:id" element={<PlatformDetail />} />
            <Route path="chat" element={<Chat />} />
          </Route>

          {/* Client portal routes */}
          <Route path="/portal" element={
            <ProtectedRoute>
              <ClientRoute>
                <ClientLayout />
              </ClientRoute>
            </ProtectedRoute>
          }>
            <Route index element={<PortalDashboard />} />
            <Route path="project" element={<PortalProject />} />
            <Route path="messages" element={<PortalMessages />} />
            <Route path="documents" element={<PortalDocuments />} />
            <Route path="invoices" element={<PortalInvoices />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
