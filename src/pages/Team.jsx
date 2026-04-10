import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Users, Shield, Key, Clock, Plus, Search, MoreVertical, Check, X, Mail, Trash2, Edit2, ChevronDown, UserPlus, FileText, Download, Eye, CheckCircle2, Circle, AlertCircle } from 'lucide-react';

// ─── Default Roles & Permissions ─────────────────────────────────────────────
const DEFAULT_ROLES = [
  { name: 'CEO', description: 'Executive leadership — full platform access, strategic oversight, final approvals', color: 'bg-purple-500', is_system: true },
  { name: 'Chief Developer', description: 'Technical leadership — full platform access, codebase authority, infrastructure management', color: 'bg-red-500', is_system: true },
  { name: 'Director of Sales', description: 'Sales leadership — manage sales team, pipeline oversight, commission structures, client strategy', color: 'bg-amber-500', is_system: true },
  { name: 'Sales Rep', description: 'Sales execution — Lead Hunter, pipeline, estimates, agreements, commissions', color: 'bg-sky-500', is_system: true },
  { name: 'Affiliate', description: 'External partner — referral tracking, commission visibility, limited platform access', color: 'bg-emerald-500', is_system: true },
  { name: 'Platform Tester', description: 'QA and testing — access client platforms for testing, bug reporting, no admin settings', color: 'bg-pink-500', is_system: true },
];

const PERMISSION_GROUPS = [
  {
    group: 'Dashboard & Call Center',
    permissions: [
      { key: 'dashboard.view', label: 'Dashboard', description: 'View main admin dashboard and metrics' },
      { key: 'call_center.access', label: 'Call Center', description: 'Access call center and phone system' },
    ]
  },
  {
    group: 'Sales Hub',
    permissions: [
      { key: 'sales.lead_hunter', label: 'Lead Hunter', description: 'Search, enrich, and manage leads' },
      { key: 'sales.customers', label: 'Customers', description: 'View and manage customer accounts' },
      { key: 'sales.pipeline', label: 'Pipeline', description: 'View and manage deal pipeline' },
      { key: 'sales.estimates', label: 'Estimates', description: 'Create and send estimates' },
      { key: 'sales.agreements', label: 'Agreements', description: 'Manage client agreements' },
      { key: 'sales.commissions', label: 'Commissions', description: 'View commission reports' },
      { key: 'sales.waitlist', label: 'Waitlist', description: 'Manage the waitlist signups' },
    ]
  },
  {
    group: 'Projects & Platforms',
    permissions: [
      { key: 'projects.view', label: 'View Projects', description: 'See project list and details' },
      { key: 'projects.manage', label: 'Manage Projects', description: 'Create, edit, and update projects' },
      { key: 'platforms.manage', label: 'Manage Platforms', description: 'Deploy and manage client sites' },
    ]
  },
  {
    group: 'Marketing',
    permissions: [
      { key: 'marketing.dashboard', label: 'Marketing Dashboard', description: 'View marketing analytics' },
      { key: 'marketing.campaigns', label: 'Campaigns', description: 'Create and manage campaigns' },
      { key: 'marketing.content', label: 'Content Creator', description: 'Create marketing content' },
    ]
  },
  {
    group: 'Communications',
    permissions: [
      { key: 'comms.hub', label: 'Comms Hub', description: 'Access the communications hub' },
      { key: 'comms.chat', label: 'Chat', description: 'Send and receive messages' },
      { key: 'comms.rally', label: 'Rally Video', description: 'Join and host video calls' },
      { key: 'comms.support', label: 'Support Tickets', description: 'Manage support tickets' },
    ]
  },
  {
    group: 'EOS',
    permissions: [
      { key: 'eos.dashboard', label: 'EOS Dashboard', description: 'View EOS overview and leadership' },
      { key: 'eos.scorecard', label: 'Scorecard', description: 'View and update EOS scorecard' },
      { key: 'eos.rocks', label: 'Rocks', description: 'Manage quarterly rocks and goals' },
      { key: 'eos.meetings', label: 'L10 Meetings', description: 'Join and manage L10 meetings' },
      { key: 'eos.issues', label: 'Issues & Todos', description: 'Track issues, todos, and headlines' },
    ]
  },
  {
    group: 'Finance',
    permissions: [
      { key: 'finance.dashboard', label: 'Finance Dashboard', description: 'View financial overview' },
      { key: 'finance.invoices', label: 'Invoices', description: 'Create and manage invoices' },
      { key: 'finance.reports', label: 'Reports', description: 'View financial reports' },
    ]
  },
  {
    group: 'Tools',
    permissions: [
      { key: 'tools.tasks', label: 'Tasks', description: 'Personal and team task management' },
      { key: 'tools.notes', label: 'Notes', description: 'Create and manage notes' },
      { key: 'tools.calendar', label: 'Calendar', description: 'View and manage calendar' },
    ]
  },
  {
    group: 'Operations',
    permissions: [
      { key: 'ops.dashboard', label: 'Ops Dashboard', description: 'View operations overview' },
      { key: 'ops.team', label: 'Team Management', description: 'Invite users, assign roles' },
      { key: 'ops.wizard', label: 'Wizard Builder', description: 'Create onboarding wizards' },
      { key: 'ops.plans', label: 'Plans', description: 'Manage subscription plans' },
      { key: 'ops.discount_codes', label: 'Discount Codes', description: 'Create and manage discounts' },
    ]
  },
  {
    group: 'System',
    permissions: [
      { key: 'system.settings', label: 'Profile & Settings', description: 'Edit profile, upload picture, notifications' },
      { key: 'system.billing', label: 'Billing', description: 'Manage billing and subscriptions' },
      { key: 'system.integrations', label: 'Integrations', description: 'Manage third-party integrations' },
    ]
  },
];

