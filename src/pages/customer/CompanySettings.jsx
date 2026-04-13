import { useState, useEffect } from 'react';
import { useOrg } from '../../lib/OrgContext';
import {
  fetchTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  fetchOrgSettings,
  upsertOrgSettings,
  fetchOrgDocuments,
  createOrgDocument,
  deleteOrgDocument,
  fetchAuditLog,
} from '../../lib/customerService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import {
  Settings,
  Users,
  CreditCard,
  FileText,
  Sparkles,
  Rocket,
  Shield,
  Plus,
  Edit2,
  Trash2,
  Search,
  Mail,
  Phone,
  Clock,
  ChevronRight,
  Download,
  Zap,
  Bot,
  MapPin,
  TrendingUp,
  Smartphone,
  Headphones,
  BarChart3,
  AlertCircle,
} from 'lucide-react';

const ROLE_COLORS = {
  owner: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  admin: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  general_manager: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  dispatcher: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  sales_manager: 'bg-green-500/20 text-green-300 border-green-500/30',
  sales_rep: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  estimator: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  crew_leader: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  crew_member: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  accountant: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  office_manager: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  report_viewer: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const STATUS_COLORS = {
  invited: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  active: 'bg-green-500/20 text-green-300 border-green-500/30',
  suspended: 'bg-red-500/20 text-red-300 border-red-500/30',
  deactivated: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const DOCUMENT_CATEGORIES = [
  'All',
  'Licenses',
  'Insurance',
  'Contract Templates',
  'Employee',
  'Training',
  'Safety',
  'Marketing',
  'Financial',
  'Legal',
];

const UPCOMING_FEATURES = [
  {
    id: 1,
    title: 'AI Receptionist',
    description:
      '24/7 AI phone answering that books appointments, answers FAQs, and routes urgent calls',
    icon: Headphones,
    status: 'Coming Soon',
  },
  {
    id: 2,
    title: 'GPS Fleet Tracking',
    description:
      'Real-time crew location, route optimization, and automated dispatch',
    icon: MapPin,
    status: 'Coming Soon',
  },
  {
    id: 3,
    title: 'Customer Portal',
    description:
      'Self-service portal for your customers to view estimates, sign agreements, and pay invoices',
    icon: Smartphone,
    status: 'In Beta',
  },
  {
    id: 4,
    title: 'Inventory Management',
    description:
      'Track parts, materials, and equipment across trucks and warehouses',
    icon: BarChart3,
    status: 'Coming Soon',
  },
  {
    id: 5,
    title: 'Advanced Reporting',
    description:
      'Custom dashboards, P&L by job type, crew profitability, and seasonal trends',
    icon: TrendingUp,
    status: 'In Beta',
  },
  {
    id: 6,
    title: 'Marketing Automation',
    description:
      'Automated review requests, seasonal campaigns, and referral programs',
    icon: Sparkles,
    status: 'Coming Soon',
  },
  {
    id: 7,
    title: 'Payment Processing',
    description:
      'Accept credit cards, ACH, and financing options directly through estimates',
    icon: CreditCard,
    status: 'Coming Soon',
  },
  {
    id: 8,
    title: 'QuickBooks Integration',
    description: 'Two-way sync with QuickBooks for seamless accounting',
    icon: TrendingUp,
    status: 'Coming Soon',
  },
];

export default function CompanySettings() {
  const { currentOrg } = useOrg();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);

  // Company Profile state
  const [companyData, setCompanyData] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    businessType: 'LLC',
    taxId: '',
    licenseNumber: '',
    insuranceInfo: '',
    industry: 'Home Services',
    timezone: 'America/Chicago',
    businessHours: {
      monday: { open: '08:00', close: '17:00', closed: false },
      tuesday: { open: '08:00', close: '17:00', closed: false },
      wednesday: { open: '08:00', close: '17:00', closed: false },
      thursday: { open: '08:00', close: '17:00', closed: false },
      friday: { open: '08:00', close: '17:00', closed: false },
      saturday: { open: '09:00', close: '13:00', closed: false },
      sunday: { open: '00:00', close: '00:00', closed: true },
    },
    logoUrl: '',
    primaryColor: '#2563eb',
    accentColor: '#1e40af',
  });

  // Team state
  const [teamMembers, setTeamMembers] = useState([]);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'sales_rep',
    title: '',
    department: '',
    hireDate: '',
  });
  const [editingMember, setEditingMember] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState([]);
  const [docFilter, setDocFilter] = useState('All');
  const [showDocDialog, setShowDocDialog] = useState(false);
  const [docForm, setDocForm] = useState({
    name: '',
    description: '',
    category: 'Licenses',
    visibility: 'admin',
    fileUrl: '',
  });

  // AI Settings state
  const [aiSettings, setAiSettings] = useState({
    aiEnabled: true,
    autoDispatch: true,
    leadScoring: true,
    emailDrafts: true,
    estimateAssistant: true,
    callSummary: true,
    customInstructions: '',
  });

  // Audit log state
  const [auditLog, setAuditLog] = useState([]);

  // Load all data on mount
  useEffect(() => {
    const loadData = async () => {
      if (!currentOrg?.id) return;
      try {
        setLoading(true);
        const [settings, members, docs, logs] = await Promise.all([
          fetchOrgSettings(currentOrg.id),
          fetchTeamMembers(currentOrg.id),
          fetchOrgDocuments(currentOrg.id),
          fetchAuditLog(currentOrg.id),
        ]);

        if (settings) {
          // Map snake_case DB fields to camelCase component state
          const hours = settings.business_hours || {};
          const dayMap = { mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday', fri: 'friday', sat: 'saturday', sun: 'sunday' };
          const mappedHours = {};
          Object.entries(dayMap).forEach(([short, long]) => {
            const h = hours[short];
            mappedHours[long] = h ? { open: h.open || '08:00', close: h.close || '17:00', closed: !h.open } : { open: '08:00', close: '17:00', closed: short === 'sun' };
          });
          setCompanyData({
            name: settings.company_name || '',
            email: settings.company_email || '',
            phone: settings.company_phone || '',
            website: settings.company_website || '',
            address: settings.company_address || '',
            city: settings.company_city || '',
            state: settings.company_state || '',
            zip: settings.company_zip || '',
            businessType: settings.business_type || 'LLC',
            taxId: settings.tax_id || '',
            licenseNumber: settings.license_number || '',
            insuranceInfo: settings.insurance_info || '',
            industry: settings.industry || 'Home Services',
            timezone: settings.timezone || 'America/Chicago',
            businessHours: mappedHours,
            logoUrl: settings.logo_url || '',
            primaryColor: settings.primary_color || '#2563eb',
            accentColor: settings.accent_color || '#1e40af',
            _id: settings.id,
          });
          setAiSettings({
            aiEnabled: settings.ai_enabled ?? true,
            autoDispatch: settings.ai_auto_dispatch ?? false,
            leadScoring: settings.ai_lead_scoring ?? false,
            emailDrafts: settings.ai_email_drafts ?? false,
            estimateAssistant: settings.ai_estimate_assist ?? false,
            callSummary: settings.ai_call_summary ?? false,
            customInstructions: settings.ai_custom_instructions || '',
          });
        }
        if (members) setTeamMembers(members);
        if (docs) setDocuments(docs);
        if (logs) setAuditLog(logs);
      } catch (error) {
        console.error('Failed to load settings:', error);
        toast.error('Failed to load company settings');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentOrg?.id]);

  // Handlers
  const handleSaveCompanyProfile = async () => {
    try {
      // Map camelCase state back to snake_case DB fields
      const dayMap = { monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu', friday: 'fri', saturday: 'sat', sunday: 'sun' };
      const dbHours = {};
      Object.entries(dayMap).forEach(([long, short]) => {
        const h = companyData.businessHours[long];
        dbHours[short] = h?.closed ? null : { open: h?.open || '08:00', close: h?.close || '17:00' };
      });
      await upsertOrgSettings(currentOrg.id, {
        company_name: companyData.name,
        company_email: companyData.email,
        company_phone: companyData.phone,
        company_website: companyData.website,
        company_address: companyData.address,
        company_city: companyData.city,
        company_state: companyData.state,
        company_zip: companyData.zip,
        business_type: companyData.businessType,
        tax_id: companyData.taxId,
        license_number: companyData.licenseNumber,
        insurance_info: companyData.insuranceInfo,
        industry: companyData.industry,
        timezone: companyData.timezone,
        business_hours: dbHours,
        logo_url: companyData.logoUrl,
        primary_color: companyData.primaryColor,
        accent_color: companyData.accentColor,
      });
      toast.success('Company profile saved');
    } catch (error) {
      toast.error('Failed to save company profile');
    }
  };

  const handleInviteTeamMember = async () => {
    if (!inviteForm.email) {
      toast.error('Email is required');
      return;
    }
    try {
      const newMember = {
        org_id: currentOrg.id,
        first_name: inviteForm.firstName,
        last_name: inviteForm.lastName,
        email: inviteForm.email,
        phone: inviteForm.phone || null,
        role: inviteForm.role,
        title: inviteForm.title || null,
        department: inviteForm.department || null,
        hire_date: inviteForm.hireDate || null,
        status: 'invited',
      };
      const created = await createTeamMember(newMember);
      setTeamMembers([...teamMembers, created]);
      setShowInviteDialog(false);
      setInviteForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: 'sales_rep',
        title: '',
        department: '',
        hireDate: '',
      });
      toast.success('Team member invited');
    } catch (error) {
      toast.error('Failed to invite team member');
    }
  };

  const handleEditMember = async () => {
    if (!editingMember) return;
    try {
      const updated = await updateTeamMember(editingMember.id, editingMember);
      setTeamMembers(teamMembers.map((m) => (m.id === updated.id ? updated : m)));
      setShowEditDialog(false);
      setEditingMember(null);
      toast.success('Team member updated');
    } catch (error) {
      toast.error('Failed to update team member');
    }
  };

  const handleDeleteMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to delete this team member?')) return;
    try {
      await deleteTeamMember(memberId);
      setTeamMembers(teamMembers.filter((m) => m.id !== memberId));
      toast.success('Team member removed');
    } catch (error) {
      toast.error('Failed to delete team member');
    }
  };

  const handleAddDocument = async () => {
    if (!docForm.name) {
      toast.error('Document name is required');
      return;
    }
    try {
      const newDoc = {
        org_id: currentOrg.id,
        name: docForm.name,
        description: docForm.description || null,
        category: docForm.category?.toLowerCase().replace(/ /g, '_') || 'general',
        visibility: docForm.visibility,
        file_url: docForm.fileUrl || null,
      };
      const created = await createOrgDocument(newDoc);
      setDocuments([...documents, created]);
      setShowDocDialog(false);
      setDocForm({
        name: '',
        description: '',
        category: 'Licenses',
        visibility: 'admin',
        fileUrl: '',
      });
      toast.success('Document added');
    } catch (error) {
      toast.error('Failed to add document');
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await deleteOrgDocument(docId);
      setDocuments(documents.filter((d) => d.id !== docId));
      toast.success('Document deleted');
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const handleSaveAISettings = async () => {
    try {
      await upsertOrgSettings(currentOrg.id, {
        ai_enabled: aiSettings.aiEnabled,
        ai_auto_dispatch: aiSettings.autoDispatch,
        ai_lead_scoring: aiSettings.leadScoring,
        ai_email_drafts: aiSettings.emailDrafts,
        ai_estimate_assist: aiSettings.estimateAssistant,
        ai_call_summary: aiSettings.callSummary,
        ai_custom_instructions: aiSettings.customInstructions,
      });
      toast.success('AI settings saved');
    } catch (error) {
      toast.error('Failed to save AI settings');
    }
  };

  const teamStats = {
    total: teamMembers.length,
    active: teamMembers.filter((m) => m.status === 'active').length,
    invited: teamMembers.filter((m) => m.status === 'invited').length,
    suspended: teamMembers.filter((m) => m.status === 'suspended').length,
  };

  const filteredDocs =
    docFilter === 'All'
      ? documents
      : documents.filter((d) => {
          const filterKey = docFilter.toLowerCase().replace(/ /g, '_');
          return d.category === filterKey || d.category === docFilter;
        });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy-950">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-navy-950">
      {/* Sidebar Navigation */}
      <div className="w-56 border-r border-navy-800 bg-navy-900 p-6">
        <h2 className="text-lg font-bold text-white mb-8 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          Settings
        </h2>
        <nav className="space-y-2">
          {[
            { id: 'profile', label: 'Company Profile', icon: Settings },
            { id: 'team', label: 'Team & Roles', icon: Users },
            { id: 'billing', label: 'Billing & Payments', icon: CreditCard },
            { id: 'documents', label: 'Documents', icon: FileText },
            { id: 'ai', label: 'AI Settings', icon: Sparkles },
            { id: 'features', label: 'Upcoming Features', icon: Rocket },
            { id: 'activity', label: 'Activity Log', icon: Clock },
          ].map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-navy-800 hover:text-white'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                <span className="text-sm">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-auto">
        {/* Company Profile Tab */}
        {activeTab === 'profile' && (
          <div className="max-w-4xl">
            <h1 className="text-3xl font-bold text-white mb-8">Company Profile</h1>

            <div className="grid gap-6">
              {/* Basic Info */}
              <Card className="bg-navy-900 border-navy-800">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Company Name
                      </label>
                      <Input
                        value={companyData.name}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, name: e.target.value })
                        }
                        placeholder="Your Company"
                        className="bg-navy-800 border-navy-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Email
                      </label>
                      <Input
                        type="email"
                        value={companyData.email}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, email: e.target.value })
                        }
                        placeholder="admin@company.com"
                        className="bg-navy-800 border-navy-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Phone
                      </label>
                      <Input
                        value={companyData.phone}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, phone: e.target.value })
                        }
                        placeholder="(555) 123-4567"
                        className="bg-navy-800 border-navy-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Website
                      </label>
                      <Input
                        value={companyData.website}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, website: e.target.value })
                        }
                        placeholder="https://company.com"
                        className="bg-navy-800 border-navy-700 text-white"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Address */}
              <Card className="bg-navy-900 border-navy-800">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Address</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm text-gray-400 mb-2">
                        Street Address
                      </label>
                      <Input
                        value={companyData.address}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, address: e.target.value })
                        }
                        placeholder="123 Main Street"
                        className="bg-navy-800 border-navy-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">City</label>
                      <Input
                        value={companyData.city}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, city: e.target.value })
                        }
                        placeholder="Chicago"
                        className="bg-navy-800 border-navy-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        State
                      </label>
                      <Input
                        value={companyData.state}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, state: e.target.value })
                        }
                        placeholder="IL"
                        className="bg-navy-800 border-navy-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">ZIP</label>
                      <Input
                        value={companyData.zip}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, zip: e.target.value })
                        }
                        placeholder="60601"
                        className="bg-navy-800 border-navy-700 text-white"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Business Details */}
              <Card className="bg-navy-900 border-navy-800">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Business Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Business Type
                      </label>
                      <select
                        value={companyData.businessType}
                        onChange={(e) =>
                          setCompanyData({
                            ...companyData,
                            businessType: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-white"
                      >
                        <option>LLC</option>
                        <option>Corporation</option>
                        <option>Sole Proprietorship</option>
                        <option>Partnership</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Industry
                      </label>
                      <Input
                        value={companyData.industry}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, industry: e.target.value })
                        }
                        className="bg-navy-800 border-navy-700 text-white"
                        disabled
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Tax ID
                      </label>
                      <Input
                        value={companyData.taxId}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, taxId: e.target.value })
                        }
                        placeholder="XX-XXXXXXX"
                        className="bg-navy-800 border-navy-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        License Number
                      </label>
                      <Input
                        value={companyData.licenseNumber}
                        onChange={(e) =>
                          setCompanyData({
                            ...companyData,
                            licenseNumber: e.target.value,
                          })
                        }
                        placeholder="LIC-123456"
                        className="bg-navy-800 border-navy-700 text-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm text-gray-400 mb-2">
                        Insurance Information
                      </label>
                      <Input
                        value={companyData.insuranceInfo}
                        onChange={(e) =>
                          setCompanyData({
                            ...companyData,
                            insuranceInfo: e.target.value,
                          })
                        }
                        placeholder="Policy details, coverage limits, etc."
                        className="bg-navy-800 border-navy-700 text-white"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Timezone & Hours */}
              <Card className="bg-navy-900 border-navy-800">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Timezone & Business Hours
                  </h3>
                  <div className="mb-6">
                    <label className="block text-sm text-gray-400 mb-2">
                      Timezone
                    </label>
                    <select
                      value={companyData.timezone}
                      onChange={(e) =>
                        setCompanyData({ ...companyData, timezone: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-white"
                    >
                      <option>America/New_York</option>
                      <option>America/Chicago</option>
                      <option>America/Denver</option>
                      <option>America/Los_Angeles</option>
                      <option>America/Anchorage</option>
                      <option>Pacific/Honolulu</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    {Object.keys(companyData.businessHours).map((day) => (
                      <div
                        key={day}
                        className="flex items-center gap-4 p-3 bg-navy-800 rounded"
                      >
                        <span className="w-20 text-sm text-gray-400 capitalize">
                          {day}
                        </span>
                        {!companyData.businessHours[day].closed ? (
                          <>
                            <input
                              type="time"
                              value={companyData.businessHours[day].open}
                              onChange={(e) =>
                                setCompanyData({
                                  ...companyData,
                                  businessHours: {
                                    ...companyData.businessHours,
                                    [day]: {
                                      ...companyData.businessHours[day],
                                      open: e.target.value,
                                    },
                                  },
                                })
                              }
                              className="px-2 py-1 bg-navy-700 border border-navy-600 rounded text-white text-sm"
                            />
                            <span className="text-gray-500">to</span>
                            <input
                              type="time"
                              value={companyData.businessHours[day].close}
                              onChange={(e) =>
                                setCompanyData({
                                  ...companyData,
                                  businessHours: {
                                    ...companyData.businessHours,
                                    [day]: {
                                      ...companyData.businessHours[day],
                                      close: e.target.value,
                                    },
                                  },
                                })
                              }
                              className="px-2 py-1 bg-navy-700 border border-navy-600 rounded text-white text-sm"
                            />
                          </>
                        ) : (
                          <span className="text-gray-500">Closed</span>
                        )}
                        <label className="ml-auto flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={companyData.businessHours[day].closed}
                            onChange={(e) =>
                              setCompanyData({
                                ...companyData,
                                businessHours: {
                                  ...companyData.businessHours,
                                  [day]: {
                                    ...companyData.businessHours[day],
                                    closed: e.target.checked,
                                  },
                                },
                              })
                            }
                            className="rounded"
                          />
                          <span className="text-xs text-gray-400">Closed</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Branding */}
              <Card className="bg-navy-900 border-navy-800">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Branding</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Logo URL
                      </label>
                      <Input
                        value={companyData.logoUrl}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, logoUrl: e.target.value })
                        }
                        placeholder="https://..."
                        className="bg-navy-800 border-navy-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Primary Color
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={companyData.primaryColor}
                          onChange={(e) =>
                            setCompanyData({
                              ...companyData,
                              primaryColor: e.target.value,
                            })
                          }
                          className="w-12 h-10 rounded cursor-pointer"
                        />
                        <Input
                          value={companyData.primaryColor}
                          onChange={(e) =>
                            setCompanyData({
                              ...companyData,
                              primaryColor: e.target.value,
                            })
                          }
                          className="bg-navy-800 border-navy-700 text-white flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Accent Color
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={companyData.accentColor}
                          onChange={(e) =>
                            setCompanyData({
                              ...companyData,
                              accentColor: e.target.value,
                            })
                          }
                          className="w-12 h-10 rounded cursor-pointer"
                        />
                        <Input
                          value={companyData.accentColor}
                          onChange={(e) =>
                            setCompanyData({
                              ...companyData,
                              accentColor: e.target.value,
                            })
                          }
                          className="bg-navy-800 border-navy-700 text-white flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="flex gap-4">
                <Button
                  onClick={handleSaveCompanyProfile}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Team & Roles Tab */}
        {activeTab === 'team' && (
          <div className="max-w-6xl">
            <h1 className="text-3xl font-bold text-white mb-8">Team & Roles</h1>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <Card className="bg-navy-900 border-navy-800">
                <div className="p-4 text-center">
                  <div className="text-3xl font-bold text-white">
                    {teamStats.total}
                  </div>
                  <div className="text-sm text-gray-400">Total Members</div>
                </div>
              </Card>
              <Card className="bg-navy-900 border-navy-800">
                <div className="p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">
                    {teamStats.active}
                  </div>
                  <div className="text-sm text-gray-400">Active</div>
                </div>
              </Card>
              <Card className="bg-navy-900 border-navy-800">
                <div className="p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-400">
                    {teamStats.invited}
                  </div>
                  <div className="text-sm text-gray-400">Invited</div>
                </div>
              </Card>
              <Card className="bg-navy-900 border-navy-800">
                <div className="p-4 text-center">
                  <div className="text-3xl font-bold text-red-400">
                    {teamStats.suspended}
                  </div>
                  <div className="text-sm text-gray-400">Suspended</div>
                </div>
              </Card>
            </div>

            <div className="flex gap-4 mb-6">
              <Button
                onClick={() => setShowInviteDialog(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Invite Team Member
              </Button>
            </div>

            {/* Team Table */}
            <Card className="bg-navy-900 border-navy-800 overflow-hidden">
              <table className="w-full">
                <thead className="bg-navy-800 border-b border-navy-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400">
                      Title
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800">
                  {teamMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-navy-800 transition">
                      <td className="px-6 py-4 text-sm text-white font-medium">
                        {member.first_name} {member.last_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {member.email}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Badge className={ROLE_COLORS[member.role] || ''}>
                          {member.role.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Badge className={STATUS_COLORS[member.status] || ''}>
                          {member.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {member.title || '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingMember(member);
                              setShowEditDialog(true);
                            }}
                            className="p-1 hover:bg-navy-700 rounded transition"
                          >
                            <Edit2 className="w-4 h-4 text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.id)}
                            className="p-1 hover:bg-navy-700 rounded transition"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {teamMembers.length === 0 && (
                <div className="p-8 text-center text-gray-400">
                  No team members yet. Invite your first team member to get started.
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Billing & Payments Tab */}
        {activeTab === 'billing' && (
          <div className="max-w-4xl">
            <h1 className="text-3xl font-bold text-white mb-8">Billing & Payments</h1>

            {/* Current Plan */}
            <Card className="bg-navy-900 border-navy-800 mb-6">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Current Plan
                </h3>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-2xl font-bold text-blue-400">
                      LABOS Starter
                    </h4>
                    <p className="text-gray-400 mt-1">$99/month per team seat</p>
                  </div>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    Upgrade Plan
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
                  <div>Up to 10 team members</div>
                  <div>5 GB storage</div>
                  <div>Email support</div>
                  <div>Basic reporting</div>
                  <div>Team collaboration</div>
                  <div>API access</div>
                </div>
              </div>
            </Card>

            {/* Usage */}
            <Card className="bg-navy-900 border-navy-800 mb-6">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Usage</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-400">Team Seats</span>
                      <span className="text-white font-medium">
                        {teamStats.total} / 10
                      </span>
                    </div>
                    <div className="w-full bg-navy-800 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(teamStats.total / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-400">Storage Used</span>
                      <span className="text-white font-medium">2.3 GB / 5 GB</span>
                    </div>
                    <div className="w-full bg-navy-800 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: '46%' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Coming Soon Cards */}
            {[
              {
                title: 'Billing History',
                description: 'View and download invoices and payment history',
                icon: Download,
              },
              {
                title: 'Bill Pay',
                description: 'Manage payment methods and auto-pay settings',
                icon: CreditCard,
              },
              {
                title: 'Payment Method',
                description: 'Add, update, or remove payment methods',
                icon: Shield,
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <Card
                  key={idx}
                  className="bg-navy-900 border-navy-800 mb-6 opacity-60"
                >
                  <div className="p-6 text-center">
                    <Icon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-gray-500 mb-4">{item.description}</p>
                    <Badge className="bg-gray-700/50 text-gray-300 border-gray-600">
                      Coming Soon
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="max-w-6xl">
            <h1 className="text-3xl font-bold text-white mb-8">Documents</h1>

            <div className="flex gap-4 mb-6">
              <Button
                onClick={() => setShowDocDialog(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Upload Document
              </Button>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {DOCUMENT_CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setDocFilter(category)}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                    docFilter === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-navy-800 text-gray-400 hover:bg-navy-700'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Documents Grid */}
            {filteredDocs.length > 0 ? (
              <div className="grid gap-4">
                {filteredDocs.map((doc) => (
                  <Card
                    key={doc.id}
                    className="bg-navy-900 border-navy-800 p-6 flex items-center justify-between hover:border-navy-700 transition"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <FileText className="w-8 h-8 text-blue-400" />
                      <div className="flex-1">
                        <h4 className="text-white font-medium">{doc.name}</h4>
                        <p className="text-sm text-gray-400">{doc.description}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                            {doc.category}
                          </Badge>
                          <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/30 text-xs">
                            {doc.visibility}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-2 hover:bg-navy-800 rounded transition"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-navy-900 border-navy-800 p-12 text-center">
                <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">
                  No documents in this category yet
                </p>
                <Button
                  onClick={() => setShowDocDialog(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Upload First Document
                </Button>
              </Card>
            )}
          </div>
        )}

        {/* AI Settings Tab */}
        {activeTab === 'ai' && (
          <div className="max-w-4xl">
            <h1 className="text-3xl font-bold text-white mb-8">AI Settings</h1>

            <Card className="bg-navy-900 border-navy-800">
              <div className="p-6 space-y-8">
                {/* Master Toggle */}
                <div className="pb-8 border-b border-navy-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-blue-400" />
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          AI Features Enabled
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                          Enable or disable all AI capabilities for your company
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={aiSettings.aiEnabled}
                        onChange={(e) =>
                          setAiSettings({
                            ...aiSettings,
                            aiEnabled: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                </div>

                {/* Feature Toggles */}
                {[
                  {
                    key: 'autoDispatch',
                    title: 'Auto Dispatch',
                    description:
                      'AI automatically assigns jobs to optimal crews based on location, skills, and availability',
                  },
                  {
                    key: 'leadScoring',
                    title: 'Lead Scoring',
                    description:
                      'AI scores incoming leads based on property data, history, and likelihood to convert',
                  },
                  {
                    key: 'emailDrafts',
                    title: 'Email Drafts',
                    description:
                      'AI drafts follow-up emails, estimate summaries, and appointment confirmations',
                  },
                  {
                    key: 'estimateAssistant',
                    title: 'Estimate Assistant',
                    description:
                      'AI suggests line items and pricing based on job type and historical data',
                  },
                  {
                    key: 'callSummary',
                    title: 'Call Summary',
                    description:
                      'AI transcribes and summarizes phone calls with key action items',
                  },
                ].map((feature) => (
                  <div key={feature.key} className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-white font-medium">{feature.title}</h4>
                      <p className="text-sm text-gray-400 mt-1">
                        {feature.description}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={aiSettings[feature.key]}
                        onChange={(e) =>
                          setAiSettings({
                            ...aiSettings,
                            [feature.key]: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                ))}

                {/* Custom Instructions */}
                <div className="pt-8 border-t border-navy-800">
                  <label className="block text-white font-medium mb-2">
                    Custom AI Instructions
                  </label>
                  <p className="text-sm text-gray-400 mb-4">
                    Tell the AI how your company operates, special terms, or preferences
                  </p>
                  <Textarea
                    value={aiSettings.customInstructions}
                    onChange={(e) =>
                      setAiSettings({
                        ...aiSettings,
                        customInstructions: e.target.value,
                      })
                    }
                    placeholder="E.g., 'We specialize in residential roof repairs. Always suggest a 10-year warranty. Our standard markup is 40%.'"
                    className="bg-navy-800 border-navy-700 text-white min-h-[120px]"
                  />
                </div>
              </div>
            </Card>

            <div className="mt-6">
              <Button
                onClick={handleSaveAISettings}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save AI Settings
              </Button>
            </div>
          </div>
        )}

        {/* Upcoming Features Tab */}
        {activeTab === 'features' && (
          <div className="max-w-6xl">
            <h1 className="text-3xl font-bold text-white mb-8">Upcoming Features</h1>
            <p className="text-gray-400 mb-8">
              Liftori is constantly building new features to help you grow your
              business. Here's what's coming next.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {UPCOMING_FEATURES.map((feature) => {
                const Icon = feature.icon;
                const statusColor =
                  feature.status === 'Coming Soon'
                    ? 'bg-gray-700/50 text-gray-300'
                    : 'bg-green-500/20 text-green-300';
                return (
                  <Card
                    key={feature.id}
                    className="bg-gradient-to-br from-navy-900 to-navy-800 border-navy-800 hover:border-navy-700 transition overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <Icon className="w-10 h-10 text-blue-400" />
                        <Badge className={statusColor}>{feature.status}</Badge>
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Activity Log Tab */}
        {activeTab === 'activity' && (
          <div className="max-w-4xl">
            <h1 className="text-3xl font-bold text-white mb-8">Activity Log</h1>

            <Card className="bg-navy-900 border-navy-800">
              {auditLog.length > 0 ? (
                <div className="divide-y divide-navy-800">
                  {auditLog.slice(0, 50).map((entry, idx) => (
                    <div key={idx} className="p-4 hover:bg-navy-800 transition">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium">
                              {entry.actorName || 'System'}
                            </span>
                            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                              {entry.action}
                            </Badge>
                          </div>
                          <p className="text-gray-400 text-sm">
                            {entry.description || `Updated ${entry.entityType}`}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleDateString()} at{' '}
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No activity recorded yet</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Invite Team Member Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="bg-navy-900 border-navy-800">
          <DialogHeader>
            <DialogTitle className="text-white">Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  First Name
                </label>
                <Input
                  value={inviteForm.firstName}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, firstName: e.target.value })
                  }
                  placeholder="John"
                  className="bg-navy-800 border-navy-700 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Last Name
                </label>
                <Input
                  value={inviteForm.lastName}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, lastName: e.target.value })
                  }
                  placeholder="Doe"
                  className="bg-navy-800 border-navy-700 text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Email (required)
              </label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, email: e.target.value })
                }
                placeholder="john@example.com"
                className="bg-navy-800 border-navy-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Phone</label>
              <Input
                value={inviteForm.phone}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, phone: e.target.value })
                }
                placeholder="(555) 123-4567"
                className="bg-navy-800 border-navy-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Role</label>
              <select
                value={inviteForm.role}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, role: e.target.value })
                }
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-white"
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="general_manager">General Manager</option>
                <option value="dispatcher">Dispatcher</option>
                <option value="sales_manager">Sales Manager</option>
                <option value="sales_rep">Sales Rep</option>
                <option value="estimator">Estimator</option>
                <option value="crew_leader">Crew Leader</option>
                <option value="crew_member">Crew Member</option>
                <option value="accountant">Accountant</option>
                <option value="office_manager">Office Manager</option>
                <option value="report_viewer">Report Viewer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Title</label>
              <Input
                value={inviteForm.title}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, title: e.target.value })
                }
                placeholder="Job Title"
                className="bg-navy-800 border-navy-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Department
              </label>
              <Input
                value={inviteForm.department}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, department: e.target.value })
                }
                placeholder="Operations"
                className="bg-navy-800 border-navy-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Hire Date
              </label>
              <Input
                type="date"
                value={inviteForm.hireDate}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, hireDate: e.target.value })
                }
                className="bg-navy-800 border-navy-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
              className="border-navy-700 text-gray-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInviteTeamMember}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Team Member Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-navy-900 border-navy-800">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Team Member</DialogTitle>
          </DialogHeader>
          {editingMember && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Role</label>
                <select
                  value={editingMember.role}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, role: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-white"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="general_manager">General Manager</option>
                  <option value="dispatcher">Dispatcher</option>
                  <option value="sales_manager">Sales Manager</option>
                  <option value="sales_rep">Sales Rep</option>
                  <option value="estimator">Estimator</option>
                  <option value="crew_leader">Crew Leader</option>
                  <option value="crew_member">Crew Member</option>
                  <option value="accountant">Accountant</option>
                  <option value="office_manager">Office Manager</option>
                  <option value="report_viewer">Report Viewer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Status</label>
                <select
                  value={editingMember.status}
                  onChange={(e) =>
                    setEditingMember({
                      ...editingMember,
                      status: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-white"
                >
                  <option value="invited">Invited</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="deactivated">Deactivated</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Title</label>
                <Input
                  value={editingMember.title || ''}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, title: e.target.value })
                  }
                  placeholder="Job Title"
                  className="bg-navy-800 border-navy-700 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Department
                </label>
                <Input
                  value={editingMember.department || ''}
                  onChange={(e) =>
                    setEditingMember({
                      ...editingMember,
                      department: e.target.value,
                    })
                  }
                  placeholder="Department"
                  className="bg-navy-800 border-navy-700 text-white"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              className="border-navy-700 text-gray-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditMember}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
        <DialogContent className="bg-navy-900 border-navy-800">
          <DialogHeader>
            <DialogTitle className="text-white">Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Document Name (required)
              </label>
              <Input
                value={docForm.name}
                onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                placeholder="Insurance Policy 2026"
                className="bg-navy-800 border-navy-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Description
              </label>
              <Textarea
                value={docForm.description}
                onChange={(e) =>
                  setDocForm({ ...docForm, description: e.target.value })
                }
                placeholder="Briefly describe the document"
                className="bg-navy-800 border-navy-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Category</label>
              <select
                value={docForm.category}
                onChange={(e) =>
                  setDocForm({ ...docForm, category: e.target.value })
                }
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-white"
              >
                {DOCUMENT_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Visibility
              </label>
              <select
                value={docForm.visibility}
                onChange={(e) =>
                  setDocForm({ ...docForm, visibility: e.target.value })
                }
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-white"
              >
                <option value="owner_only">Owner Only</option>
                <option value="admin">Admin</option>
                <option value="team">Team</option>
                <option value="public">Public</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                File URL
              </label>
              <Input
                value={docForm.fileUrl}
                onChange={(e) =>
                  setDocForm({ ...docForm, fileUrl: e.target.value })
                }
                placeholder="https://..."
                className="bg-navy-800 border-navy-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDocDialog(false)}
              className="border-navy-700 text-gray-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddDocument}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Upload Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
