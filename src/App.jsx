import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './lib/AuthContext'
import AdminLayout from './components/AdminLayout'
import ClientLayout from './components/ClientLayout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import LeadHunter from './pages/LeadHunter'
import Estimates from './pages/Estimates'
import Agreements from './pages/Agreements'
import Commissions from './pages/Commissions'
import ProjectDetail from './pages/ProjectDetail'
import Waitlist from './pages/Waitlist'
import Affiliates from './pages/Affiliates'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import ConvertSignup from './pages/ConvertSignup'
import Platforms from './pages/Platforms'
import PlatformDetail from './pages/PlatformDetail'
import RallyChat from './pages/RallyChat'
import Rally from './pages/Rally'
import { WebSocketProvider } from './contexts/WebSocketContext'
import { VideoCallProvider } from './contexts/VideoCallContext'
import DiscountCodes from './pages/DiscountCodes'
import Plans from './pages/Plans'
import PortalDashboard from './pages/portal/PortalDashboard'
import ChoosePlan from './pages/portal/ChoosePlan'
import PortalProject from './pages/portal/PortalProject'
import Settings from './pages/Settings'
import ComingSoon from './pages/ComingSoon'
import CallCenter from './pages/CallCenter'
import InHouseBuilds from './pages/InHouseBuilds'
import InHouseBuildDetail from './pages/InHouseBuildDetail'
import OpsDashboard from './pages/OpsDashboard'
import WizardBuilder from './pages/WizardBuilder'
import PortalProjects from './pages/portal/PortalProjects'
import PortalSettings from './pages/portal/PortalSettings'
import PortalMessages from './pages/portal/PortalMessages'
import PortalDocuments from './pages/portal/PortalDocuments'
import PortalInvoices from './pages/portal/PortalInvoices'
import PortalWizard from './pages/portal/PortalWizard'
// Freight AI — BIH Logistics
import FreightDashboard from './pages/freight/FreightDashboard'
import FreightSalesProfiles from './pages/freight/FreightSalesProfiles'
import FreightShippers from './pages/freight/FreightShippers'
import FreightLoads from './pages/freight/FreightLoads'
import FreightCommissions from './pages/freight/FreightCommissions'
// EOS — Entrepreneurial Operating System
import EOSDashboard from './pages/eos/EOSDashboard'
import EOSLeadershipDashboard from './pages/eos/EOSLeadershipDashboard'
import EOSScorecard from './pages/eos/EOSScorecard'
import EOSRocks from './pages/eos/EOSRocks'
import EOSIssues from './pages/eos/EOSIssues'
import EOSTodos from './pages/eos/EOSTodos'
import EOSHeadlines from './pages/eos/EOSHeadlines'
import EOSL10Meetings from './pages/eos/EOSL10Meetings'
import EOSL10MeetingRoom from './pages/eos/EOSL10MeetingRoom'
import EOSAccountabilityChart from './pages/eos/EOSAccountabilityChart'
import EOSVTO from './pages/eos/EOSVTO'
// Finance Hub
import FinanceDashboard from './pages/finance/FinanceDashboard'
import InvoicesList from './pages/finance/InvoicesList'
import PaymentsList from './pages/finance/PaymentsList'
import ExpensesList from './pages/finance/ExpensesList'
import JournalEntries from './pages/finance/JournalEntries'
import FinancialReports from './pages/finance/FinancialReports'
import CommissionBatches from './pages/finance/CommissionBatches'
import ChartOfAccounts from './pages/finance/ChartOfAccounts'
// Marketing Hub
import MarketingDashboard from './pages/marketing/MarketingDashboard'
import MarketingTracker from './pages/marketing/MarketingTracker'
import AdManager from './pages/marketing/AdManager'
import OnPaceTracking from './pages/marketing/OnPaceTracking'
import ContentCreator from './pages/marketing/ContentCreator'
import Scheduler from './pages/marketing/Scheduler'
import CustomerMap from './pages/marketing/CustomerMap'
import SEOManager from './pages/marketing/SEOManager'
import EmailCampaigns from './pages/marketing/EmailCampaigns'
import Analytics from './pages/marketing/Analytics'
import SocialListening from './pages/marketing/SocialListening'
import UTMBuilder from './pages/marketing/UTMBuilder'
import ABTesting from './pages/marketing/ABTesting'
import AudienceSegments from './pages/marketing/AudienceSegments'
// Communications Hub
import CommunicationsHub from './pages/communications/CommunicationsHub'
import ChannelsSettings from './pages/communications/ChannelsSettings'
import AutomationsPage from './pages/communications/AutomationsPage'
// Onboarding Wizard — public customer-facing
import OnboardingWizard from './pages/OnboardingWizard'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) {
    const redirectTo = location.pathname + location.search
    return <Navigate to={`/login?redirectTo=${encodeURIComponent(redirectTo)}`} replace />
  }
  return children
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return null
  if (!isAdmin) return <Navigate to="/portal" replace />
  return children
}

