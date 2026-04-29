import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { OrgProvider } from './lib/OrgContext'
import AdminLayout from './components/AdminLayout'
import ClientLayout from './components/ClientLayout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import LeadHunter from './pages/LeadHunter'
// Lead Hunter sub-pages
import LeadHunterDashboard from './pages/lead-hunter/LeadHunterDashboard'
import LeadHunterSearch from './pages/lead-hunter/LeadHunterSearch'
import LeadHunterCompany from './pages/lead-hunter/LeadHunterCompany'
import LeadHunterLists from './pages/lead-hunter/LeadHunterLists'
import LeadHunterSequences from './pages/lead-hunter/LeadHunterSequences'
import LeadHunterSignals from './pages/lead-hunter/LeadHunterSignals'
import LeadHunterSettings from './pages/lead-hunter/LeadHunterSettings'
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
import CallCenterTeam from './pages/CallCenterTeam'
import CallCenterVoicemails from './pages/CallCenterVoicemails'
import CallLists from './pages/CallLists'
import AIAgents from './pages/AIAgents'
import InHouseBuilds from './pages/InHouseBuilds'
import InHouseBuildDetail from './pages/InHouseBuildDetail'
import MobilePreview from './pages/MobilePreview'
import SalesPipeline from './pages/SalesPipeline'
import Investors from './pages/Investors'
import OpsDashboard from './pages/OpsDashboard'
import WizardBuilder from './pages/WizardBuilder'
import Team from './pages/Team'
import Pulse from './pages/Pulse'
import WorkQueue from './pages/WorkQueue'
import CompanyDocs from './pages/CompanyDocs'
import HRHub from './pages/HRHub'
import LeadershipQC from './pages/LeadershipQC'
import CostTracker from './pages/CostTracker'
import Apply from './pages/Apply'
import ScheduleInterview from './pages/ScheduleInterview'
import PortalProjects from './pages/portal/PortalProjects'
import PortalSettings from './pages/portal/PortalSettings'
import PortalMessages from './pages/portal/PortalMessages'
import PortalDocuments from './pages/portal/PortalDocuments'
import PortalInvoices from './pages/portal/PortalInvoices'
import PortalCommissions from './pages/portal/PortalCommissions'
import PortalWizard from './pages/portal/PortalWizard'
// Freight AI â€” BIH Logistics
import FreightDashboard from './pages/freight/FreightDashboard'
import FreightSalesProfiles from './pages/freight/FreightSalesProfiles'
import FreightShippers from './pages/freight/FreightShippers'
import FreightLoads from './pages/freight/FreightLoads'
import FreightCommissions from './pages/freight/FreightCommissions'
// EOS â€” Entrepreneurial Operating System
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
import SocialComposer from './pages/marketing/SocialComposer'
import MarketingWaitlist from './pages/marketing/MarketingWaitlist'
import EmailSequences from './pages/marketing/EmailSequences'
import MarketingPerformance from './pages/marketing/MarketingPerformance'
// Communications Hub
import CommunicationsHub from './pages/communications/CommunicationsHub'
import ChannelsSettings from './pages/communications/ChannelsSettings'
import AutomationsPage from './pages/communications/AutomationsPage'
// Onboarding Wizard â€” public customer-facing
import OnboardingWizard from './pages/OnboardingWizard'
import SupportTickets from './pages/SupportTickets'
import PortalSupport from './pages/portal/PortalSupport'
import RallyGuestJoin from './pages/RallyGuestJoin'
import SalesCall from './pages/SalesCall'
import ConsultingAppointments from './pages/ConsultingAppointments'
import ConsultingClients from './pages/ConsultingClients'
import ConsultingClientDetail from './pages/ConsultingClientDetail'
import ConsultingOnboardingWizard from './pages/ConsultingOnboardingWizard'
import EOSL10Hub from './pages/EOSL10Hub'
import TeamAvailability from './pages/TeamAvailability'
import SuperAdmin from './pages/SuperAdmin'
import Campaigns from './pages/communications/Campaigns'
import CommsTemplates from './pages/communications/Templates'
import OutboundLog from './pages/communications/OutboundLog'
import Testing from './pages/Testing'
import TesterOnboarding from './pages/TesterOnboarding'
import TesterDashboard from './pages/TesterDashboard'
import AffiliateOnboarding from './pages/AffiliateOnboarding'
import AffiliateLayout from './components/AffiliateLayout'
import AffiliateDashboard from './pages/affiliate/AffiliateDashboard'
import AffiliateReferrals from './pages/affiliate/AffiliateReferrals'
import AffiliateContent from './pages/affiliate/AffiliateContent'
import AffiliateScheduler from './pages/affiliate/AffiliateScheduler'
import AffiliateLibrary from './pages/affiliate/AffiliateLibrary'
import AffiliateIdeas from './pages/affiliate/AffiliateIdeas'
import AffiliateAnalytics from './pages/affiliate/AffiliateAnalytics'
import AffiliateCRM from './pages/affiliate/AffiliateCRM'
import AffiliateInventory from './pages/affiliate/AffiliateInventory'
import AffiliateNotes from './pages/affiliate/AffiliateNotes'
import AffiliateTasks from './pages/affiliate/AffiliateTasks'
import AffiliateCalendar from './pages/affiliate/AffiliateCalendar'
import AffiliateChat from './pages/affiliate/AffiliateChat'
import AffiliateSupport from './pages/affiliate/AffiliateSupport'
import AffiliateSettings from './pages/affiliate/AffiliateSettings'
import { useEffect, useState } from 'react'
import { fetchMyEnrollment } from './lib/timeTrackingService'
import { isFounder } from './lib/testerProgramService'
// Customer Sales Hub (LABOS tenant pages)
import CustomerContacts from './pages/customer/CustomerContacts'
import CustomerProjects from './pages/customer/CustomerProjects'
import CustomerPipeline from './pages/customer/CustomerPipeline'
import CustomerEstimates from './pages/customer/CustomerEstimates'
import CustomerAgreements from './pages/customer/CustomerAgreements'
import CompanySettings from './pages/customer/CompanySettings'
import OpsCommandCenter from './pages/customer/ops/OpsCommandCenter'
import OpsWorkOrders from './pages/customer/ops/OpsWorkOrders'
import OpsScheduling from './pages/customer/ops/OpsScheduling'
import OpsCrewManagement from './pages/customer/ops/OpsCrewManagement'
import OpsInventory from './pages/customer/ops/OpsInventory'
import OpsJobsMap from './pages/customer/ops/OpsJobsMap'
import OpsMeasurements from './pages/customer/ops/OpsMeasurements'
import OpsHRHub from './pages/customer/ops/OpsHRHub'
import OpsDocs from './pages/customer/ops/OpsDocs'
import OpsProjects from './pages/customer/ops/OpsProjects'
// LABOS â€” Liftori AI Business Operating System (per-client backend)
import LabosLayout from './components/labos/LabosLayout'
import LabosDashboard from './pages/labos/LabosDashboard'
import LabosSales from './pages/labos/LabosSales'
import LabosOperations from './pages/labos/LabosOperations'
import OperationsDashboard from './pages/labos/operations/OperationsDashboard'
import OperationsInventory from './pages/labos/operations/OperationsInventory'
import OperationsFulfillment from './pages/labos/operations/OperationsFulfillment'
import OperationsTeam from './pages/labos/operations/OperationsTeam'
import LabosMarketing from './pages/labos/LabosMarketing'
import LabosFinance from './pages/labos/LabosFinance'
import LabosCommunications from './pages/labos/LabosCommunications'
import LabosChat from './pages/labos/LabosChat'
// Dev Team — Wave A foundation
import DevTeamLayout from './pages/dev-team/DevTeamLayout'
import DevTeamOverview from './pages/dev-team/DevTeamOverview'
import DevTeamTasks from './pages/dev-team/DevTeamTasks'
import DevTeamActivity from './pages/dev-team/DevTeamActivity'
import DevTeamCanvas from './pages/dev-team/DevTeamCanvas'
import DevTeamCanvasDetail from './pages/dev-team/DevTeamCanvasDetail'
import DevTeamSkillsMemory from './pages/dev-team/DevTeamSkillsMemory'
import DevTeamFeatureIdeas from './pages/dev-team/DevTeamFeatureIdeas'
// CSC Services LABOS-KEC — Wave B operator admin shell
import CscLayout from './pages/csc/CscLayout'
import CscOverview from './pages/csc/CscOverview'
import CscCustomers from './pages/csc/CscCustomers'
import CscJobs from './pages/csc/CscJobs'
import CscJobDetail from './pages/csc/CscJobDetail'
// CSC public — Wave D customer portal + AHJ verify
import CscPublicLayout from './pages/csc-public/CscPublicLayout'
import CscPortal from './pages/csc-public/CscPortal'
import CscVerify from './pages/csc-public/CscVerify'
import CscDeficiencies from './pages/csc/CscDeficiencies'
import CscInvoices from './pages/csc/CscInvoices'
import CscCertificates from './pages/csc/CscCertificates'
import CscStickers from './pages/csc/CscStickers'
import CscAhjMap from './pages/csc/CscAhjMap'

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
  const { isAdmin, isAffiliate, loading } = useAuth()
  if (loading) return null
  if (isAffiliate) return <Navigate to="/affiliate" replace />
  if (!isAdmin) return <Navigate to="/portal" replace />
  return children
}

