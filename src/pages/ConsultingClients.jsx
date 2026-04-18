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
          onClick={() => setShowNewDialog(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition"
        >
          <Plus className="w-4 h-4" />
          New Client
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

      {/* New Client Dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 px-6 py-4 border-b border-slate-700 bg-slate-900">
              <h2 className="text-lg font-bold">New Consulting Client</h2>
              <p className="text-sm text-gray-400 mt-1">Create a new consulting engagement</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Client Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Client Name *</label>
                <input
                  type="text"
                  value={form.client_name}
                  onChange={e => setForm(prev => ({ ...prev, client_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  placeholder="e.g., Jane Smith"
                />
              </div>

              {/* Client Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Client Email *</label>
                <input
                  type="email"
                  value={form.client_email}
                  onChange={e => setForm(prev => ({ ...prev, client_email: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  placeholder="jane@company.com"
                />
              </div>

              {/* Client Phone */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Client Phone</label>
                <input
                  type="tel"
                  value={form.client_phone}
                  onChange={e => setForm(prev => ({ ...prev, client_phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Company Name *</label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={e => setForm(prev => ({ ...prev, company_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  placeholder="e.g., Acme Corp"
                />
              </div>

              {/* Industry */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Industry</label>
                <input
                  type="text"
                  value={form.industry}
                  onChange={e => setForm(prev => ({ ...prev, industry: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  placeholder="e.g., SaaS"
                />
              </div>

              {/* Engagement Tier */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Engagement Tier</label>
                <select
                  value={form.engagement_tier}
                  onChange={e => setForm(prev => ({ ...prev, engagement_tier: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="discovery">Discovery Call</option>
                  <option value="audit">Business Audit</option>
                  <option value="weekly_advisory">Weekly Advisory</option>
                  <option value="annual_contract">Annual Contract</option>
                </select>
              </div>

              {/* Lead Source */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Lead Source</label>
                <select
                  value={form.lead_source}
                  onChange={e => setForm(prev => ({ ...prev, lead_source: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="">— Select source —</option>
                  {LEAD_SOURCES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Engagement Stage */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Starting Stage</label>
                <select
                  value={form.engagement_stage}
                  onChange={e => setForm(prev => ({ ...prev, engagement_stage: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                >
                  {PIPELINE_STAGES.map(stage => (
                    <option key={stage.id} value={stage.id}>{stage.label}</option>
                  ))}
                </select>
              </div>

              {/* Team Assignments */}
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-700/60 bg-slate-800/30 p-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Consultant</label>
                  <TeamMemberSelect
                    value={form.consultant_id}
                    onChange={(uuid) => setForm(prev => ({ ...prev, consultant_id: uuid || '' }))}
                    placeholder="Pick consultant"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Team member delivering the engagement.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Selling Team Member</label>
                  <TeamMemberSelect
                    value={form.sales_rep_id}
                    onChange={(uuid) => setForm(prev => ({ ...prev, sales_rep_id: uuid || '' }))}
                    placeholder="Pick sales rep"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Rep credited with the sale (commission attaches here).</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Discovery Call Team Member</label>
                  <TeamMemberSelect
                    value={form.discovery_rep_id}
                    onChange={(uuid) => setForm(prev => ({ ...prev, discovery_rep_id: uuid || '' }))}
                    placeholder="Pick discovery rep"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Who ran the discovery call (may differ from closer).</p>
                </div>
              </div>

              {/* Contract Value */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contract Value</label>
                <input
                  type="number"
                  value={form.contract_value}
                  onChange={e => setForm(prev => ({ ...prev, contract_value: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              {/* Weekly Meeting Day */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Weekly Meeting Day</label>
                <select
                  value={form.weekly_meeting_day}
                  onChange={e => setForm(prev => ({ ...prev, weekly_meeting_day: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                >
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <option key={idx} value={idx}>{day}</option>
                  ))}
                </select>
              </div>

              {/* Weekly Meeting Time */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Weekly Meeting Time</label>
                <input
                  type="time"
                  value={form.weekly_meeting_time}
                  onChange={e => setForm(prev => ({ ...prev, weekly_meeting_time: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Health Score */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Initial Health Score (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={form.health_score}
                  onChange={e => setForm(prev => ({ ...prev, health_score: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 min-h-[80px]"
                  placeholder="Any additional notes..."
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewDialog(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm font-semibold text-gray-300 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin inline mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Client'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