function ClientRoute({ children }) {
  const { loading } = useAuth()
  if (loading) return null
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
      <WebSocketProvider>
        <VideoCallProvider>
          <BrowserRouter>
            <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          {/* Public onboarding wizard — no auth required */}
          <Route path="/onboard" element={<OnboardingWizard />} />

          {/* Root redirect based on role */}
          <Route path="/" element={
            <ProtectedRoute><RootRedirect /></ProtectedRoute>
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
            <Route path="call-center" element={<CallCenter />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="waitlist" element={<Waitlist />} />
            <Route path="affiliates" element={<Affiliates />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="customers/convert/:signupId" element={<ConvertSignup />} />
            <Route path="platforms" element={<Platforms />} />
            <Route path="platforms/:id" element={<PlatformDetail />} />
            <Route path="lead-hunter" element={<LeadHunter />} />
            <Route path="estimates" element={<Estimates />} />
            <Route path="agreements" element={<Agreements />} />
            <Route path="commissions" element={<Commissions />} />
            <Route path="discount-codes" element={<DiscountCodes />} />
            <Route path="plans" element={<Plans />} />
            <Route path="chat" element={<RallyChat />} />
            <Route path="rally" element={<Rally />} />
            {/* Freight AI — BIH Logistics */}
            <Route path="freight" element={<FreightDashboard />} />
            <Route path="freight/sales-profiles" element={<FreightSalesProfiles />} />
            <Route path="freight/shippers" element={<FreightShippers />} />
            <Route path="freight/loads" element={<FreightLoads />} />
            <Route path="freight/commissions" element={<FreightCommissions />} />
            {/* EOS — Entrepreneurial Operating System */}
            <Route path="eos" element={<EOSDashboard />} />
            <Route path="eos/leadership" element={<EOSLeadershipDashboard />} />
            <Route path="eos/scorecard" element={<EOSScorecard />} />
            <Route path="eos/rocks" element={<EOSRocks />} />
            <Route path="eos/issues" element={<EOSIssues />} />
            <Route path="eos/todos" element={<EOSTodos />} />
            <Route path="eos/headlines" element={<EOSHeadlines />} />
            <Route path="eos/meetings" element={<EOSL10Meetings />} />
            <Route path="eos/meetings/:meetingId" element={<EOSL10MeetingRoom />} />
            <Route path="eos/accountability" element={<EOSAccountabilityChart />} />
            <Route path="eos/vto" element={<EOSVTO />} />
            {/* Operations */}
            <Route path="ops-dashboard" element={<OpsDashboard />} />
            {/* In-House Builds */}
            <Route path="builds" element={<InHouseBuilds />} />
            <Route path="builds/:id" element={<InHouseBuildDetail />} />
            <Route path="pipeline" element={<ComingSoon />} />
            {/* Marketing Hub */}
            <Route path="marketing" element={<MarketingDashboard />} />
            <Route path="marketing/tracker" element={<MarketingTracker />} />
            <Route path="marketing/ads" element={<AdManager />} />
            <Route path="marketing/on-pace" element={<OnPaceTracking />} />
            <Route path="marketing/content" element={<ContentCreator />} />
            <Route path="marketing/scheduler" element={<Scheduler />} />
            <Route path="marketing/customer-map" element={<CustomerMap />} />
            <Route path="marketing/seo" element={<SEOManager />} />
            <Route path="marketing/email" element={<EmailCampaigns />} />
            <Route path="marketing/analytics" element={<Analytics />} />
            <Route path="marketing/social-listening" element={<SocialListening />} />
            <Route path="marketing/utm-builder" element={<UTMBuilder />} />
            <Route path="marketing/ab-testing" element={<ABTesting />} />
            <Route path="marketing/audience-segments" element={<AudienceSegments />} />
            <Route path="wizard" element={<WizardBuilder />} />
            <Route path="tasks" element={<ComingSoon />} />
            <Route path="notes" element={<ComingSoon />} />
            <Route path="calendar" element={<ComingSoon />} />
            {/* Finance Hub */}
            <Route path="finance" element={<FinanceDashboard />} />
            <Route path="finance/invoices" element={<InvoicesList />} />
            <Route path="finance/payments" element={<PaymentsList />} />
            <Route path="finance/expenses" element={<ExpensesList />} />
            <Route path="finance/journal" element={<JournalEntries />} />
            <Route path="finance/reports" element={<FinancialReports />} />
            <Route path="finance/commissions" element={<CommissionBatches />} />
            <Route path="finance/accounts" element={<ChartOfAccounts />} />
            {/* Communications Hub */}
            <Route path="comms" element={<CommunicationsHub />} />
            <Route path="comms/channels" element={<ChannelsSettings />} />
            <Route path="comms/automations" element={<AutomationsPage />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>

          {/* Choose Plan — full-screen, outside ClientLayout */}
          <Route path="/portal/choose-plan" element={
            <ProtectedRoute>
              <ClientRoute>
                <ChoosePlan />
              </ClientRoute>
            </ProtectedRoute>
          } />

          {/* Client portal routes */}
          <Route path="/portal" element={
            <ProtectedRoute>
              <ClientRoute>
                <ClientLayout />
              </ClientRoute>
            </ProtectedRoute>
          }>
            <Route index element={<PortalDashboard />} />
            <Route path="projects" element={<PortalProjects />} />
            <Route path="messages" element={<PortalMessages />} />
            <Route path="documents" element={<PortalDocuments />} />
            <Route path="invoices" element={<PortalInvoices />} />
            <Route path="settings" element={<PortalSettings />} />
            <Route path="new-project" element={<PortalWizard />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors theme="dark" />
        </VideoCallProvider>
      </WebSocketProvider>
    </AuthProvider>
  )
}
