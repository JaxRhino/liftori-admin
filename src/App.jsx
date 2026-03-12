import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import AdminLayout from './components/AdminLayout'
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <AdminLayout />
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