function DevTeamRoute({ children }) {
  const { isDevTeamMember, loading } = useAuth()
  if (loading) return null
  if (!isDevTeamMember) return <Navigate to="/admin" replace />
  return children
}

function AffiliateRoute({ children }) {
  const { isAffiliate, isAdmin, loading } = useAuth()
  if (loading) return null
  // Allow affiliates + admins (so founders can impersonate / test)
  if (!isAffiliate && !isAdmin) return <Navigate to="/portal" replace />
  return children
}

function ClientRoute({ children }) {
  const { loading } = useAuth()
  if (loading) return null
  return children
}

function RootRedirect() {
  const { isAdmin, isAffiliate, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (isAffiliate) return <Navigate to="/affiliate" replace />
  return isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/portal" replace />
}

/** Renders TesterDashboard for enrolled testers, regular Dashboard otherwise.
 *  Founders always get the regular Dashboard â€” their tester_enrollments rows
 *  exist only for preview access at /admin/tester-dashboard. */
function DashboardRouter() {
  const { user, profile } = useAuth()
  const [checked, setChecked] = useState(false)
  const [isTester, setIsTester] = useState(false)
  const founder = isFounder({ email: user?.email, personal_email: profile?.personal_email })
  useEffect(() => {
    if (!user?.id) return
    if (founder) { setIsTester(false); setChecked(true); return }
    fetchMyEnrollment(user.id)
      .then((e) => setIsTester(!!e))
      .catch(() => setIsTester(false))
      .finally(() => setChecked(true))
  }, [user?.id, founder])
  if (!checked) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  return isTester ? <TesterDashboard /> : <Dashboard />
}

export default function App() {
  return (
    <AuthProvider>
      <OrgProvider>
      <WebSocketProvider>
        <VideoCallProvider>
          <BrowserRouter>
            <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          {/* Public onboarding wizard â€” no auth required */}
          <Route path="/onboard" element={<OnboardingWizard />} />
          {/* Public Rally guest join â€” no auth required */}
          <Route path="/rally/join/:code" element={<RallyGuestJoin />} />
          {/* Public job application â€” no auth required */}
          <Route path="/apply" element={<Apply />} />
          {/* Public interview scheduler â€” no auth required */}
          <Route path="/schedule-interview/:token" element={<ScheduleInterview />} />
          {/* Public tester onboarding wizard â€” no auth required */}
          <Route path="/onboard-tester/:token" element={<TesterOnboarding />} />
          {/* Public affiliate/creator onboarding wizard â€” no auth required */}
          <Route path="/onboard-affiliate/:token" element={<AffiliateOnboarding />} />

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
            <Route index element={<DashboardRouter />} />
            <Route path="super-admin" element={<SuperAdmin />} />
            <Route path="tester-dashboard" element={<TesterDashboard />} />
            <Route path="outbound-mail" element={<OutboundLog />} />
            <Route path="call-center" element={<CallCenter />} />
            <Route path="cc-team" element={<CallCenterTeam />} />
            <Route path="call-lists" element={<CallLists />} />
            <Route path="voicemails" element={<CallCenterVoicemails />} />
            <Route path="ai-agents" element={<AIAgents />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="waitlist" element={<Waitlist />} />
            <Route path="affiliates" element={<Affiliates />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="customers/convert/:signupId" element={<ConvertSignup />} />
            <Route path="platforms" element={<Platforms />} />
            <Route path="platforms/:id" element={<PlatformDetail />} />
            <Route path="lead-hunter" element={<LeadHunterDashboard />} />
            <Route path="lead-hunter/search" element={<LeadHunterSearch />} />
            <Route path="lead-hunter/company/:id" element={<LeadHunterCompany />} />
            <Route path="lead-hunter/lists" element={<LeadHunterLists />} />
            <Route path="lead-hunter/sequences" element={<LeadHunterSequences />} />
            <Route path="lead-hunter/signals" element={<LeadHunterSignals />} />
            <Route path="lead-hunter/settings" element={<LeadHunterSettings />} />
            <Route path="estimates" element={<Estimates />} />
            <Route path="agreements" element={<Agreements />} />
            <Route path="commissions" element={<Commissions />} />
            <Route path="discount-codes" element={<DiscountCodes />} />
            <Route path="plans" element={<Plans />} />
            <Route path="chat" element={<RallyChat />} />
            <Route path="rally" element={<Rally />} />
            {/* Freight AI â€” BIH Logistics */}
            <Route path="freight" element={<FreightDashboard />} />
            <Route path="freight/sales-profiles" element={<FreightSalesProfiles />} />
            <Route path="freight/shippers" element={<FreightShippers />} />
            <Route path="freight/loads" element={<FreightLoads />} />
            <Route path="freight/commissions" element={<FreightCommissions />} />
            {/* EOS â€” Entrepreneurial Operating System */}
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
            {/* Customer Sales Hub (LABOS tenant pages) */}
            <Route path="crm/contacts" element={<CustomerContacts />} />
            <Route path="crm/projects" element={<CustomerProjects />} />
            <Route path="crm/pipeline" element={<CustomerPipeline />} />
            <Route path="crm/estimates" element={<CustomerEstimates />} />
            <Route path="crm/agreements" element={<CustomerAgreements />} />
            <Route path="crm/measurements" element={<OpsMeasurements />} />
            <Route path="crm/settings" element={<CompanySettings />} />
            {/* Customer Ops Command Center (LABOS tenant pages) */}
            <Route path="ops/dashboard" element={<OpsCommandCenter />} />
            <Route path="ops/work-orders" element={<OpsWorkOrders />} />
            <Route path="ops/scheduling" element={<OpsScheduling />} />
            <Route path="ops/crews" element={<OpsCrewManagement />} />
            <Route path="ops/inventory" element={<OpsInventory />} />
            <Route path="ops/map" element={<OpsJobsMap />} />
            <Route path="ops/projects" element={<OpsProjects />} />
            <Route path="ops/measurements" element={<OpsMeasurements />} />
            <Route path="ops/hr" element={<OpsHRHub />} />
            <Route path="ops/docs" element={<OpsDocs />} />
            {/* Operations (Liftori internal) */}
            <Route path="ops-dashboard" element={<OpsDashboard />} />
            <Route path="team" element={<Team />} />
            <Route path="pulse" element={<Pulse />} />
            <Route path="work-queue" element={<WorkQueue />} />
            <Route path="company-docs" element={<CompanyDocs />} />
            <Route path="hr-hub" element={<HRHub />} />
            <Route path="leadership-qc" element={<LeadershipQC />} />
            <Route path="cost-tracker" element={<CostTracker />} />
            {/* In-House Builds */}
            <Route path="builds" element={<InHouseBuilds />} />
            <Route path="builds/:id" element={<InHouseBuildDetail />} />
            <Route path="mobile-preview" element={<MobilePreview />} />
            <Route path="pipeline" element={<SalesPipeline />} />
            <Route path="investors" element={<Investors />} />
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
            <Route path="marketing/social-composer" element={<SocialComposer />} />
            <Route path="marketing/waitlist" element={<MarketingWaitlist />} />
            <Route path="marketing/sequences" element={<EmailSequences />} />
            <Route path="marketing/performance" element={<MarketingPerformance />} />
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
            <Route path="comms/campaigns" element={<Campaigns />} />
            <Route path="comms/templates" element={<CommsTemplates />} />
            <Route path="comms/outbound" element={<OutboundLog />} />
            <Route path="comms/channels" element={<ChannelsSettings />} />
            <Route path="comms/automations" element={<AutomationsPage />} />
            {/* Consulting */}
            <Route path="consulting" element={<ConsultingAppointments />} />
            <Route path="consulting/clients" element={<ConsultingClients />} />
            <Route path="consulting/client/:id" element={<ConsultingClientDetail />} />
            <Route path="consulting/onboard/:engagementId" element={<ConsultingOnboardingWizard />} />
            <Route path="consulting/eos" element={<EOSL10Hub />} />
            <Route path="team-availability" element={<TeamAvailability />} />
            <Route path="sales-call/:roomId" element={<SalesCall />} />
            <Route path="support-tickets" element={<SupportTickets />} />
            <Route path="testing" element={<Testing />} />
            <Route path="dev-team" element={<DevTeamRoute><DevTeamLayout /></DevTeamRoute>}>
              <Route index element={<DevTeamOverview />} />
              <Route path="tasks" element={<DevTeamTasks />} />
              <Route path="ideas" element={<DevTeamFeatureIdeas />} />
              <Route path="activity" element={<DevTeamActivity />} />
              <Route path="canvas" element={<DevTeamCanvas />} />
              <Route path="canvas/:slug" element={<DevTeamCanvasDetail />} />
              <Route path="skills" element={<DevTeamSkillsMemory />} />
            </Route>
            {/* CSC Services LABOS-KEC — Wave B */}
            <Route path="csc" element={<CscLayout />}>
              <Route index element={<CscOverview />} />
              <Route path="customers" element={<CscCustomers />} />
              <Route path="jobs" element={<CscJobs />} />
              <Route path="jobs/:id" element={<CscJobDetail />} />
              <Route path="deficiencies" element={<CscDeficiencies />} />
              <Route path="invoices" element={<CscInvoices />} />
              <Route path="certificates" element={<CscCertificates />} />
              <Route path="stickers" element={<CscStickers />} />
              <Route path="ahj" element={<CscAhjMap />} />
            </Route>
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>

          {/* CSC public — restaurant owner portal + AHJ verify (no auth) */}
          <Route path="/csc" element={<CscPublicLayout />}>
            <Route path="portal/:token" element={<CscPortal />} />
            <Route path="verify/:qr" element={<CscVerify />} />
          </Route>

          {/* LABOS â€” per-client backend (admin impersonation enters here) */}
          <Route path="/labos/:platformId" element={
            <ProtectedRoute>
              <AdminRoute>
                <LabosLayout />
              </AdminRoute>
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<LabosDashboard />} />
            <Route path="sales" element={<LabosSales />} />
            <Route path="operations" element={<LabosOperations />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<OperationsDashboard />} />
              <Route path="inventory" element={<OperationsInventory />} />
              <Route path="fulfillment" element={<OperationsFulfillment />} />
              <Route path="team" element={<OperationsTeam />} />
            </Route>
            <Route path="marketing" element={<LabosMarketing />} />
            <Route path="finance" element={<LabosFinance />} />
            <Route path="communications" element={<LabosCommunications />} />
            <Route path="chat" element={<LabosChat />} />
          </Route>

          {/* Affiliate / Creator Portal routes */}
          <Route path="/affiliate" element={
            <ProtectedRoute>
              <AffiliateRoute>
                <AffiliateLayout />
              </AffiliateRoute>
            </ProtectedRoute>
          }>
            <Route index element={<AffiliateDashboard />} />
            <Route path="referrals" element={<AffiliateReferrals />} />
            <Route path="content" element={<AffiliateContent />} />
            <Route path="scheduler" element={<AffiliateScheduler />} />
            <Route path="library" element={<AffiliateLibrary />} />
            <Route path="ideas" element={<AffiliateIdeas />} />
            <Route path="analytics" element={<AffiliateAnalytics />} />
            <Route path="crm" element={<AffiliateCRM />} />
            <Route path="inventory" element={<AffiliateInventory />} />
            <Route path="notes" element={<AffiliateNotes />} />
            <Route path="tasks" element={<AffiliateTasks />} />
            <Route path="calendar" element={<AffiliateCalendar />} />
            <Route path="chat" element={<AffiliateChat />} />
            <Route path="support" element={<AffiliateSupport />} />
            <Route path="settings" element={<AffiliateSettings />} />
            <Route path="*" element={<Navigate to="/affiliate" replace />} />
          </Route>

          {/* Choose Plan â€” full-screen, outside ClientLayout */}
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
            <Route path="support" element={<PortalSupport />} />
            <Route path="commissions" element={<PortalCommissions />} />
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
      </OrgProvider>
    </AuthProvider>
  )
}