// Default permission maps for preset roles
const ALL_PERMISSIONS = Object.fromEntries(PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => [p.key, true])));
const ROLE_PERMISSION_DEFAULTS = {
  CEO: { ...ALL_PERMISSIONS },
  'Chief Developer': { ...ALL_PERMISSIONS },
  'Director of Sales': {
    // Dashboard & Call Center
    'dashboard.view': true, 'call_center.access': true,
    // Full Sales Hub
    'sales.lead_hunter': true, 'sales.customers': true, 'sales.pipeline': true,
    'sales.estimates': true, 'sales.agreements': true, 'sales.commissions': true, 'sales.waitlist': true,
    // Projects & Platforms
    'projects.view': true, 'projects.manage': true, 'platforms.manage': true,
    // Marketing
    'marketing.dashboard': true, 'marketing.campaigns': true, 'marketing.content': true,
    // Communications
    'comms.hub': true, 'comms.chat': true, 'comms.rally': true, 'comms.support': true,
    // EOS
    'eos.dashboard': true, 'eos.scorecard': true, 'eos.rocks': true, 'eos.meetings': true, 'eos.issues': true,
    // Tools
    'tools.tasks': true, 'tools.notes': true, 'tools.calendar': true,
    // Profile & Settings (NO ops, NO billing, NO integrations)
    'system.settings': true,
  },
  'Sales Rep': {
    'dashboard.view': true, 'call_center.access': true,
    'sales.lead_hunter': true, 'sales.customers': true, 'sales.pipeline': true,
    'sales.estimates': true, 'sales.agreements': true, 'sales.commissions': true, 'sales.waitlist': true,
    'projects.view': true,
    'comms.hub': true, 'comms.chat': true, 'comms.rally': true,
    'eos.dashboard': true, 'eos.scorecard': true, 'eos.rocks': true, 'eos.meetings': true, 'eos.issues': true,
    'tools.tasks': true, 'tools.notes': true, 'tools.calendar': true,
    'system.settings': true,
  },
  Affiliate: {
    'dashboard.view': true,
    'sales.commissions': true,
    'comms.chat': true,
    'system.settings': true,
  },
  'Platform Tester': {
    'dashboard.view': true,
    'projects.view': true, 'platforms.manage': true,
    'comms.chat': true, 'comms.rally': true, 'comms.support': true,
    'tools.tasks': true, 'tools.notes': true,
    'system.settings': true,
  },
};

