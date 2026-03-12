import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import AdminLayout from './components/AdminLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Waitlist from './pages/Waitlist'
import ConvertSignup from './pages/ConvertSignup'
import Affiliates from './pages/Affiliates'
import Customers from './pages/Customers'
import Platforms from './pages/Platforms'
import PlatformDetail from './pages/PlatformDetail'

function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (profile && profile.role !== 'admin' && profile.role !== 'dev') {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-400">You need admin privileges to access this dashboard.</p>
        </div>
      </div>
    )
  }

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="waitlist" element={<Waitlist />} />
            <Route path="waitlist/convert/:id" element={<ConvertSignup />} />
            <Route path="affiliates" element={<Affiliates />} />
            <Route path="customers" element={<Customers />} />
            <Route path="platforms" element={<Platforms />} />
            <Route path="platforms/:id" element={<PlatformDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
