/**
 * Consulting Clients — Manage active consulting engagements
 *
 * Lists all consulting clients through the consulting pipeline:
 * lead → audit → plan_presentation → plan_adjustments → implementation → ongoing → completed
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import {
  Plus, Search, Building2, Heart, Target, Users, Calendar,
  Clock, ChevronRight, Loader2, AlertTriangle, CheckCircle,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import TeamMemberSelect from '../components/TeamMemberSelect';

const LEAD_SOURCES = [
  { value: 'inbound_web', label: 'Inbound (Website)' },
  { value: 'referral', label: 'Referral' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'affiliate', label: 'Affiliate' },
  { value: 'event', label: 'Event / Conference' },
  { value: 'partner', label: 'Partner' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'social', label: 'Social Media' },
  { value: 'other', label: 'Other' },
];

const PIPELINE_STAGES = [
  { id: 'lead', label: 'Lead', color: 'blue' },
  { id: 'audit', label: 'Business Audit', color: 'indigo' },
  { id: 'plan_presentation', label: 'Plan Presentation', color: 'purple' },
  { id: 'plan_adjustments', label: 'Plan Adjustments', color: 'amber' },
  { id: 'implementation', label: 'Implementation', color: 'orange' },
  { id: 'ongoing', label: 'Ongoing / Weekly L10s', color: 'emerald' },
  { id: 'completed', label: 'Completed', color: 'green' }
];

const STAGE_BADGES = {
  lead: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  audit: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  plan_presentation: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  plan_adjustments: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  implementation: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  ongoing: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30'
};

const ENGAGEMENT_TYPES = {
  discovery: 'Discovery Call',
  audit: 'Business Audit',
  weekly_advisory: 'Weekly Advisory',
  annual_contract: 'Annual Contract'
};

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getHealthColor(score) {
  if (score <= 3) return 'text-red-400 bg-red-500/10';
  if (score <= 6) return 'text-amber-400 bg-amber-500/10';
  if (score <= 8) return 'text-emerald-400 bg-emerald-500/10';
  return 'text-emerald-400 bg-emerald-500/10';
}

export default function ConsultingClients() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);

  /**
   * Create a minimal draft engagement record and navigate straight into the
   * 7-step ConsultingOnboardingWizard. The wizard's Step 1 (basics) collects
   * client_name / company_name / client_email — no need to ask twice.
   */
  async function startNewClientWizard() {
    if (creatingDraft) return;
    setCreatingDraft(true);
    try {
      const { data: inserted, error } = await supabase
        .from('consulting_engagements')
        .insert({
          client_name: 'New Client',
          company_name: 'Untitled',
          engagement_tier: 'discovery',
          engagement_stage: 'lead',
          consultant_id: user?.id || null,
          health_score: 5,
          onboarding_step: 1,
          onboarding_completed: false,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      if (inserted?.id) {
        navigate(`/admin/consulting/onboard/${inserted.id}`);
      }
    } catch (err) {
      console.error('Draft engagement create failed:', err);
      toast.error(err?.message || 'Could not start onboarding wizard');
    } finally {
      setCreatingDraft(false);
    }
  }

  // Form state
  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    company_name: '',
    industry: '',
    engagement_tier: 'discovery',
    engagement_stage: 'lead',
    consultant_id: user?.id || '',
    sales_rep_id: '',
    discovery_rep_id: '',
    lead_source: '',
    contract_value: '',
    weekly_meeting_day: '1',
    weekly_meeting_time: '10:00',
    notes: '',
    health_score: 5
  });

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('consulting_engagements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Failed to load consulting clients');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.client_name || !form.client_email || !form.company_name) {
      toast.error('Fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { data: inserted, error } = await supabase.from('consulting_engagements').insert({
        client_name: form.client_name,
        client_email: form.client_email,
        client_phone: form.client_phone || null,
        company_name: form.company_name,
        industry: form.industry || null,
        engagement_tier: form.engagement_tier,
        engagement_stage: form.engagement_stage,
        consultant_id: form.consultant_id || null,
        sales_rep_id: form.sales_rep_id || null,
        discovery_rep_id: form.discovery_rep_id || null,
        lead_source: form.lead_source || null,
        contract_value: form.contract_value ? parseFloat(form.contract_value) : null,
        weekly_meeting_day: form.weekly_meeting_day,
        weekly_meeting_time: form.weekly_meeting_time,
        notes: form.notes || null,
        health_score: parseInt(form.health_score),
        onboarding_step: 1,
        onboarding_completed: false,
        created_at: new Date().toISOString()
      }).select().single();

      if (error) throw error;

      toast.success('Client engagement created — starting onboarding');
      setShowNewDialog(false);
      if (inserted?.id) {
        navigate(`/admin/consulting/onboard/${inserted.id}`);
        return;
      }
      setForm({
        client_name: '',
        client_email: '',
        client_phone: '',
        company_name: '',
        industry: '',
        engagement_tier: 'discovery',
        engagement_stage: 'lead',
        consultant_id: user?.id || '',
        sales_rep_id: '',
        discovery_rep_id: '',
        lead_source: '',
        contract_value: '',
        weekly_meeting_day: '1',
        weekly_meeting_time: '10:00',
        notes: '',
        health_score: 5
      });
      fetchClients();
    } catch (err) {
      console.error('Submit error:', err);
      toast.error('Failed to create engagement: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Calculate stats
  const stats = useMemo(() => {
    const total = clients.length;
    const inAuditOrPlan = clients.filter(c =>
      ['audit', 'plan_presentation', 'plan_adjustments'].includes(c.engagement_stage)
    ).length;
    const inImplementation = clients.filter(c => c.engagement_stage === 'implementation').length;
    const ongoing = clients.filter(c => c.engagement_stage === 'ongoing').length;

    return { total, inAuditOrPlan, inImplementation, ongoing };
  }, [clients]);

  // Pipeline bar with counts
  const stageCounts = useMemo(() => {
    const counts = {};
    PIPELINE_STAGES.forEach(s => {
      counts[s.id] = clients.filter(c => c.engagement_stage === s.id).length;
    });
    return counts;
  }, [clients]);

  // Filter clients
  const filteredClients = useMemo(() => {
    let result = clients;

    if (selectedStage) {
      result = result.filter(c => c.engagement_stage === selectedStage);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.client_name?.toLowerCase().includes(q) ||
        c.client_email?.toLowerCase().includes(q) ||
        c.company_name?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [clients, selectedStage, search]);

  function formatDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    let hr = parseInt(h);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    if (hr > 12) hr -= 12;
    if (hr === 0) hr = 12;
    return `${hr}:${m} ${ampm}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Consulting Clients</h1>
          <p className="text-sm text-gray-400 mt-1">Manage active consulting engagements across the pipeline</p>
        </div>
        <button
          onClick={startNewClientWizard}
          disabled={creatingDraft}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          {creatingDraft ? 'Starting…' : 'New Client'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Clients', value: stats.total, icon: Users, color: 'text-blue-400 bg-blue-500/10' },
          { label: 'In Audit/Plan', value: stats.inAuditOrPlan, icon: Target, color: 'text-purple-400 bg-purple-500/10' },
          { label: 'In Implementation', value: stats.inImplementation, icon: Activity, color: 'text-orange-400 bg-orange-500/10' },
          { label: 'Ongoing', value: stats.ongoing, icon: CheckCircle, color: 'text-emerald-400 bg-emerald-500/10' }
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{stat.label}</span>
              <div className={`p-1.5 rounded-lg ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Pipeline Bar */}
      <div className="mb-6 bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Pipeline</p>
        <div className="flex gap-2">
          {PIPELINE_STAGES.map(stage => (
            <button
              key={stage.id}
              onClick={() => setSelectedStage(selectedStage === stage.id ? null : stage.id)}
              className={`flex-1 px-3 py-2.5 rounded-lg text-center transition border text-sm font-semibold ${
                selectedStage === stage.id
                  ? `bg-${stage.color}-600/20 border-${stage.color}-500/30 text-${stage.color}-400`
                  : `bg-slate-700/30 border-slate-600 text-gray-400 hover:text-gray-300`
              }`}
            >
              <div className="font-semibold">{stage.label}</div>
              <div className={`text-xs mt-0.5 ${selectedStage === stage.id ? 'opacity-100' : 'opacity-75'}`}>
                {stageCounts[stage.id]}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by client name, email, or company..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Health</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Consultant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Next Meeting</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Started</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  {search || selectedStage ? 'No matching clients found.' : 'No consulting clients yet. Create one to get started.'}
                </td>
              </tr>
            ) : (
              filteredClients.map(client => (
                <tr key={client.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition">
                  {/* Client */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-500/15 rounded-full flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{client.client_name}</p>
                        <p className="text-xs text-gray-500">{client.company_name}</p>
                      </div>
                    </div>
                  </td>

                  {/* Stage */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${STAGE_BADGES[client.engagement_stage] || STAGE_BADGES.lead}`}>
                      {PIPELINE_STAGES.find(s => s.id === client.engagement_stage)?.label}
                    </span>
                  </td>

                  {/* Health Score */}
                  <td className="px-4 py-3">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-slate-600 ${getHealthColor(client.health_score || 5)}`}>
                      <Heart className="w-3 h-3" />
                      {client.health_score || 5}/10
                    </div>
                  </td>

                  {/* Engagement Tier */}
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-300">{ENGAGEMENT_TYPES[client.engagement_tier] || client.engagement_tier || '—'}</p>
                  </td>

                  {/* Consultant */}
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-400">{client.consultant_name || 'Unassigned'}</p>
                  </td>

                  {/* Next Meeting */}
                  <td className="px-4 py-3">
                    {client.weekly_meeting_day && client.weekly_meeting_time ? (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Calendar className="w-3 h-3" />
                        <span>{DAYS_OF_WEEK[parseInt(client.weekly_meeting_day)]}</span>
                        <span className="text-gray-600">@</span>
                        <span>{formatTime(client.weekly_meeting_time)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>

                  {/* Started */}
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-400">{formatDate(client.created_at)}</p>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate(`/admin/consulting/client/${client.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 border border-purple-500/30 rounded-lg text-xs font-semibold text-purple-400 hover:bg-purple-600/30 transition"
                    >
                      View
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