// ─── Toast Hook (inline) ─────────────────────────────────────────────────────
function useToast(duration = 4000) {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(t);
  }, [toast, duration]);
  const showToast = useCallback((message, type = 'info') => setToast({ message, type }), []);
  const ToastContainer = useCallback(() => {
    if (!toast) return null;
    const bg = toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-sky-600';
    return <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${bg}`}>{toast.message}</div>;
  }, [toast]);
  return { showToast, ToastContainer };
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Team() {
  const { user, profile, isAdmin } = useAuth();
  const { showToast, ToastContainer } = useToast();
  const [activeTab, setActiveTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Onboarding state
  const [onboardingRecords, setOnboardingRecords] = useState([]);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    full_name: '', email: '', personal_email: '', phone: '', role: 'Sales Rep',
    address: '', start_date: new Date().toISOString().split('T')[0],
  });
  const [onboarding, setOnboarding] = useState(false);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'Sales Rep' });
  const [inviting, setInviting] = useState(false);

  // Role editor state
  const [editingRole, setEditingRole] = useState(null);
  const [rolePermissions, setRolePermissions] = useState({});
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', color: 'bg-sky-500' });

  // Member action menu
  const [actionMenuId, setActionMenuId] = useState(null);
  const [editingMember, setEditingMember] = useState(null);

  const TABS = [
    { id: 'members', label: 'Members', icon: Users },
    { id: 'onboarding', label: 'Onboarding', icon: UserPlus },
    { id: 'roles', label: 'Roles', icon: Shield },
    { id: 'permissions', label: 'Permissions', icon: Key },
    { id: 'activity', label: 'Activity Log', icon: Clock },
  ];

  // ─── Data Fetching ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      await Promise.all([fetchMembers(), fetchRoles(), fetchActivity(), fetchOnboarding()]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMembers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .not('role', 'eq', 'customer')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  }

  async function fetchRoles() {
    try {
      const { data, error } = await supabase
        .from('team_roles')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) {
        // Table might not exist yet — seed with defaults
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setRoles(DEFAULT_ROLES.map((r, i) => ({ id: `default-${i}`, ...r, permissions: ROLE_PERMISSION_DEFAULTS[r.name] || {} })));
          return;
        }
        throw error;
      }
      if (data && data.length > 0) {
        setRoles(data);
      } else {
        // No roles yet — show defaults
        setRoles(DEFAULT_ROLES.map((r, i) => ({ id: `default-${i}`, ...r, permissions: ROLE_PERMISSION_DEFAULTS[r.name] || {} })));
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
      setRoles(DEFAULT_ROLES.map((r, i) => ({ id: `default-${i}`, ...r, permissions: ROLE_PERMISSION_DEFAULTS[r.name] || {} })));
    }
  }

  async function fetchActivity() {
    try {
      const { data, error } = await supabase
        .from('team_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setActivityLog([]);
          return;
        }
        throw error;
      }
      setActivityLog(data || []);
    } catch (err) {
      console.error('Error fetching activity:', err);
      setActivityLog([]);
    }
  }

  // ─── Onboarding Fetching ──────────────────────────────────────────────────
  async function fetchOnboarding() {
    try {
      const { data, error } = await supabase
        .from('team_onboarding')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setOnboardingRecords([]);
          return;
        }
        throw error;
      }
      setOnboardingRecords(data || []);
    } catch (err) {
      console.error('Error fetching onboarding:', err);
      setOnboardingRecords([]);
    }
  }

  // Onboarding checklist steps
  const ONBOARDING_STEPS = [
    { key: 'nda_sent', label: 'NDA Sent', description: 'Non-Disclosure Agreement generated and sent' },
    { key: 'nda_signed', label: 'NDA Signed', description: 'NDA signed by team member' },
    { key: 'contract_sent', label: '1099 Agreement Sent', description: 'Independent Contractor Agreement generated and sent' },
    { key: 'contract_signed', label: '1099 Agreement Signed', description: 'Contractor agreement signed by team member' },
    { key: 'account_created', label: 'Account Created', description: 'Liftori admin account created with role assigned' },
    { key: 'welcome_email', label: 'Welcome Email Sent', description: 'Welcome email with login credentials and getting started guide' },
    { key: 'w9_received', label: 'W-9 Received', description: 'W-9 tax form received from contractor' },
    { key: 'tools_provisioned', label: 'Tools & Access Provisioned', description: 'Access to required tools, channels, and systems granted' },
    { key: 'intro_meeting', label: 'Intro Meeting Completed', description: 'Onboarding call / first meeting with the team' },
    { key: 'onboarding_complete', label: 'Onboarding Complete', description: 'All steps verified, team member fully onboarded' },
  ];

  // ─── Start Onboarding ────────────────────────────────────────────────────
  async function handleStartOnboarding(e) {
    e.preventDefault();
    if (!onboardForm.full_name || !onboardForm.email) return;
    setOnboarding(true);
    try {
      const checklist = {};
      ONBOARDING_STEPS.forEach(s => { checklist[s.key] = false; });

      const { error } = await supabase.from('team_onboarding').insert({
        full_name: onboardForm.full_name,
        email: onboardForm.email,
        personal_email: onboardForm.personal_email || null,
        phone: onboardForm.phone || null,
        role: onboardForm.role,
        address: onboardForm.address || null,
        start_date: onboardForm.start_date,
        status: 'in_progress',
        checklist,
        initiated_by: user?.id,
      });

      if (error) throw error;

      await logActivity('onboarding_started', onboardForm.full_name, { role: onboardForm.role });
      showToast(`Onboarding started for ${onboardForm.full_name}`, 'success');
      setShowOnboardModal(false);
      setOnboardForm({ full_name: '', email: '', personal_email: '', phone: '', role: 'Sales Rep', address: '', start_date: new Date().toISOString().split('T')[0] });
      fetchOnboarding();
      fetchActivity();
    } catch (err) {
      console.error('Error starting onboarding:', err);
      showToast('Failed to start onboarding', 'error');
    } finally {
      setOnboarding(false);
    }
  }

  // ─── Toggle Onboarding Step ──────────────────────────────────────────────
  async function handleToggleStep(recordId, stepKey) {
    const record = onboardingRecords.find(r => r.id === recordId);
    if (!record) return;
    const updatedChecklist = { ...record.checklist, [stepKey]: !record.checklist[stepKey] };

    // Check if all steps are complete
    const allComplete = ONBOARDING_STEPS.every(s => updatedChecklist[s.key]);
    const newStatus = allComplete ? 'completed' : 'in_progress';

    try {
      const { error } = await supabase
        .from('team_onboarding')
        .update({ checklist: updatedChecklist, status: newStatus, ...(allComplete ? { completed_at: new Date().toISOString() } : {}) })
        .eq('id', recordId);
      if (error) throw error;

      if (allComplete) {
        await logActivity('onboarding_completed', record.full_name);
        showToast(`${record.full_name} is fully onboarded!`, 'success');
      }
      fetchOnboarding();
    } catch (err) {
      console.error('Error updating onboarding step:', err);
      showToast('Failed to update step', 'error');
    }
  }

  // ─── Log Activity Helper ─────────────────────────────────────────────────
  async function logActivity(action, target_name, details = null) {
    try {
      await supabase.from('team_activity_log').insert({
        actor_id: user?.id,
        actor_name: profile?.full_name || user?.email,
        action,
        target_name,
        details,
      });
    } catch (err) {
      console.error('Error logging activity:', err);
    }
  }

  // ─── Invite User ─────────────────────────────────────────────────────────
  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteForm.email) return;
    setInviting(true);
    try {
      // Check if user already exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteForm.email)
        .maybeSingle();

      if (existing) {
        showToast('A user with this email already exists', 'error');
        setInviting(false);
        return;
      }

      // Create invite record
      const { error } = await supabase.from('team_invites').insert({
        email: inviteForm.email,
        full_name: inviteForm.full_name,
        role: inviteForm.role,
        invited_by: user?.id,
        status: 'pending',
      });

      if (error) throw error;

      await logActivity('invited', inviteForm.email, { role: inviteForm.role });
      showToast(`Invite sent to ${inviteForm.email}`, 'success');
      setShowInviteModal(false);
      setInviteForm({ email: '', full_name: '', role: 'Sales' });
      fetchActivity();
    } catch (err) {
      console.error('Error inviting user:', err);
      showToast('Failed to send invite', 'error');
    } finally {
      setInviting(false);
    }
  }

  // ─── Update Member Role ───────────────────────────────────────────────────
  async function handleUpdateRole(memberId, newRole) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', memberId);
      if (error) throw error;

      const member = members.find(m => m.id === memberId);
      await logActivity('role_changed', member?.full_name || member?.email, { from: member?.role, to: newRole });
      showToast(`Role updated to ${newRole}`, 'success');
      setActionMenuId(null);
      setEditingMember(null);
      fetchMembers();
      fetchActivity();
    } catch (err) {
      console.error('Error updating role:', err);
      showToast('Failed to update role', 'error');
    }
  }

  // ─── Deactivate / Reactivate Member ───────────────────────────────────────
  async function handleToggleActive(memberId, currentStatus) {
    const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', memberId);
      if (error) throw error;

      const member = members.find(m => m.id === memberId);
      await logActivity(newStatus === 'inactive' ? 'deactivated' : 'reactivated', member?.full_name || member?.email);
      showToast(`User ${newStatus === 'inactive' ? 'deactivated' : 'reactivated'}`, 'success');
      setActionMenuId(null);
      fetchMembers();
      fetchActivity();
    } catch (err) {
      console.error('Error toggling user status:', err);
      showToast('Failed to update user status', 'error');
    }
  }

  // ─── Save Role Permissions ────────────────────────────────────────────────
  async function handleSaveRole() {
    if (!editingRole) return;
    try {
      const updatedPermissions = { ...rolePermissions };
      if (editingRole.id?.startsWith('default-')) {
        // Create the role in DB
        const { error } = await supabase.from('team_roles').insert({
          name: editingRole.name,
          description: editingRole.description,
          color: editingRole.color,
          is_system: editingRole.is_system || false,
          permissions: updatedPermissions,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('team_roles')
          .update({ permissions: updatedPermissions })
          .eq('id', editingRole.id);
        if (error) throw error;
      }

      await logActivity('permissions_updated', editingRole.name);
      showToast(`Permissions saved for ${editingRole.name}`, 'success');
      setEditingRole(null);
      fetchRoles();
      fetchActivity();
    } catch (err) {
      console.error('Error saving role:', err);
      showToast('Failed to save permissions', 'error');
    }
  }

  // ─── Create Custom Role ───────────────────────────────────────────────────
  async function handleCreateRole(e) {
    e.preventDefault();
    if (!roleForm.name) return;
    try {
      const { error } = await supabase.from('team_roles').insert({
        name: roleForm.name,
        description: roleForm.description,
        color: roleForm.color,
        is_system: false,
        permissions: {},
      });
      if (error) throw error;

      await logActivity('role_created', roleForm.name);
      showToast(`Role "${roleForm.name}" created`, 'success');
      setShowRoleModal(false);
      setRoleForm({ name: '', description: '', color: 'bg-sky-500' });
      fetchRoles();
      fetchActivity();
    } catch (err) {
      console.error('Error creating role:', err);
      showToast('Failed to create role', 'error');
    }
  }

  // ─── Filter Members ───────────────────────────────────────────────────────
  const filteredMembers = members.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (m.full_name || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      (m.role || '').toLowerCase().includes(q)
    );
  });

  const roleOptions = roles.length > 0 ? roles.map(r => r.name) : DEFAULT_ROLES.map(r => r.name);

  // ─── Role Color Helper ────────────────────────────────────────────────────
  function getRoleBadge(roleName) {
    const role = roles.find(r => r.name?.toLowerCase() === roleName?.toLowerCase());
    const color = role?.color || 'bg-slate-500';
    return <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${color}`}>{roleName || 'None'}</span>;
  }

  function getStatusBadge(status) {
    if (status === 'inactive') return <span className="px-2 py-0.5 rounded text-xs font-medium text-red-300 bg-red-500/20">Inactive</span>;
    return <span className="px-2 py-0.5 rounded text-xs font-medium text-emerald-300 bg-emerald-500/20">Active</span>;
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading team...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Team Management</h1>
          <p className="text-gray-400 text-sm mt-1">{members.length} team member{members.length !== 1 ? 's' : ''} across {roles.length} role{roles.length !== 1 ? 's' : ''}</p>
        </div>
        {activeTab === 'members' && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} />
            Invite Member
          </button>
        )}
        {activeTab === 'onboarding' && (
          <button
            onClick={() => setShowOnboardModal(true)}
            className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <UserPlus size={16} />
            Onboard New Member
          </button>
        )}
        {activeTab === 'roles' && (
          <button
            onClick={() => setShowRoleModal(true)}
            className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} />
            Create Role
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-800/50 p-1 rounded-lg w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-sky-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══ MEMBERS TAB ═══ */}
      {activeTab === 'members' && (
        <div>
          {/* Search */}
          <div className="relative mb-4 max-w-sm">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Members Table */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Member</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Role</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Joined</th>
                  <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map(member => (
                  <tr key={member.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 font-medium text-sm">
                          {(member.full_name || member.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{member.full_name || 'Unnamed'}</p>
                          <p className="text-gray-500 text-xs">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingMember === member.id ? (
                        <select
                          value={member.role || 'customer'}
                          onChange={e => handleUpdateRole(member.id, e.target.value)}
                          onBlur={() => setEditingMember(null)}
                          autoFocus
                          className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-sky-500"
                        >
                          {roleOptions.map(r => (
                            <option key={r} value={r.toLowerCase()}>{r}</option>
                          ))}
                          <option value="customer">Customer</option>
                        </select>
                      ) : (
                        getRoleBadge(member.role)
                      )}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(member.status)}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {member.created_at ? new Date(member.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right relative">
                      {member.id !== user?.id && (
                        <>
                          <button
                            onClick={() => setActionMenuId(actionMenuId === member.id ? null : member.id)}
                            className="text-gray-400 hover:text-white p-1 rounded transition"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {actionMenuId === member.id && (
                            <div className="absolute right-4 top-12 bg-slate-700 border border-slate-600 rounded-lg shadow-xl py-1 z-20 min-w-[160px]">
                              <button
                                onClick={() => { setEditingMember(member.id); setActionMenuId(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-slate-600 hover:text-white flex items-center gap-2"
                              >
                                <Edit2 size={14} /> Change Role
                              </button>
                              <button
                                onClick={() => handleToggleActive(member.id, member.status)}
                                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-slate-600 hover:text-white flex items-center gap-2"
                              >
                                {member.status === 'inactive' ? <Check size={14} /> : <X size={14} />}
                                {member.status === 'inactive' ? 'Reactivate' : 'Deactivate'}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                      {searchQuery ? 'No members match your search' : 'No team members found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ ONBOARDING TAB ═══ */}
      {activeTab === 'onboarding' && (
        <div>
          {/* Active Onboarding Records */}
          {onboardingRecords.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-12 text-center">
              <UserPlus size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 text-lg font-medium mb-2">No onboarding records yet</p>
              <p className="text-gray-500 text-sm mb-6">Start onboarding a new team member to track their NDA, 1099, and setup checklist</p>
              <button
                onClick={() => setShowOnboardModal(true)}
                className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition"
              >
                <UserPlus size={16} />
                Onboard New Member
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {onboardingRecords.map(record => {
                const completedSteps = ONBOARDING_STEPS.filter(s => record.checklist?.[s.key]).length;
                const totalSteps = ONBOARDING_STEPS.length;
                const progress = Math.round((completedSteps / totalSteps) * 100);
                const isComplete = record.status === 'completed';

                return (
                  <div key={record.id} className={`bg-slate-800/50 border rounded-lg p-5 ${isComplete ? 'border-emerald-500/30' : 'border-slate-700/50'}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${isComplete ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'}`}>
                          {(record.full_name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">{record.full_name}</h3>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{record.email}</span>
                            {record.phone && <span>{record.phone}</span>}
                            <span>Role: {record.role}</span>
                            <span>Started: {new Date(record.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isComplete ? (
                          <span className="flex items-center gap-1 text-emerald-400 text-sm font-medium">
                            <CheckCircle2 size={16} /> Onboarded
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">{completedSteps}/{totalSteps} steps</span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-700 rounded-full h-2 mb-4">
                      <div
                        className={`h-2 rounded-full transition-all ${isComplete ? 'bg-emerald-500' : 'bg-sky-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    {/* Checklist */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {ONBOARDING_STEPS.map(step => {
                        const isDone = record.checklist?.[step.key];
                        const isDocStep = step.key.includes('nda') || step.key.includes('contract');
                        return (
                          <div
                            key={step.key}
                            onClick={() => handleToggleStep(record.id, step.key)}
                            className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition ${
                              isDone ? 'bg-emerald-500/10 hover:bg-emerald-500/15' : 'bg-slate-700/30 hover:bg-slate-700/50'
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                            ) : (
                              <Circle size={18} className="text-gray-500 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${isDone ? 'text-emerald-300' : 'text-gray-300'}`}>{step.label}</p>
                              <p className="text-xs text-gray-500 truncate">{step.description}</p>
                            </div>
                            {isDocStep && !isDone && (
                              <a
                                href={step.key.includes('nda') ? '/templates/liftori-nda-template.docx' : '/templates/liftori-1099-agreement-template.docx'}
                                download
                                onClick={e => e.stopPropagation()}
                                className="text-sky-400 hover:text-sky-300 p-1"
                                title="Download template"
                              >
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Personal Info Section */}
                    {(record.personal_email || record.address) && (
                      <div className="mt-4 pt-3 border-t border-slate-700/30 flex gap-4 text-xs text-gray-500">
                        {record.personal_email && <span>Personal: {record.personal_email}</span>}
                        {record.address && <span>Address: {record.address}</span>}
                        {record.start_date && <span>Start: {new Date(record.start_date).toLocaleDateString()}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ ROLES TAB ═══ */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map(role => (
            <div key={role.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${role.color || 'bg-slate-500'}`} />
                  <div>
                    <h3 className="text-white font-semibold">{role.name}</h3>
                    {role.is_system && <span className="text-gray-500 text-xs">System role</span>}
                  </div>
                </div>
                <span className="text-gray-500 text-xs">
                  {members.filter(m => m.role?.toLowerCase() === role.name?.toLowerCase()).length} member{members.filter(m => m.role?.toLowerCase() === role.name?.toLowerCase()).length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-gray-400 text-sm mb-4">{role.description}</p>
              <div className="flex flex-wrap gap-1 mb-4">
                {Object.entries(role.permissions || ROLE_PERMISSION_DEFAULTS[role.name] || {})
                  .filter(([, v]) => v)
                  .slice(0, 6)
                  .map(([key]) => (
                    <span key={key} className="px-2 py-0.5 bg-slate-700/50 text-gray-400 rounded text-xs">
                      {key.split('.')[1]?.replace(/_/g, ' ')}
                    </span>
                  ))}
                {Object.values(role.permissions || ROLE_PERMISSION_DEFAULTS[role.name] || {}).filter(Boolean).length > 6 && (
                  <span className="px-2 py-0.5 text-gray-500 text-xs">
                    +{Object.values(role.permissions || ROLE_PERMISSION_DEFAULTS[role.name] || {}).filter(Boolean).length - 6} more
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setEditingRole(role);
                  setRolePermissions(role.permissions || ROLE_PERMISSION_DEFAULTS[role.name] || {});
                  setActiveTab('permissions');
                }}
                className="text-sky-400 hover:text-sky-300 text-sm font-medium transition"
              >
                Edit Permissions →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ═══ PERMISSIONS TAB ═══ */}
      {activeTab === 'permissions' && (
        <div>
          {/* Role Selector */}
          <div className="flex items-center gap-4 mb-6">
            <label className="text-gray-400 text-sm">Editing permissions for:</label>
            <div className="flex gap-2">
              {roles.map(role => (
                <button
                  key={role.id}
                  onClick={() => {
                    setEditingRole(role);
                    setRolePermissions(role.permissions || ROLE_PERMISSION_DEFAULTS[role.name] || {});
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    editingRole?.id === role.id
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {role.name}
                </button>
              ))}
            </div>
          </div>

          {editingRole ? (
            <div className="space-y-4">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.group} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold">{group.group}</h3>
                    <button
                      onClick={() => {
                        const allEnabled = group.permissions.every(p => rolePermissions[p.key]);
                        const updated = { ...rolePermissions };
                        group.permissions.forEach(p => { updated[p.key] = !allEnabled; });
                        setRolePermissions(updated);
                      }}
                      className="text-xs text-sky-400 hover:text-sky-300 transition"
                    >
                      {group.permissions.every(p => rolePermissions[p.key]) ? 'Disable All' : 'Enable All'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {group.permissions.map(perm => (
                      <label
                        key={perm.key}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-700/30 cursor-pointer transition"
                      >
                        <div>
                          <p className="text-white text-sm font-medium">{perm.label}</p>
                          <p className="text-gray-500 text-xs">{perm.description}</p>
                        </div>
                        <div
                          onClick={() => setRolePermissions(prev => ({ ...prev, [perm.key]: !prev[perm.key] }))}
                          className={`w-10 h-5 rounded-full relative transition cursor-pointer ${
                            rolePermissions[perm.key] ? 'bg-sky-500' : 'bg-slate-600'
                          }`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            rolePermissions[perm.key] ? 'translate-x-5' : 'translate-x-0.5'
                          }`} />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveRole}
                  className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition"
                >
                  <Check size={16} />
                  Save Permissions for {editingRole.name}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-12 text-center">
              <Shield size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">Select a role above to edit its permissions</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ ACTIVITY LOG TAB ═══ */}
      {activeTab === 'activity' && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden">
          {activityLog.length === 0 ? (
            <div className="p-12 text-center">
              <Clock size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">No activity recorded yet</p>
              <p className="text-gray-500 text-sm mt-1">Team changes will appear here as they happen</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/30">
              {activityLog.map((log, i) => (
                <div key={log.id || i} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-700/20 transition">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    log.action === 'invited' ? 'bg-sky-500/20 text-sky-400' :
                    log.action === 'role_changed' ? 'bg-amber-500/20 text-amber-400' :
                    log.action === 'deactivated' ? 'bg-red-500/20 text-red-400' :
                    log.action === 'reactivated' ? 'bg-emerald-500/20 text-emerald-400' :
                    log.action === 'permissions_updated' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-slate-500/20 text-gray-400'
                  }`}>
                    {log.action === 'invited' ? <Mail size={14} /> :
                     log.action === 'role_changed' ? <Edit2 size={14} /> :
                     log.action === 'deactivated' ? <X size={14} /> :
                     log.action === 'reactivated' ? <Check size={14} /> :
                     log.action === 'permissions_updated' ? <Key size={14} /> :
                     <Clock size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm">
                      <span className="font-medium">{log.actor_name}</span>
                      {' '}
                      <span className="text-gray-400">
                        {log.action === 'invited' && 'invited'}
                        {log.action === 'role_changed' && 'changed role for'}
                        {log.action === 'deactivated' && 'deactivated'}
                        {log.action === 'reactivated' && 'reactivated'}
                        {log.action === 'permissions_updated' && 'updated permissions for'}
                        {log.action === 'role_created' && 'created role'}
                      </span>
                      {' '}
                      <span className="font-medium">{log.target_name}</span>
                      {log.details?.role && (
                        <span className="text-gray-500"> as {log.details.role}</span>
                      )}
                      {log.details?.from && log.details?.to && (
                        <span className="text-gray-500"> from {log.details.from} to {log.details.to}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-gray-500 text-xs whitespace-nowrap">{timeAgo(log.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ INVITE MODAL ═══ */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowInviteModal(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Invite Team Member</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                  required
                  placeholder="name@company.com"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteForm.full_name}
                  onChange={e => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                  placeholder="John Smith"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                >
                  {roleOptions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-gray-300 py-2 rounded-lg text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <Mail size={16} />
                  {inviting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ CREATE ROLE MODAL ═══ */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowRoleModal(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Create Custom Role</h2>
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Role Name</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={e => setRoleForm({ ...roleForm, name: e.target.value })}
                  required
                  placeholder="e.g. Designer, Intern"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Description</label>
                <textarea
                  value={roleForm.description}
                  onChange={e => setRoleForm({ ...roleForm, description: e.target.value })}
                  placeholder="What can this role do?"
                  rows={2}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Color</label>
                <div className="flex gap-2">
                  {['bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setRoleForm({ ...roleForm, color: c })}
                      className={`w-8 h-8 rounded-full ${c} transition ${roleForm.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : 'opacity-50 hover:opacity-100'}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-gray-300 py-2 rounded-lg text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-sky-500 hover:bg-sky-600 text-white py-2 rounded-lg text-sm font-medium transition"
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ ONBOARD NEW MEMBER MODAL ═══ */}
      {showOnboardModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowOnboardModal(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-1">Onboard New Team Member</h2>
            <p className="text-gray-500 text-sm mb-4">This will create an onboarding record to track NDA, 1099, account setup, and all required steps.</p>
            <form onSubmit={handleStartOnboarding} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={onboardForm.full_name}
                    onChange={e => setOnboardForm({ ...onboardForm, full_name: e.target.value })}
                    required
                    placeholder="Jeff Cillo"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">Role *</label>
                  <select
                    value={onboardForm.role}
                    onChange={e => setOnboardForm({ ...onboardForm, role: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  >
                    {roleOptions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">Work Email *</label>
                  <input
                    type="email"
                    value={onboardForm.email}
                    onChange={e => setOnboardForm({ ...onboardForm, email: e.target.value })}
                    required
                    placeholder="jeff@liftori.ai"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">Personal Email</label>
                  <input
                    type="email"
                    value={onboardForm.personal_email}
                    onChange={e => setOnboardForm({ ...onboardForm, personal_email: e.target.value })}
                    placeholder="jeff@personal.com"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    value={onboardForm.phone}
                    onChange={e => setOnboardForm({ ...onboardForm, phone: e.target.value })}
                    placeholder="732-610-2582"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={onboardForm.start_date}
                    onChange={e => setOnboardForm({ ...onboardForm, start_date: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Address</label>
                <input
                  type="text"
                  value={onboardForm.address}
                  onChange={e => setOnboardForm({ ...onboardForm, address: e.target.value })}
                  placeholder="Full mailing address"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-3 mt-2">
                <p className="text-gray-400 text-xs font-medium mb-2">This will initiate the following:</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><FileText size={12} /> NDA generation & tracking</span>
                  <span className="flex items-center gap-1"><FileText size={12} /> 1099 agreement tracking</span>
                  <span className="flex items-center gap-1"><Mail size={12} /> Welcome email setup</span>
                  <span className="flex items-center gap-1"><Key size={12} /> Account & access provisioning</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-gray-300 py-2 rounded-lg text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onboarding}
                  className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <UserPlus size={16} />
                  {onboarding ? 'Starting...' : 'Start Onboarding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
