import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
  Users, UserPlus, Search, Phone, Mail, Building2, Clock, Calendar,
  ChevronRight, ChevronDown, Star, BarChart3, DollarSign, TrendingUp,
  AlertTriangle, Bell, Check, Plus, Edit2, Trash2, ArrowRight, Eye,
  MessageSquare, PhoneCall, Video, FileText, Activity, Filter, RefreshCw,
  Flame, Thermometer, Snowflake, Target, Flag, Send, ExternalLink,
  CheckCircle, XCircle, AlertCircle, Zap, Timer, CircleDot, Cpu, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ─── CRM Stage Configuration ────────────────────────────────────
const CRM_STAGES = [
  { key: 'prospect', label: 'Prospect', color: 'bg-blue-500', badge: 'bg-blue-100 text-blue-800', icon: Target },
  { key: 'qualified', label: 'Qualified', color: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
  { key: 'proposal', label: 'Proposal', color: 'bg-purple-500', badge: 'bg-purple-100 text-purple-800', icon: Send },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800', icon: MessageSquare },
  { key: 'won', label: 'Won', color: 'bg-green-500', badge: 'bg-green-100 text-green-800', icon: CheckCircle },
  { key: 'active', label: 'Active', color: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800', icon: Zap },
  { key: 'at_risk', label: 'At Risk', color: 'bg-orange-500', badge: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  { key: 'churned', label: 'Churned', color: 'bg-red-500', badge: 'bg-red-100 text-red-800', icon: XCircle },
];
const STAGE_MAP = Object.fromEntries(CRM_STAGES.map(s => [s.key, s]));

const ACTIVITY_TYPES = [
  { key: 'call', label: 'Call', icon: PhoneCall, color: 'text-green-400' },
  { key: 'email', label: 'Email', icon: Mail, color: 'text-sky-400' },
  { key: 'meeting', label: 'Meeting', icon: Video, color: 'text-purple-400' },
  { key: 'note', label: 'Note', icon: FileText, color: 'text-yellow-400' },
  { key: 'follow_up', label: 'Follow-Up', icon: Clock, color: 'text-orange-400' },
  { key: 'status_change', label: 'Stage Change', icon: ArrowRight, color: 'text-indigo-400' },
  { key: 'system', label: 'System', icon: Zap, color: 'text-gray-400' },
];
const ACTIVITY_MAP = Object.fromEntries(ACTIVITY_TYPES.map(a => [a.key, a]));

const FOLLOW_UP_TYPES = [
  { key: 'follow_up', label: 'Follow Up' },
  { key: 'call_back', label: 'Call Back' },
  { key: 'send_proposal', label: 'Send Proposal' },
  { key: 'check_in', label: 'Check In' },
  { key: 'demo', label: 'Schedule Demo' },
];

function TempBadge({ temp }) {
  if (temp === 'hot') return <span className="flex items-center gap-1 text-xs font-bold text-red-400"><Flame className="h-3.5 w-3.5" /> Hot</span>;
  if (temp === 'warm') return <span className="flex items-center gap-1 text-xs font-bold text-amber-400"><Thermometer className="h-3.5 w-3.5" /> Warm</span>;
  return <span className="flex items-center gap-1 text-xs font-bold text-blue-400"><Snowflake className="h-3.5 w-3.5" /> Cold</span>;
}

function StageBadge({ stage }) {
  const s = STAGE_MAP[stage] || STAGE_MAP.prospect;
  return <Badge className={`text-xs ${s.badge}`}>{s.label}</Badge>;
}

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatRelative(dateStr) {
  if (!dateStr) return 'Never';
  const days = daysAgo(dateStr);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─── Main Component ─────────────────────────────────────────────
export default function Customers() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterTemp, setFilterTemp] = useState('');
  const [viewMode, setViewMode] = useState('list'); // list | pipeline

  // Detail panel
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const [customerFollowUps, setCustomerFollowUps] = useState([]);

  // Dialogs
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [addFollowUpOpen, setAddFollowUpOpen] = useState(false);

  // Forms
  const [customerForm, setCustomerForm] = useState({ full_name: '', email: '', phone: '', company_name: '', source: '', estimated_value: '', crm_stage: 'prospect' });
  const [activityForm, setActivityForm] = useState({ type: 'note', title: '', description: '' });
  const [followUpForm, setFollowUpForm] = useState({ type: 'follow_up', title: '', description: '', due_at: '', priority: 'normal' });

  // LABOS Leads
  const [activeTab, setActiveTab] = useState('crm'); // 'crm' | 'labos'
  const [labosLeads, setLabosLeads] = useState([]);
  const [labosLoading, setLabosLoading] = useState(false);
  const [labosSearch, setLabosSearch] = useState('');

  useEffect(() => {
    fetchCustomers();
    fetchAllFollowUps();
    fetchLabosLeads();
  }, []);

  async function fetchCustomers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, full_name, email, role, phone, company_name, crm_stage, lead_score, lead_temperature,
          last_activity_at, next_follow_up_at, follow_up_notes, source, estimated_value, tags,
          waitlist_signup_id, created_at, updated_at,
          projects:projects!projects_customer_id_fkey (id, name, status, tier, mrr, created_at)
        `)
        .eq('role', 'customer')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllFollowUps() {
    try {
      const { data } = await supabase
        .from('customer_follow_ups')
        .select('*, customer:profiles(full_name, email)')
        .is('completed_at', null)
        .order('due_at', { ascending: true });
      setFollowUps(data || []);
    } catch (err) {
      console.error('Error fetching follow-ups:', err);
    }
  }

  async function fetchActivities(customerId) {
    const { data } = await supabase
      .from('customer_activities')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(50);
    setActivities(data || []);
  }

  async function fetchCustomerFollowUps(customerId) {
    const { data } = await supabase
      .from('customer_follow_ups')
      .select('*')
      .eq('customer_id', customerId)
      .order('due_at', { ascending: true });
    setCustomerFollowUps(data || []);
  }

  // ─── LABOS Leads ──────────────────────────────────────────────
  async function fetchLabosLeads() {
    setLabosLoading(true);
    try {
      const { data, error } = await supabase
        .from('labos_signups')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLabosLeads(data || []);
    } catch (err) {
      console.error('Error fetching LABOS leads:', err);
    } finally {
      setLabosLoading(false);
    }
  }

  async function importLabosToCRM(lead) {
    try {
      // Check if already imported (email match)
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', lead.email)
        .eq('role', 'customer')
        .maybeSingle();

      if (existing) {
        toast.error(`${lead.email} is already in CRM`);
        return;
      }

      const tierValues = { starter: 49, growth: 149, business: 299, enterprise: 499 };
      const estValue = tierValues[lead.interest_tier] || 0;

      const { data: newCustomer, error } = await supabase.from('profiles').insert({
        full_name: lead.full_name,
        email: lead.email,
        phone: lead.phone || null,
        company_name: lead.company_name || null,
        source: 'LABOS Signup',
        estimated_value: estValue,
        crm_stage: 'prospect',
        lead_temperature: 'hot',
        role: 'customer',
      }).select().single();
      if (error) throw error;

      // Log activity with LABOS context
      const deptList = (lead.departments_needed || []).join(', ');
      await logActivity(newCustomer.id, 'system', 'Imported from LABOS signup',
        `Company: ${lead.company_name || 'N/A'} | Size: ${lead.company_size || 'N/A'} | Tier: ${lead.interest_tier || 'Undecided'} | Departments: ${deptList || 'N/A'} | Tools: ${lead.current_tools || 'N/A'} | Pain: ${lead.biggest_pain || 'N/A'}`
      );

      // Update LABOS signup status
      await supabase.from('labos_signups')
        .update({ status: 'imported_to_crm', updated_at: new Date().toISOString() })
        .eq('id', lead.id);

      toast.success(`${lead.full_name} imported to CRM as Hot Prospect`);
      fetchCustomers();
      fetchLabosLeads();
    } catch (err) {
      console.error('Error importing LABOS lead:', err);
      toast.error('Failed to import lead');
    }
  }

  const filteredLabosLeads = useMemo(() => {
    if (!labosSearch) return labosLeads;
    const q = labosSearch.toLowerCase();
    return labosLeads.filter(l =>
      l.full_name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.company_name?.toLowerCase().includes(q)
    );
  }, [labosLeads, labosSearch]);

  // ─── Add Customer ─────────────────────────────────────────────
  async function handleAddCustomer(e) {
    e.preventDefault();
    if (!customerForm.full_name || !customerForm.email) {
      toast.error('Name and email are required');
      return;
    }
    try {
      const { data: newCustomer, error } = await supabase.from('profiles').insert({
        full_name: customerForm.full_name,
        email: customerForm.email,
        phone: customerForm.phone || null,
        company_name: customerForm.company_name || null,
        source: customerForm.source || 'Direct',
        estimated_value: parseFloat(customerForm.estimated_value) || 0,
        crm_stage: customerForm.crm_stage || 'prospect',
        lead_temperature: 'warm',
        role: 'customer',
      }).select().single();
      if (error) throw error;

      // Log activity
      await logActivity(newCustomer.id, 'system', 'Customer created', `Added to CRM as ${customerForm.crm_stage}`);

      toast.success(`${customerForm.full_name} added to CRM`);
      setCustomerForm({ full_name: '', email: '', phone: '', company_name: '', source: '', estimated_value: '', crm_stage: 'prospect' });
      setAddCustomerOpen(false);
      fetchCustomers();
    } catch (err) {
      console.error('Error adding customer:', err);
      toast.error('Failed to add customer');
    }
  }

  // ─── Stage Change ─────────────────────────────────────────────
  async function changeStage(customerId, newStage, customerName) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ crm_stage: newStage, updated_at: new Date().toISOString() })
        .eq('id', customerId);
      if (error) throw error;

      await logActivity(customerId, 'status_change', `Moved to ${STAGE_MAP[newStage]?.label}`, `Stage changed to ${newStage}`);

      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, crm_stage: newStage } : c));
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer(prev => ({ ...prev, crm_stage: newStage }));
        fetchActivities(customerId);
      }
      toast.success(`${customerName || 'Customer'} moved to ${STAGE_MAP[newStage]?.label}`);
    } catch (err) {
      toast.error('Failed to update stage');
    }
  }

  // ─── Log Activity ─────────────────────────────────────────────
  async function logActivity(customerId, type, title, description) {
    await supabase.from('customer_activities').insert({
      customer_id: customerId,
      type,
      title,
      description,
      created_by: user?.id,
      created_by_name: profile?.full_name || user?.email,
    });

    // Update last_activity_at
    await supabase.from('profiles')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', customerId);
  }

  async function handleAddActivity(e) {
    e.preventDefault();
    if (!activityForm.title || !selectedCustomer) return;
    try {
      await logActivity(selectedCustomer.id, activityForm.type, activityForm.title, activityForm.description);
      setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, last_activity_at: new Date().toISOString() } : c));
      setSelectedCustomer(prev => ({ ...prev, last_activity_at: new Date().toISOString() }));
      toast.success('Activity logged');
      setActivityForm({ type: 'note', title: '', description: '' });
      setAddActivityOpen(false);
      fetchActivities(selectedCustomer.id);
    } catch (err) {
      toast.error('Failed to log activity');
    }
  }

  // ─── Follow-Ups ───────────────────────────────────────────────
  async function handleAddFollowUp(e) {
    e.preventDefault();
    if (!followUpForm.title || !followUpForm.due_at || !selectedCustomer) return;
    try {
      const { error } = await supabase.from('customer_follow_ups').insert({
        customer_id: selectedCustomer.id,
        type: followUpForm.type,
        title: followUpForm.title,
        description: followUpForm.description || null,
        due_at: new Date(followUpForm.due_at).toISOString(),
        priority: followUpForm.priority,
        assigned_to: user?.id,
        assigned_to_name: profile?.full_name || user?.email,
        created_by: user?.id,
      });
      if (error) throw error;

      // Update next_follow_up on profile
      await supabase.from('profiles')
        .update({ next_follow_up_at: new Date(followUpForm.due_at).toISOString(), follow_up_notes: followUpForm.title })
        .eq('id', selectedCustomer.id);

      await logActivity(selectedCustomer.id, 'follow_up', `Follow-up scheduled: ${followUpForm.title}`, `Due: ${followUpForm.due_at}`);

      toast.success('Follow-up scheduled');
      setFollowUpForm({ type: 'follow_up', title: '', description: '', due_at: '', priority: 'normal' });
      setAddFollowUpOpen(false);
      fetchCustomerFollowUps(selectedCustomer.id);
      fetchAllFollowUps();
      fetchActivities(selectedCustomer.id);
    } catch (err) {
      toast.error('Failed to schedule follow-up');
    }
  }

  async function completeFollowUp(followUp) {
    try {
      await supabase.from('customer_follow_ups')
        .update({ completed_at: new Date().toISOString(), completed_by: user?.id })
        .eq('id', followUp.id);
      await logActivity(followUp.customer_id, 'follow_up', `Completed: ${followUp.title}`, 'Follow-up marked as done');
      toast.success('Follow-up completed');
      fetchCustomerFollowUps(followUp.customer_id);
      fetchAllFollowUps();
      if (selectedCustomer?.id === followUp.customer_id) fetchActivities(followUp.customer_id);
    } catch (err) {
      toast.error('Failed to complete follow-up');
    }
  }

  // ─── Update Temperature ───────────────────────────────────────
  async function updateTemperature(customerId, temp) {
    await supabase.from('profiles').update({ lead_temperature: temp }).eq('id', customerId);
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, lead_temperature: temp } : c));
    if (selectedCustomer?.id === customerId) setSelectedCustomer(prev => ({ ...prev, lead_temperature: temp }));
  }

  // ─── Open Detail ──────────────────────────────────────────────
  function openDetail(customer) {
    setSelectedCustomer(customer);
    setDetailOpen(true);
    fetchActivities(customer.id);
    fetchCustomerFollowUps(customer.id);
  }

  // ─── Computed ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return customers.filter(c => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!c.full_name?.toLowerCase().includes(q) && !c.email?.toLowerCase().includes(q) && !c.company_name?.toLowerCase().includes(q)) return false;
      }
      if (filterStage && c.crm_stage !== filterStage) return false;
      if (filterTemp && c.lead_temperature !== filterTemp) return false;
      return true;
    });
  }, [customers, searchQuery, filterStage, filterTemp]);

  const pipelineCounts = useMemo(() => {
    const counts = {};
    CRM_STAGES.forEach(s => { counts[s.key] = 0; });
    customers.forEach(c => { if (counts[c.crm_stage] !== undefined) counts[c.crm_stage]++; });
    return counts;
  }, [customers]);

  const overdueFollowUps = followUps.filter(f => !f.completed_at && new Date(f.due_at) < new Date());
  const todayFollowUps = followUps.filter(f => {
    if (f.completed_at) return false;
    const due = new Date(f.due_at);
    const now = new Date();
    return due.toDateString() === now.toDateString();
  });

  const staleCustomers = customers.filter(c => {
    if (['won', 'active', 'churned'].includes(c.crm_stage)) return false;
    const days = daysAgo(c.last_activity_at || c.created_at);
    return days > 7;
  });

  const totalPipelineValue = customers
    .filter(c => !['churned', 'active', 'won'].includes(c.crm_stage))
    .reduce((sum, c) => sum + (parseFloat(c.estimated_value) || 0), 0);

  const totalMRR = customers.reduce((sum, c) => {
    return sum + (c.projects || []).reduce((ps, p) => ps + (parseFloat(p.mrr) || 0), 0);
  }, 0);

  const stats = {
    total: customers.length,
    active: customers.filter(c => ['active', 'won'].includes(c.crm_stage)).length,
    pipeline: customers.filter(c => !['churned', 'active', 'won'].includes(c.crm_stage)).length,
    atRisk: customers.filter(c => c.crm_stage === 'at_risk').length,
  };

  if (loading) return <div className="p-6 text-gray-400">Loading CRM...</div>;

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-sky-400" />
            Customers
          </h1>
          <p className="text-sm text-gray-400 mt-1">CRM pipeline — track every lead, close every deal</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-white/10 text-gray-300 hover:text-white" onClick={() => { fetchCustomers(); fetchAllFollowUps(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button onClick={() => setAddCustomerOpen(true)} className="bg-sky-500 hover:bg-sky-600 text-white gap-2">
            <UserPlus className="h-4 w-4" /> Add Customer
          </Button>
        </div>
      </div>

      {/* ── Tab Toggle ────────────────────────────────────────── */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('crm')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'crm' ? 'bg-sky-500 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Users className="h-4 w-4" /> CRM Pipeline
          <span className="ml-1 text-xs opacity-70">({customers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('labos')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'labos' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Cpu className="h-4 w-4" /> LABOS Leads
          <span className="ml-1 text-xs opacity-70">({labosLeads.length})</span>
          {labosLeads.filter(l => l.status === 'new').length > 0 && (
            <span className="bg-emerald-400 text-emerald-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
              {labosLeads.filter(l => l.status === 'new').length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'labos' ? (
        /* ═══ LABOS LEADS TAB ═══════════════════════════════════ */
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Signups', value: labosLeads.length, color: 'text-emerald-400', icon: Cpu },
              { label: 'New (Unreviewed)', value: labosLeads.filter(l => l.status === 'new').length, color: 'text-sky-400', icon: Bell },
              { label: 'Imported to CRM', value: labosLeads.filter(l => l.status === 'imported_to_crm').length, color: 'text-green-400', icon: CheckCircle },
              { label: 'Enterprise Interest', value: labosLeads.filter(l => l.interest_tier === 'enterprise').length, color: 'text-purple-400', icon: Star },
            ].map(stat => (
              <Card key={stat.label} className="bg-navy-800/50 border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{stat.label}</span>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div className="text-2xl font-bold text-white mt-1">{stat.value}</div>
              </Card>
            ))}
          </div>

          {/* Search */}
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search LABOS leads..."
                value={labosSearch}
                onChange={e => setLabosSearch(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white"
              />
            </div>
            <Button variant="outline" size="sm" className="border-white/10 text-gray-300" onClick={fetchLabosLeads}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>

          {/* Table */}
          {labosLoading ? (
            <div className="text-gray-400 text-sm p-8 text-center">Loading LABOS leads...</div>
          ) : filteredLabosLeads.length === 0 ? (
            <Card className="bg-navy-800/50 border-white/10 p-12 text-center">
              <Cpu className="h-12 w-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No LABOS signups yet.</p>
              <p className="text-gray-500 text-sm mt-1">Leads from the Business OS signup form will appear here.</p>
            </Card>
          ) : (
            <Card className="bg-navy-800/50 border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="px-4 py-3 text-gray-400 font-medium">Name</th>
                      <th className="px-4 py-3 text-gray-400 font-medium">Company</th>
                      <th className="px-4 py-3 text-gray-400 font-medium">Size</th>
                      <th className="px-4 py-3 text-gray-400 font-medium">Tier</th>
                      <th className="px-4 py-3 text-gray-400 font-medium">Departments</th>
                      <th className="px-4 py-3 text-gray-400 font-medium">Status</th>
                      <th className="px-4 py-3 text-gray-400 font-medium">Signed Up</th>
                      <th className="px-4 py-3 text-gray-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLabosLeads.map(lead => {
                      const tierColors = { starter: 'bg-blue-100 text-blue-800', growth: 'bg-purple-100 text-purple-800', business: 'bg-emerald-100 text-emerald-800', enterprise: 'bg-amber-100 text-amber-800' };
                      const statusColors = { new: 'bg-sky-100 text-sky-800', contacted: 'bg-amber-100 text-amber-800', imported_to_crm: 'bg-green-100 text-green-800', closed: 'bg-gray-100 text-gray-800' };
                      return (
                        <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-white font-medium">{lead.full_name}</div>
                            <div className="text-gray-500 text-xs">{lead.email}</div>
                            {lead.phone && <div className="text-gray-500 text-xs">{lead.phone}</div>}
                          </td>
                          <td className="px-4 py-3 text-gray-300">{lead.company_name || <span className="text-gray-600">—</span>}</td>
                          <td className="px-4 py-3 text-gray-300">{lead.company_size || <span className="text-gray-600">—</span>}</td>
                          <td className="px-4 py-3">
                            {lead.interest_tier ? (
                              <Badge className={`text-xs ${tierColors[lead.interest_tier] || 'bg-gray-100 text-gray-800'}`}>
                                {lead.interest_tier.charAt(0).toUpperCase() + lead.interest_tier.slice(1)}
                              </Badge>
                            ) : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(lead.departments_needed || []).slice(0, 3).map(d => (
                                <span key={d} className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded">{d}</span>
                              ))}
                              {(lead.departments_needed || []).length > 3 && (
                                <span className="text-xs text-gray-500">+{lead.departments_needed.length - 3}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`text-xs ${statusColors[lead.status] || statusColors.new}`}>
                              {(lead.status || 'new').replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{formatRelative(lead.created_at)}</td>
                          <td className="px-4 py-3">
                            {lead.status !== 'imported_to_crm' ? (
                              <Button
                                size="sm"
                                onClick={() => importLabosToCRM(lead)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs gap-1"
                              >
                                <Download className="h-3 w-3" /> Import to CRM
                              </Button>
                            ) : (
                              <span className="text-green-400 text-xs flex items-center gap-1"><CheckCircle className="h-3 w-3" /> In CRM</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Pain Points Summary */}
          {labosLeads.filter(l => l.biggest_pain).length > 0 && (
            <Card className="bg-navy-800/50 border-white/10 p-5">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-amber-400" /> Common Pain Points
              </h3>
              <div className="space-y-2">
                {labosLeads.filter(l => l.biggest_pain).slice(0, 5).map(l => (
                  <div key={l.id} className="text-sm text-gray-400 flex gap-2">
                    <span className="text-gray-600 flex-shrink-0">{l.company_name || l.full_name}:</span>
                    <span className="text-gray-300">{l.biggest_pain}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : (
      <>
      {/* ── Alert Bar ─────────────────────────────────────────── */}
      {(overdueFollowUps.length > 0 || todayFollowUps.length > 0 || staleCustomers.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {overdueFollowUps.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-300">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span><strong>{overdueFollowUps.length}</strong> overdue follow-up{overdueFollowUps.length > 1 ? 's' : ''}</span>
            </div>
          )}
          {todayFollowUps.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-300">
              <Bell className="h-4 w-4 flex-shrink-0" />
              <span><strong>{todayFollowUps.length}</strong> follow-up{todayFollowUps.length > 1 ? 's' : ''} due today</span>
            </div>
          )}
          {staleCustomers.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300">
              <Snowflake className="h-4 w-4 flex-shrink-0" />
              <span><strong>{staleCustomers.length}</strong> lead{staleCustomers.length > 1 ? 's' : ''} going cold (no activity 7+ days)</span>
            </div>
          )}
        </div>
      )}

      {/* ── Stats Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Customers', value: stats.total, icon: Users, color: 'text-sky-400' },
          { label: 'In Pipeline', value: stats.pipeline, icon: Target, color: 'text-purple-400' },
          { label: 'Active / Won', value: stats.active, icon: CheckCircle, color: 'text-green-400' },
          { label: 'At Risk', value: stats.atRisk, icon: AlertTriangle, color: 'text-orange-400' },
          { label: 'Pipeline Value', value: `$${totalPipelineValue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400' },
        ].map(stat => (
          <Card key={stat.label} className="bg-navy-800/50 border-white/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{stat.label}</span>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold text-white mt-1">{stat.value}</div>
          </Card>
        ))}
      </div>

      {/* ── Pipeline Bar ──────────────────────────────────────── */}
      <Card className="bg-navy-800/50 border-white/10 p-4">
        <div className="flex items-center gap-1">
          {CRM_STAGES.map(stage => {
            const count = pipelineCounts[stage.key] || 0;
            const isFiltered = filterStage === stage.key;
            return (
              <button
                key={stage.key}
                onClick={() => setFilterStage(isFiltered ? '' : stage.key)}
                className={`flex-1 group relative transition-all ${isFiltered ? 'scale-105' : ''}`}
              >
                <div className={`h-3 rounded-full transition-colors ${count > 0 ? stage.color : 'bg-gray-700/50'} ${isFiltered ? 'ring-2 ring-white/30' : ''} group-hover:opacity-80`} />
                <div className="text-center mt-1.5">
                  <span className={`text-[10px] block ${isFiltered ? 'text-white font-bold' : 'text-gray-500'} group-hover:text-white transition-colors`}>
                    {stage.label}
                  </span>
                  <span className={`text-xs font-bold ${count > 0 ? 'text-white' : 'text-gray-600'}`}>{count}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search customers..."
            className="pl-10 bg-navy-800/50 border-white/10"
          />
        </div>
        <select
          value={filterTemp}
          onChange={e => setFilterTemp(e.target.value)}
          className="px-3 py-2 rounded-md bg-navy-800/50 border border-white/10 text-sm text-gray-300"
        >
          <option value="">All Temps</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>
        {filterStage && (
          <Button variant="ghost" size="sm" className="text-xs text-gray-400" onClick={() => setFilterStage('')}>
            Clear: {STAGE_MAP[filterStage]?.label} <XCircle className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>

      {/* ── Customer List ─────────────────────────────────────── */}
      <Card className="bg-navy-800/50 border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400">Customer</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400">Stage</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400">Temp</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400">Value</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400">Last Activity</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400">Next Follow-Up</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400">Projects</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(customer => {
                const isStale = !['won', 'active', 'churned'].includes(customer.crm_stage) && daysAgo(customer.last_activity_at || customer.created_at) > 7;
                const followUpOverdue = customer.next_follow_up_at && new Date(customer.next_follow_up_at) < new Date();
                return (
                  <tr
                    key={customer.id}
                    className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${isStale ? 'bg-blue-500/5' : ''} ${followUpOverdue ? 'bg-red-500/5' : ''}`}
                    onClick={() => openDetail(customer)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-sky-500/20 text-sky-400 text-xs">
                            {customer.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium text-white flex items-center gap-2">
                            {customer.full_name}
                            {isStale && <Snowflake className="h-3 w-3 text-blue-400" title="Going cold" />}
                            {followUpOverdue && <AlertTriangle className="h-3 w-3 text-red-400" title="Overdue follow-up" />}
                          </div>
                          <div className="text-xs text-gray-500">{customer.email}</div>
                          {customer.company_name && <div className="text-xs text-gray-600">{customer.company_name}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StageBadge stage={customer.crm_stage} /></td>
                    <td className="px-4 py-3"><TempBadge temp={customer.lead_temperature} /></td>
                    <td className="px-4 py-3 text-sm text-white font-medium">{customer.estimated_value ? `$${parseFloat(customer.estimated_value).toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${isStale ? 'text-blue-400 font-medium' : 'text-gray-400'}`}>
                        {formatRelative(customer.last_activity_at || customer.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {customer.next_follow_up_at ? (
                        <span className={`text-xs ${followUpOverdue ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                          {followUpOverdue && '⚠ '}{formatRelative(customer.next_follow_up_at)}
                          {customer.follow_up_notes && <span className="block text-gray-600 truncate max-w-[120px]">{customer.follow_up_notes}</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{customer.projects?.length || 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(customer)} title="View details">
                          <Eye className="h-3.5 w-3.5 text-sky-400" />
                        </Button>
                        {customer.crm_stage === 'prospect' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => changeStage(customer.id, 'qualified', customer.full_name)} title="Qualify">
                            <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-gray-500">
                    {customers.length === 0 ? 'No customers yet. Add your first lead to get started.' : 'No customers match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Upcoming Follow-Ups ───────────────────────────────── */}
      {followUps.filter(f => !f.completed_at).length > 0 && (
        <Card className="bg-navy-800/50 border-white/10 p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" /> Upcoming Follow-Ups
          </h3>
          <div className="space-y-2">
            {followUps.filter(f => !f.completed_at).slice(0, 8).map(f => {
              const overdue = new Date(f.due_at) < new Date();
              const isToday = new Date(f.due_at).toDateString() === new Date().toDateString();
              return (
                <div key={f.id} className={`flex items-center justify-between px-4 py-3 rounded-lg border ${overdue ? 'bg-red-500/10 border-red-500/20' : isToday ? 'bg-amber-500/10 border-amber-500/20' : 'bg-navy-900/50 border-white/5'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${overdue ? 'bg-red-500' : isToday ? 'bg-amber-500' : 'bg-gray-500'}`} />
                    <div>
                      <div className="text-sm text-white">{f.title}</div>
                      <div className="text-xs text-gray-400">{f.customer?.full_name} — {new Date(f.due_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs text-green-400" onClick={() => completeFollowUp(f)}>
                    <Check className="h-3 w-3 mr-1" /> Done
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      </>
      )}

      {/* ── Add Customer Dialog ───────────────────────────────── */}
      <Dialog open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
        <DialogContent className="bg-[#0B1120] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-sky-400" /> Add Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCustomer} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Full Name *</label>
                <Input value={customerForm.full_name} onChange={e => setCustomerForm(f => ({ ...f, full_name: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="John Smith" required />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Email *</label>
                <Input type="email" value={customerForm.email} onChange={e => setCustomerForm(f => ({ ...f, email: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="john@email.com" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Phone</label>
                <Input value={customerForm.phone} onChange={e => setCustomerForm(f => ({ ...f, phone: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="(555) 123-4567" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Company</label>
                <Input value={customerForm.company_name} onChange={e => setCustomerForm(f => ({ ...f, company_name: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="Acme Inc." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Source</label>
                <select value={customerForm.source} onChange={e => setCustomerForm(f => ({ ...f, source: e.target.value }))} className="w-full px-3 py-2 rounded-md bg-navy-800/50 border border-white/10 text-sm text-gray-300">
                  <option value="">Select source</option>
                  <option value="Waitlist">Waitlist</option>
                  <option value="Referral">Referral</option>
                  <option value="Website">Website</option>
                  <option value="Cold Outreach">Cold Outreach</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Direct">Direct</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Estimated Value ($)</label>
                <Input type="number" value={customerForm.estimated_value} onChange={e => setCustomerForm(f => ({ ...f, estimated_value: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="5000" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Starting Stage</label>
              <select value={customerForm.crm_stage} onChange={e => setCustomerForm(f => ({ ...f, crm_stage: e.target.value }))} className="w-full px-3 py-2 rounded-md bg-navy-800/50 border border-white/10 text-sm text-gray-300">
                {CRM_STAGES.slice(0, 5).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddCustomerOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-sky-500 hover:bg-sky-600">Add to CRM</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Customer Detail Panel ─────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-[#0B1120] border-white/10 text-white w-[95vw] max-w-[1400px] h-[90vh] overflow-y-auto p-0">
          {selectedCustomer && (
            <div className="flex flex-col h-full">
              {/* Hero Header */}
              <div className="px-8 pt-8 pb-6 border-b border-white/10 bg-gradient-to-r from-navy-800/80 to-[#0B1120]">
                <div className="flex items-start gap-5">
                  <Avatar className="h-16 w-16 ring-2 ring-sky-500/30">
                    <AvatarFallback className="bg-sky-500/20 text-sky-400 text-xl font-bold">
                      {selectedCustomer.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-2xl font-bold text-white">{selectedCustomer.full_name}</h2>
                      <StageBadge stage={selectedCustomer.crm_stage} />
                      <TempBadge temp={selectedCustomer.lead_temperature} />
                      {selectedCustomer.estimated_value > 0 && (
                        <span className="text-sm font-bold text-emerald-400">${parseFloat(selectedCustomer.estimated_value).toLocaleString()}</span>
                      )}
                    </div>
                    {selectedCustomer.company_name && <div className="text-sm text-gray-400 mt-0.5">{selectedCustomer.company_name}</div>}
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <span className="flex items-center gap-1.5 text-xs text-gray-300 bg-white/5 px-3 py-1.5 rounded-full">
                        <Mail className="h-3 w-3 text-gray-500" /> {selectedCustomer.email}
                      </span>
                      {selectedCustomer.phone && (
                        <span className="flex items-center gap-1.5 text-xs text-gray-300 bg-white/5 px-3 py-1.5 rounded-full">
                          <Phone className="h-3 w-3 text-gray-500" /> {selectedCustomer.phone}
                        </span>
                      )}
                      {selectedCustomer.source && (
                        <span className="flex items-center gap-1.5 text-xs text-gray-300 bg-white/5 px-3 py-1.5 rounded-full">
                          <CircleDot className="h-3 w-3 text-gray-500" /> {selectedCustomer.source}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-white/5 px-3 py-1.5 rounded-full">
                        <Clock className="h-3 w-3 text-gray-500" /> Added {new Date(selectedCustomer.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stage Progress */}
                <div className="flex items-center gap-1 mt-5">
                  {CRM_STAGES.map(s => {
                    const stageOrder = CRM_STAGES.map(st => st.key);
                    const currentIdx = stageOrder.indexOf(selectedCustomer.crm_stage);
                    const thisIdx = stageOrder.indexOf(s.key);
                    const isActive = thisIdx <= currentIdx;
                    const isCurrent = s.key === selectedCustomer.crm_stage;
                    return (
                      <button key={s.key} onClick={() => changeStage(selectedCustomer.id, s.key, selectedCustomer.full_name)} className="flex-1 group">
                        <div className={`h-2 rounded-full transition-colors ${isActive ? s.color : 'bg-gray-700/50'} group-hover:opacity-80`} />
                        <span className={`text-[10px] mt-1 block text-center ${isCurrent ? 'text-white font-semibold' : isActive ? 'text-gray-400' : 'text-gray-600'} group-hover:text-white`}>
                          {s.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 p-8 flex-1 overflow-y-auto">

                {/* Left (3/5): Activity Timeline */}
                <div className="lg:col-span-3 space-y-5">
                  {/* Projects */}
                  {selectedCustomer.projects?.length > 0 && (
                    <Card className="bg-navy-800/30 border-white/10 p-5">
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-emerald-400" /> Projects ({selectedCustomer.projects.length})
                      </h3>
                      <div className="space-y-2">
                        {selectedCustomer.projects.map(p => (
                          <div key={p.id} className="flex items-center justify-between bg-navy-900/50 rounded-lg p-3">
                            <div>
                              <div className="text-sm text-white font-medium">{p.name}</div>
                              <div className="text-xs text-gray-500">{p.status} {p.tier && `— ${p.tier}`}</div>
                            </div>
                            {p.mrr > 0 && <span className="text-xs font-bold text-emerald-400">${p.mrr}/mo</span>}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Activity Timeline */}
                  <Card className="bg-navy-800/30 border-white/10 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Activity className="h-4 w-4 text-sky-400" /> Activity Timeline
                      </h3>
                      <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-xs h-8" onClick={() => setAddActivityOpen(true)}>
                        <Plus className="h-3 w-3 mr-1" /> Log Activity
                      </Button>
                    </div>
                    <div className="relative">
                      {/* Timeline line */}
                      {activities.length > 0 && <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />}
                      <div className="space-y-4">
                        {activities.map(act => {
                          const aType = ACTIVITY_MAP[act.type] || ACTIVITY_MAP.note;
                          const Icon = aType.icon;
                          return (
                            <div key={act.id} className="flex gap-4 relative">
                              <div className={`w-8 h-8 rounded-full bg-navy-900 border border-white/10 flex items-center justify-center z-10 flex-shrink-0`}>
                                <Icon className={`h-3.5 w-3.5 ${aType.color}`} />
                              </div>
                              <div className="flex-1 pb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-white font-medium">{act.title}</span>
                                  <Badge className="text-[10px] bg-white/5 text-gray-400 border-0">{aType.label}</Badge>
                                </div>
                                {act.description && <p className="text-xs text-gray-400 mt-0.5">{act.description}</p>}
                                <div className="text-[10px] text-gray-600 mt-1">
                                  {act.created_by_name || 'System'} — {new Date(act.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {activities.length === 0 && (
                          <div className="text-center py-8 text-gray-600">
                            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-xs">No activity yet. Log a call, email, or note.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right (2/5): Actions + Follow-Ups */}
                <div className="lg:col-span-2 space-y-5">

                  {/* Quick Actions */}
                  <Card className="bg-navy-800/30 border-white/10 p-5">
                    <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Call', icon: PhoneCall, color: 'text-green-400 hover:bg-green-500/10', action: () => { setActivityForm({ type: 'call', title: '', description: '' }); setAddActivityOpen(true); } },
                        { label: 'Email', icon: Mail, color: 'text-sky-400 hover:bg-sky-500/10', action: () => { setActivityForm({ type: 'email', title: '', description: '' }); setAddActivityOpen(true); } },
                        { label: 'Meeting', icon: Video, color: 'text-purple-400 hover:bg-purple-500/10', action: () => { setActivityForm({ type: 'meeting', title: '', description: '' }); setAddActivityOpen(true); } },
                      ].map(a => (
                        <button key={a.label} onClick={a.action} className={`flex flex-col items-center gap-1 p-3 rounded-lg border border-white/5 ${a.color} transition-colors`}>
                          <a.icon className="h-5 w-5" />
                          <span className="text-[10px]">{a.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2">
                      <Button variant="outline" className="w-full text-sm border-white/10 text-gray-300 h-9" onClick={() => setAddFollowUpOpen(true)}>
                        <Timer className="h-4 w-4 mr-2 text-amber-400" /> Schedule Follow-Up
                      </Button>
                    </div>
                  </Card>

                  {/* Temperature */}
                  <Card className="bg-navy-800/30 border-white/10 p-5">
                    <h3 className="text-sm font-semibold text-white mb-3">Lead Temperature</h3>
                    <div className="flex gap-2">
                      {[
                        { key: 'hot', label: 'Hot', icon: Flame, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
                        { key: 'warm', label: 'Warm', icon: Thermometer, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
                        { key: 'cold', label: 'Cold', icon: Snowflake, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
                      ].map(t => (
                        <button
                          key={t.key}
                          onClick={() => updateTemperature(selectedCustomer.id, t.key)}
                          className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${selectedCustomer.lead_temperature === t.key ? t.bg : 'border-white/5 hover:bg-white/5'}`}
                        >
                          <t.icon className={`h-5 w-5 ${t.color}`} />
                          <span className={`text-xs ${selectedCustomer.lead_temperature === t.key ? 'text-white font-semibold' : 'text-gray-500'}`}>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </Card>

                  {/* Follow-Ups */}
                  <Card className="bg-navy-800/30 border-white/10 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Timer className="h-4 w-4 text-amber-400" /> Follow-Ups
                      </h3>
                      <Button size="sm" variant="ghost" className="text-xs text-sky-400 h-7" onClick={() => setAddFollowUpOpen(true)}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {customerFollowUps.filter(f => !f.completed_at).map(f => {
                        const overdue = new Date(f.due_at) < new Date();
                        return (
                          <div key={f.id} className={`flex items-center justify-between p-3 rounded-lg border ${overdue ? 'bg-red-500/10 border-red-500/20' : 'bg-navy-900/50 border-white/5'}`}>
                            <div>
                              <div className="text-xs text-white">{f.title}</div>
                              <div className={`text-[10px] ${overdue ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
                                {overdue ? 'OVERDUE — ' : ''}{new Date(f.due_at).toLocaleDateString()}
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" className="h-7 w-7 text-green-400" onClick={() => completeFollowUp(f)}>
                              <Check className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                      {customerFollowUps.filter(f => !f.completed_at).length === 0 && (
                        <p className="text-xs text-gray-600 text-center py-3">No pending follow-ups.</p>
                      )}
                      {/* Completed */}
                      {customerFollowUps.filter(f => f.completed_at).length > 0 && (
                        <div className="pt-2 border-t border-white/5">
                          <div className="text-[10px] text-gray-600 mb-1">Completed</div>
                          {customerFollowUps.filter(f => f.completed_at).slice(0, 3).map(f => (
                            <div key={f.id} className="flex items-center gap-2 text-xs text-gray-600 py-1">
                              <CheckCircle className="h-3 w-3 text-green-600" />
                              <span className="line-through">{f.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Move Stage */}
                  <Card className="bg-navy-800/30 border-white/10 p-5">
                    <h3 className="text-sm font-semibold text-white mb-3">Move Stage</h3>
                    <div className="space-y-1.5">
                      {CRM_STAGES.map(s => (
                        <button
                          key={s.key}
                          onClick={() => changeStage(selectedCustomer.id, s.key, selectedCustomer.full_name)}
                          disabled={selectedCustomer.crm_stage === s.key}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                            selectedCustomer.crm_stage === s.key
                              ? 'bg-sky-500/20 text-sky-400 font-medium border border-sky-500/30'
                              : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                          {s.label}
                          {selectedCustomer.crm_stage === s.key && <Check className="h-3.5 w-3.5 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Log Activity Dialog ───────────────────────────────── */}
      <Dialog open={addActivityOpen} onOpenChange={setAddActivityOpen}>
        <DialogContent className="bg-[#0B1120] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-sky-400" /> Log Activity</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddActivity} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Type</label>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_TYPES.filter(a => a.key !== 'status_change' && a.key !== 'system').map(a => {
                  const Icon = a.icon;
                  const isSelected = activityForm.type === a.key;
                  return (
                    <button key={a.key} type="button" onClick={() => setActivityForm(f => ({ ...f, type: a.key }))}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-colors ${isSelected ? 'bg-sky-500/20 border-sky-500/30 text-sky-400' : 'border-white/10 text-gray-400 hover:text-white'}`}>
                      <Icon className={`h-3.5 w-3.5 ${isSelected ? a.color : ''}`} /> {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Title *</label>
              <Input value={activityForm.title} onChange={e => setActivityForm(f => ({ ...f, title: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="Called to discuss project scope" required />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Notes</label>
              <Textarea value={activityForm.description} onChange={e => setActivityForm(f => ({ ...f, description: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="Details..." rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddActivityOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-sky-500 hover:bg-sky-600">Log Activity</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Schedule Follow-Up Dialog ─────────────────────────── */}
      <Dialog open={addFollowUpOpen} onOpenChange={setAddFollowUpOpen}>
        <DialogContent className="bg-[#0B1120] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Timer className="h-5 w-5 text-amber-400" /> Schedule Follow-Up</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddFollowUp} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Type</label>
              <select value={followUpForm.type} onChange={e => setFollowUpForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 rounded-md bg-navy-800/50 border border-white/10 text-sm text-gray-300">
                {FOLLOW_UP_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Title *</label>
              <Input value={followUpForm.title} onChange={e => setFollowUpForm(f => ({ ...f, title: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="Follow up on proposal" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Due Date *</label>
                <Input type="datetime-local" value={followUpForm.due_at} onChange={e => setFollowUpForm(f => ({ ...f, due_at: e.target.value }))} className="bg-navy-800/50 border-white/10" required />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Priority</label>
                <select value={followUpForm.priority} onChange={e => setFollowUpForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2 rounded-md bg-navy-800/50 border border-white/10 text-sm text-gray-300">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Notes</label>
              <Textarea value={followUpForm.description} onChange={e => setFollowUpForm(f => ({ ...f, description: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="Context for the follow-up..." rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddFollowUpOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-black">Schedule</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
